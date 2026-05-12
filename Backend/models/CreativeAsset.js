import mongoose from 'mongoose';

/**
 * CreativeAsset — Stockage des visuels générés par le Creative Generator.
 * Un document = un visuel généré (une slide pour un workspace/user).
 */
const creativeAssetSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EcomWorkspace',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EcomUser',
      required: true,
      index: true,
    },
    productName: { type: String, default: '', trim: true },
    formatId:    { type: String, default: '' },   // ex: 'hero-benefits'
    label:       { type: String, default: '' },   // ex: 'Bénéfices Clés'
    imageUrl:    { type: String, required: true },
    aspectRatio: { type: String, default: '1:1' },
    // Optional tags for filtering
    category:    { type: String, default: '' },
    template:    { type: String, default: '' },
  },
  { timestamps: true }
);

// Composite index for fast workspace+date queries
creativeAssetSchema.index({ workspaceId: 1, createdAt: -1 });

export default mongoose.model('CreativeAsset', creativeAssetSchema);
