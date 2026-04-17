const PENDING_PLAN_STORAGE_KEY = 'mf_pending_selected_plan';
const POST_REGISTER_REDIRECT_KEY = 'mf_post_register_redirect';

export function savePendingPlanSelection(planId) {
  if (!planId || typeof window === 'undefined') return;
  sessionStorage.setItem(PENDING_PLAN_STORAGE_KEY, planId);
  sessionStorage.setItem(POST_REGISTER_REDIRECT_KEY, '/ecom/billing');
}

export function getPendingPlanSelection() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(PENDING_PLAN_STORAGE_KEY);
}

export function clearPendingPlanSelection() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(PENDING_PLAN_STORAGE_KEY);
  sessionStorage.removeItem(POST_REGISTER_REDIRECT_KEY);
}