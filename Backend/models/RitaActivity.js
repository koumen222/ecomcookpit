import mongoose from 'mongoose';

const ritaActivitySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['message_received', 'message_replied', 'order_confirmed', 'vocal_transcribed', 'vocal_sent', 'image_sent', 'escalation'],
    required: true
  },
  customerPhone: { type: String, default: '' },
  customerName: { type: String, default: '' },
  product: { type: String, default: '' },
  price: { type: String, default: '' },
  details: { type: String, default: '' },
}, {
  timestamps: true,
  collection: 'rita_activities',
});

ritaActivitySchema.index({ userId: 1, createdAt: -1 });
ritaActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }); // TTL 90 days

export default mongoose.model('RitaActivity', ritaActivitySchema);
