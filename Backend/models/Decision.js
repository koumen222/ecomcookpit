import mongoose from 'mongoose';

const decisionSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    default: null,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  decisionType: {
    type: String,
    enum: ['continue', 'scale', 'stop', 'reorder'],
    required: true
  },
  reason: {
    type: String,
    required: true,
    maxlength: 1000
  },
  followUpResult: {
    type: String,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser'
  },
  completedAt: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  }
}, {
  collection: 'ecom_decisions',
  timestamps: true
});

// Index pour recherche rapide
decisionSchema.index({ productId: 1, date: -1 });
decisionSchema.index({ decisionType: 1, status: 1 });
decisionSchema.index({ priority: 1, status: 1 });
decisionSchema.index({ assignedTo: 1, status: 1 });

// Méthode pour marquer comme complétée
decisionSchema.methods.markAsCompleted = function(followUpResult = '') {
  this.status = 'completed';
  this.completedAt = new Date();
  if (followUpResult) {
    this.followUpResult = followUpResult;
  }
  return this.save();
};

// Méthode pour vérifier si en retard
decisionSchema.methods.isOverdue = function() {
  if (this.status === 'completed' || this.status === 'cancelled') return false;
  
  const now = new Date();
  const daysSinceCreation = Math.floor((now - this.date) / (1000 * 60 * 60 * 24));
  
  // Délais selon priorité
  const delays = {
    urgent: 1,
    high: 3,
    medium: 7,
    low: 14
  };
  
  return daysSinceCreation > delays[this.priority];
};

// Méthode pour obtenir les jours de retard
decisionSchema.methods.getOverdueDays = function() {
  if (!this.isOverdue()) return 0;
  
  const now = new Date();
  return Math.floor((now - this.date) / (1000 * 60 * 60 * 24));
};

// Méthode pour assigner à un utilisateur
decisionSchema.methods.assignTo = function(userId) {
  this.assignedTo = userId;
  this.status = 'in_progress';
  return this.save();
};

export default mongoose.model('Decision', decisionSchema);
