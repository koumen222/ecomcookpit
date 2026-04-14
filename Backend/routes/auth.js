import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import EcomUser from '../models/EcomUser.js';
import Workspace from '../models/Workspace.js';
import PasswordResetToken from '../models/PasswordResetToken.js';
import { generateEcomToken, generatePermanentToken, requireEcomAuth } from '../middleware/ecomAuth.js';
import { validateEmail, validatePassword } from '../middleware/validation.js';
import { logAudit } from '../middleware/security.js';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import AffiliateUser from '../models/AffiliateUser.js';
import AffiliateConversion from '../models/AffiliateConversion.js';
import {
  notifyUserRegistered,
  notifyForgotPassword,
  notifyPasswordChanged,
  notifySuspiciousLogin
} from '../core/notifications/notification.service.js';

const router = express.Router();
const ECOM_JWT_SECRET = process.env.ECOM_JWT_SECRET || 'ecom-secret-key-change-in-production';

const normalizeToken = (token = '') => token.replace(/^ecom:/, '').replace(/^perm:/, '');
const isRawJwt = (token = '') => token.split('.').length === 3;
const isSupportedAuthToken = (token = '') => (
  token.startsWith('ecom:') ||
  token.startsWith('perm:') ||
  isRawJwt(token)
);

// Helper: fire-and-forget analytics event from backend
function trackEvent(req, eventType, userId, extra = {}) {
  const ua = req.headers['user-agent'] || '';
  const device = /mobile|android|iphone|ipad/i.test(ua)
    ? (/ipad|tablet/i.test(ua) ? 'tablet' : 'mobile') : 'desktop';
  AnalyticsEvent.create({
    sessionId: req.headers['x-session-id'] || `srv_${Date.now()}`,
    eventType,
    userId: userId || null,
    country: req.headers['cf-ipcountry'] || req.headers['x-country'] || null,
    city: req.headers['cf-ipcity'] || req.headers['x-city'] || null,
    device,
    userAgent: ua.substring(0, 500),
    ...extra
  }).catch(err => console.warn('[analytics] track error:', err.message));
}

// Rate limiting simple pour forgot-password (anti-abus)
const forgotPasswordAttempts = new Map();

/**
 * Fire-and-forget: credit 500 FCFA signup commission to the referring affiliate.
 */
async function creditSignupCommission(affiliateCode, referredUserId) {
  try {
    const affiliate = await AffiliateUser.findOne({ referralCode: affiliateCode.toUpperCase(), isActive: true });
    if (!affiliate) return;
    await AffiliateConversion.create({
      affiliateId: affiliate._id,
      affiliateCode: affiliate.referralCode,
      conversionType: 'signup',
      referredUserId,
      commissionType: 'fixed',
      commissionValue: 500,
      commissionAmount: 500,
      status: 'approved',
      statusNote: 'Bonus inscription automatique'
    });
    console.log(`[affiliate] 500 FCFA signup commission for affiliate ${affiliate.referralCode} (referred user ${referredUserId})`);
  } catch (err) {
    console.warn('[affiliate] signup commission error:', err.message);
  }
}
const FORGOT_PASSWORD_LIMIT = 3; // max 3 demandes
const FORGOT_PASSWORD_WINDOW = 15 * 60 * 1000; // par 15 minutes

// POST /api/ecom/auth/login - Connexion
router.post('/login', validateEmail, async (req, res) => {
  try {
    const { email, password, rememberDevice, deviceInfo } = req.body;

    const user = await EcomUser.findOne({ email, isActive: true });
    if (!user) {
      // Log tentative échouée (utilisateur introuvable)
      console.warn(`⚠️ Tentative login échouée: ${email} (utilisateur non trouvé)`);
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Log tentative échouée (mauvais mot de passe)
      req.ecomUser = user;
      await logAudit(req, 'LOGIN_FAILED', `Tentative de connexion échouée pour ${email}`, 'auth');
      trackEvent(req, 'login_failed', user._id, { meta: { email } });
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Mettre à jour lastLogin
    user.lastLogin = new Date();
    await user.save();

    let token;
    let isPermanent = false;

    // Si l'utilisateur demande de se souvenir de l'appareil
    if (rememberDevice) {
      console.log(`📱 Enregistrement de l'appareil demandé pour ${email}`);
      token = await generatePermanentToken(user, deviceInfo);
      isPermanent = true;
      console.log('✅ Token permanent généré');
    } else {
      token = generateEcomToken(user);
      console.log('✅ Token normal généré');
    }

    // Log connexion réussie
    req.ecomUser = user;
    await logAudit(req, 'LOGIN', `Connexion réussie: ${user.email} (${user.role}) - Permanent: ${isPermanent}`, 'auth', user._id);
    trackEvent(req, 'login', user._id, { workspaceId: user.workspaceId, userRole: user.role });

    // Charger le workspace
    let workspace = null;
    if (user.workspaceId) {
      workspace = await Workspace.findById(user.workspaceId);
    }

    res.json({
      success: true,
      message: isPermanent ? 'Connexion réussie - Appareil enregistré' : 'Connexion réussie',
      data: {
        token,
        isPermanent,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          canAccessRitaAgent: user.canAccessRitaAgent,
          currency: user.currency,
          lastLogin: user.lastLogin,
          workspaceId: user.workspaceId,
          deviceInfo: user.deviceInfo
        },
        workspace: workspace ? {
          id: workspace._id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
          trialEndsAt: workspace.trialEndsAt,
          subscriptionWarning: workspace.subscriptionWarning,
          inviteCode: user.role === 'ecom_admin' ? workspace.inviteCode : undefined
        } : null
      }
    });
  } catch (error) {
    console.error('Erreur login e-commerce:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// POST /api/ecom/auth/refresh - Rafraîchir un token expiré
router.post('/refresh', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token manquant'
      });
    }

    // Décoder le token même s'il est expiré pour récupérer l'ID utilisateur
    let decoded;
    try {
      decoded = jwt.verify(normalizeToken(token), ECOM_JWT_SECRET, { ignoreExpiration: true });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
    }

    // Vérifier que l'utilisateur existe toujours et est actif
    const user = await EcomUser.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé ou inactif'
      });
    }

    // Générer un nouveau token
    const newToken = generateEcomToken(user);

    // Charger le workspace
    let workspace = null;
    if (user.workspaceId) {
      workspace = await Workspace.findById(user.workspaceId);
    }

    console.log(`🔄 Token rafraîchi pour ${user.email}`);

    res.json({
      success: true,
      message: 'Token rafraîchi',
      data: {
        token: newToken,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          canAccessRitaAgent: user.canAccessRitaAgent,
          currency: user.currency,
          workspaceId: user.workspaceId
        },
        workspace: workspace ? {
          id: workspace._id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
          trialEndsAt: workspace.trialEndsAt,
          subscriptionWarning: workspace.subscriptionWarning
        } : null
      }
    });
  } catch (error) {
    console.error('Erreur refresh token:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// POST /api/ecom/auth/register-device - Enregistrer un appareil pour un utilisateur déjà connecté
router.post('/register-device', async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token || !isSupportedAuthToken(token)) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    const decoded = jwt.verify(normalizeToken(token), ECOM_JWT_SECRET);

    const user = await EcomUser.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé ou inactif'
      });
    }

    // Générer un token permanent
    const permanentToken = await generatePermanentToken(user, deviceInfo);

    console.log(`📱 Appareil enregistré pour ${user.email}`);

    res.json({
      success: true,
      message: 'Appareil enregistré avec succès',
      data: {
        permanentToken,
        deviceInfo: user.deviceInfo
      }
    });
  } catch (error) {
    console.error('Erreur register device:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// GET /api/ecom/auth/device-status - Vérifier le statut de l'appareil actuel
router.get('/device-status', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.json({
        success: true,
        data: {
          isAuthenticated: false,
          isPermanent: false,
          deviceInfo: null
        }
      });
    }

    const ECOM_JWT_SECRET = process.env.ECOM_JWT_SECRET || 'ecom-secret-key-change-in-production';
    let decoded;
    let isPermanent = false;
    let user = null;

    try {
      if (token.startsWith('perm:')) {
        decoded = jwt.verify(token.replace('perm:', ''), ECOM_JWT_SECRET);
        isPermanent = true;
        user = await EcomUser.findById(decoded.id).select('-password');
      } else if (token.startsWith('ecom:')) {
        decoded = jwt.verify(token.replace('ecom:', ''), ECOM_JWT_SECRET);
        isPermanent = false;
        user = await EcomUser.findById(decoded.id).select('-password');
      }
    } catch (error) {
      return res.json({
        success: true,
        data: {
          isAuthenticated: false,
          isPermanent: false,
          deviceInfo: null,
          error: 'Token invalide ou expiré'
        }
      });
    }

    if (!user || !user.isActive) {
      return res.json({
        success: true,
        data: {
          isAuthenticated: false,
          isPermanent: false,
          deviceInfo: null
        }
      });
    }

    res.json({
      success: true,
      data: {
        isAuthenticated: true,
        isPermanent,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          currency: user.currency,
          lastLogin: user.lastLogin
        },
        deviceInfo: isPermanent ? user.deviceInfo : null
      }
    });
  } catch (error) {
    console.error('Erreur device status:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// POST /api/ecom/auth/revoke-device - Révoquer l'accès de l'appareil actuel
router.post('/revoke-device', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token || !token.startsWith('perm:')) {
      return res.status(400).json({
        success: false,
        message: 'Aucun appareil permanent à révoquer'
      });
    }

    const ECOM_JWT_SECRET = process.env.ECOM_JWT_SECRET || 'ecom-secret-key-change-in-production';
    const decoded = jwt.verify(token.replace('perm:', ''), ECOM_JWT_SECRET);

    const user = await EcomUser.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé ou inactif'
      });
    }

    // Vérifier que le token correspond
    if (user.deviceToken !== token) {
      return res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
    }

    // Révoquer l'appareil
    user.deviceToken = null;
    user.deviceInfo = null;
    await user.save();

    console.log(`📱 Appareil révoqué pour ${user.email}`);

    res.json({
      success: true,
      message: 'Appareil révoqué avec succès'
    });
  } catch (error) {
    console.error('Erreur revoke device:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// GET /api/ecom/auth/super-admin-exists - Vérifier si un super admin existe déjà
router.get('/super-admin-exists', async (req, res) => {
  try {
    const exists = await EcomUser.exists({ role: 'super_admin' });
    res.json({ success: true, data: { exists: !!exists } });
  } catch (error) {
    console.error('Erreur check super admin:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── OTP store en mémoire (email → { code, expiresAt, attempts }) ─────────────
const otpStore = new Map();
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

// Nettoyage périodique
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of otpStore.entries()) {
    if (v.expiresAt < now) otpStore.delete(k);
  }
}, 5 * 60 * 1000);

// POST /api/ecom/auth/send-otp - Envoyer un code de vérification par email
router.post('/send-otp', validateEmail, async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    // Vérifier si l'email est déjà utilisé
    const existing = await EcomUser.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Cet email est déjà utilisé' });
    }

    // Générer un code à 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + OTP_TTL_MS;

    otpStore.set(normalizedEmail, { code, expiresAt, attempts: 0 });

    // Envoyer l'email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const { Resend: ResendClient } = await import('resend');
      const resend = new ResendClient(resendKey);
      const FROM = `Scalor <${process.env.EMAIL_FROM || 'contact@infomania.store'}>`;
      await resend.emails.send({
        from: FROM,
        to: normalizedEmail,
        subject: `${code} — Votre code de vérification Scalor`,
        html: `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}.wrapper{max-width:480px;margin:0 auto;padding:32px 16px}.card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}.header{background:#4f46e5;padding:28px 32px;text-align:center}.header h1{color:#fff;margin:0;font-size:22px;font-weight:700}.body{padding:32px;text-align:center}.code{font-size:48px;font-weight:800;letter-spacing:12px;color:#4f46e5;background:#f0f0ff;border-radius:12px;padding:20px 32px;display:inline-block;margin:16px 0;font-family:monospace}.footer{padding:20px 32px;text-align:center;background:#f8f9ff;border-top:1px solid #eee}.footer p{color:#aaa;font-size:12px;margin:4px 0}</style></head><body><div class="wrapper"><div class="card"><div class="header"><h1>Scalor</h1></div><div class="body"><p style="color:#4a4a68;font-size:16px;margin:0 0 8px">Votre code de vérification</p><div class="code">${code}</div><p style="color:#888;font-size:13px;margin:16px 0 0">Ce code expire dans <strong>10 minutes</strong>.<br/>Ne le partagez avec personne.</p></div><div class="footer"><p>© ${new Date().getFullYear()} Scalor · Si vous n'avez pas demandé ce code, ignorez cet email.</p></div></div></div></body></html>`
      });
    } else {
      console.log(`[OTP DEV] Code pour ${normalizedEmail}: ${code}`);
    }

    res.json({ success: true, message: 'Code envoyé par email' });
  } catch (error) {
    console.error('Erreur send-otp:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi du code' });
  }
});

// POST /api/ecom/auth/verify-otp - Vérifier le code OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email et code requis' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const entry = otpStore.get(normalizedEmail);

    if (!entry) {
      return res.status(400).json({ success: false, message: 'Aucun code envoyé pour cet email. Recommencez.' });
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({ success: false, message: 'Code expiré. Demandez un nouveau code.' });
    }

    entry.attempts += 1;
    if (entry.attempts > OTP_MAX_ATTEMPTS) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({ success: false, message: 'Trop de tentatives. Demandez un nouveau code.' });
    }

    if (entry.code !== code.trim()) {
      return res.status(400).json({ success: false, message: `Code incorrect (${OTP_MAX_ATTEMPTS - entry.attempts + 1} essai(s) restant(s))` });
    }

    // Code valide — marquer comme vérifié
    entry.verified = true;

    res.json({ success: true, message: 'Email vérifié avec succès' });
  } catch (error) {
    console.error('Erreur verify-otp:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/auth/register - Création d'un compte (sans workspace ni rôle)
router.post('/register', validateEmail, validatePassword, async (req, res) => {
  try {
    const { email, password, name, phone, superAdmin, acceptPrivacy, affiliateCode } = req.body;

    // Vérifier l'acceptation de la politique de confidentialité
    if (!superAdmin && !acceptPrivacy) {
      return res.status(400).json({
        success: false,
        message: 'Vous devez accepter la politique de confidentialité pour créer un compte'
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await EcomUser.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }

    // Création super admin (une seule fois)
    if (superAdmin) {
      const superAdminExists = await EcomUser.exists({ role: 'super_admin' });
      if (superAdminExists) {
        return res.status(400).json({
          success: false,
          message: 'Un super administrateur existe déjà. Impossible d\'en créer un autre.'
        });
      }

      const user = new EcomUser({ email, password, role: 'super_admin' });
      await user.save();
      const token = generateEcomToken(user);

      return res.status(201).json({
        success: true,
        message: 'Compte Super Admin créé avec succès',
        data: {
          token,
          user: { id: user._id, email: user.email, role: user.role, isActive: user.isActive, currency: user.currency, workspaceId: null },
          workspace: null
        }
      });
    }

    // Créer l'utilisateur SANS workspace ni rôle
    const user = new EcomUser({
      email,
      password,
      name: name?.trim() || '',
      phone: phone?.trim() || '',
      role: null,
      workspaceId: null,
      referredByAffiliateCode: affiliateCode?.trim().toUpperCase() || null
    });
    await user.save();

    // Credit 500 FCFA signup commission to referring affiliate (non-blocking)
    if (user.referredByAffiliateCode) {
      creditSignupCommission(user.referredByAffiliateCode, user._id);
    }

    const token = generateEcomToken(user);

    // Email de bienvenue (non bloquant)
    notifyUserRegistered(user, null).catch(err => console.warn('[notif] register:', err.message));

    console.log(`✅ Nouveau compte créé: ${user.email} (sans workspace)`);
    trackEvent(req, 'signup_completed', user._id);

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      data: {
        token,
        user: { id: user._id, email: user.email, name: user.name, role: null, isActive: user.isActive, currency: user.currency, workspaceId: null },
        workspace: null
      }
    });
  } catch (error) {
    console.error('Erreur register e-commerce:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/auth/health - Quick health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Auth service is running',
    timestamp: new Date().toISOString(),
    env: {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasJwtSecret: !!process.env.ECOM_JWT_SECRET,
      nodeEnv: process.env.NODE_ENV || 'development',
    }
  });
});

// POST /api/ecom/auth/google - Connexion / inscription via Google
router.post('/google', async (req, res) => {
  try {
    const { credential, affiliateCode } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Token Google manquant' });
    }

    // ─── Vérification sécurisée du id_token via google-auth-library ───
    const { OAuth2Client } = await import('google-auth-library');
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    
    if (!GOOGLE_CLIENT_ID) {
      console.error('❌ [Google Auth] GOOGLE_CLIENT_ID manquant dans les variables d\'environnement');
      return res.status(503).json({ 
        success: false, 
        message: 'GOOGLE_CLIENT_ID manquant côté serveur. Veuillez configurer les variables d\'environnement.' 
      });
    }
    
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);

    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
    } catch (verifyError) {
      console.error('❌ [Google Auth] Vérification id_token échouée:', verifyError.message);
      // Diagnostic précis selon le type d'erreur
      if (verifyError.message.includes('audience')) {
        return res.status(401).json({
          success: false,
          message: 'Audience mismatch — le token a été émis pour un autre Client ID. Vérifiez GOOGLE_CLIENT_ID côté backend.'
        });
      }
      if (verifyError.message.includes('Token used too late') || verifyError.message.includes('expired')) {
        return res.status(401).json({
          success: false,
          message: 'Token Google expiré. Veuillez réessayer.'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Token Google invalide : ' + verifyError.message
      });
    }

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    console.log('✅ [Google Auth] Token vérifié pour:', email, '| aud:', payload.aud);

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email non disponible depuis Google' });
    }

    // Chercher un utilisateur existant par email ou googleId
    let user = await EcomUser.findOne({ $or: [{ email }, { googleId }] });
    let isNewUser = false;

    if (user) {
      // Utilisateur existant — mettre à jour le googleId si nécessaire
      if (!user.googleId) user.googleId = googleId;
      if (!user.name && name) user.name = name;
      if (!user.avatar && picture) user.avatar = picture;
      user.lastLogin = new Date();
      await user.save();
    } else {
      // Nouvel utilisateur — créer sans workspace ni rôle
      user = new EcomUser({
        email,
        googleId,
        name: name || '',
        avatar: picture || '',
        role: null,
        workspaceId: null,
        referredByAffiliateCode: affiliateCode?.trim().toUpperCase() || null
      });
      await user.save();
      isNewUser = true;

      // Credit 500 FCFA signup commission to referring affiliate (non-blocking)
      if (user.referredByAffiliateCode) {
        creditSignupCommission(user.referredByAffiliateCode, user._id);
      }

      // Email de bienvenue
      notifyUserRegistered(user, null).catch(err => console.warn('[notif] google-register:', err.message));
      console.log(`✅ Nouveau compte Google créé: ${user.email}`);
    }

    const token = generateEcomToken(user);

    // Charger le workspace si existant
    let workspace = null;
    if (user.workspaceId) {
      workspace = await Workspace.findById(user.workspaceId);
    }

    res.json({
      success: true,
      message: isNewUser ? 'Compte créé avec succès via Google' : 'Connexion réussie via Google',
      data: {
        token,
        isNewUser,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          currency: user.currency,
          workspaceId: user.workspaceId
        },
        workspace: workspace ? {
          id: workspace._id,
          name: workspace.name,
          slug: workspace.slug,
          inviteCode: user.role === 'ecom_admin' ? workspace.inviteCode : undefined
        } : null
      }
    });
  } catch (error) {
    console.error('Erreur Google auth:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/auth/create-workspace - Créer un workspace (utilisateur authentifié)
router.post('/create-workspace', async (req, res) => {
  try {
    const { workspaceName } = req.body;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, message: 'Token manquant' });
    }

    const normalizedTk = token.replace(/^ecom:/, '').replace(/^perm:/, '');
    const decoded = jwt.verify(normalizedTk, ECOM_JWT_SECRET);
    const user = await EcomUser.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Utilisateur non trouvé ou inactif' });
    }

    if (!workspaceName || workspaceName.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Le nom de l\'espace est requis (min. 2 caractères)' });
    }

    const { role: rawRole = 'ecom_admin' } = req.body;
    // Normaliser 'livreur' → 'ecom_livreur' (rétro-compatibilité)
    const roleNorm = { livreur: 'ecom_livreur' };
    const role = roleNorm[rawRole] || rawRole;
    const validRoles = ['ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Rôle invalide' });
    }

    // Créer le workspace
    const workspace = new Workspace({
      name: workspaceName.trim(),
      owner: user._id
    });
    await workspace.save();

    // Mettre à jour l'utilisateur avec le rôle choisi
    user.role = role;
    user.workspaceId = workspace._id;
    user.addWorkspace(workspace._id, role);
    await user.save();

    // Regénérer le token avec le nouveau rôle et workspace
    const newToken = generateEcomToken(user);

    console.log(`✅ Workspace créé: ${workspace.name} par ${user.email}`);
    trackEvent(req, 'workspace_created', user._id, { workspaceId: workspace._id, userRole: role });

    res.status(201).json({
      success: true,
      message: 'Espace créé avec succès',
      data: {
        token: newToken,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          currency: user.currency,
          workspaceId: workspace._id
        },
        workspace: {
          id: workspace._id,
          name: workspace.name,
          slug: workspace.slug,
          inviteCode: workspace.inviteCode
        }
      }
    });
  } catch (error) {
    console.error('Erreur create-workspace:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/auth/join-workspace - Rejoindre un workspace (utilisateur authentifié, tout rôle)
router.post('/join-workspace', async (req, res) => {
  try {
    const { inviteCode, selectedRole } = req.body;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, message: 'Token manquant' });
    }

    const normalizedTk = token.replace(/^ecom:/, '').replace(/^perm:/, '');
    const decoded = jwt.verify(normalizedTk, ECOM_JWT_SECRET);
    const user = await EcomUser.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Utilisateur non trouvé ou inactif' });
    }

    if (!inviteCode || !inviteCode.trim()) {
      return res.status(400).json({ success: false, message: 'Code d\'invitation requis' });
    }

    // Chercher le workspace
    const workspace = await Workspace.findOne({ inviteCode: inviteCode.trim(), isActive: true });
    if (!workspace) {
      return res.status(400).json({ success: false, message: 'Code d\'invitation invalide ou espace inactif' });
    }

    // Vérifier que l'utilisateur n'est pas déjà dans ce workspace
    if (user.hasWorkspaceAccess(workspace._id)) {
      return res.status(400).json({ success: false, message: 'Vous êtes déjà membre de cet espace' });
    }

    // Tout rôle est permis
    const allowedRoles = ['ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur'];
    const role = (selectedRole && allowedRoles.includes(selectedRole)) ? selectedRole : 'ecom_closeuse';

    // ✅ CORRECTION : Ajouter le workspace sans écraser le rôle global
    // Ajouter le nouveau workspace à l'array workspaces
    const added = user.addWorkspace(workspace._id, role);
    if (!added) {
      return res.status(400).json({ success: false, message: 'Erreur lors de l\'ajout du workspace' });
    }
    
    // Mettre à jour le workspace actif et le rôle actif (pour ce workspace uniquement)
    user.workspaceId = workspace._id;
    user.role = role;
    await user.save();

    // Regénérer le token
    const newToken = generateEcomToken(user);

    console.log(`✅ ${user.email} a rejoint ${workspace.name} en tant que ${role}`);
    trackEvent(req, 'workspace_joined', user._id, { workspaceId: workspace._id, userRole: role });

    res.json({
      success: true,
      message: 'Vous avez rejoint l\'espace avec succès',
      data: {
        token: newToken,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          currency: user.currency,
          workspaceId: workspace._id
        },
        workspace: {
          id: workspace._id,
          name: workspace.name,
          slug: workspace.slug,
          inviteCode: role === 'ecom_admin' ? workspace.inviteCode : undefined
        }
      }
    });
  } catch (error) {
    console.error('Erreur join-workspace:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/auth/me - Obtenir le profil utilisateur
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const debugAuth = process.env.DEBUG_AUTH === 'true';

    if (debugAuth) {
      console.log('🔐 /auth/me appelé');
      console.log('   Authorization header:', authHeader ? 'Présent' : 'Manquant');
      console.log('   Token length:', token?.length || 0);
      console.log('   Token starts with:', token?.substring(0, 20) + '...');
      console.log('   Origin:', req.headers.origin);
    }

    if (!token) {
      if (debugAuth) {
        console.log('❌ Token manquant');
      }
      return res.status(401).json({
        success: false,
        message: 'Token manquant'
      });
    }

    if (!isSupportedAuthToken(token)) {
      if (debugAuth) {
        console.log('❌ Token format non supporté. Raw check:', token.split('.').length === 3 ? 'JWT brut' : 'Format inconnu');
      }
      return res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
    }

    const normalizedToken = normalizeToken(token);
    if (debugAuth) {
      console.log('✅ Token normalisé, longueur:', normalizedToken.length);
    }

    const decoded = jwt.verify(normalizedToken, ECOM_JWT_SECRET);
    if (debugAuth) {
      console.log('✅ Token vérifié, userId:', decoded.id);
    }

    if (debugAuth) {
      console.log('🔍 Recherche utilisateur avec ID:', decoded.id);
    }
    const user = await EcomUser.findById(decoded.id).select('-password');
    if (debugAuth) {
      console.log('👤 Utilisateur trouvé:', user ? user.email : 'Non trouvé');
      console.log('🔑 Utilisateur actif:', user?.isActive);
    }

    if (!user || !user.isActive) {
      if (debugAuth) {
        console.log('❌ Utilisateur non trouvé ou inactif');
      }
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé ou inactif'
      });
    }

    // Charger le workspace
    let workspace = null;
    if (user.workspaceId) {
      workspace = await Workspace.findById(user.workspaceId);
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          canAccessRitaAgent: user.canAccessRitaAgent,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          workspaceId: user.workspaceId,
          currency: user.currency
        },
        workspace: workspace ? {
          id: workspace._id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
          trialEndsAt: workspace.trialEndsAt,
          subscriptionWarning: workspace.subscriptionWarning,
          inviteCode: user.role === 'ecom_admin' ? workspace.inviteCode : undefined
        } : null
      }
    });
  } catch (error) {
    console.error('Erreur get profile e-commerce:', error);
    res.status(401).json({
      success: false,
      message: 'Token invalide'
    });
  }
});

// PUT /api/ecom/auth/profile - Mettre à jour le profil
router.put('/profile', async (req, res) => {
  try {
    const { name, phone } = req.body;
    console.log('🔧 [Profile Update] Données reçues:', { name, phone, body: req.body });

    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token || !isSupportedAuthToken(token)) {
      console.log('❌ [Profile Update] Token invalide:', token?.substring(0, 20));
      return res.status(401).json({ success: false, message: 'Token invalide' });
    }

    const decoded = jwt.verify(normalizeToken(token), ECOM_JWT_SECRET);
    console.log('👤 [Profile Update] Token décodé, userId:', decoded.id);

    const user = await EcomUser.findById(decoded.id);
    if (!user || !user.isActive) {
      console.log('❌ [Profile Update] Utilisateur non trouvé ou inactif:', decoded.id);
      return res.status(401).json({ success: false, message: 'Utilisateur non trouvé ou inactif' });
    }

    console.log('📋 [Profile Update] Avant modification:', {
      id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email
    });

    if (name !== undefined) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();

    console.log('💾 [Profile Update] Sauvegarde en cours...');
    await user.save();
    console.log('✅ [Profile Update] Sauvegarde réussie!');

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: { name: user.name, phone: user.phone }
    });
  } catch (error) {
    console.error('❌ [Profile Update] Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/auth/forgot-password - Demander une réinitialisation
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email requis' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limiting
    const now = Date.now();
    const key = normalizedEmail;
    const attempts = forgotPasswordAttempts.get(key) || { count: 0, firstAttempt: now };

    if (now - attempts.firstAttempt > FORGOT_PASSWORD_WINDOW) {
      attempts.count = 0;
      attempts.firstAttempt = now;
    }

    if (attempts.count >= FORGOT_PASSWORD_LIMIT) {
      return res.status(429).json({
        success: false,
        message: 'Trop de tentatives. Veuillez réessayer dans 15 minutes.'
      });
    }

    attempts.count++;
    forgotPasswordAttempts.set(key, attempts);

    // Toujours répondre succès (sécurité : ne pas révéler si l'email existe)
    const successMessage = 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.';

    const user = await EcomUser.findOne({ email: normalizedEmail, isActive: true });
    if (!user) {
      console.log(`\u26a0\ufe0f Forgot password: email ${normalizedEmail} non trouv\u00e9`);
      return res.json({ success: true, message: successMessage });
    }

    // Générer le token
    const resetToken = await PasswordResetToken.createToken(user._id);

    // Construire le lien de réinitialisation
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/ecom/reset-password?token=${resetToken.token}`;

    // Envoyer via le système centralisé
    const notifResult = await notifyForgotPassword(user, resetLink);
    if (!notifResult.success) {
      console.error('❌ Erreur envoi email reset:', notifResult.error);
      return res.status(500).json({ success: false, message: 'Erreur envoi email de réinitialisation' });
    }

    console.log(`✅ Email de réinitialisation envoyé à ${normalizedEmail}`);
    res.json({ success: true, message: successMessage });
  } catch (error) {
    console.error('Erreur forgot-password:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/auth/reset-password - R\u00e9initialiser le mot de passe avec le token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token et nouveau mot de passe requis' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 6 caract\u00e8res' });
    }

    // V\u00e9rifier le token
    const resetToken = await PasswordResetToken.verifyToken(token);
    if (!resetToken) {
      return res.status(400).json({
        success: false,
        message: 'Lien de r\u00e9initialisation invalide ou expir\u00e9. Veuillez faire une nouvelle demande.'
      });
    }

    // Trouver l'utilisateur
    const user = await EcomUser.findById(resetToken.userId);
    if (!user || !user.isActive) {
      return res.status(400).json({ success: false, message: 'Utilisateur non trouv\u00e9 ou inactif' });
    }

    // Mettre \u00e0 jour le mot de passe
    user.password = newPassword;
    await user.save();

    // Marquer le token comme utilis\u00e9
    resetToken.used = true;
    await resetToken.save();

    // Notification de confirmation (non bloquante)
    notifyPasswordChanged(user).catch(err => console.warn('[notif] password_changed:', err.message));

    console.log(`✅ Mot de passe réinitialisé pour ${user.email}`);
    res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error('Erreur reset-password:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/auth/change-password - Changer mot de passe
router.put('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token || !isSupportedAuthToken(token)) {
      return res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
    }

    const decoded = jwt.verify(normalizeToken(token), ECOM_JWT_SECRET);

    const user = await EcomUser.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé ou inactif'
      });
    }

    // Vérifier le mot de passe actuel
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel incorrect'
      });
    }

    // Valider le nouveau mot de passe
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
      });
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();

    // Notification sécurité (non bloquante)
    notifyPasswordChanged(user).catch(err => console.warn('[notif] change_password:', err.message));

    res.json({
      success: true,
      message: 'Mot de passe changé avec succès'
    });
  } catch (error) {
    console.error('Erreur change password e-commerce:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// PUT /api/ecom/auth/currency - Changer la devise de l'utilisateur
router.put('/currency', async (req, res) => {
  try {
    const { currency } = req.body;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token || !isSupportedAuthToken(token)) {
      return res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
    }

    const decoded = jwt.verify(normalizeToken(token), ECOM_JWT_SECRET);

    const user = await EcomUser.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé ou inactif'
      });
    }

    // Valider la devise
    const allowedCurrencies = [
      // Afrique Centrale
      'XAF', 'CDF',
      // Afrique de l'Ouest
      'XOF', 'NGN', 'GHS', 'GNF', 'LRD', 'SLL',
      // Afrique du Nord
      'MAD', 'TND', 'DZD', 'EGP', 'LYD',
      // Afrique de l'Est
      'KES', 'UGX', 'TZS', 'RWF', 'BIF', 'ETB', 'SOS', 'SDG', 'SSP', 'ERN', 'DJF',
      // Afrique Australe
      'ZAR', 'BWP', 'NAD', 'ZMW', 'MZN', 'MWK', 'SZL', 'LSL', 'AOA', 'ZWL',
      // Internationales
      'USD', 'EUR', 'GBP', 'CAD', 'CNY'
    ];
    if (!currency || !allowedCurrencies.includes(currency)) {
      return res.status(400).json({
        success: false,
        message: 'Devise non valide'
      });
    }

    // Mettre à jour la devise
    user.currency = currency;
    await user.save();

    res.json({
      success: true,
      message: 'Devise mise à jour avec succès',
      data: { currency }
    });
  } catch (error) {
    console.error('Erreur change currency e-commerce:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// PUT /api/ecom/auth/avatar - Mettre à jour l'avatar
router.put('/avatar', async (req, res) => {
  try {
    const { avatar } = req.body;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token || !isSupportedAuthToken(token)) {
      return res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
    }

    const decoded = jwt.verify(normalizeToken(token), ECOM_JWT_SECRET);

    const user = await EcomUser.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé ou inactif'
      });
    }

    // Mettre à jour l'avatar
    if (avatar !== undefined) {
      user.avatar = avatar.trim();
      await user.save();
    }

    res.json({
      success: true,
      message: 'Avatar mis à jour avec succès',
      data: { avatar: user.avatar }
    });
  } catch (error) {
    console.error('Erreur update avatar e-commerce:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});


// ─── INVITATIONS PAR LIEN ─────────────────────────────────────────────────────

// Générer un token d'invitation unique
function generateInviteToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// GET /api/ecom/auth/invite/:token - Valider un lien d'invitation
router.get('/invite/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token invitation manquant' });
    }

    const workspace = await Workspace.findOne({ 'invites.token': token })
      .populate('invites.createdBy', 'name email')
      .populate('owner', 'name email');

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Lien d\'invitation invalide ou expiré' });
    }

    const invite = (workspace.invites || []).find((inv) => inv.token === token);
    if (!invite) {
      return res.status(404).json({ success: false, message: 'Lien d\'invitation invalide ou expiré' });
    }

    if (invite.used) {
      return res.status(400).json({ success: false, message: 'Ce lien a déjà été utilisé' });
    }

    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return res.status(404).json({ success: false, message: 'Lien d\'invitation invalide ou expiré' });
    }

    const invitedBy = invite.createdBy?.name || invite.createdBy?.email || workspace.owner?.name || workspace.owner?.email || 'Administrateur';

    res.json({
      success: true,
      data: {
        workspaceName: workspace.name,
        invitedBy,
        expiresAt: invite.expiresAt
      }
    });
  } catch (error) {
    console.error('Erreur validate invite:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/auth/accept-invite - Accepter une invitation
router.post('/accept-invite', requireEcomAuth, async (req, res) => {
  try {
    const { token, role } = req.body;
    const user = req.ecomUser;

    if (!token || !role) {
      return res.status(400).json({ success: false, message: 'Token et rôle requis' });
    }

    const roleMap = {
      livreur: 'ecom_livreur',
      ecom_livreur: 'ecom_livreur',
      ecom_admin: 'ecom_admin',
      ecom_closeuse: 'ecom_closeuse',
      ecom_compta: 'ecom_compta'
    };
    const finalRole = roleMap[role];
    if (!finalRole) {
      return res.status(400).json({ success: false, message: 'Rôle invalide' });
    }

    const workspace = await Workspace.findOne({ 'invites.token': token });

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Lien d\'invitation invalide ou expiré' });
    }

    const invite = (workspace.invites || []).find((inv) => inv.token === token);
    if (!invite || invite.used || (invite.expiresAt && new Date(invite.expiresAt) < new Date())) {
      return res.status(404).json({ success: false, message: 'Lien d\'invitation invalide ou expiré' });
    }

    // Vérifier si l'utilisateur n'est pas déjà dans le workspace
    if (user.workspaces.some(w => w.workspaceId.toString() === workspace._id.toString())) {
      return res.status(400).json({ success: false, message: 'Vous êtes déjà membre de cet espace' });
    }

    // Ajouter l'utilisateur au workspace
    user.addWorkspace(workspace._id, finalRole);

    // Basculer sur ce workspace (comportement attendu après acceptation)
    user.workspaceId = workspace._id;
    user.role = finalRole;

    await user.save();

    // Marquer l'invitation comme utilisée
    invite.used = true;
    invite.usedBy = user._id;
    invite.usedAt = new Date();
    await workspace.save();

    // Notifier le propriétaire du workspace
    // TODO: Envoyer une notification au propriétaire

    const newToken = generateEcomToken(user);

    const populatedUser = await EcomUser.findById(user._id)
      .select('-password')
      .populate('workspaceId', 'name slug');

    const activeWorkspaces = await EcomUser.findById(user._id)
      .populate('workspaces.workspaceId', 'name description createdAt')
      .then((u) => (u ? u.getActiveWorkspaces().map((w) => ({
        _id: w.workspaceId._id,
        name: w.workspaceId.name,
        description: w.workspaceId.description,
        role: w.role,
        joinedAt: w.joinedAt,
        invitedBy: w.invitedBy,
        createdAt: w.workspaceId.createdAt,
        isPrimary: u.workspaceId && u.workspaceId.toString() === w.workspaceId._id.toString()
      })) : []));

    res.json({
      success: true,
      message: 'Invitation acceptée avec succès',
      data: {
        token: newToken,
        user: populatedUser,
        workspace: populatedUser?.workspaceId || null,
        workspaces: activeWorkspaces,
        workspaceId: workspace._id,
        workspaceName: workspace.name,
        role: finalRole
      }
    });
  } catch (error) {
    console.error('Erreur accept invite:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/auth/generate-invite - Générer un lien d'invitation
router.post('/generate-invite', requireEcomAuth, async (req, res) => {
  try {
    const user = req.ecomUser;

    if (!user || !user.workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Aucun workspace associé à cet utilisateur'
      });
    }

    // Vérifier que l'utilisateur est admin de son workspace
    if (!['ecom_admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Permission refusée' });
    }

    const workspace = await Workspace.findById(user.workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace non trouvé' });
    }

    // Générer un token d'invitation
    const token = crypto.randomBytes(32).toString('hex');

    // Sauvegarder l'invitation
    if (!Array.isArray(workspace.invites)) workspace.invites = [];
    workspace.invites.push({
      token,
      createdBy: user._id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      used: false
    });
    await workspace.save();

    const configuredFrontend = (process.env.FRONTEND_URL || '').trim();
    const isLocalFrontend = /localhost|127\.0\.0\.1/i.test(configuredFrontend);
    const frontendBase = (!configuredFrontend || isLocalFrontend)
      ? 'https://scalor.site'
      : configuredFrontend.replace(/\/$/, '');
    const inviteLink = `${frontendBase}/ecom/invite/${token}`;

    console.log(`🔗 Invitation générée par ${user.email}: ${inviteLink}`);

    await logAudit(req, 'GENERATE_INVITE', `Lien d'invitation généré par ${user.email}`, 'workspace', workspace._id.toString());

    res.json({
      success: true,
      message: 'Lien d\'invitation généré',
      data: {
        token,
        inviteLink,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
  } catch (error) {
    console.error('Erreur generate invite:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/auth/sessions - Liste des sessions actives de l'utilisateur
router.get('/sessions', requireEcomAuth, async (req, res) => {
  try {
    const user = req.ecomUser;
    const currentToken = req.header('Authorization')?.replace('Bearer ', '');
    
    // Importer AnalyticsSession
    const AnalyticsSession = (await import('../models/AnalyticsSession.js')).default;
    
    // Récupérer les sessions actives (dernière activité < 30 jours)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sessions = await AnalyticsSession.find({
      userId: user._id,
      lastActivityAt: { $gte: thirtyDaysAgo },
      endedAt: null
    })
    .sort({ lastActivityAt: -1 })
    .limit(20)
    .lean();

    // Déterminer la session actuelle
    let currentSessionId = null;
    if (currentToken) {
      try {
        const decoded = jwt.verify(normalizeToken(currentToken), ECOM_JWT_SECRET);
        currentSessionId = decoded.sessionId || req.headers['x-session-id'];
      } catch (err) {
        // Token invalide, pas grave
      }
    }

    const sessionsWithCurrent = sessions.map(s => ({
      ...s,
      isCurrent: s.sessionId === currentSessionId || s.sessionId === req.headers['x-session-id']
    }));

    res.json({
      success: true,
      data: { sessions: sessionsWithCurrent }
    });
  } catch (error) {
    console.error('Erreur récupération sessions:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/auth/sessions/:sessionId - Déconnecter une session spécifique
router.delete('/sessions/:sessionId', requireEcomAuth, async (req, res) => {
  try {
    const user = req.ecomUser;
    const { sessionId } = req.params;
    
    const AnalyticsSession = (await import('../models/AnalyticsSession.js')).default;
    
    // Marquer la session comme terminée
    const session = await AnalyticsSession.findOne({
      sessionId,
      userId: user._id
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session non trouvée'
      });
    }

    session.endedAt = new Date();
    await session.save();

    await logAudit(req, 'SESSION_REVOKED', `Session ${sessionId} révoquée`, 'auth', user._id);

    res.json({
      success: true,
      message: 'Session déconnectée avec succès'
    });
  } catch (error) {
    console.error('Erreur déconnexion session:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/auth/sessions - Déconnecter toutes les sessions (sauf la session actuelle)
router.delete('/sessions', requireEcomAuth, async (req, res) => {
  try {
    const user = req.ecomUser;
    const currentToken = req.header('Authorization')?.replace('Bearer ', '');
    
    const AnalyticsSession = (await import('../models/AnalyticsSession.js')).default;
    
    // Déterminer la session actuelle
    let currentSessionId = null;
    if (currentToken) {
      try {
        const decoded = jwt.verify(normalizeToken(currentToken), ECOM_JWT_SECRET);
        currentSessionId = decoded.sessionId || req.headers['x-session-id'];
      } catch (err) {
        currentSessionId = req.headers['x-session-id'];
      }
    }

    // Terminer toutes les sessions actives sauf la session actuelle
    const result = await AnalyticsSession.updateMany(
      {
        userId: user._id,
        sessionId: { $ne: currentSessionId },
        endedAt: null
      },
      {
        $set: { endedAt: new Date() }
      }
    );

    await logAudit(req, 'ALL_SESSIONS_REVOKED', `${result.modifiedCount} sessions révoquées`, 'auth', user._id);

    res.json({
      success: true,
      message: `${result.modifiedCount} session(s) déconnectée(s)`,
      data: { count: result.modifiedCount }
    });
  } catch (error) {
    console.error('Erreur déconnexion toutes sessions:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
