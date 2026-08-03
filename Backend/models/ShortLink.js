import mongoose from 'mongoose';

// Lien court : scalor.net/s/{slug} -> targetUrl
// Scopé par workspace (chaque marchand gère ses liens),
// mais le slug est unique globalement (un seul espace de noms /s/*).
const shortLinkSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    targetUrl: { type: String, required: true, maxlength: 2000 },
    title: { type: String, default: '', maxlength: 200 },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser' },
    active: { type: Boolean, default: true },
    // Compteurs dénormalisés (les détails vivent dans ShortLinkClick)
    clicks: { type: Number, default: 0 },
    previews: { type: Number, default: 0 }, // bots de preview WhatsApp/FB/etc.
    lastClickAt: { type: Date },
  },
  { timestamps: true }
);

shortLinkSchema.index({ workspaceId: 1, createdAt: -1 });

export default mongoose.models.ShortLink || mongoose.model('ShortLink', shortLinkSchema);
