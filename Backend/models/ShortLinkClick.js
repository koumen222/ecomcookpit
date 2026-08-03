import mongoose from 'mongoose';

// Un document par clic (les bots de preview sont marqués isBot
// et comptés à part — ils ne polluent pas les stats).
const shortLinkClickSchema = new mongoose.Schema(
  {
    linkId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShortLink', index: true },
    slug: { type: String, required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
    country: { type: String, default: '??' },   // code ISO via geoip-lite
    city: { type: String, default: '' },
    device: { type: String, default: 'desktop' }, // android | ios | desktop
    source: { type: String, default: 'direct' },  // whatsapp | facebook | tiktok | … (utm > UA > referer)
    referer: { type: String, default: '' },
    isBot: { type: Boolean, default: false },
    ipHash: { type: String, default: '' },        // sha256 tronqué (jamais l'IP en clair)
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

shortLinkClickSchema.index({ slug: 1, createdAt: -1 });
shortLinkClickSchema.index({ workspaceId: 1, createdAt: -1 });

export default mongoose.models.ShortLinkClick || mongoose.model('ShortLinkClick', shortLinkClickSchema);
