import mongoose from 'mongoose';

const ritaContactSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  phone: { type: String, required: true },
  pushName: { type: String, default: '' },
  clientNumber: { type: Number, required: true },
  firstMessageAt: { type: Date, default: Date.now },
  lastMessageAt: { type: Date, default: Date.now },
  messageCount: { type: Number, default: 1 },
  hasOrdered: { type: Boolean, default: false },
  tags: [{ type: String }],
  notes: { type: String, default: '' },
}, {
  timestamps: true,
  collection: 'rita_contacts',
});

ritaContactSchema.index({ userId: 1, phone: 1 }, { unique: true });
ritaContactSchema.index({ userId: 1, clientNumber: 1 });
ritaContactSchema.index({ userId: 1, lastMessageAt: -1 });

export default mongoose.model('RitaContact', ritaContactSchema);
