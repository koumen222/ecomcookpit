import mongoose from 'mongoose';

const snapshotSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  plan: { type: String, default: '' },
}, { _id: false });

const productPageGenerationLogSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true,
    index: true,
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GenerationTask',
    default: null,
    index: true,
  },
  status: {
    type: String,
    enum: ['started', 'processing_images', 'completed', 'partial_failure', 'failed'],
    default: 'started',
    index: true,
  },
  inputType: {
    type: String,
    enum: ['url', 'description'],
    required: true,
    index: true,
  },
  outputMode: {
    type: String,
    enum: ['page_only', 'page_with_images'],
    required: true,
    index: true,
  },
  creditSource: {
    type: String,
    enum: ['simple', 'free', 'paid', 'unknown'],
    default: 'unknown',
    index: true,
  },
  creditsUsed: {
    type: Number,
    default: 1,
    min: 0,
  },
  productName: {
    type: String,
    default: '',
    trim: true,
  },
  productUrl: {
    type: String,
    default: '',
    trim: true,
  },
  generatedContentTypes: {
    type: [String],
    default: [],
  },
  stats: {
    anglesCount: { type: Number, default: 0 },
    faqCount: { type: Number, default: 0 },
    testimonialsCount: { type: Number, default: 0 },
    benefitsCount: { type: Number, default: 0 },
    conversionBlocksCount: { type: Number, default: 0 },
    uploadedPhotoCount: { type: Number, default: 0 },
    generatedImageCount: { type: Number, default: 0 },
    generatedGifCount: { type: Number, default: 0 },
  },
  requestMeta: {
    visualTemplate: { type: String, default: '' },
    marketingApproach: { type: String, default: '' },
    imageGenerationMode: { type: String, default: '' },
    imageAspectRatio: { type: String, default: '' },
    tone: { type: String, default: '' },
    language: { type: String, default: '' },
  },
  userSnapshot: {
    type: snapshotSchema,
    default: () => ({}),
  },
  workspaceSnapshot: {
    type: snapshotSchema,
    default: () => ({}),
  },
  completedAt: {
    type: Date,
    default: null,
    index: true,
  },
  errorMessage: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
  collection: 'product_page_generation_logs',
});

productPageGenerationLogSchema.index({ createdAt: -1 });
productPageGenerationLogSchema.index({ userId: 1, createdAt: -1 });
productPageGenerationLogSchema.index({ workspaceId: 1, createdAt: -1 });
productPageGenerationLogSchema.index({ creditSource: 1, createdAt: -1 });

export default mongoose.model('ProductPageGenerationLog', productPageGenerationLogSchema);