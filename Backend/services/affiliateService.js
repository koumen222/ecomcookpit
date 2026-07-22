import crypto from 'node:crypto';
import AffiliateUser from '../models/AffiliateUser.js';
import AffiliateLink from '../models/AffiliateLink.js';
import AffiliateClick from '../models/AffiliateClick.js';
import AffiliateVisit from '../models/AffiliateVisit.js';
import AffiliateConversion from '../models/AffiliateConversion.js';
import AffiliateConfig from '../models/AffiliateConfig.js';

export function normalizeCode(value = '') {
  return String(value || '').trim().toUpperCase();
}

export function generateClickId() {
  return crypto.randomUUID().replace(/-/g, '');
}

export function generateCode(prefix = 'AFF') {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${random}`;
}

export async function getAffiliateConfig() {
  let config = await AffiliateConfig.findOne({ singletonKey: 'global' });
  if (!config) {
    config = await AffiliateConfig.create({
      singletonKey: 'global',
      baseCommissionType: 'fixed',
      baseCommissionValue: 500,
      defaultLandingUrl: 'https://scalor.net',
      linkTypeRules: [
        { name: 'default', commissionType: 'fixed', commissionValue: 500, isActive: true }
      ]
    });
  }
  return config;
}

export function computeCommission({ amount = 0, commissionType = 'fixed', commissionValue = 500 }) {
  if (commissionType === 'percentage') {
    const value = Math.max(0, Number(commissionValue) || 0);
    return Math.round((Math.max(0, Number(amount) || 0) * value) / 100);
  }
  return Math.max(0, Number(commissionValue) || 0);
}

export async function resolveCommissionRule({ affiliate, link, config, amount = 0 }) {
  let type = config.baseCommissionType || 'fixed';
  let value = Number(config.baseCommissionValue || 500);

  if (affiliate?.commissionValue > 0) {
    type = affiliate.commissionType || type;
    value = Number(affiliate.commissionValue || value);
  }

  if (link?.commissionValue > 0) {
    type = link.commissionType || type;
    value = Number(link.commissionValue || value);
  }

  const amountValue = computeCommission({ amount, commissionType: type, commissionValue: value });
  return {
    commissionType: type,
    commissionValue: value,
    commissionAmount: amountValue
  };
}

export async function createAffiliateConversionFromOrder({
  affiliateCode,
  affiliateLinkCode,
  workspaceId,
  storeOrder,
  order
}) {
  const normalizedAffiliateCode = normalizeCode(affiliateCode);
  if (!normalizedAffiliateCode) return null;

  const affiliate = await AffiliateUser.findOne({
    referralCode: normalizedAffiliateCode,
    isActive: true
  });

  if (!affiliate) return null;

  const normalizedLinkCode = normalizeCode(affiliateLinkCode);
  let link = null;
  if (normalizedLinkCode) {
    link = await AffiliateLink.findOne({
      code: normalizedLinkCode,
      affiliateId: affiliate._id,
      isActive: true
    });
  }

  const config = await getAffiliateConfig();
  const orderAmount = Number(order?.price ?? storeOrder?.total ?? 0) || 0;

  const rule = await resolveCommissionRule({
    affiliate,
    link,
    config,
    amount: orderAmount
  });

  const conversion = await AffiliateConversion.create({
    affiliateId: affiliate._id,
    affiliateCode: normalizedAffiliateCode,
    affiliateLinkCode: normalizedLinkCode || '',
    workspaceId: workspaceId || null,
    storeOrderId: storeOrder?._id || null,
    orderId: order?._id || null,
    orderNumber: order?.orderId || storeOrder?.orderNumber || '',
    orderAmount,
    orderCurrency: order?.currency || storeOrder?.currency || 'XAF',
    commissionType: rule.commissionType,
    commissionValue: rule.commissionValue,
    commissionAmount: rule.commissionAmount,
    status: 'pending'
  });

  return conversion;
}

// ─────────────────────────────────────────────────────────────────────────────
// Programme Scalor (SaaS) — conversions inscription + paiements d'abonnement
// ─────────────────────────────────────────────────────────────────────────────

const clip = (value, max = 300) => String(value || '').trim().slice(0, max);

/**
 * Garde anti auto-parrainage : un affilié ne touche pas de commission sur son
 * propre compte Scalor (compte lié ou même email).
 */
export function isSelfReferral(affiliate, user) {
  if (!affiliate || !user) return false;
  if (affiliate.scalorUserId && String(affiliate.scalorUserId) === String(user._id)) return true;
  const affEmail = String(affiliate.email || '').trim().toLowerCase();
  const userEmail = String(user.email || '').trim().toLowerCase();
  return Boolean(affEmail && userEmail && affEmail === userEmail);
}

/**
 * Bonus d'inscription (montant configurable, défaut 500 FCFA).
 * Idempotent : l'index unique (conversionType=signup, referredUserId) absorbe
 * les doubles appels (register + Google, replays). Anti auto-parrainage.
 * @returns {Promise<object|null>} la conversion créée, ou null (refus/duplicat)
 */
export async function creditSignupConversion(user) {
  const code = normalizeCode(user?.referredByAffiliateCode);
  if (!code) return null;

  const affiliate = await AffiliateUser.findOne({ referralCode: code, isActive: true });
  if (!affiliate) return null;

  if (isSelfReferral(affiliate, user)) {
    console.warn(`[affiliate] auto-parrainage refusé (signup): ${code} → ${user.email}`);
    return null;
  }

  const config = await getAffiliateConfig();
  const bonus = Math.max(0, Number(config.signupBonusAmount ?? 500));
  if (!bonus) return null;

  try {
    const conversion = await AffiliateConversion.create({
      affiliateId: affiliate._id,
      affiliateCode: affiliate.referralCode,
      affiliateLinkCode: normalizeCode(user.referredByAffiliateLinkCode || ''),
      clickId: clip(user.referredByClickId, 64),
      conversionType: 'signup',
      referredUserId: user._id,
      commissionType: 'fixed',
      commissionValue: bonus,
      commissionAmount: bonus,
      status: 'approved',
      statusNote: 'Bonus inscription automatique'
    });
    console.log(`[affiliate] +${bonus} FCFA (signup) → ${affiliate.referralCode} (filleul ${user._id})`);
    return conversion;
  } catch (error) {
    if (error?.code === 11000) return null; // bonus déjà crédité pour ce filleul
    throw error;
  }
}

/**
 * Commission sur paiement d'abonnement : % configurable (défaut 50), à vie.
 * Idempotent : une seule conversion par PlanPayment (index unique).
 * @returns {Promise<object|null>}
 */
export async function creditPlanPaymentConversion({ payment, user }) {
  if (!payment?._id || !user?.referredByAffiliateCode) return null;

  const code = normalizeCode(user.referredByAffiliateCode);
  const affiliate = await AffiliateUser.findOne({ referralCode: code, isActive: true });
  if (!affiliate) return null;

  if (isSelfReferral(affiliate, user)) {
    console.warn(`[affiliate] auto-parrainage refusé (payment): ${code} → ${user.email}`);
    return null;
  }

  const config = await getAffiliateConfig();
  const percent = Math.min(100, Math.max(0, Number(config.paymentCommissionPercent ?? 50)));
  if (!percent) return null;

  const amount = Math.max(0, Number(payment.amount) || 0);
  const commissionAmount = Math.round((amount * percent) / 100);
  if (!commissionAmount) return null;

  try {
    const conversion = await AffiliateConversion.create({
      affiliateId: affiliate._id,
      affiliateCode: affiliate.referralCode,
      affiliateLinkCode: normalizeCode(user.referredByAffiliateLinkCode || ''),
      clickId: clip(user.referredByClickId, 64),
      conversionType: 'payment',
      referredUserId: user._id,
      planPaymentId: payment._id,
      orderAmount: amount,
      orderCurrency: 'XAF',
      commissionType: 'percentage',
      commissionValue: percent,
      commissionAmount,
      status: 'approved',
      statusNote: `${percent}% commission sur paiement ${payment.plan || ''} (${payment.durationMonths || 1} mois)`
    });
    console.log(`[affiliate] +${commissionAmount} FCFA (payment ${payment._id}) → ${affiliate.referralCode}`);
    return conversion;
  } catch (error) {
    if (error?.code === 11000) return null; // paiement déjà commissionné (webhook rejoué)
    throw error;
  }
}

/**
 * Enregistre une visite référée (beacon public).
 * Dédoublonnage : même visiteur + même page dans les 30 dernières minutes.
 * Rattache aussi le visitorId au clic /r/ d'origine (funnel exact).
 * @returns {Promise<{recorded: boolean}>}
 */
export async function recordAffiliateVisit({
  affiliateCode,
  affiliateLinkCode,
  clickId,
  visitorId,
  sessionId,
  url,
  referrer,
  ipAddress,
  userAgent
}) {
  const code = normalizeCode(affiliateCode);
  const cleanVisitorId = clip(visitorId, 64);
  if (!code || !cleanVisitorId) return { recorded: false };

  const affiliate = await AffiliateUser.findOne({ referralCode: code, isActive: true })
    .select('_id referralCode').lean();
  if (!affiliate) return { recorded: false };

  let path = '';
  try {
    path = new URL(String(url || ''), 'https://scalor.net').pathname.slice(0, 300);
  } catch {
    path = clip(url, 300);
  }

  // Dédoublonnage : reload / navigation répétée sur la même page
  const dedupSince = new Date(Date.now() - 30 * 60 * 1000);
  const recent = await AffiliateVisit.findOne({
    visitorId: cleanVisitorId,
    path,
    createdAt: { $gte: dedupSince }
  }).select('_id').lean();
  if (recent) return { recorded: false };

  const cleanClickId = clip(clickId, 64);
  await AffiliateVisit.create({
    affiliateId: affiliate._id,
    affiliateCode: affiliate.referralCode,
    affiliateLinkCode: normalizeCode(affiliateLinkCode || ''),
    clickId: cleanClickId,
    visitorId: cleanVisitorId,
    sessionId: clip(sessionId, 64),
    url: clip(url, 500),
    path,
    referrer: clip(referrer, 500),
    ipAddress: clip(ipAddress, 100),
    userAgent: clip(userAgent, 500)
  });

  // Backfill : rattacher le visiteur au clic d'origine (une seule fois)
  if (cleanClickId) {
    AffiliateClick.updateOne(
      { clickId: cleanClickId, visitorId: '' },
      { $set: { visitorId: cleanVisitorId } }
    ).catch(() => {});
  }

  return { recorded: true };
}

/**
 * Solde disponible = commissions approuvées non rattachées à un retrait.
 */
export async function getAffiliateBalance(affiliateId) {
  const [row] = await AffiliateConversion.aggregate([
    { $match: { affiliateId, status: 'approved', payoutId: null } },
    { $group: { _id: null, amount: { $sum: '$commissionAmount' }, count: { $sum: 1 } } }
  ]);
  return { amount: row?.amount || 0, count: row?.count || 0 };
}
