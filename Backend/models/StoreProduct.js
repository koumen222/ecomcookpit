import mongoose from 'mongoose';

/**
 * StoreProduct — Public catalog product for storefront display.
 * Separated from internal Product model (used for analytics/stock).
 * 
 * Design decisions:
 * - workspaceId indexed for tenant isolation (NEVER load cross-workspace)
 * - images stored as URLs (Cloudinary/S3) — never local
 * - slug for SEO-friendly URLs
 * - lean schema: only fields needed for public display + admin management
 * - compound indexes for common query patterns
 */
const storeProductSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  slug: {
    type: String,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: '',
    maxlength: 50000
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  compareAtPrice: {
    type: Number,
    min: 0,
    default: null
  },
  currency: {
    type: String,
    default: 'XAF'
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  // Images stored as external URLs (Cloudinary / S3)
  images: [{
    url: { type: String, required: true },
    alt: { type: String, default: '' },
    order: { type: Number, default: 0 }
  }],
  category: {
    type: String,
    trim: true,
    default: ''
  },
  tags: {
    type: [String],
    default: []
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  // SEO metadata
  seoTitle: {
    type: String,
    trim: true,
    default: ''
  },
  seoDescription: {
    type: String,
    trim: true,
    default: ''
  },
  // Link to internal Product model (optional — for stock sync)
  linkedProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  },
  // Features/badges displayed under product title (scrollable list)
  features: {
    type: [{
      icon: { type: String, default: '' }, // Lucide icon name
      text: { type: String, required: true, maxlength: 50 }
    }],
    default: []
  },
  // Vidéos du produit
  videos: {
    type: [{
      url: { type: String, required: true },
      type: { type: String, enum: ['youtube', 'vimeo', 'direct'], default: 'direct' },
      thumbnail: { type: String, default: '' },
      title: { type: String, default: '' },
      order: { type: Number, default: 0 }
    }],
    default: []
  },
  // Témoignages
  testimonials: {
    type: [{
      name: { type: String, required: true },
      text: { type: String, required: true, maxlength: 500 },
      rating: { type: Number, min: 1, max: 5, default: 5 },
      image: { type: String, default: '' },
      location: { type: String, default: '' },
      date: { type: String, default: '' },
      verified: { type: Boolean, default: false },
      source: { type: String, enum: ['manual', 'ai'], default: 'manual' }
    }],
    default: []
  },
  // Configuration de génération des témoignages
  testimonialsConfig: {
    autoGenerate: { type: Boolean, default: false },
    generatedCount: { type: Number, default: 3 },
    lastGenerated: { type: Date, default: null }
  },
  // FAQ items (AI-generated or manual)
  faq: {
    type: [{
      question: { type: String, required: true },
      answer: { type: String, required: true }
    }],
    default: []
  },
  // Full AI-generated page data blob (_pageData from generator)
  _pageData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  collection: 'store_products',
  timestamps: true
});

// Generate slug from name before save
storeProductSchema.pre('save', function () {
  if (this.isNew || this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);
  }
});

// ─── Performance indexes ──────────────────────────────────────────────────────
// Primary tenant isolation — every query MUST use this
storeProductSchema.index({ workspaceId: 1, createdAt: -1 });
// Public store listing — only published products, sorted by newest
storeProductSchema.index({ workspaceId: 1, isPublished: 1, createdAt: -1 });
// ─── Indexes for Multi-Tenant Performance ───────────────────────────────────
// CRITICAL: These indexes ensure queries scale to 10,000+ workspaces

// 1. Unique slug per workspace (SEO-friendly URLs)
storeProductSchema.index({ workspaceId: 1, slug: 1 }, { unique: true });

// 2. Public storefront queries (most common)
// Filters published products by workspace, sorted by date
storeProductSchema.index({ workspaceId: 1, isPublished: 1, createdAt: -1 });

// 3. Category filtering on public store
storeProductSchema.index({ workspaceId: 1, category: 1, isPublished: 1 });

// 4. Dashboard product management
// Admin queries all products (published + unpublished) by workspace
storeProductSchema.index({ workspaceId: 1, createdAt: -1 });

// 5. Search optimization (text search)
storeProductSchema.index({ workspaceId: 1, name: 'text', description: 'text', tags: 'text' });
// Text search for store search bar
storeProductSchema.index({ name: 'text', description: 'text', category: 'text' });

// ─── Optimized static methods ─────────────────────────────────────────────────

/**
 * Paginated query with workspace isolation.
 * Used by both dashboard (all) and public store (published only).
 */
storeProductSchema.statics.findPaginated = function (filter, { page = 1, limit = 20, sort = { createdAt: -1 } } = {}) {
  const skip = (Math.max(1, page) - 1) * limit;
  return this.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
};

/**
 * Count for pagination metadata.
 */
storeProductSchema.statics.countForFilter = function (filter) {
  return this.countDocuments(filter);
};

export default mongoose.model('StoreProduct', storeProductSchema);
