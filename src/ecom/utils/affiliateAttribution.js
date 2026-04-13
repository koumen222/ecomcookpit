const STORAGE_KEY = 'skaylo_aff_attribution';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function captureAffiliateAttributionFromSearch(search = '') {
  const params = new URLSearchParams(search || '');
  const affiliateCode = String(params.get('aff') || '').trim().toUpperCase();
  const affiliateLinkCode = String(params.get('aff_link') || '').trim().toUpperCase();

  if (!affiliateCode && !affiliateLinkCode) return null;

  const payload = {
    affiliateCode,
    affiliateLinkCode,
    capturedAt: Date.now(),
    expiresAt: Date.now() + TTL_MS
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function getAffiliateAttribution() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  const parsed = safeParse(raw);
  if (!parsed || !parsed.expiresAt || parsed.expiresAt < Date.now()) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  return {
    affiliateCode: String(parsed.affiliateCode || '').trim().toUpperCase(),
    affiliateLinkCode: String(parsed.affiliateLinkCode || '').trim().toUpperCase(),
    capturedAt: parsed.capturedAt,
    expiresAt: parsed.expiresAt
  };
}

export function clearAffiliateAttribution() {
  localStorage.removeItem(STORAGE_KEY);
}
