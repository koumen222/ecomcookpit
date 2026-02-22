import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  senderRole: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000,
    trim: true
  },
  channel: {
    type: String,
    required: true,
    index: true
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomMessage',
    default: null
  },
  replyToContent: {
    type: String,
    default: null
  },
  replyToSenderName: {
    type: String,
    default: null
  },
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EcomUser'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'ecom_messages'
});

messageSchema.index({ workspaceId: 1, channel: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // 90 jours

const Message = mongoose.model('EcomMessage', messageSchema);

export default Message;
