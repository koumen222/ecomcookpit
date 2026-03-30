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
  scheduledDeliveryDate: { type: Date, default: null }, // Date programmée ISO format
  deliveryAddress: { type: String, default: '' }, // Lieu de livraison (quartier/zone)

  // Statut
  status: { type: String, enum: ['pending', 'accepted', 'refused', 'delivered', 'cancelled'], default: 'pending' },
  previousStatus: { type: String, default: '' },
  statusUpdatedAt: { type: Date, default: Date.now },
  
  // Tracking vente
  isSale: { type: Boolean, default: false }, // true si status = 'delivered'
  saleAmount: { type: Number, default: 0 }, // Montant de la vente

  // Notes
  notes: { type: String, default: '' },
  conversationSummary: { type: String, default: '' },
}, {
  timestamps: true,
  collection: 'whatsapp_orders',
});

whatsAppOrderSchema.index({ userId: 1, status: 1 });
whatsAppOrderSchema.index({ userId: 1, createdAt: -1 });
whatsAppOrderSchema.index({ userId: 1, isSale: 1 });
whatsAppOrderSchema.index({ userId: 1, scheduledDeliveryDate: 1 });

// Hook pour mettre à jour isSale quand status change
whatsAppOrderSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.statusUpdatedAt = new Date();
    if (this.status === 'delivered') {
      this.isSale = true;
      // Extraire le montant du prix si possible
      if (this.productPrice && !this.saleAmount) {
        const match = this.productPrice.match(/\d+/);
        if (match) {
          this.saleAmount = parseInt(match[0]) * (this.quantity || 1);
        }
      }
    }
  }
  next();
});

export default mongoose.model('WhatsAppOrder', whatsAppOrderSchema);
