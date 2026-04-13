import mongoose from 'mongoose';

/**
 * StoreOrder — Public storefront orders from customers.
 * Separated from internal Order model (used for fulfillment/analytics).
 * 
 * Design decisions:
 * - workspaceId indexed for strict tenant isolation
 * - Minimal customer data (name, phone, address) — no account required
 * - products[] embeds snapshot of ordered items (price at time of order)
 * - WhatsApp-first: phone is primary contact for African markets
 * - Lightweight: no joins needed to display order
 */
const storeOrderSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    required: true,
    index: true
  },
  // Multi-store: which store this order belongs to (null = legacy single-store)
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    index: true,
    default: null
  },
  // Auto-generated human-readable order number
  orderNumber: {
    type: String,
    required: true,
    default: () => `SC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  },
  // Customer info — no account needed (guest checkout)
  customerName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  phoneCode: {
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
  address: {
    type: String,
    trim: true,
    default: ''
  },
  city: {
    type: String,
    trim: true,
    default: ''
  },
  // Embedded product snapshots — avoids joins, preserves price at order time
  products: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StoreProduct',
      required: true
    },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    image: { type: String, default: '' }
  }],
  total: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'XAF'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  // How the order was placed
  channel: {
    type: String,
    enum: ['store', 'whatsapp'],
    default: 'store'
  },
  // Delivery zone info
  country: {
    type: String,
    trim: true,
    default: ''
  },
  deliveryZone: {
    type: String,
    trim: true,
    default: ''
  },
  deliveryType: {
    type: String,
    enum: ['livraison', 'expedition', ''],
    default: ''
  },
  deliveryCost: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  affiliateCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  affiliateLinkCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  linkedOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  }
}, {
  collection: 'store_orders',
  timestamps: true
});

// Generate sequential order number before save (SC1, SC2, ... SCN per workspace)
storeOrderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderNumber) {
    try {
      const last = await this.constructor.findOne(
        { workspaceId: this.workspaceId },
        { orderNumber: 1 },
        { sort: { createdAt: -1 } }
      );
      let nextNum = 1;
      if (last?.orderNumber) {
        const match = last.orderNumber.match(/^SC(\d+)$/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      this.orderNumber = `SC${nextNum}`;
    } catch {
      this.orderNumber = `SC${Date.now().toString().slice(-6)}`;
    }
  }
  next();
});

// ─── Performance indexes ──────────────────────────────────────────────────────
// Primary queries: orders for a workspace, sorted by newest
storeOrderSchema.index({ workspaceId: 1, createdAt: -1 });
// Filter by status
storeOrderSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
// Lookup by order number (customer support)
storeOrderSchema.index({ workspaceId: 1, orderNumber: 1 });
// Phone lookup (repeat customers)
storeOrderSchema.index({ workspaceId: 1, phone: 1 });

/**
 * Paginated query with workspace isolation.
 */
storeOrderSchema.statics.findPaginated = function (filter, { page = 1, limit = 20, sort = { createdAt: -1 } } = {}) {
  const skip = (Math.max(1, page) - 1) * limit;
  return this.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
};

/**
 * Quick stats for dashboard analytics.
 * Single aggregation — no multiple queries needed.
 */
storeOrderSchema.statics.getQuickStats = function (workspaceId, storeId) {
  const matchFilter = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
  if (storeId) {
    matchFilter.storeId = new mongoose.Types.ObjectId(storeId);
  }
  return this.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        revenue: { $sum: '$total' }
      }
    },
    {
      $group: {
        _id: null,
        byStatus: { $push: { status: '$_id', count: '$count', revenue: '$revenue' } },
        totalOrders: { $sum: '$count' },
        totalRevenue: { $sum: '$revenue' }
      }
    },
    { $project: { _id: 0 } }
  ]);
};

export default mongoose.model('StoreOrder', storeOrderSchema);
