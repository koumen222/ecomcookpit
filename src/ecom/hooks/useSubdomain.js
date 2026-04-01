/**
 * useSubdomain — Detect store subdomain from window.location.hostname.
 * 
 * Returns:
 * - subdomain: string | null (e.g., "koumen" from koumen.scalor.net)
 * - isStoreDomain: boolean (true if on a subdomain store)
 * - isCustomDomain: boolean (true if on a custom domain like maboutique.com)
 * 
 * Rules:
 * - scalor.net → null (root SaaS)
 * - www.scalor.net → null (root SaaS)
 * - koumen.scalor.net → "koumen"
 * - maboutique.com → custom domain (resolved via API)
 * - localhost → null (dev mode, use /store/:subdomain routes)
 */

import { useState, useEffect } from 'react';

const ROOT_DOMAINS = ['scalor.net', 'ecomcookpit.site', 'ecomcookpit.pages.dev'];
const IGNORED_SUBS = ['www', 'api'];
const CUSTOM_DOMAIN_CACHE_KEY = 'scalor_custom_domain_map';

let _cached = null;

/**
 * Check if hostname belongs to a known root/platform domain
 */
function isKnownPlatformHost(hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) return true;
  if (hostname.endsWith('.railway.app') || hostname.endsWith('.railway.internal')) return true;
  for (const root of ROOT_DOMAINS) {
    if (hostname === root || hostname === `www.${root}`) return true;
    if (hostname.endsWith(`.${root}`)) return true;
  }
  return false;
}

/**
 * Get cached custom domain → subdomain mapping from localStorage
 */
function getCachedCustomDomain(hostname) {
  try {
    const map = JSON.parse(localStorage.getItem(CUSTOM_DOMAIN_CACHE_KEY) || '{}');
    const entry = map[hostname];
    if (entry && Date.now() < entry.expires) return entry.subdomain;
    // Expired, clean up
    if (entry) {
      delete map[hostname];
      localStorage.setItem(CUSTOM_DOMAIN_CACHE_KEY, JSON.stringify(map));
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Cache custom domain → subdomain mapping in localStorage (TTL: 10 min)
 */
function setCachedCustomDomain(hostname, subdomain) {
  try {
    const map = JSON.parse(localStorage.getItem(CUSTOM_DOMAIN_CACHE_KEY) || '{}');
    map[hostname] = { subdomain, expires: Date.now() + 10 * 60 * 1000 };
    localStorage.setItem(CUSTOM_DOMAIN_CACHE_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

function detectSubdomain() {
  if (_cached !== null) return _cached;

  const hostname = window.location.hostname.toLowerCase();

  // Localhost / IP → no subdomain (use /store/:subdomain route in dev)
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
    _cached = { subdomain: null, isStoreDomain: false, isCustomDomain: false };
    return _cached;
  }

  // Railway internal domains → no subdomain
  if (hostname.endsWith('.railway.app') || hostname.endsWith('.railway.internal')) {
    _cached = { subdomain: null, isStoreDomain: false, isCustomDomain: false };
    return _cached;
  }

  // Check if it's a root domain (e.g., scalor.net, www.scalor.net)
  for (const root of ROOT_DOMAINS) {
    if (hostname === root || hostname === `www.${root}`) {
      _cached = { subdomain: null, isStoreDomain: false, isCustomDomain: false };
      return _cached;
    }
  }

  // Extract subdomain from known ROOT_DOMAINS: koumen.scalor.net → "koumen"
  for (const root of ROOT_DOMAINS) {
    if (hostname.endsWith(`.${root}`)) {
      const prefix = hostname.slice(0, -(root.length + 1)); // "koumen" or "www.koumen"
      const sub = prefix.startsWith('www.') ? prefix.slice(4) : prefix;

      if (IGNORED_SUBS.includes(sub)) {
        _cached = { subdomain: null, isStoreDomain: false, isCustomDomain: false };
        return _cached;
      }

      const isValid = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(sub);
      if (isValid) {
        _cached = { subdomain: sub, isStoreDomain: true, isCustomDomain: false };
        return _cached;
      }

      _cached = { subdomain: null, isStoreDomain: false, isCustomDomain: false };
      return _cached;
    }
  }

  // Not a known ROOT_DOMAIN → treat as custom domain (e.g., maboutique.com)
  // Check localStorage cache first for instant resolution
  const cachedSub = getCachedCustomDomain(hostname);
  if (cachedSub) {
    _cached = { subdomain: cachedSub, isStoreDomain: true, isCustomDomain: true };
    return _cached;
  }

  // Custom domain detected but not yet resolved — mark for async resolution
  _cached = { subdomain: null, isStoreDomain: true, isCustomDomain: true };
  return _cached;
}

/**
 * Reset cache (call after async domain resolution)
 */
export function resetSubdomainCache() {
  _cached = null;
}

/**
 * Resolve custom domain via API call
 */
export async function resolveCustomDomain(hostname) {
  const API_BASE = import.meta.env.VITE_STORE_API_URL
    || (import.meta.env.PROD ? 'https://api.scalor.net' : null)
    || import.meta.env.VITE_BACKEND_URL
    || 'https://api.scalor.net';

  const res = await fetch(`${API_BASE}/api/store/resolve-domain/${encodeURIComponent(hostname)}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.success && data.data?.subdomain) {
    setCachedCustomDomain(hostname, data.data.subdomain);
    return data.data.subdomain;
  }
  return null;
}

/**
 * Hook: returns { subdomain, isStoreDomain, isCustomDomain, loading }
 * For custom domains, triggers async resolution automatically.
 */
export function useSubdomain() {
  const initial = detectSubdomain();
  const [resolved, setResolved] = useState(initial);
  const [loading, setLoading] = useState(initial.isCustomDomain && !initial.subdomain);

  useEffect(() => {
    // Only resolve if custom domain detected but subdomain not yet resolved
    if (!initial.isCustomDomain || initial.subdomain) return;

    const hostname = window.location.hostname.toLowerCase();
    let cancelled = false;

    resolveCustomDomain(hostname).then((subdomain) => {
      if (cancelled) return;
      if (subdomain) {
        resetSubdomainCache();
        const result = { subdomain, isStoreDomain: true, isCustomDomain: true };
        _cached = result;
        setResolved(result);
      } else {
        // Domain not found — not a valid store
        resetSubdomainCache();
        const result = { subdomain: null, isStoreDomain: false, isCustomDomain: false };
        _cached = result;
        setResolved(result);
      }
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  return { ...resolved, loading };
}

// Export plain function for use outside React components (synchronous — uses cache)
export function getSubdomain() {
  return detectSubdomain();
}

export default useSubdomain;
