import mongoose from 'mongoose';

const supplierOrderSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomWorkspace', required: true, index: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  
  // Détails des produits commandés
  products: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 } // quantity * unitPrice
  }],
  
  // Informations globales de la commande
  totalAmount: { type: Number, required: true, min: 0 }, // Somme des totalPrice des produits + frais éventuels
  shippingCost: { type: Number, default: 0 },
  
  // Métadonnées
  orderDate: { type: Date, default: Date.now, required: true },
  expectedDeliveryDate: { type: Date },
  actualDeliveryDate: { type: Date },
  
  // Statut
  status: { 
    type: String, 
    enum: ['pending', 'paid', 'shipped', 'received', 'cancelled'], 
    default: 'pending' 
  },
  
  paymentMethod: { type: String },
  paymentStatus: { 
    type: String, 
    enum: ['unpaid', 'partial', 'paid'], 
    default: 'unpaid' 
  },
  
  notes: { type: String },
  referenceNumber: { type: String }, // Numéro de suivi ou de référence externe
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser' }
}, { timestamps: true });

supplierOrderSchema.index({ workspaceId: 1, supplierId: 1, status: 1 });
supplierOrderSchema.index({ workspaceId: 1, orderDate: -1 });

export default mongoose.model('SupplierOrder', supplierOrderSchema);
