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
  // Marché de la boutique — code pays ISO 3166-1 alpha-2 (CM, CI, SN, BJ, TG, TD…).
  // Obligatoire à la création (routes/stores.js), pas d'enum figé : la liste
  // s'étend sans migration. Passer à une collection Marché dédiée si un pays
  // doit porter de la config (devise, zones, passerelle mobile money).
  market: {
    type: String,
    uppercase: true,
    trim: true,
    default: null,
    index: true
  },
  // Closeuse active de la boutique (une à la fois ; une closeuse peut couvrir
  // plusieurs boutiques). Copiée FIGÉE sur Order.closerId à la création de
  // chaque commande — jamais recalculée (le suivi perf/commission reste vrai
  // après réassignation).
  closerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    default: null,
    index: true
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
  // Footer + pages légales (À propos, CGV, confidentialité…) du storefront.
  // IMPORTANT : sans ces champs déclarés, mongoose (strict) IGNORAIT
  // silencieusement leur sauvegarde → boutiques multi-store sans pages.
  storeFooter: { type: mongoose.Schema.Types.Mixed, default: null },
  storeLegalPages: { type: mongoose.Schema.Types.Mixed, default: null },
  storePixels: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Synchro Google Sheets des commandes (service account) : chaque nouvelle
  // commande de la boutique est ajoutée dans la feuille du marchand.
  // { enabled, spreadsheetId, sheetName, lastSyncAt, lastError, lastErrorAt }
  storeSheetSync: { type: mongoose.Schema.Types.Mixed, default: null },
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
storeSchema.index({ 'storeDomains.customDomain': 1, isActive: 1, 'storeSettings.isStoreEnabled': 1 });

export default mongoose.model('Store', storeSchema);
