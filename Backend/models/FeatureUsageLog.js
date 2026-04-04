import mongoose from 'mongoose';

/**
 * FeatureUsageLog — Trace chaque utilisation d'une fonctionnalité par workspace/user.
 * Utilisé par le super admin pour voir la fréquence d'usage de chaque feature.
 *
 * TTL : 365 jours
 */
const featureUsageSchema = new mongoose.Schema({
  // Contexte
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomWorkspace', required: true, index: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', required: true, index: true },

  // Feature trackée
  feature: {
    type: String,
    required: true,
    index: true,
    enum: [
      'product_page_generator',   // Générateur de page produit (IA)
      'creative_generator',        // Générateur de créas publicitaires
      'commercial_ia',             // Commercial IA (Rita / agent)
      'boutique_store',            // Boutique en ligne (commande reçue)
      'whatsapp_campaign',         // Campagne WhatsApp envoyée
      'whatsapp_auto_confirm',     // WhatsApp auto-confirmation commande
      'order_created',             // Commande créée manuellement
      'order_shopify',             // Commande Shopify webhook
      'order_skelor',              // Commande via boutique Skelo
      'pixel_tracking',            // Pixel FB/TikTok configuré
      'delivery_offer',            // Offre livreur envoyée
      'custom_domain',             // Domaine personnalisé configuré
    ]
  },

  // Metadata contextuelles
  meta: {
    // Pour product_page_generator
    generationType: { type: String }, // 'free' | 'paid'
    productUrl:     { type: String },
    productName:    { type: String },

    // Pour creative_generator
    slideType:      { type: String },
    slideCount:     { type: Number },

    // Pour commercial_ia / Rita
    activityType:   { type: String },
    customerPhone:  { type: String },

    // Pour campaigns
    campaignId:     { type: String },
    recipientCount: { type: Number },

    // Pour orders
    orderSource:    { type: String },
    orderTotal:     { type: Number },

    // Général
    success:        { type: Boolean, default: true },
    errorMessage:   { type: String },
    durationMs:     { type: Number },
  }
}, {
  timestamps: true,
  collection: 'feature_usage_logs',
});

// Index composés pour les agrégations super admin
featureUsageSchema.index({ feature: 1, createdAt: -1 });
featureUsageSchema.index({ workspaceId: 1, feature: 1, createdAt: -1 });
featureUsageSchema.index({ userId: 1, feature: 1, createdAt: -1 });
featureUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 }); // TTL 1 an

export default mongoose.model('FeatureUsageLog', featureUsageSchema);
