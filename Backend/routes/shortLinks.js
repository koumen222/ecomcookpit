// ============================================================
// Redirection publique des liens courts — monté sur /s
//   GET /s/:slug  ->  302 vers l'URL cible + log du clic (async)
//
// À ajouter dans le tableau `routes` de server.js :
//   ['./routes/shortLinks.js', '/s'],
// ============================================================
import express from 'express';
import ShortLink from '../models/ShortLink.js';
import ShortLinkClick from '../models/ShortLinkClick.js';
import {
  isBotUA, detectDevice, detectSource, hashIp, clientIp, buildDestination,
} from '../utils/shortLinkUtils.js';

const router = express.Router();

const FALLBACK_URL = process.env.SHORTLINK_FALLBACK_URL || 'https://scalor.net';
const IP_SALT = process.env.SHORTLINK_IP_SALT || 'scalor-links';

// geoip-lite est déjà dans les dépendances du backend ; chargement paresseux
// pour ne jamais bloquer le démarrage si absent.
let geoip = null;
let geoipTried = false;
async function lookupCountry(ip) {
  if (!geoipTried) {
    geoipTried = true;
    try { geoip = (await import('geoip-lite')).default; }
    catch { console.warn('⚠️ shortLinks: geoip-lite indisponible, pays = ??'); }
  }
  if (!geoip || !ip) return { country: '??', city: '' };
  try {
    const g = geoip.lookup(ip);
    return { country: g?.country || '??', city: g?.city || '' };
  } catch {
    return { country: '??', city: '' };
  }
}

async function logHit(link, req, { isBot }) {
  try {
    const ua = String(req.headers['user-agent'] || '');
    const referer = String(req.headers['referer'] || req.headers['referrer'] || '').slice(0, 500);
    const ip = clientIp(req);
    const { country, city } = await lookupCountry(ip);
    await ShortLinkClick.create({
      linkId: link._id,
      slug: link.slug,
      workspaceId: link.workspaceId,
      country,
      city,
      device: detectDevice(ua),
      source: detectSource({ utmSource: req.query?.utm_source, ua, referer }),
      referer,
      isBot,
      ipHash: hashIp(ip, IP_SALT),
    });
    const inc = isBot ? { previews: 1 } : { clicks: 1 };
    await ShortLink.updateOne(
      { _id: link._id },
      { $inc: inc, ...(isBot ? {} : { $set: { lastClickAt: new Date() } }) }
    );
  } catch (err) {
    console.error('shortLinks: échec log clic:', err.message);
  }
}

// GET /s/:slug — redirection
router.get('/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug || slug.length > 60) return res.redirect(302, FALLBACK_URL);

    const link = await ShortLink.findOne({ slug }).lean();
    if (!link || !link.active) return res.redirect(302, FALLBACK_URL);

    const isBot = isBotUA(req.headers['user-agent']);
    // Fire-and-forget : la redirection ne doit jamais attendre le log
    logHit(link, req, { isBot }).catch(() => {});

    const destination = buildDestination(link.targetUrl, req.query);
    res.set('Cache-Control', 'no-store');
    // 302 (pas 301) : permet de changer la cible plus tard sans cache navigateur
    return res.redirect(302, destination);
  } catch (err) {
    console.error('shortLinks: erreur redirection:', err.message);
    return res.redirect(302, FALLBACK_URL);
  }
});

export default router;
