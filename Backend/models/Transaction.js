import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    default: null,
    index: true
  },
  date: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      // Dépenses
      'publicite',
      'produit',
      'livraison',
      'salaire',
      'abonnement',
      'materiel',
      'transport',
      'autre_depense',
      // Entrées
      'vente',
      'remboursement_client',
      'investissement',
      'autre_entree'
    ]
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    default: ''
  },
  reference: {
    type: String,
    default: ''
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  }
}, {
  timestamps: true,
  collection: 'ecom_transactions',
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
});

// Index pour les requêtes fréquentes
transactionSchema.index({ date: -1 });
transactionSchema.index({ type: 1, date: -1 });
transactionSchema.index({ category: 1, date: -1 });

// Labels lisibles pour les catégories
transactionSchema.statics.getCategoryLabels = function() {
  return {
    publicite: 'Publicité',
    produit: 'Achat produit',
    livraison: 'Frais de livraison',
    salaire: 'Salaire',
    abonnement: 'Abonnement / Outil',
    materiel: 'Matériel',
    transport: 'Transport',
    autre_depense: 'Autre dépense',
    vente: 'Vente',
    remboursement_client: 'Remboursement client',
    investissement: 'Investissement',
    autre_entree: 'Autre entrée'
  };
};

// Catégories par type
transactionSchema.statics.getCategoriesByType = function() {
  return {
    expense: ['publicite', 'produit', 'livraison', 'salaire', 'abonnement', 'materiel', 'transport', 'autre_depense'],
    income: ['vente', 'remboursement_client', 'investissement', 'autre_entree']
  };
};

const Transaction = mongoose.model('EcomTransaction', transactionSchema);

export default Transaction;
