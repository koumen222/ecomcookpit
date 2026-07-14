import mongoose from 'mongoose';

const whatsappInstanceSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  instanceName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  instanceToken: {
    type: String,
    required: true,
    trim: true
  },
  customName: {
    type: String,
    trim: true
  },
  // Rôle fonctionnel de l'instance dans le workspace.
  // customer: échanges et relances destinés aux clients.
  // host: canal interne pour rapports, commandes et alertes d'équipe.
  usageType: {
    type: String,
    enum: ['customer', 'host'],
    default: 'customer',
    index: true
  },
  hostSettings: {
    recipientRoles: [{
      type: String,
      enum: ['super_admin', 'ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur', 'service_client']
    }],
    events: [{
      type: String,
      enum: ['daily_report', 'new_order', 'order_assignment', 'important_alert', 'stock_alert']
    }],
    enabled: { type: Boolean, default: true }
  },
  apiUrl: {
    type: String,
    default: 'https://api.evolution-api.com'
  },
  status: {
    type: String,
    enum: ['connected', 'disconnected', 'unknown', 'configured', 'active', 'deleted'],
    default: 'unknown'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  defaultPart: {
    type: Number,
    default: 50,
    min: 0,
    max: 100
  },
  // Plan et limites de messages
  plan: {
    type: String,
    // Keep legacy values for backward compatibility.
    enum: ['free', 'pro', 'plus', 'premium', 'unlimited'],
    default: 'free'
  },
  dailyLimit: {
    type: Number,
    default: 100  // Plan gratuit: 100 messages/jour
  },
  monthlyLimit: {
    type: Number,
    default: 5000  // Plan gratuit: 5000 messages/mois
  },
  messagesSentToday: {
    type: Number,
    default: 0
  },
  messagesSentThisMonth: {
    type: Number,
    default: 0
  },
  lastDailyReset: {
    type: Date,
    default: Date.now
  },
  lastMonthlyReset: {
    type: Date,
    default: Date.now
  },
  // Désactivation automatique si limites dépassées
  limitExceeded: {
    type: Boolean,
    default: false
  },
  limitExceededAt: {
    type: Date
  }
}, {
  collection: 'whatsapp_instances',
  timestamps: true
});

// Index pour recherche rapide par utilisateur et workspace
whatsappInstanceSchema.index({ userId: 1 });
whatsappInstanceSchema.index({ workspaceId: 1 });
whatsappInstanceSchema.index({ workspaceId: 1, usageType: 1, isActive: 1 });

export default mongoose.model('WhatsappInstance', whatsappInstanceSchema);
