// ─── Attribution affiliée (last-click, fenêtre 60 jours) ─────────────────────
// Capture les params ?aff=CODE&aff_link=LNK&aff_click=ID posés par la
// redirection /r/:code, les stocke 60j (last-click : une nouvelle capture
// écrase la précédente), et envoie un beacon de visite au backend pour le
// tracking visites/sessions du programme d'affiliation Scalor.

const STORAGE_KEY = 'skaylo_aff_attribution';
const VISITOR_KEY = 'skaylo_aff_visitor';
const SESSION_KEY = 'skaylo_aff_session';
const TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 jours — aligné sur attributionWindowDays serveur

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function randomId() {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g, '');
  } catch { /* noop */ }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

// Identifiant visiteur persistant (mesure des visiteurs uniques)
export function getAffiliateVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

// Identifiant de session (nouvelle valeur par onglet/session de navigation)
export function getAffiliateSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = randomId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

export function captureAffiliateAttributionFromSearch(search = '') {
  const params = new URLSearchParams(search || '');
  const affiliateCode = String(params.get('aff') || '').trim().toUpperCase();
  const affiliateLinkCode = String(params.get('aff_link') || '').trim().toUpperCase();
  const clickId = String(params.get('aff_click') || '').trim();
  const subId = String(params.get('aff_sub') || '').trim();

  if (!affiliateCode && !affiliateLinkCode) return null;

  const payload = {
    affiliateCode,
    affiliateLinkCode,
    clickId,
    subId,
    capturedAt: Date.now(),
    expiresAt: Date.now() + TTL_MS
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch { /* stockage indisponible */ }
  return payload;
}

export function getAffiliateAttribution() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  const parsed = safeParse(raw);
  if (!parsed || !parsed.expiresAt || parsed.expiresAt < Date.now()) {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    return null;
  }

  return {
    affiliateCode: String(parsed.affiliateCode || '').trim().toUpperCase(),
    affiliateLinkCode: String(parsed.affiliateLinkCode || '').trim().toUpperCase(),
    clickId: String(parsed.clickId || '').trim(),
    subId: String(parsed.subId || '').trim(),
    capturedAt: parsed.capturedAt,
    expiresAt: parsed.expiresAt
  };
}

export function clearAffiliateAttribution() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

// ─── Beacon de visite ────────────────────────────────────────────────────────
// Envoie une visite référée au backend (dédoublonnée côté serveur : même
// visiteur + même page dans les 30 min = 1 seule visite). Fire-and-forget.

function resolveApiBase() {
  try {
    const env = import.meta.env || {};
    if (env.DEV) return '';
    const candidate = env.VITE_STORE_API_URL || env.VITE_BACKEND_URL || env.VITE_API_BASE_URL;
    if (candidate) return String(candidate).replace(/\/+$/, '');
  } catch { /* noop */ }
  return 'https://api.scalor.net';
}

const sentThisPage = new Set();

export function trackAffiliateVisit(pathnameHint = '') {
  const attribution = getAffiliateAttribution();
  if (!attribution?.affiliateCode) return;

  const url = typeof window !== 'undefined' ? window.location.href : '';
  const path = pathnameHint || (typeof window !== 'undefined' ? window.location.pathname : '');

  // Anti-spam local : une seule tentative par page et par session d'app
  const key = `${attribution.affiliateCode}:${path}`;
  if (sentThisPage.has(key)) return;
  sentThisPage.add(key);

  const body = JSON.stringify({
    affiliateCode: attribution.affiliateCode,
    affiliateLinkCode: attribution.affiliateLinkCode,
    clickId: attribution.clickId,
    visitorId: getAffiliateVisitorId(),
    sessionId: getAffiliateSessionId(),
    url,
    referrer: typeof document !== 'undefined' ? document.referrer : ''
  });

  const endpoint = `${resolveApiBase()}/api/affiliate/track/visit`;

  try {
    // fetch keepalive : part même si l'utilisateur quitte la page
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {});
  } catch { /* beacon best-effort */ }
}
