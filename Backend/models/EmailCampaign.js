import mongoose from 'mongoose';

const emailCampaignSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    default: null,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  previewText: {
    type: String,
    trim: true,
    default: ''
  },
  fromName: {
    type: String,
    trim: true,
    default: ''
  },
  fromEmail: {
    type: String,
    trim: true,
    default: ''
  },
  replyTo: {
    type: String,
    trim: true,
    default: ''
  },
  // Body: either HTML or plain text
  bodyHtml: {
    type: String,
    default: ''
  },
  bodyText: {
    type: String,
    default: ''
  },
  // Audience
  audienceType: {
    type: String,
    enum: ['all_users', 'workspace_users', 'custom_list', 'segment'],
    default: 'custom_list'
  },
  // Custom email list (manual)
  customEmails: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  // Segment filter (for workspace_users)
  segmentFilter: {
    roles: [String],
    hasWorkspace: { type: Boolean, default: null }
  },
  // Scheduling
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'],
    default: 'draft',
    index: true
  },
  scheduledAt: {
    type: Date,
    default: null
  },
  sentAt: {
    type: Date,
    default: null
  },
  // Stats
  stats: {
    targeted: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 }
  },
  // Per-recipient results (capped at 500 for perf)
  results: [{
    email: String,
    name: String,
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    error: String,
    sentAt: Date,
    resendId: String
  }],
  tags: [{ type: String, trim: true }]
}, {
  timestamps: true,
  collection: 'ecom_email_campaigns'
});

emailCampaignSchema.index({ status: 1, scheduledAt: 1 });
emailCampaignSchema.index({ createdAt: -1 });

const EmailCampaign = mongoose.model('EmailCampaign', emailCampaignSchema);
export default EmailCampaign;
