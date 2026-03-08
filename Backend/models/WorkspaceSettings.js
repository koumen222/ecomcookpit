import mongoose from 'mongoose';

const workspaceSettingsSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    unique: true,
    index: true
  },
  googleSheets: {
    apiKey: { type: String, default: '' },
    spreadsheetId: { type: String, default: '' },
    sheetName: { type: String, default: 'Sheet1' },
    lastSyncAt: { type: Date },
    columnMapping: {
      orderId: { type: String, default: 'A' },
      date: { type: String, default: 'B' },
      clientName: { type: String, default: 'C' },
      clientPhone: { type: String, default: 'D' },
      city: { type: String, default: 'E' },
      product: { type: String, default: 'F' },
      quantity: { type: String, default: 'G' },
      price: { type: String, default: 'H' },
      status: { type: String, default: 'I' },
      notes: { type: String, default: 'J' }
    }
  },
  sources: [{
    name: { type: String, required: true },
    type: { type: String, enum: ['google_sheets'], default: 'google_sheets' },
    spreadsheetId: { type: String, required: true },
    sheetName: { type: String, default: 'Sheet1' },
    isActive: { type: Boolean, default: true },
    lastSyncAt: { type: Date },
    lastRowCount: { type: Number, default: 0 },
    detectedHeaders: [String],
    detectedColumns: mongoose.Schema.Types.Mixed
  }],
  syncLocks: [{
    key: { type: String, required: true, index: true },
    sourceId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId },
    createdAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true, index: true }
  }],
  // Configuration de la synchronisation automatique
  autoSync: {
    enabled: { type: Boolean, default: true },
    interval: { 
      type: String, 
      enum: ['1min', '5min', '15min', '30min', '1hour'], 
      default: '5min' 
    },
    lastRunAt: { type: Date },
    updatedAt: { type: Date, default: Date.now },
    notifyOnChanges: { type: Boolean, default: true }
  },
  // Commission par commande livrée pour les closeuses
  commissionRate: {
    type: Number,
    default: 1000
  },
  // Préférences de notifications push
  pushNotifications: {
    push_new_orders: { type: Boolean, default: true },
    push_status_changes: { type: Boolean, default: true },
    push_deliveries: { type: Boolean, default: true },
    push_stock_updates: { type: Boolean, default: true },
    push_low_stock: { type: Boolean, default: true },
    push_sync_completed: { type: Boolean, default: true }
  }
}, {
  timestamps: true,
  collection: 'ecom_workspace_settings'
});

const WorkspaceSettings = mongoose.model('WorkspaceSettings', workspaceSettingsSchema);
export default WorkspaceSettings;
