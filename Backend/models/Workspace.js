import mongoose from 'mongoose';
import crypto from 'crypto';

const workspaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  },
  inviteCode: {
    type: String,
    unique: true
  },
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      currency: 'XOF',
      businessType: 'ecommerce'
    }
  },
  // Public store subdomain — generates https://{subdomain}.scalor.app
  subdomain: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  // Store configuration for public storefront
  storeSettings: {
    isStoreEnabled: { type: Boolean, default: false },
    storeName: { type: String, trim: true, default: '' },
    storeDescription: { type: String, trim: true, default: '' },
    storeLogo: { type: String, default: '' },
    storeBanner: { type: String, default: '' },
    storePhone: { type: String, default: '' },
    storeWhatsApp: { type: String, default: '' },
    storeThemeColor: { type: String, default: '#0F6B4F' },
    storeCurrency: { type: String, default: 'XAF' }
  },
  whatsappConfig: {
    phoneNumber: { type: String, default: '' },
    status: { type: String, enum: ['none', 'pending', 'active'], default: 'none' },
    requestedAt: { type: Date },
    activatedAt: { type: Date },
    note: { type: String, default: '' }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  invites: [{
    token: {
      type: String,
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EcomUser',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
    },
    used: {
      type: Boolean,
      default: false
    },
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EcomUser'
    },
    usedAt: {
      type: Date
    }
  }]
}, {
  collection: 'ecom_workspaces',
  timestamps: true
});

// Générer slug et inviteCode avant sauvegarde
workspaceSchema.pre('save', function () {
  if (this.isNew) {
    if (!this.slug) {
      this.slug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
    }
    if (!this.inviteCode) {
      this.inviteCode = crypto.randomBytes(6).toString('hex');
    }
  }
});

// Régénérer le code d'invitation
workspaceSchema.methods.regenerateInviteCode = function () {
  this.inviteCode = crypto.randomBytes(6).toString('hex');
  return this.save();
};

// Créer une invitation par lien
workspaceSchema.methods.createInviteLink = function (createdBy) {
  const token = crypto.randomBytes(32).toString('hex');
  this.invites.push({
    token,
    createdBy,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
  });
  return this.save().then(() => token);
};

workspaceSchema.index({ owner: 1 });
// Subdomain lookup for public store routing
workspaceSchema.index({ subdomain: 1 }, { unique: true, sparse: true });
// Compound index for resolveWorkspace middleware query
workspaceSchema.index({ subdomain: 1, isActive: 1, 'storeSettings.isStoreEnabled': 1 });

export default mongoose.model('EcomWorkspace', workspaceSchema);
