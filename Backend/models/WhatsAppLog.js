import mongoose from 'mongoose';

/**
 * Modèle pour logger les envois de messages WhatsApp
 */
const whatsappLogSchema = new mongoose.Schema({
  // Workspace concerné
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },

  // Utilisateur qui a envoyé le message
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    index: true
  },

  // Campagne associée (si envoyé via une campagne)
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    index: true
  },

  // Numéro de téléphone destinataire
  phoneNumber: {
    type: String,
    required: true
  },

  // Contenu du message
  message: {
    type: String,
    required: true
  },

  // Statut de l'envoi
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
    default: 'pending',
    index: true
  },

  // ID du message WhatsApp (retourné par l'API)
  messageId: {
    type: String
  },

  // Nom de l'instance WhatsApp utilisée
  instanceName: {
    type: String
  },

  // Réponse d'erreur (si échec)
  errorMessage: {
    type: String
  },

  // Date d'envoi
  sentAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Date de mise à jour du statut
  statusUpdatedAt: {
    type: Date
  },

  // Type de message (text, media, template)
  messageType: {
    type: String,
    enum: ['text', 'media', 'template', 'audio'],
    default: 'text'
  },

  // URL du média (si message média)
  mediaUrl: {
    type: String
  },

  // Métadonnées additionnelles
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  collection: 'whatsapp_logs'
});

// Index composites pour les requêtes fréquentes
whatsappLogSchema.index({ workspaceId: 1, status: 1, sentAt: -1 });
whatsappLogSchema.index({ workspaceId: 1, sentAt: -1 });
whatsappLogSchema.index({ userId: 1, sentAt: -1 });
whatsappLogSchema.index({ campaignId: 1, sentAt: -1 });

const WhatsAppLog = mongoose.model('WhatsAppLog', whatsappLogSchema);

export default WhatsAppLog;
