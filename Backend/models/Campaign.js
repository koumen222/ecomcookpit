import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: [
      'relance_pending', 
      'relance_cancelled', 
      'relance_unreachable', 
      'relance_called', 
      'relance_postponed', 
      'relance_returns', 
      'relance_confirmed_not_shipped',
      'promo_city', 
      'promo_product', 
      'followup_delivery', 
      'relance_reorder', 
      'followup_shipping',
      'promo', 
      'followup', 
      'custom', 
      'whatsapp'
    ],
    default: 'custom'
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'paused', 'failed'],
    default: 'draft'
  },
  // Filtres pour cibler les clients
  targetFilters: {
    // Filtres client
    clientStatus: { type: String, default: '' },
    city: { type: String, default: '' },
    product: { type: String, default: '' },
    tag: { type: String, default: '' },
    minOrders: { type: Number, default: 0 },
    maxOrders: { type: Number, default: 0 },
    lastContactBefore: { type: Date },
    // Filtres commande
    orderStatus: { type: String, default: '' },
    orderCity: { type: String, default: '' },
    orderAddress: { type: String, default: '' },
    orderProduct: { type: String, default: '' },
    orderSourceId: { type: String, default: '' },
    orderDateFrom: { type: Date },
    orderDateTo: { type: Date },
    orderMinPrice: { type: Number, default: 0 },
    orderMaxPrice: { type: Number, default: 0 }
  },
  // IDs des clients sélectionnés manuellement (prioritaire sur targetFilters)
  selectedClientIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  }],
  // Snapshot des destinataires pour figer la cible à la création
  recipientSnapshotIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  }],
  // ✅ Champs pour les campagnes WhatsApp
  recipients: {
    type: {
      type: String,
      enum: ['all', 'segment', 'list'],
      default: null
    },
    segment: String,
    customPhones: {
      type: [String],
      validate: {
        validator: function(v) {
          // Validation uniquement pour le type 'list'
          if (this.recipients?.type === 'list') {
            if (!v || v.length === 0) return false;
            
            // Fonction de normalisation pour validation
            const normalizePhone = (phone) => {
              if (!phone) return '';
              let cleaned = phone.toString().replace(/\D/g, '').trim();
              
              // ✅ Corriger le cas 00237699887766
              if (cleaned.startsWith('00')) {
                cleaned = cleaned.substring(2);
              }
              
              // Gérer le préfixe pays (Cameroun 237)
              if (cleaned.length === 9 && cleaned.startsWith('6')) {
                return '237' + cleaned;
              }
              
              return cleaned;
            };
            
            // Valider et normaliser les numéros
            const validPhones = v
              .map(phone => normalizePhone(phone))
              .filter(phone => phone.length >= 8); // Minimum 8 digits
            
            return validPhones.length > 0;
          }
          return true; // Pas de validation pour les autres types
        },
        message: 'customPhones doit contenir au moins un numéro valide (8 chiffres minimum) pour le type "list"'
      }
    },
    count: Number
  },
  previewId: {
    type: String,
    default: null
  },
  // Template du message WhatsApp
  messageTemplate: {
    type: String,
    required: true,
    trim: true
  },
  // Variables disponibles: {firstName}, {lastName}, {phone}, {city}, {product}, {totalOrders}, {totalSpent}
  // Programmation
  scheduledAt: {
    type: Date
  },
  sentAt: {
    type: Date
  },
  // Statistiques
  stats: {
    targeted: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  // Résultats détaillés
  results: [{
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    clientName: String,
    phone: String,
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    error: String,
    sentAt: Date
  }],
  tags: [{
    type: String,
    trim: true
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  }
}, {
  timestamps: true,
  collection: 'ecom_campaigns'
});

campaignSchema.index({ workspaceId: 1, status: 1 });
campaignSchema.index({ workspaceId: 1, createdAt: -1 });
campaignSchema.index({ workspaceId: 1, scheduledAt: 1 });
campaignSchema.index({ previewId: 1 }); // ✅ Index pour les previews

const Campaign = mongoose.model('Campaign', campaignSchema);
export default Campaign;
