import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomWorkspace', required: true, index: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  link: { type: String, trim: true },
  email: { type: String, trim: true },
  notes: { type: String },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser' }
}, { timestamps: true });

supplierSchema.index({ workspaceId: 1, name: 1 });

export default mongoose.model('Supplier', supplierSchema);
