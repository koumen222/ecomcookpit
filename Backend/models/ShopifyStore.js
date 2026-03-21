import mongoose from 'mongoose';

const shopifyStoreSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  platform: {
    type: String,
    default: 'shopify',
    enum: ['shopify']
  },
  shop: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  accessToken: {
    type: String,
    required: true
  },
  scope: {
    type: String,
    default: 'read_orders,read_products,read_customers'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSyncAt: {
    type: Date,
    default: null
  },
  syncStatus: {
    type: String,
    enum: ['idle', 'syncing', 'error'],
    default: 'idle'
  },
  syncError: {
    type: String,
    default: null
  },
  metadata: {
    shopName: String,
    email: String,
    domain: String,
    currency: String,
    timezone: String
  }
}, {
  timestamps: true
});

// Un seul shop par workspace
shopifyStoreSchema.index({ workspaceId: 1, shop: 1 }, { unique: true });

export default mongoose.model('ShopifyStore', shopifyStoreSchema);
