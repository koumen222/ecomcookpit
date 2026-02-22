import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    trim: true,
    default: ''
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  city: {
    type: String,
    trim: true,
    default: ''
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  source: {
    type: String,
    enum: ['facebook', 'instagram', 'tiktok', 'whatsapp', 'site', 'referral', 'other'],
    default: 'other'
  },
  status: {
    type: String,
    default: 'prospect'
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  products: [{
    type: String,
    trim: true
  }],
  tags: [{
    type: String,
    trim: true
  }],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  },
  lastContactAt: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'ecom_clients'
});

clientSchema.index({ workspaceId: 1, phone: 1 });
clientSchema.index({ workspaceId: 1, status: 1 });
clientSchema.index({ workspaceId: 1, createdAt: -1 });

clientSchema.virtual('fullName').get(function() {
  return [this.firstName, this.lastName].filter(Boolean).join(' ');
});

clientSchema.set('toJSON', { virtuals: true });
clientSchema.set('toObject', { virtuals: true });

const Client = mongoose.model('Client', clientSchema);
export default Client;
