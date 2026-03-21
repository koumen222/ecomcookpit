import mongoose from 'mongoose';
import crypto from 'crypto';

const scalorApiKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScalorUser',
    required: true,
    index: true
  },
  // The actual API key (hashed for storage)
  keyHash: {
    type: String,
    required: true,
    unique: true
  },
  // Prefix for identification (first 8 chars of key, e.g. "sk_live_abc12345...")
  keyPrefix: {
    type: String,
    required: true
  },
  name: {
    type: String,
    default: 'Default API Key',
    trim: true
  },
  // Permissions
  permissions: {
    type: [String],
    default: ['instance:read', 'instance:create', 'message:send', 'message:read', 'webhook:manage']
  },
  // Rate limiting per key
  rateLimit: {
    type: Number,
    default: 60  // requests per minute
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  }
}, {
  collection: 'scalor_api_keys',
  timestamps: true
});

/**
 * Generate a new API key
 * Returns the raw key (to show once) and saves the hash
 */
scalorApiKeySchema.statics.generateKey = function (type = 'live') {
  const randomPart = crypto.randomBytes(32).toString('hex');
  const rawKey = `sk_${type}_${randomPart}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 16);
  return { rawKey, keyHash, keyPrefix };
};

/**
 * Find a key by raw API key value
 */
scalorApiKeySchema.statics.findByRawKey = function (rawKey) {
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  return this.findOne({ keyHash, isActive: true });
};

scalorApiKeySchema.index({ keyHash: 1 });
scalorApiKeySchema.index({ userId: 1 });

export default mongoose.model('ScalorApiKey', scalorApiKeySchema);
