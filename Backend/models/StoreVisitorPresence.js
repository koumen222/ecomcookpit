import mongoose from 'mongoose';

/**
 * Présence "temps réel" des visiteurs du storefront (Live View façon Shopify).
 * Un document par visiteur actif, upserté par heartbeat (~20 s côté client).
 * TTL Mongo : purge automatique 15 min après le dernier signe de vie —
 * le "en ce moment" côté API filtre sur lastSeenAt > now - 5 min.
 */
const storeVisitorPresenceSchema = new mongoose.Schema({
  workspaceId: { type: String, required: true, index: true },
  storeId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null, index: true },
  subdomain:   { type: String, required: true, index: true },

  visitorId:   { type: String, required: true },
  sessionId:   { type: String, default: '' },

  // Où il est maintenant
  page: {
    path:  { type: String, default: '' },
    title: { type: String, default: '' },
  },
  productId:   { type: String, default: null },
  productName: { type: String, default: '' },

  // Qui il est
  device:   { type: String, enum: ['desktop', 'mobile', 'tablet', 'unknown'], default: 'unknown' },
  browser:  { type: String, default: '' },
  country:  { type: String, default: '' },
  city:     { type: String, default: '' },
  referrer: { type: String, default: '' },

  // Progression dans le tunnel (max atteint sur la session)
  // 1 = navigation, 2 = fiche produit, 3 = checkout entamé, 4 = commande passée
  funnelStage: { type: Number, default: 1, min: 1, max: 4 },

  firstSeenAt: { type: Date, default: Date.now },
  // L'index TTL déclaré plus bas couvre aussi les filtres sur lastSeenAt.
  // Ne pas ajouter un second index simple sur la même clé : MongoDB peut
  // refuser sa création avec IndexOptionsConflict.
  lastSeenAt:  { type: Date, default: Date.now },
}, {
  timestamps: false,
  collection: 'store_visitor_presence',
});

// Un seul doc par visiteur et par boutique
storeVisitorPresenceSchema.index({ subdomain: 1, visitorId: 1 }, { unique: true });
storeVisitorPresenceSchema.index({ workspaceId: 1, lastSeenAt: -1 });
// Purge auto : 15 min après le dernier heartbeat
storeVisitorPresenceSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 15 * 60 });

export default mongoose.model('StoreVisitorPresence', storeVisitorPresenceSchema);
