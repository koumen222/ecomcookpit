import mongoose from 'mongoose';

/**
 * Facture STRICTE des crédits Creative Center — une écriture par mouvement.
 * Alimentée au cœur de services/creativeCredits.js : aucun débit ni
 * remboursement ne peut avoir lieu sans trace ici. Sert au pilotage des
 * coûts API (super admin : consommation par fonctionnalité / jour / compte).
 */
const creativeCreditLedgerSchema = new mongoose.Schema({
  workspaceId: { type: String, required: true, index: true },
  // 'debit' = crédits consommés · 'refund' = crédits rendus (échec ou équité Pro→Éco)
  type:    { type: String, enum: ['debit', 'refund'], required: true },
  feature: { type: String, required: true, index: true },
  credits: { type: Number, required: true, min: 0 },
  // Solde du workspace juste après le mouvement (null si inconnu)
  balanceAfter: { type: Number, default: null },
  // Contexte libre : stage, engine, quality (480p/720p), raison du refund…
  meta: { type: mongoose.Schema.Types.Mixed, default: null },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'ecom_creative_credit_ledger',
});

creativeCreditLedgerSchema.index({ createdAt: -1 });
creativeCreditLedgerSchema.index({ feature: 1, createdAt: -1 });
creativeCreditLedgerSchema.index({ workspaceId: 1, createdAt: -1 });

export default mongoose.model('CreativeCreditLedger', creativeCreditLedgerSchema);
