import crypto from 'crypto';
import mongoose from 'mongoose';

// ═══════════════════════════════════════════════════════════════
// 1. CHIFFREMENT AES-256 DES DONNÉES SENSIBLES
// ═══════════════════════════════════════════════════════════════

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Clé dérivée du secret — même toi (le propriétaire) ne peux pas lire les données sans cette clé
function getEncryptionKey() {
  const secret = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-change-me';
  return crypto.scryptSync(secret, 'ecom-cockpit-salt', 32);
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
    'SETTINGS_CHANGE', 'SECURITY_EVENT'
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
  // Don't set security headers for CORS preflight requests
  if (req.method === 'OPTIONS') {
    return next();
  }
  
  // Empêcher le sniffing MIME
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Protection XSS
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Empêcher le clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Strict Transport Security (only for HTTPS)
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions Policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
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
// 5. RATE LIMITER - DÉSACTIVÉ
// ═══════════════════════════════════════════════════════════════
// Rate limiting désactivé pour permettre des connexions illimitées
