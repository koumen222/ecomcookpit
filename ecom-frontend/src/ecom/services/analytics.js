import ecomApi from './ecommApi.js';

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

    // Use sendBeacon for page_view (works even on page unload), fallback to POST
    if (eventType === 'page_view' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const token = localStorage.getItem('ecomToken');
      // sendBeacon can't set headers, so use fetch with keepalive instead
      fetch('/api/ecom/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}`, 'X-Session-Id': sessionId } : { 'X-Session-Id': sessionId })
        },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    } else {
      // Regular POST via axios (adds auth headers automatically)
      ecomApi.post('/analytics/track', payload).catch(() => {});
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
export const analyticsApi = {
  getOverview: (range = '30d') => ecomApi.get('/analytics/overview', { params: { range } }),
  getFunnel: (range = '30d') => ecomApi.get('/analytics/funnel', { params: { range } }),
  getTraffic: (range = '30d') => ecomApi.get('/analytics/traffic', { params: { range } }),
  getCountries: (range = '30d') => ecomApi.get('/analytics/countries', { params: { range } }),
  getPages: (range = '30d') => ecomApi.get('/analytics/pages', { params: { range } }),
  getUsersActivity: (range = '30d', page = 1) => ecomApi.get('/analytics/users-activity', { params: { range, page } }),
  getUserFlow: (range = '30d') => ecomApi.get('/analytics/user-flow', { params: { range } })
};
