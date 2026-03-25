import ecomApi from './ecommApi.js';
import api from '../../lib/api.js';

function getSessionId() {
  let sid = sessionStorage.getItem('_a_sid');
  if (!sid) {
    sid = 'ses_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem('_a_sid', sid);
  }
  return sid;
}

export function trackEvent(eventType, extra = {}) {
  try {
    // CRITICAL: Disable custom analytics in dev to prevent infinite loops
    // PostHog handles all analytics in dev mode
    const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
    if (isDev) {
      // Silent skip in dev - PostHog handles tracking
      return;
    }

    const user = JSON.parse(localStorage.getItem('ecomUser') || 'null');
    const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
    const sessionId = getSessionId();

    const payload = {
      sessionId,
      eventType,
      page: window.location.pathname,
      referrer: document.referrer || null,
      userId: user?.id || user?._id || null,
      workspaceId: workspace?.id || workspace?._id || null,
      userRole: user?.role || null,
      ...extra
    };

    // Use keepalive fetch for page_view (works even on page unload)
    if (eventType === 'page_view' && navigator.sendBeacon) {
      // Note: api client can't use keepalive, so we use direct fetch here
      // but with UTF-8 headers for consistency
      const token = localStorage.getItem('ecomToken');
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://api.scalor.net';
      fetch(`${backendUrl}/api/ecom/analytics/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...(token ? { 'Authorization': `Bearer ${token}`, 'X-Session-Id': sessionId } : { 'X-Session-Id': sessionId })
        },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    } else {
      // Regular POST via client API (UTF-8 fix intégré)
      api.post('/analytics/track', payload).catch(() => {});
    }
  } catch (e) {
    // Silent fail - analytics should never break the app
  }
}

// Track page view (convenience)
export function trackPageView(path) {
  trackEvent('page_view', { page: path || window.location.pathname });
}

// Analytics API for Super Admin dashboard
// params: { range, startDate, endDate } — startDate/endDate (YYYY-MM-DD) override range
export const analyticsApi = {
  getOverview: (params = {}) => ecomApi.get('/analytics/overview', { params }),
  getFunnel: (params = {}) => ecomApi.get('/analytics/funnel', { params }),
  getTraffic: (params = {}) => ecomApi.get('/analytics/traffic', { params }),
  getCountries: (params = {}) => ecomApi.get('/analytics/countries', { params }),
  getPages: (params = {}) => ecomApi.get('/analytics/pages', { params }),
  getUsersActivity: (params = {}) => ecomApi.get('/analytics/users-activity', { params }),
  getUserFlow: (params = {}) => ecomApi.get('/analytics/user-flow', { params })
};
