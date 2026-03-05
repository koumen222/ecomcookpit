import mongoose from 'mongoose';

const whatsAppInstanceSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  instanceId: {
    type: String,
    required: true,
    trim: true
  },
  apiKey: {
    type: String,
    required: true
  },
  apiUrl: {
    type: String,
    default: 'https://api.ecomcookpit.site'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'error'],
    default: 'active'
  },
  lastUsed: {
    type: Date,
    default: null
  },
  messagesSent: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index pour recherche rapide par workspace
whatsAppInstanceSchema.index({ workspaceId: 1, status: 1 });

// Middleware pour mettre à jour updatedAt
whatsAppInstanceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const WhatsAppInstance = mongoose.model('WhatsAppInstance', whatsAppInstanceSchema);

export default WhatsAppInstance;
