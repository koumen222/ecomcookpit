import AffiliateUser from '../models/AffiliateUser.js';
import AffiliateLink from '../models/AffiliateLink.js';
import AffiliateConversion from '../models/AffiliateConversion.js';
import AffiliateConfig from '../models/AffiliateConfig.js';

export function normalizeCode(value = '') {
  return String(value || '').trim().toUpperCase();
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
