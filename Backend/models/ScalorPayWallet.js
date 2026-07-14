import mongoose from 'mongoose';

/**
 * ScalorPayWallet — merchant balance for the managed "Scalor Pay" method.
 *
 * When a customer pays an order via Scalor Pay, the money is collected on the
 * platform's own MoneyFusion account. The order amount, minus the Scalor Pay
 * commission, is credited to this wallet. The merchant sees `balance` (solde
 * disponible) and can request a payout (withdrawal) down to it.
 *
 * One wallet per workspace (single-store legacy) — orders keep a storeId so the
 * ledger can still be filtered per store, but the balance is workspace-level.
 *
 * All amounts are stored in the wallet `currency` (default XAF), integers-safe
 * (FCFA has no decimals). Crediting is idempotent via the ledger's
 * `creditApplied` flag, mirroring the billing PlanPayment pattern.
 */
const scalorPayWalletSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    required: true,
    unique: true,
    index: true
  },
  currency: {
    type: String,
    default: 'XAF'
  },
  // Solde disponible (retirable maintenant)
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  // Montant en cours d'encaissement (paiements pas encore confirmés) — informatif
  pendingBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  // Cumuls (audit / affichage)
  totalCollected: { type: Number, default: 0 }, // brut encaissé (avant commission)
  totalCommission: { type: Number, default: 0 }, // commission Scalor prélevée
  totalCredited: { type: Number, default: 0 }, // net crédité au marchand
  totalWithdrawn: { type: Number, default: 0 }, // net déjà versé au marchand
}, {
  timestamps: true
});

const ScalorPayWallet = mongoose.model('ScalorPayWallet', scalorPayWalletSchema);
export default ScalorPayWallet;
