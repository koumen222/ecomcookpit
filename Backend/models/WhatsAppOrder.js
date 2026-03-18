import mongoose from 'mongoose';

const whatsAppOrderSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  instanceName: { type: String, default: '' },

  // Client info
  customerPhone: { type: String, required: true },
  customerName: { type: String, default: '' },
  customerCity: { type: String, default: '' },
  pushName: { type: String, default: '' },

  // Produit
  productName: { type: String, default: '' },
  productPrice: { type: String, default: '' },
  quantity: { type: Number, default: 1 },

  // Livraison
  deliveryDate: { type: String, default: '' },
  deliveryTime: { type: String, default: '' },

  // Statut
  status: { type: String, enum: ['pending', 'accepted', 'refused', 'delivered', 'cancelled'], default: 'pending' },

  // Notes
  notes: { type: String, default: '' },
  conversationSummary: { type: String, default: '' },
}, {
  timestamps: true,
  collection: 'whatsapp_orders',
});

whatsAppOrderSchema.index({ userId: 1, status: 1 });
whatsAppOrderSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('WhatsAppOrder', whatsAppOrderSchema);
