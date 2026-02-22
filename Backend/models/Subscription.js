import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true,
    index: true
  },
  endpoint: {
    type: String,
    required: true
  },
  keys: {
    p256dh: {
      type: String,
      required: true
    },
    auth: {
      type: String,
      required: true
    }
  },
  userAgent: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'push_subscriptions'
});

// Index composite pour éviter les doublons
subscriptionSchema.index({ workspaceId: 1, userId: 1, endpoint: 1 }, { unique: true });

// Méthode pour nettoyer les abonnements inactifs
subscriptionSchema.statics.cleanupInactive = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await this.deleteMany({
    $or: [
      { lastUsed: { $lt: cutoffDate } },
      { isActive: false }
    ]
  });
  
  console.log(`🧹 Nettoyé ${result.deletedCount} abonnements push inactifs`);
  return result.deletedCount;
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
