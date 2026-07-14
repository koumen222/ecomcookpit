import mongoose from 'mongoose';

// Journal central de TOUS les emails sortants (SMTP ou fournisseur API).
// Alimente l'onglet "Envois" du dashboard super-admin serveur mail.
const emailSendLogSchema = new mongoose.Schema({
  to: { type: String, required: true, index: true },
  from: { type: String, default: '' },
  subject: { type: String, default: '' },
  status: { type: String, enum: ['sent', 'failed'], required: true, index: true },
  // Origine applicative : otp | notification | custom | campaign | campaign_test | ...
  source: { type: String, default: 'app', index: true },
  provider: { type: String, enum: ['smtp', 'resend'], default: 'smtp', index: true },
  messageId: { type: String, default: '' },
  // Queue ID Postfix ("queued as XXXX") — permet de croiser avec /var/log/mail.log
  queueId: { type: String, default: '', index: true },
  smtpResponse: { type: String, default: '' },
  error: { type: String, default: '' },
  durationMs: { type: Number, default: 0 },
  meta: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

emailSendLogSchema.index({ createdAt: -1 });

export default mongoose.model('EmailSendLog', emailSendLogSchema);
