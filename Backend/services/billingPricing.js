import PlanConfig from '../models/PlanConfig.js';

const ROUNDING_STEP = 500;

const DEFAULT_MONTHLY_PRICES = {
  starter: 5000,
  pro: 10000,
  ultra: 15000
};

const PLAN_DURATION = {
  starter_1: 1,
  starter_3: 3,
  starter_6: 6,
  starter_12: 12,
  pro_1: 1,
  pro_3: 3,
  pro_6: 6,
  pro_12: 12,
  ultra_1: 1,
  ultra_3: 3,
  ultra_6: 6,
  ultra_12: 12
};

const PLAN_BILLING_FACTORS = {
  starter: {
    1: 1,
    3: 5 / 6,
    6: 95 / 120,
    12: 3 / 4
  },
  pro: {
    1: 1,
    3: 13 / 15,
    6: 4 / 5,
    12: 3 / 4
  },
  ultra: {
    1: 1,
    3: 8 / 9,
    6: 5 / 6,
    12: 7 / 9
  }
};

function roundBillingAmount(value) {
  return Math.round(Number(value || 0) / ROUNDING_STEP) * ROUNDING_STEP;
}

async function getRegularMonthlyPrice(planKey) {
  await PlanConfig.seedDefaults();
  const config = await PlanConfig.findOne({ key: planKey }).select('priceRegular').lean();
  return Number(config?.priceRegular ?? DEFAULT_MONTHLY_PRICES[planKey] ?? 0);
}

async function getPlanCheckoutAmount(planCode) {
  const durationMonths = PLAN_DURATION[planCode];
  if (!durationMonths) return null;

  const planKey = String(planCode).split('_')[0];
  const billingFactor = PLAN_BILLING_FACTORS[planKey]?.[durationMonths];
  if (!billingFactor) return null;

  const monthlyPrice = await getRegularMonthlyPrice(planKey);
  return roundBillingAmount(monthlyPrice * durationMonths * billingFactor);
}

export {
  DEFAULT_MONTHLY_PRICES,
  PLAN_DURATION,
  PLAN_BILLING_FACTORS,
  roundBillingAmount,
  getPlanCheckoutAmount
};