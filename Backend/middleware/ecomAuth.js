import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import EcomUser from '../models/EcomUser.js';
import Store from '../models/Store.js';
import EcomWorkspace from '../models/Workspace.js';

// Clé secrète pour les tokens e-commerce (différente du système principal)
// WARNING: ECOM_JWT_SECRET must be set in production! Fallback is for development only.
const ECOM_JWT_SECRET = process.env.ECOM_JWT_SECRET || 'ecom-secret-key-change-in-production';

// Validate JWT secret in production
if (process.env.NODE_ENV === 'production' && ECOM_JWT_SECRET === 'ecom-secret-key-change-in-production') {
  console.error('🚨 SECURITY WARNING: Using default JWT secret in production! Set ECOM_JWT_SECRET environment variable.');
}

// Cache utilisateurs en mémoire (évite 1 requête MongoDB par appel API)
const userCache = new Map();
const USER_CACHE_TTL = 15000; // 15 secondes

function getCachedUser(userId) {
  const entry = userCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { userCache.delete(userId); return null; }
  return entry.user;
}

function setCachedUser(userId, user) {
  userCache.set(userId, { user, expiresAt: Date.now() + USER_CACHE_TTL });
}

export function hasRitaAgentAccess(user, roleOverride = null) {
  if (!user) return false;

  const effectiveRole = roleOverride || user.role;
  if (effectiveRole === 'super_admin') return true;
  if (effectiveRole !== 'ecom_admin') return false;

  return user.canAccessRitaAgent !== false;
}

// Periodic cleanup to prevent memory leak (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of userCache.entries()) {
    if (now > entry.expiresAt) {
      userCache.delete(userId);
    }
  }
}, 5 * 60 * 1000);

export function invalidateUserCache(userId) {
  userCache.delete(String(userId));
}

// Routes accessibles pendant l'onboarding « boutique d'abord » (nouveau compte
// admin sans boutique). Tout le reste renvoie 403 STORE_ONBOARDING_REQUIRED.
// Comparé au chemin complet (baseUrl + path).
const ONBOARDING_ALLOWED_PREFIXES = [
  '/api/ecom/auth',          // session, profil, join-workspace, logout
  '/api/ecom/stores',        // création de la boutique + check sous-domaine
  '/api/ecom/store-manage',  // config boutique (logo, couleur, devise…)
  '/api/ecom/store',         // thème / pages (storeAdmin)
  '/api/ecom/media-upload',  // upload du logo
  '/api/ecom/billing',       // choix d'un plan pendant l'inscription
  '/api/ecom/users/me',      // actions self-service du compte (dont suppression)
];

function isTokenRevokedForUser(decoded, user) {
  if (!user?.sessionRevokedAt) return false;
  const tokenIssuedAtMs = decoded?.iat ? decoded.iat * 1000 : 0;
  const revokedAtMs = new Date(user.sessionRevokedAt).getTime();
  return Boolean(revokedAtMs && (!tokenIssuedAtMs || tokenIssuedAtMs <= revokedAtMs));
}

// Fonction pour générer un identifiant d'appareil unique
const generateDeviceId = () => {
  return 'device_' + crypto.randomBytes(16).toString('hex');
};

// Fonction pour générer un token permanent par appareil
export const generatePermanentToken = async (user, deviceInfo) => {
  const deviceId = generateDeviceId();
  const permanentToken = 'perm:' + jwt.sign(
    { 
      id: user._id,
      email: user.email,
      role: user.role,
      workspaceId: user.workspaceId,
      deviceId: deviceId,
      type: 'permanent'
    },
    ECOM_JWT_SECRET,
    { expiresIn: '365d' } // Valide 1 an
  );

  // Sauvegarder le token et les infos de l'appareil
  user.deviceToken = permanentToken;
  user.deviceInfo = {
    deviceId: deviceId,
    userAgent: deviceInfo?.userAgent || '',
    platform: deviceInfo?.platform || 'unknown',
    lastSeen: new Date()
  };
  await user.save();

  return permanentToken;
};

// Middleware pour vérifier l'authentification e-commerce
export const requireEcomAuth = async (req, res, next) => {
  try {
    console.log('🔐 requireEcomAuth - Method:', req.method, 'URL:', req.url);
    const authHeader = req.header('Authorization');
    console.log('🔐 AuthHeader:', authHeader ? 'Bearer [hidden]' : 'MISSING');
    
    if (!authHeader) {
      console.log('❌ No auth header provided');
      return res.status(401).json({ success: false, message: 'Token manquant' });
    }

    let token = authHeader.startsWith('Bearer ') 
      ? authHeader.replace('Bearer ', '')
      : authHeader;
    token = token.replace(/^ecom:/, '').replace(/^perm:/, '');
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Token e-commerce manquant' });
    }

    let decoded;
    let user;

    try {
      decoded = jwt.verify(token, ECOM_JWT_SECRET);
      
      // Cache utilisateur — évite 1 requête MongoDB par appel API
      user = getCachedUser(decoded.id);
      if (!user) {
        user = await EcomUser.findById(decoded.id).select('-password');
        if (user) setCachedUser(decoded.id, user);
      }
      
      if (!user || !user.isActive) {
        return res.status(401).json({ success: false, message: 'Utilisateur e-commerce non trouvé ou inactif' });
      }

      if (isTokenRevokedForUser(decoded, user)) {
        invalidateUserCache(decoded.id);
        return res.status(401).json({ success: false, message: 'Session expirée. Veuillez vous reconnecter.' });
      }
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Token e-commerce invalide ou expiré' });
    }

    req.user = decoded;
    req.ecomUser = user;
    console.log('🔐 Auth successful - User ID:', decoded.id, 'Email:', user.email, 'Role:', user.role);

    // Déterminer le workspaceId actif :
    // 1. D'abord vérifier si la requête envoie un workspaceId (query, body ou header)
    // 2. Si oui ET l'utilisateur y a accès → l'utiliser
    // 3. Sinon → fallback sur le workspaceId par défaut de l'utilisateur en base
    const requestedWsId = req.query?.workspaceId || req.body?.workspaceId || req.headers['x-workspace-id'];
    console.log('🔐 User default workspaceId:', user.workspaceId);
    console.log('🔐 Requested workspaceId:', requestedWsId);

    if (requestedWsId && requestedWsId !== String(user.workspaceId)) {
      // Vérifier que l'utilisateur a accès au workspace demandé
      const hasAccess = user.hasWorkspaceAccess
        ? user.hasWorkspaceAccess(requestedWsId)
        : false;
      
      if (hasAccess) {
        req.workspaceId = requestedWsId;
        req.ecomUserRole = user.getRoleInWorkspace ? (user.getRoleInWorkspace(requestedWsId) || user.role) : user.role;
      } else {
        // Pas d'accès au workspace demandé → utiliser le workspace par défaut
        req.workspaceId = user.workspaceId;
        req.ecomUserRole = user.getRoleInWorkspace ? (user.getRoleInWorkspace(user.workspaceId) || user.role) : user.role;
      }
    } else {
      req.workspaceId = user.workspaceId;
      req.ecomUserRole = user.getRoleInWorkspace ? (user.getRoleInWorkspace(user.workspaceId) || user.role) : user.role;
    }
    
    // Résoudre activeStoreId depuis le header X-Store-Id (multi-store)
    const requestedStoreId = req.headers['x-store-id'];
    req.activeStoreIdSource = null;
    if (requestedStoreId && /^[0-9a-fA-F]{24}$/.test(requestedStoreId)) {
      try {
        const store = await Store.findOne({
          _id: requestedStoreId,
          workspaceId: req.workspaceId,
          isActive: true
        }).select('_id').lean();
        req.activeStoreId = store?._id || null;
        req.activeStoreIdSource = store ? 'header' : null;
      } catch (e) {
        req.activeStoreId = null;
        req.activeStoreIdSource = null;
      }
    } else {
      req.activeStoreId = null;
      req.activeStoreIdSource = null;
    }

    // Safety net: if no X-Store-Id header was sent but Store documents exist,
    // resolve the primary store so routes never return the whole workspace blindly.
    if (!req.activeStoreId) {
      try {
        const ws = await EcomWorkspace.findById(req.workspaceId).select('primaryStoreId').lean();
        const query = { workspaceId: req.workspaceId, isActive: true };
        if (ws?.primaryStoreId) query._id = ws.primaryStoreId;
        const fallback = await Store.findOne(query).sort({ createdAt: 1 }).select('_id').lean();
        req.activeStoreId = fallback?._id || null;
        req.activeStoreIdSource = fallback ? 'fallback' : null;
      } catch (_) {
        // Non-critical — leave activeStoreId null for legacy workspace-only accounts
      }
    }

    // ─── Onboarding « boutique d'abord » (nouveaux comptes uniquement) ──────
    // Un nouveau compte admin (needsStoreSetup=true) n'accède au système
    // central qu'après avoir créé sa boutique. Seules les routes nécessaires
    // à l'onboarding restent accessibles. Les comptes existants (flag absent)
    // et les rôles invités ne sont jamais concernés.
    if (user.needsStoreSetup === true && req.ecomUserRole === 'ecom_admin') {
      // La boutique peut exister sous plusieurs formes : doc Store du workspace
      // actif (activeStoreId), doc Store créé par l'utilisateur dans un autre
      // workspace, ou boutique « legacy » portée par le Workspace lui-même
      // (subdomain / isStoreEnabled, sans doc Store).
      let hasStore = Boolean(req.activeStoreId);
      if (!hasStore) {
        try {
          const [otherStore, wsLegacy] = await Promise.all([
            Store.exists({ createdBy: user._id, isActive: true }),
            EcomWorkspace.findById(req.workspaceId).select('subdomain storeSettings').lean(),
          ]);
          hasStore = Boolean(
            otherStore
            || wsLegacy?.subdomain
            || wsLegacy?.storeSettings?.isStoreEnabled === true
          );
        } catch (_) { /* strict : en cas d'échec du check, hasStore reste false */ }
      }

      if (hasStore) {
        // Auto-réparation du flag, sans bloquer la requête en cours.
        user.needsStoreSetup = false;
        EcomUser.updateOne({ _id: user._id }, { $set: { needsStoreSetup: false } })
          .then(() => invalidateUserCache(user._id))
          .catch(() => {});
      } else {
        const fullPath = `${req.baseUrl || ''}${req.path || ''}`;
        const allowed = ONBOARDING_ALLOWED_PREFIXES.some(p => fullPath.startsWith(p));
        if (!allowed) {
          return res.status(403).json({
            success: false,
            code: 'STORE_ONBOARDING_REQUIRED',
            message: 'Créez votre boutique pour accéder à votre espace.'
          });
        }
      }
    }

    next();
  } catch (error) {
    console.error('❌ Erreur requireEcomAuth:', error.message);
    console.error('❌ Full error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur authentification' });
  }
};

// Middleware pour vérifier un rôle spécifique
export const requireEcomRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.ecomUser) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentification e-commerce requise' 
      });
    }

    if (req.ecomUser.role !== requiredRole) {
      return res.status(403).json({ 
        success: false,
        message: 'Rôle e-commerce insuffisant' 
      });
    }

    next();
  };
};

// Middleware pour vérifier une permission spécifique
export const requireEcomPermission = (permission) => {
  return (req, res, next) => {
    if (!req.ecomUser) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentification e-commerce requise' 
      });
    }

    if (!req.ecomUser.hasPermission(permission)) {
      return res.status(403).json({ 
        success: false,
        message: 'Permission e-commerce insuffisante' 
      });
    }

    next();
  };
};

export const requireRitaAgentAccess = async (req, res, next) => {
  if (!req.ecomUser) {
    return res.status(401).json({
      success: false,
      message: 'Authentification e-commerce requise'
    });
  }

  const effectiveRole = req.ecomUserRole || req.ecomUser.role;
  if (!hasRitaAgentAccess(req.ecomUser, effectiveRole)) {
    return res.status(403).json({
      success: false,
      message: 'Accès Rita IA non autorisé pour ce compte'
    });
  }

  // Check workspace plan — WhatsApp AI agent requires pro or ultra
  try {
    const workspaceId = req.workspaceId || req.query?.workspaceId || req.body?.workspaceId;
    if (workspaceId && effectiveRole !== 'super_admin') {
      const EcomWorkspace = (await import('../models/Workspace.js')).default;
      const workspace = await EcomWorkspace.findById(workspaceId).select('plan planExpiresAt trialEndsAt').lean();
      if (workspace) {
        const now = new Date();
        const isPaidWithAgent = (workspace.plan === 'pro' || workspace.plan === 'ultra') &&
          workspace.planExpiresAt && workspace.planExpiresAt > now;
        const isTrialActive = workspace.trialEndsAt && workspace.trialEndsAt > now;
        if (!isPaidWithAgent && !isTrialActive) {
          return res.status(403).json({
            success: false,
            message: 'L\'agent WhatsApp IA nécessite un abonnement Scalor + IA ou supérieur',
            requiresPlan: 'pro'
          });
        }
      }
    }
  } catch (err) {
    console.error('[ecomAuth] Plan check error:', err.message);
  }

  next();
};

// Middleware pour valider l'accès selon le rôle et la ressource
export const validateEcomAccess = (resource, action) => {
  return (req, res, next) => {
    if (!req.ecomUser) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentification e-commerce requise' 
      });
    }

    const userRole = req.ecomUserRole || req.ecomUser.role;
    const permission = `${resource}:${action}`;
    
    // Mode incarnation : Super Admin a accès à tout
    if (req.user?.workspaceId && userRole === 'super_admin') {
      return next();
    }

    // Règles d'accès spécifiques — principe du moindre privilège
    const accessRules = {
      'super_admin': ['*'],
      'ecom_admin': [
        'orders:read', 'orders:write',
        'products:read', 'products:write',
        'reports:read', 'reports:write',
        'finance:read', 'finance:write',
        'campaigns:read', 'campaigns:write',
        'clients:read', 'clients:write',
        'users:read', 'users:write',
        'settings:read', 'settings:write',
        'analytics:read',
        'stock:read', 'stock:write',
        'store:read', 'store:write',
        'agent:read', 'agent:write',
        // L'admin de workspace gère sa propre équipe (création/modif/reset de
        // closeuses, comptables, livreurs) et ses objectifs internes. Sa portée
        // reste limitée à son workspaceId par validateEcomAccess.
        'admin:read', 'admin:write'
      ],
      'ecom_closeuse': ['orders:read', 'orders:write', 'reports:read', 'reports:write', 'products:read', 'campaigns:read', 'campaigns:write'],
      'ecom_compta': ['finance:read', 'finance:write', 'reports:read', 'reports:write', 'products:read'],
      'ecom_livreur': ['orders:read']
    };

    const userPermissions = accessRules[userRole] || [];
    
    // Le super_admin a accès à tout avec '*'
    if (userPermissions.includes('*')) {
      return next();
    }
    
    if (!userPermissions.includes('*') && !userPermissions.includes(permission)) {
      return res.status(403).json({ 
        success: false,
        message: `Accès refusé: ${permission} non autorisé pour le rôle ${userRole}` 
      });
    }

    next();
  };
};

// Fonction pour générer un token e-commerce
export const generateEcomToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      email: user.email,
      role: user.role,
      workspaceId: user.workspaceId
    },
    ECOM_JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Middleware pour vérifier que l'utilisateur est super_admin
export const requireSuperAdmin = (req, res, next) => {
  if (!req.ecomUser || req.ecomUser.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Accès réservé au super administrateur'
    });
  }
  next();
};

// Middleware pour les agents service client (service_client OU super_admin)
export const requireServiceClient = (req, res, next) => {
  if (!req.ecomUser || !['super_admin', 'service_client'].includes(req.ecomUser.role)) {
    return res.status(403).json({
      success: false,
      message: 'Accès réservé au service client'
    });
  }
  next();
};

// Middleware pour vérifier que l'utilisateur a un workspace
export const requireWorkspace = (req, res, next) => {
  console.log('🏢 requireWorkspace - workspaceId:', req.workspaceId);
  if (!req.workspaceId) {
    console.log('❌ No workspaceId found in request');
    return res.status(403).json({
      success: false,
      message: 'Aucun espace de travail associé. Veuillez créer ou rejoindre un espace.'
    });
  }
  console.log('✅ Workspace check passed');
  next();
};

// Middleware optionnel pour logger les actions e-commerce
export const logEcomAction = (action) => {
  return (req, res, next) => {
    console.log(`[ECOM] ${req.ecomUser?.email} (${req.ecomUser?.role}) - ${action} - ${new Date().toISOString()}`);
    next();
  };
};
