import ecomApi from './ecommApi.js';

/**
 * Billing API — MoneyFusion plan upgrade integration.
 */

/** Fetch the public plan catalog (prices, features, promo). No auth. */
export async function getPublicPlans() {
  const { data } = await ecomApi.get('/billing/plans/public');
  return data;
}

/** Fetch current plan for the active workspace */
export async function getCurrentPlan(workspaceId) {
  const { data } = await ecomApi.get('/billing/plan', { params: { workspaceId } });
  return data;
}

/**
 * Initiate a checkout session.
 * @param {Object} payload — { plan, phone, clientName, workspaceId }
 * @returns {{ success, mfToken, paymentUrl, amount, plan, durationMonths }}
 */
export async function createCheckout(payload) {
  const { data } = await ecomApi.post('/billing/checkout', payload);
  return data;
}

/**
 * Poll the payment status from MoneyFusion via our backend.
 * @param {string} token — MoneyFusion tokenPay
 */
export async function getPaymentStatus(token) {
  const { data } = await ecomApi.get(`/billing/status/${token}`);
  return data;
}

/** Fetch payment history for the active workspace */
export async function getPaymentHistory(workspaceId) {
  const { data } = await ecomApi.get('/billing/history', { params: { workspaceId } });
  return data;
}

/** Activate 7-day free trial */
export async function activateTrial(workspaceId) {
  const { data } = await ecomApi.post('/billing/trial', { workspaceId });
  return data;
}

/**
 * Validate a promo code for a given plan/workspace.
 * Returns: { success, code, discountType, discountValue, originalAmount, discountAmount, finalAmount }
 */
export async function validatePromoCode({ code, plan, workspaceId }) {
  const { data } = await ecomApi.post('/billing/validate-promo', { code, plan, workspaceId });
  return data;
}

// ─── Super-admin promo codes CRUD ──────────────────────────────────────────────
export async function listPromoCodes(params = {}) {
  const { data } = await ecomApi.get('/promo-codes', { params });
  return data;
}

export async function getPromoCode(id) {
  const { data } = await ecomApi.get(`/promo-codes/${id}`);
  return data;
}

export async function createPromoCode(payload) {
  const { data } = await ecomApi.post('/promo-codes', payload);
  return data;
}

export async function updatePromoCode(id, payload) {
  const { data } = await ecomApi.patch(`/promo-codes/${id}`, payload);
  return data;
}

export async function deletePromoCode(id) {
  const { data } = await ecomApi.delete(`/promo-codes/${id}`);
  return data;
}
