import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomWorkspace', required: true, index: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true },
  emoji: { type: String, default: '💬' },
  description: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true, collection: 'ecom_channels' });

channelSchema.index({ workspaceId: 1, slug: 1 }, { unique: true });

export default mongoose.model('EcomChannel', channelSchema);
