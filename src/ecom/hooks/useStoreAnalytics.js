import { useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://ecomcookpit-production.up.railway.app';

const VISITOR_ID_KEY = 'store_visitor_id';
const THROTTLE_MS = 30 * 60 * 1000; // 30 minutes

function generateVisitorId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getOrCreateVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = generateVisitorId();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return generateVisitorId();
  }
}

function getThrottleKey(eventType, productId, path) {
  return `analytics_throttle_${eventType}_${productId || ''}_${path || ''}`;
}

function isThrottled(eventType, productId, path) {
  try {
    const key = getThrottleKey(eventType, productId, path);
    const last = localStorage.getItem(key);
    if (!last) return false;
    return Date.now() - parseInt(last, 10) < THROTTLE_MS;
  } catch {
    return false;
  }
}

function setThrottleStamp(eventType, productId, path) {
  try {
    const key = getThrottleKey(eventType, productId, path);
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * Hook pour tracker les événements analytics du storefront.
 * Utilise un visitorId persistant (localStorage UUID) et un throttle
 * côté client de 30 min pour les page_view / product_view.
 */
export const useStoreAnalytics = (subdomain) => {
  const sessionId = useRef(
    `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  const getVisitorInfo = () => {
    const ua = navigator.userAgent.toLowerCase();
    let device = 'desktop';
    if (/mobile|android|iphone|ipad|ipod/.test(ua)) {
      device = /ipad|tablet/.test(ua) ? 'tablet' : 'mobile';
    }

    let browser = 'other';
    if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('safari')) browser = 'Safari';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('edge')) browser = 'Edge';

    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      device,
      browser,
    };
  };

  const track = async (eventType, data = {}) => {
    if (!subdomain) return;

    const path = window.location.pathname;
    const productId = data.productId || '';

    // Throttle côté client pour page_view et product_view
    if (['page_view', 'product_view'].includes(eventType)) {
      if (isThrottled(eventType, productId, path)) return;
      setThrottleStamp(eventType, productId, path);
    }

    try {
      const event = {
        subdomain,
        eventType,
        visitorId: getOrCreateVisitorId(),
        sessionId: sessionId.current,
        visitor: getVisitorInfo(),
        page: {
          path,
          title: document.title,
          referrer: document.referrer,
        },
        ...data,
      };

      await axios.post(`${API_URL}/api/ecom/store-analytics/track`, event);
    } catch (error) {
      console.warn('Analytics tracking failed:', error.message);
    }
  };

  return {
    trackPageView: () => track('page_view'),
    trackProductView: (productId, productName, productPrice) =>
      track('product_view', { productId, productName, productPrice }),
    trackAddToCart: (productId, productName, productPrice) =>
      track('add_to_cart', { productId, productName, productPrice }),
    trackCheckoutStarted: () => track('checkout_started'),
    trackOrderPlaced: (orderId, orderValue) =>
      track('order_placed', { orderId, orderValue }),
  };
};

export default useStoreAnalytics;
