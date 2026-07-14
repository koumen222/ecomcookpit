import mongoose from 'mongoose';

/**
 * Collection — regroupement éditorial de produits d'une boutique
 * (équivalent des collections Shopify). Sélection manuelle de produits,
 * image de couverture, slug public /collections/:slug.
 */
const collectionSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    required: true,
    index: true,
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    default: null,
    index: true,
  },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 140 },
  description: { type: String, default: '', maxlength: 2000 },
  image: { type: String, default: '' },
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StoreProduct' }],
  enabled: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, {
  collection: 'store_collections',
  timestamps: true,
});

// Un slug unique par boutique (storeId null = boutique legacy du workspace)
collectionSchema.index({ workspaceId: 1, storeId: 1, slug: 1 }, { unique: true });
collectionSchema.index({ workspaceId: 1, storeId: 1, enabled: 1, sortOrder: 1 });

export default mongoose.model('Collection', collectionSchema);
