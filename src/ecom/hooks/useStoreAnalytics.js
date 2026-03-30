import { useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://ecomcookpit-production.up.railway.app';

/**
 * Hook pour tracker les événements analytics du storefront
 */
export const useStoreAnalytics = (subdomain) => {
  const sessionId = useRef(null);
  const tracked = useRef(new Set());

  useEffect(() => {
    // Générer un ID de session unique
    if (!sessionId.current) {
      sessionId.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }, []);

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

    try {
      const event = {
        subdomain,
        eventType,
        sessionId: sessionId.current,
        visitor: getVisitorInfo(),
        page: {
          path: window.location.pathname,
          title: document.title,
          referrer: document.referrer,
        },
        ...data,
      };

      // Éviter de tracker deux fois le même événement rapidement
      const eventKey = `${eventType}_${data.productId || ''}_${Date.now()}`;
      if (tracked.current.has(eventKey)) return;
      tracked.current.add(eventKey);

      await axios.post(`${API_URL}/api/ecom/store-analytics/track`, event);
    } catch (error) {
      // Silencieux - ne pas bloquer l'UX si le tracking échoue
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
