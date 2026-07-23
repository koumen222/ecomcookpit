import express from 'express';
import rateLimit from 'express-rate-limit';
import StoreOrder from '../models/StoreOrder.js';
import Store from '../models/Store.js';
import EcomUser from '../models/EcomUser.js';
import Workspace from '../models/Workspace.js';
import { memCache } from '../services/memoryCache.js';

/**
 * publicLeaderboard.js — Classement PUBLIC des meilleures boutiques Scalor.
 *
 * Sert le carrousel « Top vendeurs » de la landing. Reproduit les chiffres de la
 * page « Activité boutique » (super-admin) : agrégat de TOUTES les commandes
 * StoreOrder (tous statuts, livrées ou non) des boutiques natives *.scalor.net,
 * sur TOUTE la période, classé par CA décroissant. Garde-fous de confidentialité :
 *   - vendeur ANONYMISÉ : prénom + initiale du nom (« Aminata K. »)
 *   - CA arrondi au 100 000 près (« 23,8 M FCFA » — fidèle, pas au franc près)
 *   - seuil minimum de commandes (évite d'exposer une micro-boutique)
 *   - opt-out par boutique/workspace (storeSettings.hideFromLeaderboard = true)
 *   - flag d'environnement PUBLIC_LEADERBOARD_ENABLED=false pour tout couper
 *   - cache mémoire 15 min (l'agrégation ne tourne pas à chaque visite)
 *
 * Monté sur /api/ecom/public → GET /api/ecom/public/top-stores
 */

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes.' },
});

const WINDOW_DAYS = Number(process.env.PUBLIC_LEADERBOARD_WINDOW_DAYS || 0); // 0 = toute la période
const MIN_ORDERS = Number(process.env.PUBLIC_LEADERBOARD_MIN_ORDERS || 5);
const TOP_N = Number(process.env.PUBLIC_LEADERBOARD_LIMIT || 12);
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_KEY = 'public:top-stores';

// Devise → libellé court affiché
const CURRENCY_LABEL = {
  XAF: 'FCFA', XOF: 'FCFA', FCFA: 'FCFA', CDF: 'FC', GNF: 'FG',
  NGN: '₦', GHS: '₵', MAD: 'MAD', TND: 'DT', DZD: 'DA',
  KES: 'KSh', RWF: 'FRw', UGX: 'USh', TZS: 'TSh', ZAR: 'R',
  USD: '$', EUR: '€',
};

// Pays (ISO2 ou nom courant) → drapeau + nom FR
const COUNTRY = {
  CM: ['🇨🇲', 'Cameroun'], CI: ['🇨🇮', "Côte d'Ivoire"], SN: ['🇸🇳', 'Sénégal'],
  ML: ['🇲🇱', 'Mali'], BF: ['🇧🇫', 'Burkina Faso'], BJ: ['🇧🇯', 'Bénin'],
  TG: ['🇹🇬', 'Togo'], GN: ['🇬🇳', 'Guinée'], GA: ['🇬🇦', 'Gabon'],
  CG: ['🇨🇬', 'Congo'], CD: ['🇨🇩', 'RD Congo'], MA: ['🇲🇦', 'Maroc'],
  DZ: ['🇩🇿', 'Algérie'], TN: ['🇹🇳', 'Tunisie'], GH: ['🇬🇭', 'Ghana'],
  NG: ['🇳🇬', 'Nigeria'], KE: ['🇰🇪', 'Kenya'], TZ: ['🇹🇿', 'Tanzanie'],
  RW: ['🇷🇼', 'Rwanda'], CF: ['🇨🇫', 'Centrafrique'], TD: ['🇹🇩', 'Tchad'],
};
const NAME_TO_ISO = {};
for (const [iso, [, name]] of Object.entries(COUNTRY)) NAME_TO_ISO[name.toLowerCase()] = iso;

function resolveCountry(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^[A-Za-z]{2}$/.test(s) && COUNTRY[s.toUpperCase()]) {
    const [flag, name] = COUNTRY[s.toUpperCase()];
    return { flag, name };
  }
  const iso = NAME_TO_ISO[s.toLowerCase()];
  if (iso) {
    const [flag, name] = COUNTRY[iso];
    return { flag, name };
  }
  return null;
}

// Prénom + initiale du nom de famille : « Aminata Koumba » → « Aminata K. »
function anonymizeName(name) {
  if (!name) return null;
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const first = cap(parts[0]);
  if (parts.length === 1) return first;
  const initial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${initial}.`;
}

// Montant fidèle mais lisible : millions à 1 décimale (arrondi au 100 000 près),
// milliers avec « k ». Reste proche du chiffre réel de « Activité boutique ».
function formatRevenue(n, currencyLabel) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  if (v >= 1_000_000) {
    const m = Math.round(v / 100_000) / 10;
    return `${String(m).replace('.', ',')} M ${currencyLabel}`;
  }
  if (v >= 1_000) {
    return `${Math.round(v / 1_000)}k ${currencyLabel}`;
  }
  return `${v} ${currencyLabel}`;
}

// Override manuel des stats, comme la page « Activité boutique »
// (storeSettings.adminStatsOverride / activityStatsOverride).
function readStatsOverride(...sources) {
  for (const src of sources) {
    const o = src?.storeSettings?.adminStatsOverride || src?.storeSettings?.activityStatsOverride;
    if (!o || o.enabled === false) continue;
    const to = Number(o.totalOrders);
    const tr = Number(o.totalRevenue);
    return {
      totalOrders: Number.isFinite(to) && to >= 0 ? Math.round(to) : null,
      totalRevenue: Number.isFinite(tr) && tr >= 0 ? Math.round(tr) : null,
    };
  }
  return null;
}

router.get('/top-stores', limiter, async (req, res) => {
  res.set('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800, max-age=0');
  try {
    if (String(process.env.PUBLIC_LEADERBOARD_ENABLED).toLowerCase() === 'false') {
      return res.json({ success: true, disabled: true, stores: [] });
    }

    const cached = memCache.get(CACHE_KEY);
    if (cached) return res.json(cached);

    // Mêmes chiffres que la page « Activité boutique » : aucune restriction de
    // statut ; fenêtre de date seulement si WINDOW_DAYS > 0 (sinon toute la période).
    const match = {};
    if (WINDOW_DAYS > 0) {
      match.createdAt = { $gte: new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000) };
    }

    const agg = await StoreOrder.aggregate([
      { $match: match },
      {
        $group: {
          _id: { workspaceId: '$workspaceId', storeId: '$storeId' },
          revenue: { $sum: { $ifNull: ['$total', 0] } },
          orders: { $sum: 1 },
          currency: { $max: '$currency' },
          country: { $max: '$country' },
        },
      },
      { $match: { revenue: { $gt: 0 } } },
      { $sort: { revenue: -1 } },
      { $limit: TOP_N * 5 },
    ]);

    if (!agg.length) {
      const empty = { success: true, windowDays: WINDOW_DAYS, stores: [] };
      memCache.set(CACHE_KEY, empty, CACHE_TTL_MS);
      return res.json(empty);
    }

    const storeIds = agg.map((a) => a._id.storeId).filter(Boolean);
    const wsIds = agg.map((a) => a._id.workspaceId).filter(Boolean);

    const [stores, workspaces] = await Promise.all([
      Store.find({ _id: { $in: storeIds } }, { name: 1, workspaceId: 1, createdBy: 1, storeSettings: 1 }).lean(),
      Workspace.find({ _id: { $in: wsIds } }, { owner: 1, name: 1, storeSettings: 1 }).lean(),
    ]);
    const storeById = new Map(stores.map((s) => [String(s._id), s]));
    const wsById = new Map(workspaces.map((w) => [String(w._id), w]));

    const ownerIds = new Set();
    for (const a of agg) {
      const st = a._id.storeId ? storeById.get(String(a._id.storeId)) : null;
      const ws = a._id.workspaceId ? wsById.get(String(a._id.workspaceId)) : null;
      const uid = (st && st.createdBy) || (ws && ws.owner);
      if (uid) ownerIds.add(String(uid));
    }
    const owners = ownerIds.size
      ? await EcomUser.find({ _id: { $in: Array.from(ownerIds) } }, { name: 1 }).lean()
      : [];
    const ownerById = new Map(owners.map((u) => [String(u._id), u]));

    const enriched = [];
    for (const a of agg) {
      const st = a._id.storeId ? storeById.get(String(a._id.storeId)) : null;
      const ws = a._id.workspaceId ? wsById.get(String(a._id.workspaceId)) : null;

      const optOut = st?.storeSettings?.hideFromLeaderboard === true
        || ws?.storeSettings?.hideFromLeaderboard === true;
      if (optOut) continue;

      // Honore l'override manuel affiché sur « Activité boutique »
      const ov = readStatsOverride(st, ws);
      const revenue = ov && ov.totalRevenue != null ? ov.totalRevenue : a.revenue;
      const orders = ov && ov.totalOrders != null ? ov.totalOrders : a.orders;
      if (orders < MIN_ORDERS || revenue <= 0) continue;

      const uid = (st && st.createdBy) || (ws && ws.owner);
      const owner = uid ? ownerById.get(String(uid)) : null;
      const seller = anonymizeName(owner?.name) || 'Vendeur Scalor';
      const currencyLabel = CURRENCY_LABEL[a.currency] || a.currency || 'FCFA';
      const country = resolveCountry(a.country);

      enriched.push({
        _revenue: revenue,
        seller,
        country: country ? country.name : null,
        flag: country ? country.flag : '🌍',
        revenueLabel: formatRevenue(revenue, currencyLabel),
        orders,
      });
    }

    // Re-tri par CA effectif (après override) puis top N
    enriched.sort((x, y) => y._revenue - x._revenue);
    const stores_out = enriched.slice(0, TOP_N).map(({ _revenue, ...rest }) => rest);

    const payload = {
      success: true,
      windowDays: WINDOW_DAYS,
      updatedAt: new Date().toISOString(),
      stores: stores_out.map((s, i) => ({ rank: i + 1, ...s })),
    };
    memCache.set(CACHE_KEY, payload, CACHE_TTL_MS);
    return res.json(payload);
  } catch (err) {
    console.error('[publicLeaderboard] /top-stores error:', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur', stores: [] });
  }
});

export default router;
