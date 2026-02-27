import mongoose from 'mongoose';
import crypto from 'crypto';

const passwordResetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  used: {
    type: Boolean,
    default: false
  }
}, {
  collection: 'ecom_password_reset_tokens',
  timestamps: true
});

// Auto-expire documents after expiresAt
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to generate a secure token
passwordResetTokenSchema.statics.createToken = async function(userId) {
  // Invalidate any existing tokens for this user
  await this.deleteMany({ userId });
  
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  
  const resetToken = await this.create({
    userId,
    token,
    expiresAt
  });
  
  return resetToken;
};

// Static method to verify a token
passwordResetTokenSchema.statics.verifyToken = async function(token) {
  const resetToken = await this.findOne({
    token,
    used: false,
    expiresAt: { $gt: new Date() }
  });
  
  return resetToken;
};

export default mongoose.model('PasswordResetToken', passwordResetTokenSchema);
