import mongoose from 'mongoose';

const ritaContactSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  phone: { type: String, required: true },
  pushName: { type: String, default: '' },
  nom: { type: String, default: '' },
  ville: { type: String, default: '' },
  adresse: { type: String, default: '' },
  clientNumber: { type: Number, required: true },
  firstMessageAt: { type: Date, default: Date.now },
  lastMessageAt: { type: Date, default: Date.now },
  messageCount: { type: Number, default: 1 },
  
  // Statut et classification
  status: { 
    type: String, 
    enum: ['prospect', 'client', 'scheduled'], 
    default: 'prospect',
    index: true
  },
  hasOrdered: { type: Boolean, default: false },
  
  // Tracking des ventes
  totalOrders: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 }, // Commandes livrées (ventes confirmées)
  lastOrderDate: { type: Date, default: null },
  lastSaleDate: { type: Date, default: null },
  
  // Relances
  lastFollowUpAt: { type: Date, default: null },
  followUpCount: { type: Number, default: 0 },
  lastFollowUpMessage: { type: String, default: '' },
  
  tags: [{ type: String }],
  notes: { type: String, default: '' },
}, {
  timestamps: true,
  collection: 'rita_contacts',
});

ritaContactSchema.index({ userId: 1, phone: 1 }, { unique: true });
ritaContactSchema.index({ userId: 1, clientNumber: 1 });
ritaContactSchema.index({ userId: 1, lastMessageAt: -1 });
ritaContactSchema.index({ userId: 1, status: 1 });
ritaContactSchema.index({ userId: 1, lastFollowUpAt: -1 });

export default mongoose.model('RitaContact', ritaContactSchema);
