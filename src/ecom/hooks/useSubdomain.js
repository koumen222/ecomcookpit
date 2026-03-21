/**
 * useSubdomain — Detect store subdomain from window.location.hostname.
 * 
 * Returns:
 * - subdomain: string | null (e.g., "koumen" from koumen.scalor.net)
 * - isStoreDomain: boolean (true if on a subdomain store)
 * 
 * Rules:
 * - scalor.net → null (root SaaS)
 * - www.scalor.net → null (root SaaS)
 * - koumen.scalor.net → "koumen"
 * - localhost → null (dev mode, use /store/:subdomain routes)
 */

const ROOT_DOMAINS = ['scalor.net', 'ecomcookpit.site', 'ecomcookpit.pages.dev'];
const IGNORED_SUBS = ['www', 'api'];

let _cached = null;

function detectSubdomain() {
  if (_cached !== null) return _cached;

  const hostname = window.location.hostname.toLowerCase();

  // Localhost / IP → no subdomain (use /store/:subdomain route in dev)
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
    _cached = { subdomain: null, isStoreDomain: false };
    return _cached;
  }

  // Railway internal domains → no subdomain
  if (hostname.endsWith('.railway.app') || hostname.endsWith('.railway.internal')) {
    _cached = { subdomain: null, isStoreDomain: false };
    return _cached;
  }

  // Check if it's a root domain (e.g., scalor.net, www.scalor.net)
  for (const root of ROOT_DOMAINS) {
    if (hostname === root || hostname === `www.${root}`) {
      _cached = { subdomain: null, isStoreDomain: false };
      return _cached;
    }
  }

  // Extract subdomain: koumen.scalor.net → parts = ['koumen', 'scalor', 'net']
  const parts = hostname.split('.');

  if (parts.length >= 3) {
    const sub = parts[0] === 'www' ? parts[1] : parts[0];

    // Ignore system subdomains
    if (IGNORED_SUBS.includes(sub)) {
      _cached = { subdomain: null, isStoreDomain: false };
      return _cached;
    }

    // Validate format (alphanumeric + hyphens, 1-63 chars)
    const isValid = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(sub);
    if (isValid) {
      _cached = { subdomain: sub, isStoreDomain: true };
      return _cached;
    }
  }

  _cached = { subdomain: null, isStoreDomain: false };
  return _cached;
}

/**
 * Hook: returns { subdomain, isStoreDomain }
 * Also works as a plain function (no state needed — hostname doesn't change)
 */
export function useSubdomain() {
  return detectSubdomain();
}

// Export plain function for use outside React components (e.g., in API layer)
export function getSubdomain() {
  return detectSubdomain();
}

export default useSubdomain;
