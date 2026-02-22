import mongoose from 'mongoose';

const productResearchSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  },
  
  // Informations de base (format Excel)
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  imageUrl: {
    type: String,
    trim: true,
    maxlength: 500
  },
  creative: {
    type: String,
    trim: true,
    maxlength: 500
  },
  alibabaLink: {
    type: String,
    trim: true,
    maxlength: 500
  },
  researchLink: {
    type: String,
    trim: true,
    maxlength: 500
  },
  websiteUrl: {
    type: String,
    trim: true,
    maxlength: 500
  },

  // Sourcing
  sourcingType: {
    type: String,
    enum: ['local', 'china'],
    default: 'local'
  },
  
  // Prix et coûts (format Excel)
  sourcingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  weight: {
    type: Number,
    default: 0,
    min: 0
  },
  pricePerKg: {
    type: Number,
    default: 0,
    min: 0
  },
  shippingUnitCost: {
    type: Number,
    default: 0,
    min: 0
  },
  cogs: {
    type: Number,
    default: 0,
    min: 0
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Calculs automatiques
  margin: {
    type: Number,
    default: 0
  },
  profit: {
    type: Number,
    default: 0
  },
  
  // Analyse marché
  demand: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  competition: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  trend: {
    type: String,
    enum: ['growing', 'stable', 'declining'],
    default: 'stable'
  },
  
  // Fournisseurs
  supplierCount: {
    type: Number,
    default: 0,
    min: 0
  },
  supplierReliability: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  
  // Potentiel
  opportunityScore: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  monthlyEstimate: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Notes et observations
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  pros: [{
    type: String,
    trim: true,
    maxlength: 200
  }],
  cons: [{
    type: String,
    trim: true,
    maxlength: 200
  }],
  
  // Statut et suivi
  status: {
    type: String,
    enum: ['research', 'testing', 'validated', 'rejected'],
    default: 'research'
  },
  researchDate: {
    type: Date,
    default: Date.now
  },
  
  // Métadonnées
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }]
}, {
  collection: 'ecom_product_research',
  timestamps: true
});

// Index pour optimiser les recherches
productResearchSchema.index({ workspaceId: 1, status: 1 });
productResearchSchema.index({ workspaceId: 1, opportunityScore: -1 });
productResearchSchema.index({ workspaceId: 1, researchDate: -1 });
productResearchSchema.index({ name: 'text', creative: 'text', websiteUrl: 'text' });

// Méthodes virtuelles
productResearchSchema.virtual('roi').get(function() {
  if (this.cogs <= 0) return 0;
  return (this.profit / this.cogs * 100).toFixed(2);
});

productResearchSchema.virtual('monthlyRevenue').get(function() {
  return this.sellingPrice * this.monthlyEstimate;
});

productResearchSchema.virtual('monthlyProfit').get(function() {
  return this.profit * this.monthlyEstimate;
});

// Méthodes d'instance
productResearchSchema.methods.calculateFinancials = function() {
  // Calculer le COGS si non défini
  if (!this.cogs) {
    this.cogs = this.sourcingPrice + this.shippingUnitCost;
  }
  
  // Calculer le bénéfice et la marge
  this.profit = Math.max(0, this.sellingPrice - this.cogs);
  this.margin = this.sellingPrice > 0 ? (this.profit / this.sellingPrice * 100) : 0;
  return this;
};

productResearchSchema.methods.updateStatus = function(newStatus, reason = '') {
  this.status = newStatus;
  if (reason) {
    this.notes = this.notes ? `${this.notes}\n\n[${new Date().toISOString()}] ${newStatus}: ${reason}` : `[${new Date().toISOString()}] ${newStatus}: ${reason}`;
  }
  return this.save();
};

// Méthodes statiques
productResearchSchema.statics.findByOpportunityScore = function(workspaceId, minScore = 4) {
  return this.find({ 
    workspaceId, 
    opportunityScore: { $gte: minScore },
    status: { $ne: 'rejected' }
  }).sort({ opportunityScore: -1, researchDate: -1 });
};

productResearchSchema.statics.findHighMargin = function(workspaceId, minMargin = 40) {
  return this.find({ 
    workspaceId, 
    margin: { $gte: minMargin },
    status: { $ne: 'rejected' }
  }).sort({ margin: -1, researchDate: -1 });
};

productResearchSchema.statics.getStats = function(workspaceId) {
  return this.aggregate([
    { $match: { workspaceId: new mongoose.Types.ObjectId(workspaceId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        avgMargin: { $avg: '$margin' },
        avgOpportunityScore: { $avg: '$opportunityScore' },
        byStatus: {
          $push: {
            status: '$status',
            count: 1
          }
        },
        byDemand: {
          $push: {
            demand: '$demand',
            count: 1
          }
        }
      }
    }
  ]);
};

export default mongoose.model('ProductResearch', productResearchSchema);
