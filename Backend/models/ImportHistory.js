import mongoose from 'mongoose';

const importErrorSchema = new mongoose.Schema({
  row: { type: Number, required: true },
  field: { type: String, default: '' },
  message: { type: String, required: true },
  rawData: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const importHistorySchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  sourceId: {
    type: String,
    required: true,
    index: true
  },
  sourceName: {
    type: String,
    default: ''
  },
  spreadsheetId: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'success', 'partial', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  triggeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    default: null
  },
  // Résultats détaillés
  successCount: { type: Number, default: 0 },
  updatedCount: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  duplicateCount: { type: Number, default: 0 },
  skippedCount: { type: Number, default: 0 },
  totalRows: { type: Number, default: 0 },
  // Erreurs détaillées
  errors: [importErrorSchema],
  // Colonnes détectées
  detectedHeaders: [String],
  columnMapping: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Timing
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  duration: { type: Number, default: 0 } // en secondes
}, {
  timestamps: true,
  collection: 'ecom_import_history'
});

importHistorySchema.index({ workspaceId: 1, createdAt: -1 });
importHistorySchema.index({ workspaceId: 1, status: 1 });

const ImportHistory = mongoose.model('ImportHistory', importHistorySchema);
export default ImportHistory;
