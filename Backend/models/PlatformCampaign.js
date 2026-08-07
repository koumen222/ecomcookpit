import mongoose from 'mongoose';

/**
 * Campagne marketing PLATEFORME — émise depuis le super admin vers les
 * utilisateurs de Scalor (marchands inscrits + inscrits newsletter plateforme).
 *
 * Jamais vers les clients finaux des marchands : ce consentement-là appartient
 * au marchand qui l'a collecté, pas à la plateforme. Les modèles Client et
 * NewsletterSubscriber sont volontairement hors de portée d'ici.
 *
 * Une annonce de fonctionnalité et une campagne sont le MÊME objet — seul
 * `kind` change, et une annonce ajoute un affichage in-app (`placement`).
 * Deux modèles séparés auraient divergé dès la première colonne ajoutée, et
 * l'annonce se serait retrouvée sans statistiques ni planification.
 */

const emailContentSchema = new mongoose.Schema({
  subject: { type: String, default: '' },
  // Texte d'aperçu affiché après l'objet dans la boîte de réception. Absent, le
  // client mail affiche le début du HTML — souvent « Voir dans le navigateur ».
  preheader: { type: String, default: '' },
  html: { type: String, default: '' },
  // Version texte : son absence est un des premiers signaux de spam.
  text: { type: String, default: '' },
  fromName: { type: String, default: '' },
  ctaLabel: { type: String, default: '' },
  ctaUrl: { type: String, default: '' },
}, { _id: false });

const whatsappContentSchema = new mongoose.Schema({
  text: { type: String, default: '' },
  mediaUrl: { type: String, default: '' },
  mediaType: { type: String, enum: ['image', 'video', 'none'], default: 'none' },
}, { _id: false });

const pushContentSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  body: { type: String, default: '' },
  url: { type: String, default: '' },
  icon: { type: String, default: '' },
}, { _id: false });

const audienceSchema = new mongoose.Schema({
  // 'users' = EcomUser (marchands) · 'subscribers' = PlatformSubscriber
  sources: [{ type: String, enum: ['users', 'subscribers'], default: 'users' }],
  filters: {
    plans: [{ type: String }],
    roles: [{ type: String }],
    acquisitionSources: [{ type: String }],
    signedUpAfter: { type: Date, default: null },
    signedUpBefore: { type: Date, default: null },
    activeWithinDays: { type: Number, default: null },
    inactiveSinceDays: { type: Number, default: null },
    hasStore: { type: Boolean, default: null },
    hasWhatsappInstance: { type: Boolean, default: null },
    minSparks: { type: Number, default: null },
    maxSparks: { type: Number, default: null },
    countries: [{ type: String }],
    // Ciblage manuel : ids explicites, ignore tous les filtres ci-dessus.
    explicitUserIds: [{ type: mongoose.Schema.Types.ObjectId }],
  },
  // Adresses / numéros de test, ne comptent jamais dans les statistiques.
  testEmails: [{ type: String }],
  testPhones: [{ type: String }],
}, { _id: false });

const placementSchema = new mongoose.Schema({
  // Où l'annonce apparaît dans l'app. Vide = pas d'affichage in-app.
  surfaces: [{
    type: String,
    enum: ['dashboard_banner', 'creative_home', 'sidebar_badge', 'login_modal', 'notification_center'],
  }],
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
  dismissible: { type: Boolean, default: true },
  variant: { type: String, enum: ['info', 'success', 'warning', 'feature'], default: 'feature' },
  imageUrl: { type: String, default: '' },
  title: { type: String, default: '' },
  body: { type: String, default: '' },
  ctaLabel: { type: String, default: '' },
  ctaUrl: { type: String, default: '' },
}, { _id: false });

const channelStatsSchema = new mongoose.Schema({
  targeted: { type: Number, default: 0 },
  sent: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  opened: { type: Number, default: 0 },
  clicked: { type: Number, default: 0 },
  unsubscribed: { type: Number, default: 0 },
  bounced: { type: Number, default: 0 },
}, { _id: false });

const platformCampaignSchema = new mongoose.Schema({
  kind: { type: String, enum: ['announcement', 'campaign'], default: 'campaign', index: true },
  name: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'paused', 'sent', 'failed', 'cancelled'],
    default: 'draft',
    index: true,
  },
  channels: [{ type: String, enum: ['email', 'whatsapp', 'push'] }],

  content: {
    email: { type: emailContentSchema, default: () => ({}) },
    whatsapp: { type: whatsappContentSchema, default: () => ({}) },
    push: { type: pushContentSchema, default: () => ({}) },
  },

  audience: { type: audienceSchema, default: () => ({ sources: ['users'] }) },
  placement: { type: placementSchema, default: () => ({}) },

  schedule: {
    sendAt: { type: Date, default: null, index: true },
    // Cadence d'envoi. Vider une liste d'un coup est le moyen le plus rapide
    // de faire classer le domaine en spam et de faire bannir un numéro WhatsApp.
    emailPerMinute: { type: Number, default: 60 },
    whatsappPerMinute: { type: Number, default: 6 },
  },

  stats: {
    targeted: { type: Number, default: 0 },
    byChannel: {
      email: { type: channelStatsSchema, default: () => ({}) },
      whatsapp: { type: channelStatsSchema, default: () => ({}) },
      push: { type: channelStatsSchema, default: () => ({}) },
    },
  },

  // Reprise après pause : index du dernier destinataire traité par canal.
  progress: {
    email: { type: Number, default: 0 },
    whatsapp: { type: Number, default: 0 },
    push: { type: Number, default: 0 },
  },

  whatsappInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppInstance', default: null },

  aiMeta: {
    prompt: { type: String, default: '' },
    model: { type: String, default: '' },
    generatedAt: { type: Date, default: null },
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', default: null },
  startedAt: { type: Date, default: null },
  finishedAt: { type: Date, default: null },
  lastError: { type: String, default: '' },
}, { timestamps: true, collection: 'platform_campaigns' });

platformCampaignSchema.index({ status: 1, 'schedule.sendAt': 1 });
platformCampaignSchema.index({ kind: 1, createdAt: -1 });
// Recherche des annonces actives à afficher dans l'app.
platformCampaignSchema.index({ kind: 1, 'placement.startsAt': 1, 'placement.endsAt': 1 });

export default mongoose.model('PlatformCampaign', platformCampaignSchema);
