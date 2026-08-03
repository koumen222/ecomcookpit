// Fonctions pures du système de liens courts (testées par test/selftest.js)
import { randomBytes, createHash } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // sans 0/O/1/l/I
// Configurable : SHORTLINK_SLUG_LENGTH (4 = très court, 11M de combinaisons ; défaut 6)
export const SLUG_LENGTH = Math.min(Math.max(parseInt(process.env.SHORTLINK_SLUG_LENGTH || '6', 10) || 6, 3), 12);

export function generateSlug(length = SLUG_LENGTH) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export const RESERVED_SLUGS = new Set([
  'api', 's', 'admin', 'ui', 'app', 'www', 'login', 'logout', 'signup',
  'uploads', 'health', 'static', 'assets', 'stats', 'config', 'webhook',
  'webhooks', 'unsubscribe', 'favicon.ico', 'robots.txt',
]);

export function isValidCustomSlug(slug) {
  return typeof slug === 'string'
    && /^[a-zA-Z0-9_-]{2,40}$/.test(slug)
    && !RESERVED_SLUGS.has(slug.toLowerCase());
}

// Valide et normalise l'URL cible. Retourne null si invalide.
// shortBase = base complète des liens courts (ex. https://scalor.net/s ou https://scl.to)
export function normalizeTargetUrl(raw, shortBase = 'https://scalor.net/s') {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s; // tolère "maboutique.scalor.net/produit/x"
  let url;
  try { url = new URL(s); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (!url.hostname.includes('.')) return null;
  // Anti-boucle : interdit de raccourcir un lien court.
  // Base avec chemin (scalor.net/s) → bloque ce chemin ; domaine dédié → bloque tout le domaine.
  try {
    const base = new URL(shortBase);
    const baseHost = base.hostname.replace(/^www\./, '');
    const basePath = base.pathname.replace(/\/$/, '');
    if (url.hostname.replace(/^www\./, '') === baseHost && url.pathname.startsWith(basePath + '/')) return null;
  } catch { /* base invalide -> pas de blocage */ }
  if (url.href.length > 2000) return null;
  return url.href;
}

// Bots de preview / crawlers — comptés comme "previews", pas comme clics.
const BOT_RE = /facebookexternalhit|facebookcatalog|whatsapp\/|telegrambot|twitterbot|linkedinbot|slackbot|discordbot|pinterest|skypeuripreview|googlebot|bingbot|yandex|duckduckbot|baiduspider|applebot|petalbot|semrush|ahrefs|mj12bot|dotbot|crawler|spider|curl\/|wget\/|python-requests|axios\/|headlesschrome/i;

export function isBotUA(ua = '') {
  return BOT_RE.test(String(ua));
}

export function detectDevice(ua = '') {
  const s = String(ua).toLowerCase();
  if (/ipad|iphone|ipod/.test(s)) return 'ios';
  if (s.includes('android')) return 'android';
  return 'desktop';
}

const REFERER_SOURCES = [
  [/facebook\.|fb\.com|fb\.me/i, 'facebook'],
  [/instagram\./i, 'instagram'],
  [/tiktok\./i, 'tiktok'],
  [/whatsapp\.|wa\.me/i, 'whatsapp'],
  [/t\.me|telegram\./i, 'telegram'],
  [/twitter\.|t\.co|x\.com/i, 'x'],
  [/youtube\.|youtu\.be/i, 'youtube'],
  [/snapchat\./i, 'snapchat'],
  [/google\./i, 'google'],
];

// Priorité : ?utm_source= sur le lien court > navigateur in-app (UA) > referer > direct
export function detectSource({ utmSource = '', ua = '', referer = '' } = {}) {
  if (utmSource) return String(utmSource).toLowerCase().slice(0, 40);
  const s = String(ua);
  if (/FBAN|FBAV|FB_IAB/i.test(s)) return 'facebook';
  if (/Instagram/i.test(s)) return 'instagram';
  if (/TikTok|Bytedance|musical_ly/i.test(s)) return 'tiktok';
  if (/Snapchat/i.test(s)) return 'snapchat';
  if (referer) {
    for (const [re, name] of REFERER_SOURCES) if (re.test(referer)) return name;
    try { return new URL(referer).hostname.replace(/^www\./, '').slice(0, 40); } catch { /* ignore */ }
  }
  return 'direct';
}

export function hashIp(ip = '', salt = '') {
  if (!ip) return '';
  return createHash('sha256').update(salt + '|' + ip).digest('hex').slice(0, 16);
}

export function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || String(req.headers['x-real-ip'] || '') || req.ip || '';
}

// Fusionne les query params du lien court dans l'URL cible
// (préserve fbclid/utm_* jusqu'à la destination ; la cible garde priorité).
export function buildDestination(targetUrl, incomingQuery = {}) {
  try {
    const url = new URL(targetUrl);
    for (const [k, v] of Object.entries(incomingQuery)) {
      if (typeof v === 'string' && v.length <= 500 && !url.searchParams.has(k)) {
        url.searchParams.set(k, v);
      }
    }
    return url.href;
  } catch {
    return targetUrl;
  }
}
