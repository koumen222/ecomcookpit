import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    required: true
  },
  closeuseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  },
  // Affectation des sources de commandes
  orderSources: [{
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OrderSource',
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EcomUser',
      required: true
    }
  }],
  // Affectation des produits par source
  productAssignments: [{
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OrderSource',
      required: true
    },
    productIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }],
    sheetProductNames: [{
      type: String,
      trim: true
    }],
    assignedAt: {
      type: Date,
      default: Date.now
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EcomUser',
      required: true
    }
  }],
  // Affectation des villes
  cityAssignments: [{
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OrderSource',
      required: true
    },
    cityNames: [{
      type: String,
      trim: true
    }],
    assignedAt: {
      type: Date,
      default: Date.now
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EcomUser',
      required: true
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  collection: 'closeuse_assignments',
  timestamps: true
});

// Index pour recherche rapide
assignmentSchema.index({ workspaceId: 1, closeuseId: 1, isActive: 1 });
assignmentSchema.index({ closeuseId: 1, isActive: 1 });

export default mongoose.model('CloseuseAssignment', assignmentSchema);
