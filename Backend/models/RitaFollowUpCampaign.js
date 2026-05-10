import mongoose from 'mongoose';

const ritaFollowUpCampaignSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  agentId: { type: String, default: '' },
  
  // Configuration de la campagne
  name: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['draft', 'active', 'paused', 'completed', 'cancelled'], 
    default: 'draft',
    index: true
  },
  
  // Filtres pour cibler les contacts
  filters: {
    targetStatus: [{ type: String, enum: ['prospect', 'client', 'scheduled'] }], // Qui cibler
    minInactiveDays: { type: Number, default: 0 }, // Minimum de jours sans message
    maxInactiveDays: { type: Number, default: null }, // Maximum de jours sans message
    hasOrdered: { type: Boolean, default: null }, // null = tous, true = clients, false = prospects
    specificProducts: [{ type: String }], // Produits spécifiques
    tags: [{ type: String }], // Tags spécifiques
    excludeRecentFollowUp: { type: Number, default: 7 }, // Ne pas relancer si déjà relancé dans X jours
  },
  
  // Message de relance
  followUpMessage: { type: String, required: true },
  useAI: { type: Boolean, default: false }, // Utiliser l'IA pour personnaliser le message
  
  // Échelonnement
  delayBetweenMessages: { type: Number, default: 15 }, // Minutes entre chaque envoi
  maxMessagesPerDay: { type: Number, default: 50 }, // Limite journalière
  
  // Tracking
  targetedCount: { type: Number, default: 0 }, // Nombre de contacts ciblés
  sentCount: { type: Number, default: 0 }, // Nombre de messages envoyés
  respondedCount: { type: Number, default: 0 }, // Nombre de réponses reçues
  
  // Dates
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  lastSentAt: { type: Date, default: null },
  
  // Contacts traités
  processedContacts: [{ 
    phone: String, 
    sentAt: Date,
    responded: { type: Boolean, default: false }
  }],
}, {
  timestamps: true,
  collection: 'rita_followup_campaigns',
});

ritaFollowUpCampaignSchema.index({ userId: 1, status: 1 });
ritaFollowUpCampaignSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('RitaFollowUpCampaign', ritaFollowUpCampaignSchema);
