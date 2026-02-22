import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomWorkspace', required: true, index: true },
  name: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['publicite', 'produit', 'livraison', 'salaire', 'abonnement', 'materiel', 'transport', 'autre_depense'],
    required: true
  },
  amount: { type: Number, required: true, min: 0 },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  period: { type: String, enum: ['monthly', 'quarterly', 'yearly', 'custom'], default: 'monthly' },
  startDate: { type: Date, default: () => new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
  endDate: { type: Date, default: () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0) },
  color: { type: String, default: '#6366f1' },
  notes: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser' }
}, { timestamps: true });

budgetSchema.index({ workspaceId: 1, isActive: 1 });
budgetSchema.index({ workspaceId: 1, category: 1 });

export default mongoose.model('Budget', budgetSchema);
