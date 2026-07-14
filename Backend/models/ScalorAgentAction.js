import mongoose from 'mongoose';

const scalorAgentActionSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomWorkspace', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', required: true, index: true },
  userRole: { type: String, default: '' },
  actionType: { type: String, required: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  success: { type: Boolean, default: false },
  result: { type: mongoose.Schema.Types.Mixed, default: {} },
  error: { type: String, default: '' },
  sourceMessage: { type: String, default: '' },
}, { timestamps: true, collection: 'scalor_agent_actions' });

scalorAgentActionSchema.index({ workspaceId: 1, createdAt: -1 });

export default mongoose.model('ScalorAgentAction', scalorAgentActionSchema);
