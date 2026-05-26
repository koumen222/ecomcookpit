import crypto from 'crypto';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';

// ═══════════════════════════════════════════════════════════════
// VÉRIFICATION DES VARIABLES CRITIQUES AU DÉMARRAGE
// ═══════════════════════════════════════════════════════════════
const REQUIRED_SECRETS = ['DATA_ENCRYPTION_KEY', 'ECOM_JWT_SECRET', 'SESSION_SECRET'];
for (const key of REQUIRED_SECRETS) {
  const val = process.env[key];
  if (!val || val.startsWith('CHANGE_ME') || val === 'default-change-me') {
    console.error(`🚨 SÉCURITÉ CRITIQUE: La variable d'environnement ${key} est absente ou non configurée.`);
    if (process.env.NODE_ENV === 'production') {
      console.error('Arrêt du serveur — impossible de démarrer sans secrets valides en production.');
      process.exit(1);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. CHIFFREMENT AES-256 DES DONNÉES SENSIBLES
// ═══════════════════════════════════════════════════════════════

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey() {
  const secret = process.env.DATA_ENCRYPTION_KEY;
  if (!secret || secret.startsWith('CHANGE_ME')) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATA_ENCRYPTION_KEY manquant — impossible de chiffrer en production');
    }
    console.warn('⚠️ DATA_ENCRYPTION_KEY non défini — utilisation d\'une clé de développement temporaire');
  }
  return crypto.scryptSync(secret || 'dev-only-key-not-for-production', 'ecom-cockpit-salt', 32);
}

export function encryptField(text) {
  if (!text || typeof text !== 'string') return text;
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    // Format: iv:tag:encrypted
    return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('Erreur chiffrement:', err.message);
    return text;
  }
}

export function decryptField(encryptedText) {
  if (!encryptedText || typeof encryptedText !== 'string' || !encryptedText.startsWith('enc:')) return encryptedText;
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const encrypted = parts[3];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Erreur déchiffrement:', err.message);
    return '[DONNÉES PROTÉGÉES]';
  }
}

// Masquer un numéro de téléphone : +212612345678 → +212****5678
export function maskPhone(phone) {
  if (!phone || phone.length < 6) return '****';
  return phone.slice(0, 4) + '****' + phone.slice(-4);
}

// Masquer un email : morgan@gmail.com → m****n@gmail.com
export function maskEmail(email) {
  if (!email || !email.includes('@')) return '****';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return local[0] + '****@' + domain;
  return local[0] + '****' + local[local.length - 1] + '@' + domain;
}

// ═══════════════════════════════════════════════════════════════
// 2. MODÈLE AUDIT LOG — TRACE IMMUABLE DE TOUTE ACTION
// ═══════════════════════════════════════════════════════════════

const auditLogSchema = new mongoose.Schema({
  // Qui a fait l'action
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', required: true },
  userEmail: { type: String, required: true },
  userRole: { type: String, required: true },
  userIp: { type: String, default: 'unknown' },
  
  // Quoi
  action: { type: String, required: true, enum: [
    'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
    'VIEW_USERS', 'VIEW_USER_DETAIL', 'VIEW_ORDERS', 'VIEW_CLIENTS',
    'CREATE_ORDER', 'UPDATE_ORDER', 'DELETE_ORDER',
    'CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'CHANGE_ROLE', 'TOGGLE_USER',
    'VIEW_ALL_WORKSPACES', 'TOGGLE_WORKSPACE',
    'IMPERSONATE_USER', 'STOP_IMPERSONATION',
    'GENERATE_INVITE', 'ACCEPT_INVITE', 'RESET_PASSWORD',
    'EXPORT_DATA', 'SYNC_DATA',
    'VIEW_SENSITIVE_DATA', 'DECRYPT_DATA',
    'SETTINGS_CHANGE', 'SECURITY_EVENT',
    'DELETE_ALL_USER_DATA',
    'WHATSAPP_POSTULATION_UPDATE'
  ]},
  
  // Détails
  resource: { type: String }, // 'user', 'order', 'workspace', etc.
  resourceId: { type: String },
  details: { type: String, maxlength: 500 },
  
  // Contexte
  workspaceId: { type: mongoose.Schema.Types.ObjectId },
  method: { type: String }, // GET, POST, PUT, DELETE
  path: { type: String },
  
  // Sécurité — hash pour empêcher la modification du log
  integrityHash: { type: String }
}, {
  collection: 'ecom_audit_logs',
  timestamps: true
});

// Empêcher la modification et suppression des logs
auditLogSchema.pre('findOneAndUpdate', function() {
  throw new Error('Les logs d\'audit ne peuvent pas être modifiés');
});
auditLogSchema.pre('findOneAndDelete', function() {
  throw new Error('Les logs d\'audit ne peuvent pas être supprimés');
});
auditLogSchema.pre('deleteOne', function() {
  throw new Error('Les logs d\'audit ne peuvent pas être supprimés');
});
auditLogSchema.pre('deleteMany', function() {
  throw new Error('Les logs d\'audit ne peuvent pas être supprimés');
});
auditLogSchema.pre('updateOne', function() {
  throw new Error('Les logs d\'audit ne peuvent pas être modifiés');
});
auditLogSchema.pre('updateMany', function() {
  throw new Error('Les logs d\'audit ne peuvent pas être modifiés');
});

// Générer un hash d'intégrité avant la sauvegarde
auditLogSchema.pre('save', function() {
  if (this.isNew) {
    const data = `${this.userId}|${this.action}|${this.createdAt || Date.now()}|${this.details || ''}`;
    this.integrityHash = crypto.createHash('sha256').update(data).digest('hex');
  }
});

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ workspaceId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model('EcomAuditLog', auditLogSchema);

// Fonction helper pour créer un log
export async function logAudit(req, action, details = '', resourceType = '', resourceId = '') {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    await AuditLog.create({
      userId: req.ecomUser?._id,
      userEmail: req.ecomUser?.email || 'unknown',
      userRole: req.ecomUser?.role || 'unknown',
      userIp: typeof ip === 'string' ? ip.split(',')[0].trim() : 'unknown',
      action,
      resource: resourceType,
      resourceId: resourceId?.toString() || '',
      details: details.substring(0, 500),
      workspaceId: req.workspaceId || null,
      method: req.method,
      path: req.originalUrl?.substring(0, 200)
    });
  } catch (err) {
    console.error('⚠️ Erreur audit log:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. MIDDLEWARE DE SÉCURITÉ HTTP
// ═══════════════════════════════════════════════════════════════

export function securityHeaders(req, res, next) {
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Empêcher le sniffing MIME
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Protection XSS legacy
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Empêcher le clickjacking (SAMEORIGIN permet l'iframe du builder)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Allow Google Sign-In popup to communicate back without COOP warnings
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  // Strict Transport Security — toujours envoyé (Cloudflare/Railway gère HTTPS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions Policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // ── Content Security Policy ─────────────────────────────────────────────────
  // IMPORTANT : tous les domaines des pixels publicitaires DOIVENT être whitelist
  // ici, sinon le navigateur bloque silencieusement le chargement des scripts
  // (fbevents.js, TikTok, GA, Snapchat) et Meta/TikTok/Google ne reçoit AUCUN
  // event. Le marchand voit "Aucune action disponible" dans Events Manager.
  //
  // script-src   : les fichiers .js des pixels
  // img-src      : les pixels HTTP (1x1 pings de fallback)
  // connect-src  : les fetch/XHR/beacon que les pixels envoient
  // frame-src    : iframes (Stripe checkout, certains tags Meta)
  // style-src    : Google Fonts, Fontshare
  // font-src     : fichiers de fonts
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      [
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        // Paiements
        "https://js.stripe.com https://checkout.stripe.com",
        // Google Sign-In (GSI)
        "https://accounts.google.com https://apis.google.com",
        // Meta / Facebook
        "https://connect.facebook.net https://*.facebook.net https://*.facebook.com",
        // TikTok
        "https://analytics.tiktok.com https://*.tiktok.com",
        // Google Tag / Ads / GA4
        "https://www.googletagmanager.com https://www.google-analytics.com https://*.googletagmanager.com https://*.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net",
        // Snapchat
        "https://sc-static.net https://*.snapchat.com",
        // PostHog (analytics interne)
        "https://*.posthog.com",
      ].join(' '),
      [
        "style-src 'self' 'unsafe-inline'",
        "https://fonts.googleapis.com https://api.fontshare.com https://cdn.fontshare.com",
      ].join(' '),
      [
        "font-src 'self' data:",
        "https://fonts.gstatic.com https://api.fontshare.com https://cdn.fontshare.com",
      ].join(' '),
      [
        "img-src 'self' data: blob:",
        "https://*.cloudinary.com https://*.r2.dev https://res.cloudinary.com",
        // Domaines Scalor (logos, icons, banners de fallback)
        "https://scalor.net https://*.scalor.net",
        // Pixel pings (1x1 image trackers)
        "https://www.facebook.com https://*.facebook.com",
        "https://analytics.tiktok.com https://*.tiktok.com",
        "https://www.google-analytics.com https://www.googletagmanager.com https://*.google-analytics.com https://*.googletagmanager.com https://stats.g.doubleclick.net https://googleads.g.doubleclick.net",
        "https://sc-static.net https://tr.snapchat.com https://*.snapchat.com",
      ].join(' '),
      [
        "connect-src 'self'",
        // API Scalor
        "https://api.scalor.net https://*.scalor.net https://*.railway.app",
        // Sockets (WebSocket pour store:updated)
        "wss://api.scalor.net wss://*.scalor.net wss://*.railway.app",
        // PostHog
        "https://*.posthog.com https://us.i.posthog.com https://us-assets.i.posthog.com",
        // Meta — events POST vers /tr/
        "https://www.facebook.com https://*.facebook.com https://graph.facebook.com",
        // TikTok events
        "https://analytics.tiktok.com https://*.tiktok.com",
        // Google Analytics / Ads
        "https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://*.googletagmanager.com https://stats.g.doubleclick.net https://googleads.g.doubleclick.net",
        // Snapchat events
        "https://tr.snapchat.com https://*.snapchat.com",
        // Google Fonts (fetch CSS depuis service worker)
        "https://fonts.googleapis.com https://fonts.gstatic.com",
        // Fontshare (Satoshi font CSS)
        "https://api.fontshare.com https://cdn.fontshare.com",
      ].join(' '),
      [
        "frame-src 'self'",
        "https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com",
        // Google Sign-In iframe
        "https://accounts.google.com",
        // Certains tags Meta utilisent un iframe pour le tracking cross-domain
        "https://www.facebook.com https://*.facebook.com",
        "https://td.doubleclick.net",
      ].join(' '),
      "frame-ancestors 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      // 'object-src none' bloque Flash/applets — recommandé Meta
      "object-src 'none'",
    ].join('; ')
  );
  // Cache pour les API
  if (req.url.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
}

// ═══════════════════════════════════════════════════════════════
// 4. MIDDLEWARE D'AUDIT AUTOMATIQUE POUR ROUTES SENSIBLES
// ═══════════════════════════════════════════════════════════════

export function auditSensitiveAccess(action, resourceType = '') {
  return async (req, res, next) => {
    if (req.ecomUser) {
      const details = `${req.ecomUser.email} (${req.ecomUser.role}) - ${req.method} ${req.originalUrl}`;
      await logAudit(req, action, details, resourceType, req.params?.id);
    }
    next();
  };
}

// ═══════════════════════════════════════════════════════════════
// 5. RATE LIMITERS
// ═══════════════════════════════════════════════════════════════

// Authentification : 10 tentatives par 15 minutes par IP
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
  skipSuccessfulRequests: false,
});

// Mot de passe oublié : 5 requêtes par heure par IP
export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de demandes de réinitialisation. Réessayez dans 1 heure.' },
});

// API générale : 300 requêtes par minute par IP
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes. Ralentissez.' },
  skip: (req) => req.ecomUser?.role === 'super_admin',
});
