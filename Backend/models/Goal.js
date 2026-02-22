import mongoose from 'mongoose';

const goalSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['revenue', 'orders', 'delivery_rate'],
    required: true
  },
  product: {
    type: String,
    default: null
  },
  targetValue: {
    type: Number,
    required: true
  },
  deliveryCount: {
    type: Number,
    default: null
  },
  currentValue: {
    type: Number,
    default: 0
  },
  periodType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'weekly',
    required: true
  },
  day: {
    type: Date, // Pour les objectifs journaliers
    default: null
  },
  weekNumber: {
    type: Number,
    required: false
  },
  month: {
    type: Number, // 1-12
    required: false
  },
  year: {
    type: Number,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['in_progress', 'achieved', 'failed'],
    default: 'in_progress'
  }
}, {
  timestamps: true,
  collection: 'ecom_goals'
});

// Indexes conditionnels pour éviter les conflits entre périodes
goalSchema.index({ workspaceId: 1, periodType: 1, year: 1, weekNumber: 1, type: 1, product: 1 }, 
  { unique: true, partialFilterExpression: { periodType: 'weekly' } });

goalSchema.index({ workspaceId: 1, periodType: 1, year: 1, month: 1, type: 1, product: 1 }, 
  { unique: true, partialFilterExpression: { periodType: 'monthly' } });

goalSchema.index({ workspaceId: 1, periodType: 1, day: 1, type: 1, product: 1 }, 
  { unique: true, partialFilterExpression: { periodType: 'daily' } });

const Goal = mongoose.model('Goal', goalSchema);
export default Goal;
