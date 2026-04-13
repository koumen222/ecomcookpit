import mongoose from 'mongoose';

/**
 * GenerationTask — Persistent background task for product page generation.
 * Replaces in-memory imageJobs Map with a durable MongoDB document.
 * Tasks survive server restarts, have no timeout, and support retry logic.
 */
const generationTaskSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomWorkspace', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', required: true },

  // Status lifecycle: pending → generating_text → generating_images → done | error
  status: {
    type: String,
    enum: ['pending', 'generating_text', 'generating_images', 'done', 'error'],
    default: 'pending',
    index: true,
  },

  // Generation input parameters (stored for retry capability)
  input: {
    url: String,
    description: String,
    skipScraping: { type: Boolean, default: false },
    marketingApproach: { type: String, default: 'PAS' },
    visualTemplate: { type: String, default: 'general' },
    imageGenerationMode: { type: String, default: 'ad_4_5' },
    imageAspectRatio: { type: String, default: '4:5' },
    preferredColor: String,
    heroVisualDirection: String,
    decorationDirection: String,
    titleColor: String,
    contentColor: String,
    targetAvatar: String,
    targetGender: String,
    targetAgeRange: String,
    targetProfile: String,
    mainProblem: String,
    tone: { type: String, default: 'urgence' },
    language: { type: String, default: 'français' },
    // Photo URLs (already uploaded to R2)
    photoUrls: [String],
    // Raw photo buffers stored as base64 for retry (first photo only for image generation)
    referenceImageBase64: String,
  },

  // Progress tracking
  progress: { type: Number, default: 0 },       // images done
  totalImages: { type: Number, default: 0 },     // total images expected
  progressPercent: { type: Number, default: 0 },  // 0-100

  // Step label for UI
  currentStep: { type: String, default: 'En attente...' },

  // Generated text content (product page JSON)
  product: { type: mongoose.Schema.Types.Mixed, default: null },

  // Generated images (merged progressively)
  images: {
    heroImage: String,
    heroPosterImage: String,
    beforeAfterImage: String,
    beforeAfterImages: [String],
    angles: [{ type: mongoose.Schema.Types.Mixed }],
    peoplePhotos: [String],
    socialProofImages: [String],
    descriptionGifs: [String],
  },

  // Error info
  errorMessage: String,
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },

  // Product name for display in task list
  productName: { type: String, default: '' },

  // Legacy imageJobId for backward compat
  imageJobId: String,
}, {
  timestamps: true,
});

// Index for fetching user's tasks
generationTaskSchema.index({ workspaceId: 1, createdAt: -1 });
generationTaskSchema.index({ status: 1, updatedAt: 1 });

// Auto-cleanup tasks older than 7 days
generationTaskSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export default mongoose.model('GenerationTask', generationTaskSchema);
