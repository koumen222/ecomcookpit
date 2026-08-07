import mongoose from 'mongoose';

/**
 * Liste de diffusion de la PLATEFORME — prospects, liste d'attente, inscrits
 * depuis le site scalor.net.
 *
 * Distinct de NewsletterSubscriber, qui est rattaché à un `storeId` : celui-là
 * appartient à un marchand et contient SES clients. Les fusionner reviendrait
 * à envoyer du marketing plateforme à des gens qui ont donné leur adresse à
 * une boutique, pas à Scalor.
 */
const platformSubscriberSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  name: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
  country: { type: String, default: '', trim: true },
  // D'où vient l'inscription : 'landing', 'waitlist', 'import', 'manual', ...
  source: { type: String, default: 'landing', index: true },
  tags: [{ type: String }],
  isActive: { type: Boolean, default: true, index: true },
  // Trace du consentement — sans elle, impossible de justifier un envoi.
  consentAt: { type: Date, default: Date.now },
  consentIp: { type: String, default: '' },
  unsubscribedAt: { type: Date, default: null },
}, { timestamps: true, collection: 'platform_subscribers' });

export default mongoose.model('PlatformSubscriber', platformSubscriberSchema);
