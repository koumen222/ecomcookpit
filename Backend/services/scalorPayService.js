/**
 * Scalor Pay service — managed payment method backed by the platform's own
 * MoneyFusion account.
 *
 * Flow:
 *   1. Storefront checkout creates a StoreOrder (paymentStatus 'pending') and a
 *      ScalorPayTransaction ('sale', pending), then opens a MoneyFusion session
 *      on the PLATFORM account (same account as billing).
 *   2. Customer pays → MoneyFusion calls the shared webhook / we poll status.
 *   3. On 'paid', `creditSaleTransaction` marks the order paid and credits the
 *      merchant wallet with the net amount (gross − commission), exactly once.
 *
 * Commission is configurable via SCALOR_PAY_COMMISSION_RATE (default 0.02 = 2%).
 */
import https from 'https';
import axios from 'axios';
import ScalorPayWallet from '../models/ScalorPayWallet.js';
import ScalorPayTransaction from '../models/ScalorPayTransaction.js';
import StoreOrder from '../models/StoreOrder.js';

// ── MoneyFusion config — same platform account as billing ──
export const MF_API_URL = process.env.MF_API_URL
  || 'https://pay.moneyfusion.net/scalor/597e2cf962834532/pay/';
export const MF_STATUS_URL = (token) => `https://pay.moneyfusion.net/paiementNotif/${token}`;
export const mfHttpsAgent = new https.Agent({ rejectUnauthorized: false });

// ── Commission (part gardée par la plateforme) ──
export const COMMISSION_RATE = (() => {
  const v = Number(process.env.SCALOR_PAY_COMMISSION_RATE);
  return Number.isFinite(v) && v >= 0 && v < 1 ? v : 0.02; // défaut 2%
})();

/** FCFA n'a pas de décimales — on arrondit la commission au franc. */
export function computeSplit(grossAmount) {
  const gross = Math.max(0, Math.round(Number(grossAmount) || 0));
  const commissionAmount = Math.round(gross * COMMISSION_RATE);
  const netAmount = gross - commissionAmount;
  return { gross, commissionAmount, netAmount, commissionRate: COMMISSION_RATE };
}

/** Récupère (ou crée) le wallet d'un workspace. */
export async function getOrCreateWallet(workspaceId, currency = 'XAF') {
  let wallet = await ScalorPayWallet.findOne({ workspaceId });
  if (!wallet) {
    try {
      wallet = await ScalorPayWallet.create({ workspaceId, currency });
    } catch (err) {
      // Course : un autre appel vient de le créer (unique index) → on relit.
      if (err?.code === 11000) {
        wallet = await ScalorPayWallet.findOne({ workspaceId });
      } else {
        throw err;
      }
    }
  }
  return wallet;
}

/**
 * Crée une session de paiement MoneyFusion sur le compte plateforme.
 * @returns {{ mfToken:string, paymentUrl:string, message?:string }}
 */
export async function createMoneyFusionSession({ amount, phone, clientName, personalInfo, returnUrl, webhookUrl }) {
  const paymentData = {
    totalPrice: amount,
    article: [{ 'Commande boutique (Scalor Pay)': amount }],
    personal_Info: [personalInfo],
    numeroSend: String(phone || '').trim(),
    nomclient: String(clientName || '').trim(),
    return_url: returnUrl,
    webhook_url: webhookUrl,
  };

  const mfResponse = await axios.post(MF_API_URL, paymentData, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000,
    httpsAgent: mfHttpsAgent,
  });

  const { statut, token: mfToken, url: paymentUrl, message } = mfResponse.data || {};
  if (!statut || !mfToken) {
    const e = new Error(message || 'Réponse invalide du prestataire de paiement');
    e.mfBadResponse = mfResponse.data;
    throw e;
  }
  return { mfToken, paymentUrl: paymentUrl || '', message };
}

/**
 * Crédite le wallet marchand pour une vente Scalor Pay confirmée — IDEMPOTENT.
 *
 * Étapes atomiques (mêmes garanties que billing.applyPlanPayment) :
 *   1. Claim : status→'paid' + creditApplied encore false  (sinon on sort)
 *   2. $inc wallet.balance += netAmount (+ cumuls)
 *   3. SET creditApplied=true
 * Un crash entre 1 et 3 est rattrapé au prochain passage (status='paid' &
 * creditApplied=false).
 *
 * @param {object} tx  document ScalorPayTransaction (type 'sale')
 * @param {object} [ancillary]  { paymentMethod, transactionNumber }
 */
export async function creditSaleTransaction(tx, ancillary = {}) {
  if (!tx || tx.type !== 'sale') return;

  const set = { status: 'paid' };
  if (ancillary.paymentMethod) set.paymentMethod = ancillary.paymentMethod;
  if (ancillary.transactionNumber) set.transactionNumber = ancillary.transactionNumber;

  // 1. Claim
  const claimed = await ScalorPayTransaction.findOneAndUpdate(
    { _id: tx._id, $or: [{ status: { $ne: 'paid' } }, { creditApplied: { $ne: true } }] },
    { $set: set },
    { new: true }
  );
  if (!claimed) return;              // déjà crédité par un autre process
  if (claimed.creditApplied) return; // status paid mais crédit déjà appliqué

  try {
    // 2. Crédit du wallet (atomique)
    const wallet = await getOrCreateWallet(claimed.workspaceId, claimed.currency);
    await ScalorPayWallet.findByIdAndUpdate(wallet._id, {
      $inc: {
        balance: claimed.netAmount,
        totalCollected: claimed.grossAmount,
        totalCommission: claimed.commissionAmount,
        totalCredited: claimed.netAmount,
      },
    });

    // 3. Verrou d'idempotence
    const finalState = await ScalorPayTransaction.findOneAndUpdate(
      { _id: claimed._id, creditApplied: { $ne: true } },
      { $set: { creditApplied: true, creditedAt: new Date(), lastCreditError: '' } },
      { new: true }
    );
    if (!finalState) {
      // Course : déjà appliqué ailleurs → on annule le double-crédit.
      await ScalorPayWallet.findByIdAndUpdate(wallet._id, {
        $inc: {
          balance: -claimed.netAmount,
          totalCollected: -claimed.grossAmount,
          totalCommission: -claimed.commissionAmount,
          totalCredited: -claimed.netAmount,
        },
      });
      return;
    }

    // Marque la commande comme payée (best-effort).
    if (claimed.orderId) {
      await StoreOrder.findByIdAndUpdate(claimed.orderId, {
        $set: { paymentStatus: 'paid', status: 'confirmed', paidAt: new Date() },
      }).catch(() => {});
    }

    console.log(`[scalorPay] ✅ crédité net=${claimed.netAmount} ${claimed.currency} (brut=${claimed.grossAmount}, com=${claimed.commissionAmount}) wallet ws=${claimed.workspaceId}`);
  } catch (err) {
    await ScalorPayTransaction.findByIdAndUpdate(claimed._id, {
      $set: { lastCreditError: String(err?.message || err).slice(0, 200) },
    });
    console.error('[scalorPay] creditSaleTransaction error:', err);
  }
}
