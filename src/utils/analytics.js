class AnalyticsService {
  constructor() {
    this.endpoint = this.resolveEndpoint();
    this.enabled = Boolean(this.endpoint);
    this.sessionId = this.generateSessionId();
    this.userId = null;
    this.queue = [];
    this.isOnline = navigator.onLine;

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  resolveEndpoint() {
    const configured = String(import.meta.env.VITE_CUSTOM_ANALYTICS_ENDPOINT || '').trim();
    if (configured) return configured;

    // Default to same-origin backend route to avoid cross-origin/CORS issues.
    return '/api/ecom/analytics/track';
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

    // Send to custom endpoint
    if (this.isOnline) {
      try {
        await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        console.warn('Analytics: Failed to send event', error);
        this.queue.push(payload);
      }
    } else {
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

// Auto-track page views on navigation
let currentPath = window.location.pathname;
const observer = new MutationObserver(() => {
  if (window.location.pathname !== currentPath) {
    currentPath = window.location.pathname;
    analytics.trackPageView(currentPath);
  }
});

observer.observe(document, { subtree: true, childList: true });

// Track page load
window.addEventListener('load', () => {
  analytics.trackPageView(window.location.pathname, {
    initial_load: true
  });
});

// Track errors
window.addEventListener('error', (event) => {
  analytics.trackError(event.error, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  analytics.trackError(event.reason, {
    type: 'unhandled_promise_rejection'
  });
});

export default analytics;