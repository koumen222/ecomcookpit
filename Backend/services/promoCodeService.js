/**
 * promoCodeService — Validation et application des codes promo aux paiements.
 *
 * - validatePromoCode({code, planKey, durationMonths, amount, workspaceId})
 *     -> { ok: true, code, discountAmount, finalAmount } | { ok: false, reason }
 *
 * - markPromoCodeUsed(promoDoc)
 *     incremente usedCount (à appeler quand un paiement passe en 'paid').
 */
import PromoCode from '../models/PromoCode.js';
import PlanPayment from '../models/PlanPayment.js';

function computeDiscount(promo, amount) {
  if (promo.discountType === 'percentage') {
    const pct = Math.max(0, Math.min(100, Number(promo.discountValue) || 0));
    return Math.round((amount * pct) / 100);
  }
  // fixed
  return Math.min(amount, Math.max(0, Number(promo.discountValue) || 0));
}

export async function validatePromoCode({ code, planKey, durationMonths, amount, workspaceId }) {
  if (!code || typeof code !== 'string') {
    return { ok: false, reason: 'Code requis' };
  }
  const normalized = String(code).trim().toUpperCase();
  if (!normalized) return { ok: false, reason: 'Code requis' };

  const promo = await PromoCode.findOne({ code: normalized });
  if (!promo) return { ok: false, reason: 'Code promo introuvable' };

  const status = promo.isCurrentlyValid();
  if (!status.ok) return { ok: false, reason: status.reason };

  if (Array.isArray(promo.applicablePlans) && promo.applicablePlans.length > 0) {
    if (!promo.applicablePlans.includes(planKey)) {
      return { ok: false, reason: 'Code non applicable à ce plan' };
    }
  }

  if (Array.isArray(promo.applicableDurations) && promo.applicableDurations.length > 0) {
    if (!promo.applicableDurations.includes(Number(durationMonths))) {
      return { ok: false, reason: 'Code non applicable à cette durée' };
    }
  }

  if (promo.minAmount && amount < promo.minAmount) {
    return { ok: false, reason: `Montant minimum requis : ${promo.minAmount} FCFA` };
  }

  if (promo.maxUsesPerWorkspace != null && workspaceId) {
    const usedByWs = await PlanPayment.countDocuments({
      workspaceId,
      promoCodeId: promo._id,
      status: 'paid'
    });
    if (usedByWs >= promo.maxUsesPerWorkspace) {
      return { ok: false, reason: 'Code déjà utilisé sur ce workspace' };
    }
  }

  const discountAmount = computeDiscount(promo, amount);
  const finalAmount = Math.max(0, amount - discountAmount);

  return {
    ok: true,
    promo,
    discountAmount,
    finalAmount,
    originalAmount: amount
  };
}

export async function markPromoCodeUsed(promoCodeId) {
  if (!promoCodeId) return;
  await PromoCode.updateOne({ _id: promoCodeId }, { $inc: { usedCount: 1 } });
}
