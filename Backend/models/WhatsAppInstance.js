import mongoose from 'mongoose';

const whatsappInstanceSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  instanceName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  instanceToken: {
    type: String,
    required: true,
    trim: true
  },
  customName: {
    type: String,
    trim: true
  },
  apiUrl: {
    type: String,
    default: 'https://api.evolution-api.com'
  },
  status: {
    type: String,
    enum: ['connected', 'disconnected', 'unknown', 'configured', 'active', 'deleted'],
    default: 'unknown'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  defaultPart: {
    type: Number,
    default: 50,
    min: 0,
    max: 100
  }
}, {
  collection: 'whatsapp_instances',
  timestamps: true
});

// Index pour recherche rapide par utilisateur et workspace
whatsappInstanceSchema.index({ userId: 1 });
whatsappInstanceSchema.index({ workspaceId: 1 });

export default mongoose.model('WhatsappInstance', whatsappInstanceSchema);
