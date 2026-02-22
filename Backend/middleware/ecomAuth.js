import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import EcomUser from '../models/EcomUser.js';

// Clé secrète pour les tokens e-commerce (différente du système principal)
const ECOM_JWT_SECRET = process.env.ECOM_JWT_SECRET || 'ecom-secret-key-change-in-production';

// Fonction pour générer un identifiant d'appareil unique
const generateDeviceId = () => {
  return 'device_' + crypto.randomBytes(16).toString('hex');
};

// Fonction pour générer un token permanent par appareil
export const generatePermanentToken = (user, deviceInfo) => {
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
  user.save();

  return permanentToken;
};

// Middleware pour vérifier l'authentification e-commerce
export const requireEcomAuth = async (req, res, next) => {
  try {
    console.log(' Middleware requireEcomAuth appelé');
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      console.log(' Token manquant');
      return res.status(401).json({ 
        success: false,
        message: 'Token manquant' 
      });
    }

    // Extraire le token proprement (Bearer ecom:xxx, ecom:xxx, perm:xxx)
    let token = authHeader.startsWith('Bearer ') 
      ? authHeader.replace('Bearer ', '')
      : authHeader;
    
    // Supprimer les préfixes ecom: et perm: si présents
    token = token.replace(/^ecom:/, '').replace(/^perm:/, '');
    
    console.log(' Token reçu:', token ? 'Token présent' : 'Token manquant');
    
    if (!token) {
      console.log(' Token manquant');
      return res.status(401).json({ 
        success: false,
        message: 'Token e-commerce manquant' 
      });
    }

    let decoded;
    let user;

    try {
      decoded = jwt.verify(token, ECOM_JWT_SECRET);
      console.log(' Token décodé avec succès:', decoded);
      
      user = await EcomUser.findById(decoded.id).select('-password');
      console.log(' Utilisateur trouvé:', user ? user.email : 'Non trouvé');
      
      if (!user || !user.isActive) {
        console.log(' Utilisateur non trouvé ou inactif');
        return res.status(401).json({ 
          success: false,
          message: 'Utilisateur e-commerce non trouvé ou inactif' 
        });
      }

      console.log(' Utilisateur authentifié avec succès');
    } catch (error) {
      console.log(' Erreur validation token:', error.message);
      return res.status(401).json({ 
        success: false,
        message: 'Token e-commerce invalide ou expiré' 
      });
    }

    // Assigner l'utilisateur et le workspace à la requête
    req.user = decoded; // Données du token (id, email, role, workspaceId)
    req.ecomUser = user;  // Complète de la base de données
    req.workspaceId = decoded.workspaceId; // Utiliser workspaceId du token
    req.ecomUserRole = user.getRoleInWorkspace(decoded.workspaceId) || user.role;
    
    console.log('👤 Utilisateur authentifié - WorkspaceId:', req.workspaceId, 'Role:', req.ecomUserRole);
    
    next();
  } catch (error) {
    console.error(' Erreur dans requireEcomAuth:', error.message);
    return res.status(500).json({ 
      success: false,
      message: 'Erreur serveur authentification'
    });
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
      console.log('🎭 Mode incarnation - Super Admin accès autorisé pour:', permission);
      return next();
    }

    // Règles d'accès spécifiques
    const accessRules = {
      'super_admin': ['admin:read', 'admin:write', '*'], // Super admin a accès à tout
      'ecom_admin': ['*'],
      'ecom_closeuse': ['orders:read', 'orders:write', 'reports:read', 'reports:write', 'products:read', 'campaigns:read', 'campaigns:write'],
      'ecom_compta': ['finance:read', 'finance:write', 'reports:read', 'reports:write', 'products:read'],
      'ecom_livreur': ['orders:read']
    };

    const userPermissions = accessRules[userRole] || [];
    
    // Le super_admin a accès à tout avec '*'
    if (userPermissions.includes('*')) {
      console.log('🎭 Super Admin accès autorisé pour:', permission);
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

// Middleware pour vérifier que l'utilisateur a un workspace
export const requireWorkspace = (req, res, next) => {
  if (!req.workspaceId) {
    return res.status(403).json({
      success: false,
      message: 'Aucun espace de travail associé. Veuillez créer ou rejoindre un espace.'
    });
  }
  next();
};

// Middleware optionnel pour logger les actions e-commerce
export const logEcomAction = (action) => {
  return (req, res, next) => {
    console.log(`[ECOM] ${req.ecomUser?.email} (${req.ecomUser?.role}) - ${action} - ${new Date().toISOString()}`);
    next();
  };
};
