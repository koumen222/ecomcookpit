import mongoose from 'mongoose';

const emailCampaignRecipientLogSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmailCampaign',
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    default: null,
    index: true
  },
  recipientToken: {
    type: String,
    required: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    required: true
  },
  name: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending',
    index: true
  },
  error: {
    type: String,
    default: ''
  },
  sentAt: Date,
  resendId: String,
  opened: {
    type: Boolean,
    default: false,
    index: true
  },
  openedAt: Date,
  openCount: {
    type: Number,
    default: 0
  },
  clicks: [{
    url: String,
    clickedAt: Date
  }],
  uniqueClicks: {
    type: Number,
    default: 0,
    index: true
  },
  lastClickedAt: Date
}, {
  timestamps: true,
  collection: 'ecom_email_campaign_recipient_logs'
});

emailCampaignRecipientLogSchema.index({ campaignId: 1, recipientToken: 1 }, { unique: true });
emailCampaignRecipientLogSchema.index({ campaignId: 1, sentAt: -1 });
emailCampaignRecipientLogSchema.index({ campaignId: 1, email: 1 });

const EmailCampaignRecipientLog = mongoose.model('EmailCampaignRecipientLog', emailCampaignRecipientLogSchema);
export default EmailCampaignRecipientLog;
