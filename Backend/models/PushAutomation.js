import mongoose from 'mongoose';

const pushAutomationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: 80
  },
  scope: {
    type: String,
    enum: ['global', 'workspace'],
    required: true,
    default: 'global',
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    default: null,
    index: true
  },
  cron: {
    type: String,
    required: true
  },
  timezone: {
    type: String,
    default: 'Africa/Abidjan'
  },
  enabled: {
    type: Boolean,
    default: true,
    index: true
  },
  payload: {
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 500 },
    url: { type: String, default: '' },
    tag: { type: String, default: 'automation' },
    icon: { type: String, default: '/icons/icon-192x192.png' },
    badge: { type: String, default: '/icons/icon-72x72.png' }
  },
  lastRunAt: {
    type: Date,
    default: null
  },
  lastResult: {
    total: { type: Number, default: 0 },
    successful: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'push_automations'
});

pushAutomationSchema.index({ enabled: 1, scope: 1 });

const PushAutomation = mongoose.model('PushAutomation', pushAutomationSchema);

export default PushAutomation;
