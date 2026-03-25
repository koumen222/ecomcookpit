import mongoose from 'mongoose';

const agentSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  workspaceId: { type: String, index: true },

  // Infos de base
  name: { type: String, required: true },
  type: { type: String, enum: ['whatsapp', 'instagram', 'facebook', 'email'], default: 'whatsapp' },
  description: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive', 'paused'], default: 'inactive' },

  // Référence à la config
  configId: { type: mongoose.Schema.Types.ObjectId, ref: 'RitaConfig' },

  // Stats
  productsCount: { type: Number, default: 0 },
  instanceId: { type: String, default: '' },

  // Métadonnées
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  collection: 'agents',
  timestamps: true
});

agentSchema.index({ userId: 1, type: 1 });
agentSchema.index({ workspaceId: 1 });

export default mongoose.model('Agent', agentSchema);
