class AnalyticsService {
  constructor() {
    this.endpoint = this.resolveEndpoint();
    this.enabled = Boolean(this.endpoint);
    this.sessionId = this.generateSessionId();
    this.userId = null;
    this.queue = [];
    this.isOnline = navigator.onLine;
    this.backendReady = false;
    this._readyCheck = null;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Don't fire analytics until backend is confirmed reachable
    this._checkBackendReady();
  }

  async _checkBackendReady() {
    const healthUrl = this.endpoint.replace(/\/analytics\/track$/, '/auth/health');
    for (let i = 0; i < 5; i++) {
      try {
        const res = await fetch(healthUrl, { method: 'GET', cache: 'no-store' });
        if (res.ok) { this.backendReady = true; this.flushQueue(); return; }
      } catch { /* backend not ready yet */ }
      await new Promise(r => setTimeout(r, 3000 * (i + 1)));
    }
    // After retries, enable anyway to not lose events forever
    this.backendReady = true;
    this.flushQueue();
  }

  resolveEndpoint() {
    const configured = String(import.meta.env.VITE_CUSTOM_ANALYTICS_ENDPOINT || '').trim();
    if (configured) return configured;

    // In dev, use the Vite proxy (same-origin) to avoid CORS / connection issues
    if (import.meta.env.DEV) {
      return '/api/ecom/analytics/track';
    }

    const configuredBackend = String(
      import.meta.env.VITE_BACKEND_URL ||
      import.meta.env.VITE_API_BASE_URL ||
      ''
    ).trim();
    if (configuredBackend) {
      const backendUrl = configuredBackend.replace(/\/api\/ecom\/?$/, '').replace(/\/$/, '');
      return `${backendUrl}/api/ecom/analytics/track`;
    }

    // In production on scalor.net, use the public API as the final fallback.
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('scalor.net')) {
      return 'https://api.scalor.net/api/ecom/analytics/track';
    }

    const backendUrl = 'https://api.scalor.net';
    return `${backendUrl}/api/ecom/analytics/track`;
  }

  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  setUserId(userId) {
    this.userId = userId;
  }

  async sendEvent(eventName, eventData = {}) {
    if (!this.enabled) return;

    let workspaceId = null;
    let userRole = null;
    try {
      const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
      const user = JSON.parse(localStorage.getItem('ecomUser') || 'null');
      workspaceId = workspace?._id || workspace?.id || null;
      userRole = user?.role || null;
      if (!this.userId) {
        this.userId = user?._id || user?.id || null;
      }
    } catch {
      // Ignore localStorage parsing errors for non-critical analytics.
    }

    const payload = {
      sessionId: this.sessionId,
      eventType: eventName,
      page: window.location.pathname,
      referrer: document.referrer || null,
      userId: this.userId,
      workspaceId,
      userRole,
      meta: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        ...eventData
      }
    };

    // Send to GA4 via GTM
    if (window.gtag) {
      window.gtag('event', eventName, {
        custom_parameter_1: JSON.stringify(eventData),
        event_category: eventData.category || 'general',
        event_label: eventData.label || '',
        value: eventData.value || 0
      });
    }

    // Queue until backend is confirmed reachable
    if (!this.isOnline || !this.backendReady) {
      this.queue.push(payload);
      return;
    }

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok && res.status >= 500) {
        this.queue.push(payload);
      }
    } catch {
      this.queue.push(payload);
    }
  }

  async flushQueue() {
    if (this.queue.length === 0 || !this.isOnline) return;

    const events = [...this.queue];
    this.queue = [];

    const results = await Promise.allSettled(
      events.map(payload =>
        fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        })
      )
    );

    const failedEvents = [];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failedEvents.push(events[index]);
        return;
      }

      if (!result.value.ok) {
        failedEvents.push(events[index]);
      }
    });

    if (failedEvents.length > 0) {
      this.queue.unshift(...failedEvents);
    }
  }

  // Page tracking
  trackPageView(pageName, additionalData = {}) {
    this.sendEvent('page_view', {
      page_name: pageName,
      category: 'navigation',
      ...additionalData
    });
  }

  // User actions
  trackUserLogin(userId, method = 'email') {
    this.setUserId(userId);
    this.sendEvent('login', {
      category: 'user',
      method,
      user_id: userId
    });
  }

  trackUserLogout() {
    this.sendEvent('logout', {
      category: 'user',
      user_id: this.userId
    });
    this.userId = null;
  }

  // E-commerce events
  trackOrderView(orderId, orderData = {}) {
    this.sendEvent('view_order', {
      category: 'ecommerce',
      order_id: orderId,
      ...orderData
    });
  }

  trackOrderCreate(orderData) {
    this.sendEvent('create_order', {
      category: 'ecommerce',
      order_id: orderData.id,
      value: orderData.total,
      currency: orderData.currency || 'EUR',
      ...orderData
    });
  }

  trackOrderUpdate(orderId, changes) {
    this.sendEvent('update_order', {
      category: 'ecommerce',
      order_id: orderId,
      changes,
      label: 'order_modification'
    });
  }

  trackOrderDelete(orderId, orderData = {}) {
    this.sendEvent('delete_order', {
      category: 'ecommerce',
      order_id: orderId,
      ...orderData
    });
  }

  // Product events
  trackProductView(productId, productData = {}) {
    this.sendEvent('view_product', {
      category: 'ecommerce',
      product_id: productId,
      ...productData
    });
  }

  trackProductCreate(productData) {
    this.sendEvent('create_product', {
      category: 'ecommerce',
      product_id: productData.id,
      product_name: productData.name,
      ...productData
    });
  }

  trackProductUpdate(productId, changes) {
    this.sendEvent('update_product', {
      category: 'ecommerce',
      product_id: productId,
      changes,
      label: 'product_modification'
    });
  }

  // Marketing events
  trackCampaignView(campaignId, campaignData = {}) {
    this.sendEvent('view_campaign', {
      category: 'marketing',
      campaign_id: campaignId,
      ...campaignData
    });
  }

  trackCampaignCreate(campaignData) {
    this.sendEvent('create_campaign', {
      category: 'marketing',
      campaign_id: campaignData.id,
      campaign_name: campaignData.name,
      ...campaignData
    });
  }

  // Admin actions
  trackAdminAction(action, data = {}) {
    this.sendEvent('admin_action', {
      category: 'admin',
      action,
      label: action,
      ...data
    });
  }

  // Form events
  trackFormSubmit(formName, success = true, data = {}) {
    this.sendEvent('form_submit', {
      category: 'form',
      form_name: formName,
      success,
      ...data
    });
  }

  // Button clicks
  trackButtonClick(buttonName, location, additionalData = {}) {
    this.sendEvent('button_click', {
      category: 'interaction',
      button_name: buttonName,
      location,
      ...additionalData
    });
  }

  // Error tracking
  trackError(error, context = {}) {
    this.sendEvent('error', {
      category: 'error',
      error_message: error.message || error,
      error_stack: error.stack,
      ...context
    });
  }

  // Search events
  trackSearch(query, results_count = 0, filters = {}) {
    this.sendEvent('search', {
      category: 'search',
      search_query: query,
      results_count,
      filters,
      label: 'site_search'
    });
  }
}

// Create global instance
const analytics = new AnalyticsService();

// Page view tracking is handled by React components (App.jsx PageViewTracker
// and main.jsx idle callbacks). No global MutationObserver needed — it caused
// duplicate events and premature requests before backend readiness.


export default analytics;
