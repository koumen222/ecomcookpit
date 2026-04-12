/**
 * Pixel Tracking Utility
 * Injects Meta (Facebook), TikTok, Google Tag, and Snapchat pixel scripts
 * and provides unified event firing for e-commerce events.
 */

import { publicStoreApi } from '../services/storeApi.js';

let _injected = false;
let _pixels = null;

function readCookie(name) {
  if (typeof document === 'undefined') return '';
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
}

function buildMetaCustomData(params = {}) {
  const {
    value,
    currency,
    content_ids,
    content_name,
    content_type,
    num_items,
    contents,
    order_id,
  } = params;

  return Object.fromEntries(
    Object.entries({
      value,
      currency,
      content_ids,
      content_name,
      content_type: content_type || 'product',
      num_items,
      contents,
      order_id,
    }).filter(([, entry]) => {
      if (entry == null) return false;
      if (Array.isArray(entry)) return entry.length > 0;
      return true;
    }),
  );
}

export function createMetaEventId(prefix = 'meta') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getMetaBrowserData() {
  return {
    fbp: readCookie('_fbp'),
    fbc: readCookie('_fbc'),
  };
}

/**
 * Inject pixel scripts into the page <head>.
 * Safe to call multiple times — only injects once per session.
 */
export function injectPixelScripts(pixels) {
  if (!pixels || _injected) return;

  const { metaPixelId, tiktokPixelId, googleTagId, snapchatPixelId } = pixels;
  _pixels = pixels;

  // ─── Meta Pixel ──────────────────────────────────────────────────────────────
  if (metaPixelId && typeof window !== 'undefined') {
    if (!window.fbq) {
      (function(f, b, e, v, n, t, s) {
        if (f.fbq) return;
        n = f.fbq = function() {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = true;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', metaPixelId);
    }
  }

  // ─── TikTok Pixel ──────────────────────────────────────────────────────────
  if (tiktokPixelId && typeof window !== 'undefined') {
    if (!window.ttq) {
      (function(w, d, t) {
        w.TiktokAnalyticsObject = t;
        var ttq = w[t] = w[t] || [];
        ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
        ttq.setAndDefer = function(t, e) {
          t[e] = function() {
            t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
          };
        };
        for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
        ttq.instance = function(t) {
          for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
          return e;
        };
        ttq.load = function(e, n) {
          var i = 'https://analytics.tiktok.com/i18n/pixel/events.js';
          ttq._i = ttq._i || {};
          ttq._i[e] = [];
          ttq._i[e]._u = i;
          ttq._t = ttq._t || {};
          ttq._t[e] = +new Date();
          ttq._o = ttq._o || {};
          ttq._o[e] = n || {};
          var s = document.createElement('script');
          s.type = 'text/javascript';
          s.async = true;
          s.src = i + '?sdkid=' + e + '&lib=' + t;
          var a = document.getElementsByTagName('script')[0];
          a.parentNode.insertBefore(s, a);
        };
        ttq.load(tiktokPixelId);
        ttq.page();
      })(window, document, 'ttq');
    }
  }

  // ─── Google Tag (GA4 + Google Ads) ───────────────────────────────────────
  if (googleTagId && typeof window !== 'undefined') {
    if (!window.gtag) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${googleTagId}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function() { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', googleTagId);

      // Google Ads conversion tracking if configured
      const { googleAdsId } = pixels;
      if (googleAdsId) {
        window.gtag('config', googleAdsId);
      }
    }
  }

  // ─── Snapchat Pixel ──────────────────────────────────────────────────────
  if (snapchatPixelId && typeof window !== 'undefined') {
    if (!window.snaptr) {
      (function(e, t, n) {
        if (e.snaptr) return;
        var a = e.snaptr = function() {
          a.handleRequest ? a.handleRequest.apply(a, arguments) : a.queue.push(arguments);
        };
        a.queue = [];
        var s = 'script';
        var r = t.createElement(s);
        r.async = true;
        r.src = n;
        var u = t.getElementsByTagName(s)[0];
        u.parentNode.insertBefore(r, u);
      })(window, document, 'https://sc-static.net/scevent.min.js');
      window.snaptr('init', snapchatPixelId);
      window.snaptr('track', 'PAGE_VIEW');
    }
  }

  _injected = true;
}

/**
 * Fire a pixel event across all configured platforms.
 * @param {string} eventName - Standard event name (ViewContent, AddToCart, Purchase, etc.)
 * @param {Object} params - Event parameters { value, currency, content_ids, content_name, ... }
 */
export function firePixelEvent(eventName, params = {}) {
  if (typeof window === 'undefined') return;

  const {
    value,
    currency = 'XAF',
    content_ids = [],
    content_name = '',
    num_items = 1,
    eventId,
    eventID,
  } = params;
  const resolvedEventId = eventId || eventID;

  // ─── Meta Pixel ──────────────────────────────────────────────────────────
  if (window.fbq) {
    const fbParams = {
      content_ids,
      content_name,
      content_type: 'product',
      currency,
    };
    if (value != null) fbParams.value = value;
    if (num_items) fbParams.num_items = num_items;
    if (resolvedEventId) {
      window.fbq('track', eventName, fbParams, { eventID: resolvedEventId });
    } else {
      window.fbq('track', eventName, fbParams);
    }
  }

  // ─── TikTok Pixel ──────────────────────────────────────────────────────
  if (window.ttq) {
    const ttqEventMap = {
      ViewContent: 'ViewContent',
      AddToCart: 'AddToCart',
      Purchase: 'CompletePayment',
      InitiateCheckout: 'InitiateCheckout',
      Lead: 'Contact',
      Search: 'Search',
    };
    const ttqEvent = ttqEventMap[eventName] || eventName;
    const ttqParams = { content_id: content_ids[0] || '', content_name, currency };
    if (value != null) ttqParams.value = value;
    window.ttq.track(ttqEvent, ttqParams);
  }

  // ─── Google Tag ──────────────────────────────────────────────────────────
  if (window.gtag) {
    const gaEventMap = {
      ViewContent: 'view_item',
      AddToCart: 'add_to_cart',
      Purchase: 'purchase',
      InitiateCheckout: 'begin_checkout',
      Lead: 'generate_lead',
      Search: 'search',
      PageView: 'page_view',
    };
    const gaEvent = gaEventMap[eventName];
    if (gaEvent) {
      const gaParams = { currency };
      if (value != null) gaParams.value = value;
      if (content_ids.length) gaParams.items = content_ids.map(id => ({ item_id: id, item_name: content_name }));
      window.gtag('event', gaEvent, gaParams);
    }
  }

  // ─── Snapchat Pixel ──────────────────────────────────────────────────────
  if (window.snaptr) {
    const snapEventMap = {
      ViewContent: 'VIEW_CONTENT',
      AddToCart: 'ADD_CART',
      Purchase: 'PURCHASE',
      InitiateCheckout: 'START_CHECKOUT',
      Lead: 'SIGN_UP',
      Search: 'SEARCH',
    };
    const snapEvent = snapEventMap[eventName];
    if (snapEvent) {
      const snapParams = { currency };
      if (value != null) snapParams.price = value;
      if (content_ids.length) snapParams.item_ids = content_ids;
      window.snaptr('track', snapEvent, snapParams);
    }
  }
}

export async function trackStorefrontEvent({
  subdomain,
  pixels,
  eventName,
  params = {},
  userData = {},
  eventId,
  sendServer = true,
  eventSourceUrl,
}) {
  const resolvedEventId = eventId || createMetaEventId(eventName.toLowerCase());

  if (pixels) {
    injectPixelScripts(pixels);
  }

  firePixelEvent(eventName, {
    ...params,
    eventId: resolvedEventId,
  });

  if (sendServer && subdomain && pixels?.metaPixelId) {
    try {
      await publicStoreApi.trackEvent(subdomain, {
        eventName,
        eventId: resolvedEventId,
        eventSourceUrl: eventSourceUrl || (typeof window !== 'undefined' ? window.location.href : ''),
        customData: buildMetaCustomData(params),
        userData: {
          ...getMetaBrowserData(),
          ...userData,
        },
      });
    } catch (error) {
      console.warn('[Pixels] Meta tracking bridge failed:', error?.message || error);
    }
  }

  return resolvedEventId;
}
