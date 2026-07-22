// ─────────────────────────────────────────────────────────────────────────────
//  Débit / remboursement des crédits Creative Center — service partagé.
//  Pattern identique à creativeGenerator : réservation ATOMIQUE avant l'appel
//  provider (findOneAndUpdate avec garde $gte), remboursement si échec.
//  Utilisé par : builderAi (voix, vidéo, montage, clone, lipsync) et
//  videoTranslation. La grille vient de config/creativePricing.js.
// ─────────────────────────────────────────────────────────────────────────────
import EcomWorkspace from '../models/Workspace.js';
import { CREATIVE_PRICING, PRICE_PER_CREDIT_FCFA } from '../config/creativePricing.js';

// ── Grille dynamique (éditable super admin) — cache 30 s ────────────────────
// Source : singleton CreativePricingConfig (Mongo). Repli : défauts statiques.
let _pricingCache = null;
let _pricingCacheAt = 0;
const PRICING_TTL_MS = 30_000;

function staticSnapshot() {
  const features = {};
  for (const [k, v] of Object.entries(CREATIVE_PRICING)) features[k] = { ...v };
  return { pricePerCreditFcfa: PRICE_PER_CREDIT_FCFA, features, freeMode: false };
}

/** Grille tarifaire effective (overrides super admin inclus). */
export async function getCreativePricingSnapshot() {
  if (_pricingCache && Date.now() - _pricingCacheAt < PRICING_TTL_MS) return _pricingCache;
  try {
    const CreativePricingConfig = (await import('../models/CreativePricingConfig.js')).default;
    const cfg = await CreativePricingConfig.getSingleton();
    _pricingCache = cfg.getSnapshot();
    _pricingCacheAt = Date.now();
  } catch (e) {
    console.warn('[creativeCredits] Grille DB indisponible, défauts statiques utilisés:', e.message);
    if (!_pricingCache) { _pricingCache = staticSnapshot(); _pricingCacheAt = Date.now(); }
  }
  return _pricingCache;
}

/** À appeler après toute modification super admin de la grille. */
export function invalidateCreativePricingCache() {
  _pricingCache = null;
  _pricingCacheAt = 0;
}

/** Coût effectif en crédits d'une fonctionnalité (grille dynamique). */
export async function getFeatureCost(key) {
  const snap = await getCreativePricingSnapshot();
  return snap.features?.[key]?.credits ?? 0;
}

/** Mode gratuit global du Creative Center (toggle super admin) — cache 30 s.
 *  true = aucun crédit débité, quelle que soit la fonctionnalité. */
export async function isCreativeFreeModeEnabled() {
  const snap = await getCreativePricingSnapshot();
  return !!snap.freeMode;
}

/**
 * Réserve les crédits d'une fonctionnalité pour un workspace.
 * @param {string} workspaceId
 * @param {string} feature  clé de CREATIVE_PRICING ('voice', 'video', …)
 * @param {number} [overrideCredits]  coût custom (ex. stage 'character' → tarif image)
 * @returns {{ ok:true, credits, remaining, refund }|{ ok:false, credits, available }}
 *  refund(reason?) est idempotent — appelable sans risque dans plusieurs chemins d'échec.
 */
export async function reserveFeatureCredits(workspaceId, feature, overrideCredits) {
  // Mode gratuit global (toggle super admin) : aucun débit, refund no-op.
  if (await isCreativeFreeModeEnabled()) {
    console.log(`🎁 [creativeCredits] Mode gratuit actif — 0 crédit débité (${feature})`);
    return { ok: true, credits: 0, remaining: null, refund: async () => {}, freeMode: true };
  }
  const credits = Number.isFinite(overrideCredits) ? overrideCredits : await getFeatureCost(feature);
  if (!credits) return { ok: true, credits: 0, remaining: null, refund: async () => {} };
  if (!workspaceId) return { ok: false, credits, available: 0 };

  const ws = await EcomWorkspace.findOneAndUpdate(
    { _id: workspaceId, creativeCreditsRemaining: { $gte: credits } },
    { $inc: { creativeCreditsRemaining: -credits } },
    { new: true, select: 'creativeCreditsRemaining' },
  );

  if (!ws) {
    const cur = await EcomWorkspace.findById(workspaceId).select('creativeCreditsRemaining').lean();
    return { ok: false, credits, available: cur?.creativeCreditsRemaining ?? 0 };
  }

  let refunded = false;
  const refund = async (reason = '') => {
    if (refunded) return;
    refunded = true;
    try {
      await EcomWorkspace.updateOne({ _id: workspaceId }, { $inc: { creativeCreditsRemaining: credits } });
      console.log(`💳 [creativeCredits] +${credits} remboursé (${feature}${reason ? ` — ${String(reason).slice(0, 120)}` : ''})`);
    } catch (e) {
      console.error(`❌ [creativeCredits] Remboursement échoué (${feature}, ${credits}cr, ws=${workspaceId}):`, e.message);
    }
  };

  console.log(`💳 [creativeCredits] -${credits} réservé (${feature}); reste=${ws.creativeCreditsRemaining}`);
  return { ok: true, credits, remaining: ws.creativeCreditsRemaining, refund };
}

/** Réponse 402 normalisée — le front détecte error === 'INSUFFICIENT_CREDITS'. */
export function sendInsufficientCredits(res, feature, r) {
  return res.status(402).json({
    success: false,
    error: 'INSUFFICIENT_CREDITS',
    message: `Crédits insuffisants : ${r.credits} requis, ${r.available} disponible${r.available > 1 ? 's' : ''}. Rechargez depuis le Creative Center.`,
    feature,
    creditsRequired: r.credits,
    creditsAvailable: r.available,
  });
}
