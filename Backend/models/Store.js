import mongoose from 'mongoose';

/**
 * Store — One workspace can have multiple stores (boutiques).
 * Each store has its own subdomain, branding, products, and orders.
 * Migrated from EcomWorkspace fields (storeSettings, storeTheme, etc.)
 * Legacy workspaces without a Store doc still work via Workspace.subdomain fallback.
 */
const storeSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Public subdomain → https://{subdomain}.scalor.net (unique across ALL stores)
  subdomain: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Full store settings (mirrors Workspace.storeSettings)
  storeSettings: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      isStoreEnabled: true,
      storeName: '',
      storeDescription: '',
      storeLogo: '',
      storeBanner: '',
      storePhone: '',
      storeWhatsApp: '',
      storeThemeColor: '#0F6B4F',
      storeCurrency: 'XAF'
    }
  },
  storeTheme: { type: mongoose.Schema.Types.Mixed, default: {} },
  storePages: { type: mongoose.Schema.Types.Mixed, default: null },
  storePixels: { type: mongoose.Schema.Types.Mixed, default: {} },
  storePayments: { type: mongoose.Schema.Types.Mixed, default: {} },
  storeDomains: { type: mongoose.Schema.Types.Mixed, default: {} },
  storeDeliveryZones: {
    type: mongoose.Schema.Types.Mixed,
    default: { countries: [], zones: [] }
  },
  // WhatsApp automation (mirrors Workspace)
  whatsappAutoConfirm: { type: Boolean, default: false },
  whatsappOrderTemplate: { type: String, default: '' },
  whatsappAutoInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppInstance', default: null },
  whatsappAutoImageUrl: { type: String, default: '' },
  whatsappAutoAudioUrl: { type: String, default: '' },
  whatsappAutoVideoUrl: { type: String, default: '' },
  whatsappAutoDocumentUrl: { type: String, default: '' },
  whatsappAutoSendOrder: { type: [String], default: [] },
  whatsappAutoProductMediaRules: { type: mongoose.Schema.Types.Mixed, default: [] },
  // Webhooks
  shopifyWebhookToken: { type: String, unique: true, sparse: true },
  orderWebhookToken: { type: String, unique: true, sparse: true },
  orderWebhookFilters: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser'
  }
}, {
  collection: 'stores',
  timestamps: true
});

storeSchema.index({ workspaceId: 1, isActive: 1 });
storeSchema.index({ subdomain: 1, isActive: 1, 'storeSettings.isStoreEnabled': 1 });

export default mongoose.model('Store', storeSchema);
