import mongoose from 'mongoose';

/**
 * Une ligne par (campagne, destinataire, canal).
 *
 * C'est ce qui rend une campagne reprenable : après une pause, un crash ou un
 * quota atteint, l'état de CHAQUE envoi est sur disque. Un compteur global
 * dans la campagne aurait obligé à tout renvoyer depuis le début, donc à
 * doublonner chez les gens déjà servis.
 *
 * `token` sert au pixel d'ouverture, à la redirection de clic et au lien de
 * désinscription : il identifie un envoi précis sans jamais exposer l'email
 * ni l'identifiant utilisateur dans une URL.
 */
const platformRecipientSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformCampaign', required: true, index: true },
  channel: { type: String, enum: ['email', 'whatsapp', 'push'], required: true, index: true },

  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', default: null, index: true },
  subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformSubscriber', default: null },

  email: { type: String, default: '', index: true },
  phone: { type: String, default: '' },
  name: { type: String, default: '' },

  token: { type: String, required: true, unique: true, index: true },

  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'skipped', 'bounced'],
    default: 'pending',
    index: true,
  },
  // Pourquoi un destinataire a été écarté : 'suppressed', 'no_email',
  // 'no_phone', 'no_push_token', 'duplicate', 'opted_out'.
  skipReason: { type: String, default: '' },
  error: { type: String, default: '' },
  providerMessageId: { type: String, default: '' },

  sentAt: { type: Date, default: null },
  openedAt: { type: Date, default: null },
  clickedAt: { type: Date, default: null },
  clickCount: { type: Number, default: 0 },
  unsubscribedAt: { type: Date, default: null },
}, { timestamps: true, collection: 'platform_recipients' });

// Un même utilisateur ne peut pas être servi deux fois sur le même canal.
platformRecipientSchema.index({ campaignId: 1, channel: 1, email: 1 }, { sparse: true });
platformRecipientSchema.index({ campaignId: 1, channel: 1, status: 1 });

export default mongoose.model('PlatformRecipient', platformRecipientSchema);
