// ============================================================
// Gestion des liens courts + stats — monté sur /api/ecom/links
// Auth : requireEcomAuth (Bearer), scopé par workspace comme le reste.
//
// À ajouter dans le tableau `routes` de server.js :
//   ['./routes/shortLinksAdmin.js', '/api/ecom/links'],
//
// Interface web : GET /api/ecom/links/ui  (page autonome, jeton Bearer à coller)
// ============================================================
import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ShortLink from '../models/ShortLink.js';
import ShortLinkClick from '../models/ShortLinkClick.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import {
  generateSlug, isValidCustomSlug, normalizeTargetUrl, RESERVED_SLUGS,
} from '../utils/shortLinkUtils.js';

const router = express.Router();

const BASE_URL = (process.env.SHORTLINK_BASE_URL || 'https://scalor.net/s').replace(/\/$/, '');

// ─── Interface admin (page autonome) ─────────────────────────────────────────
router.get('/ui', (_req, res) => {
  try {
    const html = readFileSync(fileURLToPath(new URL('./shortLinksAdmin.ui.html', import.meta.url)), 'utf8');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).json({ success: false, message: 'UI introuvable: ' + err.message });
  }
});

// ─── Config (pour l'UI) ──────────────────────────────────────────────────────
router.get('/config', requireEcomAuth, (_req, res) => {
  res.json({ success: true, data: { baseUrl: BASE_URL } });
});

// ─── Créer un lien ───────────────────────────────────────────────────────────
// POST /api/ecom/links  { url, slug?, title? }
router.post('/', requireEcomAuth, async (req, res) => {
  try {
    const targetUrl = normalizeTargetUrl(req.body?.url, BASE_URL);
    if (!targetUrl) {
      return res.status(400).json({ success: false, message: 'URL invalide (http/https attendu)' });
    }

    let slug = String(req.body?.slug || '').trim();
    if (slug) {
      if (!isValidCustomSlug(slug)) {
        return res.status(400).json({
          success: false,
          message: 'Slug invalide : 2-40 caractères (lettres, chiffres, - _), hors mots réservés (' + [...RESERVED_SLUGS].slice(0, 6).join(', ') + '…)',
        });
      }
      const exists = await ShortLink.findOne({ slug }).lean();
      if (exists) return res.status(409).json({ success: false, message: `Le slug "${slug}" est déjà pris` });
    } else {
      // Slug aléatoire avec re-tentative en cas de collision (rarissime)
      for (let i = 0; i < 5; i++) {
        slug = generateSlug();
        // eslint-disable-next-line no-await-in-loop
        if (!(await ShortLink.findOne({ slug }).lean())) break;
        slug = '';
      }
      if (!slug) return res.status(500).json({ success: false, message: 'Impossible de générer un slug unique' });
    }

    const link = await ShortLink.create({
      slug,
      targetUrl,
      title: String(req.body?.title || '').slice(0, 200),
      workspaceId: req.workspaceId,
      createdBy: req.ecomUser?._id,
    });

    res.status(201).json({ success: true, data: { ...link.toObject(), shortUrl: `${BASE_URL}/${slug}` } });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ success: false, message: 'Slug déjà pris' });
    console.error('shortLinksAdmin POST /:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── Lister ──────────────────────────────────────────────────────────────────
// GET /api/ecom/links?search=&page=1&limit=50
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const filter = { workspaceId: req.workspaceId };
    if (search) {
      filter.$or = [
        { slug: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { targetUrl: { $regex: search, $options: 'i' } },
      ];
    }
    const [links, total] = await Promise.all([
      ShortLink.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).skip((Number(page) - 1) * Number(limit)).lean(),
      ShortLink.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: {
        links: links.map(l => ({ ...l, shortUrl: `${BASE_URL}/${l.slug}` })),
        total,
        page: Number(page),
      },
    });
  } catch (err) {
    console.error('shortLinksAdmin GET /:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── Stats d'un lien ─────────────────────────────────────────────────────────
// GET /api/ecom/links/:slug/stats?days=30
router.get('/:slug/stats', requireEcomAuth, async (req, res) => {
  try {
    const link = await ShortLink.findOne({ slug: req.params.slug, workspaceId: req.workspaceId }).lean();
    if (!link) return res.status(404).json({ success: false, message: 'Lien introuvable' });

    const days = Math.min(Math.max(parseInt(req.query.days || '30', 10) || 30, 1), 365);
    const since = new Date(Date.now() - days * 86_400_000);
    const matchClicks = { linkId: link._id, isBot: false, createdAt: { $gte: since } };

    const [agg] = await ShortLinkClick.aggregate([
      { $match: matchClicks },
      {
        $facet: {
          total: [{ $count: 'n' }],
          uniques: [{ $group: { _id: '$ipHash' } }, { $count: 'n' }],
          byDay: [
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          byCountry: [
            { $group: { _id: '$country', n: { $sum: 1 } } },
            { $sort: { n: -1 } }, { $limit: 12 },
          ],
          byDevice: [{ $group: { _id: '$device', n: { $sum: 1 } } }, { $sort: { n: -1 } }],
          bySource: [
            { $group: { _id: '$source', n: { $sum: 1 } } },
            { $sort: { n: -1 } }, { $limit: 12 },
          ],
        },
      },
    ]);

    const previews = await ShortLinkClick.countDocuments({ linkId: link._id, isBot: true, createdAt: { $gte: since } });

    res.json({
      success: true,
      data: {
        link: { ...link, shortUrl: `${BASE_URL}/${link.slug}` },
        days,
        total: agg?.total?.[0]?.n || 0,
        uniques: agg?.uniques?.[0]?.n || 0,
        previews,
        byDay: (agg?.byDay || []).map(d => ({ date: d._id, clicks: d.n })),
        byCountry: (agg?.byCountry || []).map(d => ({ country: d._id, clicks: d.n })),
        byDevice: (agg?.byDevice || []).map(d => ({ device: d._id, clicks: d.n })),
        bySource: (agg?.bySource || []).map(d => ({ source: d._id, clicks: d.n })),
        allTime: { clicks: link.clicks || 0, previews: link.previews || 0, lastClickAt: link.lastClickAt || null },
      },
    });
  } catch (err) {
    console.error('shortLinksAdmin GET /:slug/stats:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── Modifier ────────────────────────────────────────────────────────────────
// PATCH /api/ecom/links/:slug  { url?, title?, active? }
router.patch('/:slug', requireEcomAuth, async (req, res) => {
  try {
    const update = {};
    if (req.body?.url !== undefined) {
      const targetUrl = normalizeTargetUrl(req.body.url, BASE_URL);
      if (!targetUrl) return res.status(400).json({ success: false, message: 'URL invalide' });
      update.targetUrl = targetUrl;
    }
    if (req.body?.title !== undefined) update.title = String(req.body.title).slice(0, 200);
    if (req.body?.active !== undefined) update.active = Boolean(req.body.active);

    const link = await ShortLink.findOneAndUpdate(
      { slug: req.params.slug, workspaceId: req.workspaceId },
      { $set: update },
      { new: true }
    ).lean();
    if (!link) return res.status(404).json({ success: false, message: 'Lien introuvable' });
    res.json({ success: true, data: { ...link, shortUrl: `${BASE_URL}/${link.slug}` } });
  } catch (err) {
    console.error('shortLinksAdmin PATCH /:slug:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── Supprimer (lien + historique de clics) ──────────────────────────────────
router.delete('/:slug', requireEcomAuth, async (req, res) => {
  try {
    const link = await ShortLink.findOneAndDelete({ slug: req.params.slug, workspaceId: req.workspaceId });
    if (!link) return res.status(404).json({ success: false, message: 'Lien introuvable' });
    const { deletedCount } = await ShortLinkClick.deleteMany({ linkId: link._id });
    res.json({ success: true, message: `Lien supprimé (${deletedCount} clics d'historique effacés)` });
  } catch (err) {
    console.error('shortLinksAdmin DELETE /:slug:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
