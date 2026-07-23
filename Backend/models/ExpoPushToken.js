import mongoose from 'mongoose';

/**
 * Token Expo Push d'un appareil mobile (app Scalor iOS/Android).
 * Équivalent mobile du modèle Subscription (Web Push).
 */
const expoPushTokenSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true,
    index: true
  },
  // ExponentPushToken[xxxxxxxx]
  token: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    enum: ['ios', 'android', 'unknown'],
    default: 'unknown'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUsed: {
    type: Date,
    default: Date.now
  }
});

// Un token n'existe qu'une fois par utilisateur
expoPushTokenSchema.index({ userId: 1, token: 1 }, { unique: true });

const ExpoPushToken = mongoose.model('ExpoPushToken', expoPushTokenSchema);

export default ExpoPushToken;
