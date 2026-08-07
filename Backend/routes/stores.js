/**
 * /api/ecom/stores — Multi-store management
 * List, create, update, delete stores for a workspace.
 * Each store has its own subdomain, branding, products, and orders.
 */
import express from 'express';
import mongoose from 'mongoose';
import Store from '../models/Store.js';
import Workspace from '../models/Workspace.js';
import EcomUser from '../models/EcomUser.js';
import StoreProduct from '../models/StoreProduct.js';
import StoreOrder from '../models/StoreOrder.js';
import { requireEcomAuth, invalidateUserCache } from '../middleware/ecomAuth.js';
import { checkPlanLimit, getEffectiveStoreLimit } from '../middleware/planLimits.js';
import { completeText as deepseekComplete } from '../services/textProviderService.js';
import { invalidateStoreCache } from './storeApi.js';
import { invalidateStorefrontCache } from './publicStorefront.js';
import { buildFallbackSections, buildFallbackFooterAndLegal } from './storeManagement.js';

const router = express.Router();

// Sous-domaines réservés à la plateforme (jamais attribuables à une boutique).
// Liste alignée sur RESERVED_SUBDOMAINS de storeManagement.js.
export const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'app', 'admin', 'dashboard', 'mail', 'ftp', 'store', 'shop',
  'scalor', 'help', 'support', 'docs', 'blog', 'static', 'cdn', 'assets',
  'dev', 'staging', 'test'
]);

// Helper: generate a subdomain suggestion from a store name
function generateSubdomain(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

function buildStorePublicUrl(store) {
  const customDomain = String(store?.storeDomains?.customDomain || '').trim().toLowerCase();
  const isCustomDomainReady = store?.storeDomains?.sslStatus === 'active';

  if (customDomain && isCustomDomainReady) {
    return `https://${customDomain}`;
  }

  if (store?.subdomain) {
    return `https://${store.subdomain}.scalor.net`;
  }

  return null;
}

function hasLegacyWorkspaceStore(workspace) {
  return Boolean(
    workspace?.subdomain
    || workspace?.storePages?.sections?.length > 0
    || workspace?.storeSettings?.isStoreEnabled === true
  );
}

function buildLegacyWorkspaceStore(workspace) {
  const storeLike = {
    subdomain: workspace?.subdomain || null,
    storeDomains: workspace?.storeDomains || {},
  };

  return {
    _id: null,
    name: workspace?.storeSettings?.storeName || workspace?.name || 'Boutique',
    subdomain: workspace?.subdomain || null,
    storeSettings: workspace?.storeSettings || {},
    storeTheme: workspace?.storeTheme || {},
    storePages: workspace?.storePages || {},
    storeDomains: workspace?.storeDomains || {},
    isActive: true,
    createdAt: workspace?.createdAt || null,
    hasHomepage: !!(workspace?.storePages?.sections?.length > 0),
    isPrimary: true,
    customDomain: workspace?.storeDomains?.customDomain || '',
    sslStatus: workspace?.storeDomains?.sslStatus || 'none',
    dnsVerified: workspace?.storeDomains?.dnsVerified === true,
    storeUrl: buildStorePublicUrl(storeLike),
    publicUrl: buildStorePublicUrl(storeLike),
    legacyWorkspaceStore: true,
  };
}

// Helper: check subdomain availability across Store + Workspace (for backward compat)
// Exported: also used by the public availability check in auth.js (funnel d'inscription).
export async function isSubdomainAvailable(subdomain, excludeStoreId = null, excludeWorkspaceId = null) {
  const cleanSub = subdomain.toLowerCase().trim();
  if (RESERVED_SUBDOMAINS.has(cleanSub)) return false;
  // Always exclude all stores belonging to the same workspace
  const storeQuery = { subdomain: cleanSub };
  if (excludeWorkspaceId) storeQuery.workspaceId = { $ne: excludeWorkspaceId };
  else if (excludeStoreId) storeQuery._id = { $ne: excludeStoreId };

  const wsQuery = { subdomain: cleanSub };
  if (excludeWorkspaceId) wsQuery._id = { $ne: excludeWorkspaceId };

  const [storeConflict, wsConflict] = await Promise.all([
    Store.findOne(storeQuery).select('_id').lean(),
    Workspace.findOne(wsQuery).select('_id').lean()
  ]);
  return !storeConflict && !wsConflict;
}

// GET /api/ecom/stores — list all stores for current workspace
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const stores = await Store.find({ workspaceId: req.workspaceId, isActive: true })
      .select('_id name subdomain market closerId storeSettings storeTheme storePages storeDomains isActive createdAt')
      .sort({ createdAt: 1 })
      .lean();

    const ws = await Workspace.findById(req.workspaceId)
      .select('primaryStoreId name subdomain storeSettings storeTheme storePages storeDomains createdAt')
      .lean();

    // Auto-assign orphan products/orders to primary store ONLY when there is exactly 1 store
    // (one-time migration for legacy data). With multiple stores, orphans stay unassigned
    // to avoid incorrectly attributing data to the wrong store.
    if (stores.length === 1) {
      const primaryId = stores[0]._id;
      const orphanCount = await StoreProduct.countDocuments({ workspaceId: req.workspaceId, storeId: null });
      if (orphanCount > 0) {
        await Promise.all([
          StoreProduct.updateMany(
            { workspaceId: req.workspaceId, storeId: null },
            { $set: { storeId: primaryId } }
          ),
          StoreOrder.updateMany(
            { workspaceId: req.workspaceId, storeId: null },
            { $set: { storeId: primaryId } }
          )
        ]);
        console.log(`✅ Migrated ${orphanCount} orphan products to store ${primaryId}`);
      }
    }

    const normalizedStores = stores.map(s => ({
      ...s,
      hasHomepage: !!(s.storePages?.sections?.length > 0),
      isPrimary: String(ws?.primaryStoreId) === String(s._id),
      customDomain: s.storeDomains?.customDomain || '',
      sslStatus: s.storeDomains?.sslStatus || 'none',
      dnsVerified: s.storeDomains?.dnsVerified === true,
      storeUrl: buildStorePublicUrl(s),
      publicUrl: buildStorePublicUrl(s)
    }));

    if (normalizedStores.length === 0 && hasLegacyWorkspaceStore(ws)) {
      normalizedStores.push(buildLegacyWorkspaceStore(ws));
    }

    res.json({
      success: true,
      data: normalizedStores
    });
  } catch (err) {
    console.error('Erreur liste stores:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/stores — hard cap (plan limits enforced upstream by checkPlanLimit)
const MAX_STORES_PER_WORKSPACE = 10; // repli si la limite effective est indisponible

// Marché → code ISO 3166-1 alpha-2. Accepte un code 2 lettres tel quel ;
// mappe les noms FR courants (compat anciens clients qui envoient `country`).
const MARKET_NAME_TO_ISO = {
  'cameroun': 'CM', 'cameroon': 'CM', "côte d'ivoire": 'CI', "cote d'ivoire": 'CI', 'ivory coast': 'CI',
  'sénégal': 'SN', 'senegal': 'SN', 'bénin': 'BJ', 'benin': 'BJ', 'togo': 'TG', 'tchad': 'TD', 'chad': 'TD',
  'mali': 'ML', 'burkina faso': 'BF', 'guinée': 'GN', 'guinee': 'GN', 'gabon': 'GA', 'congo': 'CG',
  'rd congo': 'CD', 'rdc': 'CD', 'maroc': 'MA', 'morocco': 'MA', 'algérie': 'DZ', 'algerie': 'DZ',
  'tunisie': 'TN', 'ghana': 'GH', 'nigeria': 'NG', 'kenya': 'KE', 'tanzanie': 'TZ', 'rwanda': 'RW',
  'centrafrique': 'CF', 'niger': 'NE', 'mauritanie': 'MR', 'madagascar': 'MG', 'france': 'FR',
  'états-unis': 'US', 'etats-unis': 'US', 'usa': 'US', 'united states': 'US',
};
function resolveMarketCode(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  return MARKET_NAME_TO_ISO[s.toLowerCase()] || null;
}
// ── Extraction IA d'un brief de création de boutique ────────────────────────
// Le wizard-chat envoie ici tout texte long (description libre, concept
// complet, spec/prompt markdown…) : le LLM en tire les champs de création.
// Repli côté front sur l'extraction locale si indisponible.
const AI_BRIEF_TYPES = ['beaute', 'fitness', 'mode', 'tech', 'maison', 'sante', 'enfants', 'autre'];
const AI_BRIEF_TONES = ['premium', 'naturel', 'dynamique'];
router.post('/ai-brief', requireEcomAuth, async (req, res) => {
  const text = String(req.body?.text || '').trim().slice(0, 12000);
  if (text.length < 10) return res.status(400).json({ success: false, message: 'Brief trop court' });
  try {
    const system = `Tu extrais les informations de création d'une boutique e-commerce depuis un texte libre (description, concept de marque, spec, prompt, document markdown).
Réponds UNIQUEMENT un objet JSON, aucune prose, avec ces clés (null si l'info est absente) :
{"storeName": string|null, "productType": string|null, "productDescription": string|null, "productPrice": number|null, "country": string|null, "city": string|null, "tone": string|null, "themeColor": string|null, "whatsapp": string|null, "description": string|null, "storeNameInvented": boolean, "design": {"primaryColor": string|null, "ctaColor": string|null, "backgroundColor": string|null, "textColor": string|null, "secondaryColor": string|null, "font": string|null, "borderRadius": string|null}|null}
Règles :
- storeName : le nom de la boutique. Si le texte propose plusieurs noms, choisis le meilleur. Si AUCUN nom n'existe, invente-en un court, prononçable, cohérent avec la niche, et mets storeNameInvented=true.
- productType : exactement une valeur parmi ${JSON.stringify(AI_BRIEF_TYPES)} (la niche dominante, déduite du/des produits décrits).
- productDescription : le produit phare en quelques mots (ex "montre connectée homme"), sinon null.
- productPrice : prix de vente du produit phare en NOMBRE seul (sans devise, sans séparateurs) s'il est mentionné, sinon null. N'INVENTE JAMAIS de prix.
- country : nom français du pays du marché principal (ex "Cameroun"). city : la ville principale si citée.
- tone : parmi ${JSON.stringify(AI_BRIEF_TONES)} selon le positionnement (luxe/élégant→premium, bio/authentique→naturel, énergique/jeune→dynamique).
- themeColor : couleur principale en hex #RRGGBB — celle du texte si mentionnée, sinon une couleur adaptée à la niche.
- whatsapp : numéro complet avec indicatif s'il figure dans le texte, sinon null. N'INVENTE JAMAIS de numéro.
- description : 1 à 2 phrases reformulées — ce que vend la boutique et pour qui. PAS le texte brut.
- design : UNIQUEMENT si le texte définit une direction visuelle (palette, univers visuel, couleurs, typographie, style). Si plusieurs palettes sont proposées, choisis la plus cohérente avec la niche. Couleurs en hex #RRGGBB, contraste lisible (texte sombre sur fond clair ou l'inverse). font parmi ["inter","poppins","montserrat","playfair","lora","dmsans","raleway","nunito"]. borderRadius parmi ["sm","md","lg","xl"] (épuré→sm/md, doux/premium→lg/xl). Si le texte ne définit RIEN de visuel : design=null.`;
    const raw = await deepseekComplete(text, { system, temperature: 0.2, maxTokens: 500, responseFormat: { type: 'json_object' }, timeoutMs: 30000 });
    let data = null;
    try {
      data = JSON.parse(String(raw).replace(/```(?:json)?/g, '').trim());
    } catch {
      const m = String(raw).match(/\{[\s\S]*\}/);
      if (m) { try { data = JSON.parse(m[0]); } catch { data = null; } }
    }
    if (!data || typeof data !== 'object') {
      return res.status(502).json({ success: false, message: 'Réponse IA illisible' });
    }
    const str = (v, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
    const out = {
      storeName: str(data.storeName, 60),
      productType: AI_BRIEF_TYPES.includes(data.productType) ? data.productType : null,
      productDescription: str(data.productDescription, 140),
      productPrice: Number.isFinite(Number(data.productPrice)) && Number(data.productPrice) > 0
        ? String(Math.round(Number(data.productPrice))) : null,
      country: str(data.country, 60),
      city: str(data.city, 60),
      tone: AI_BRIEF_TONES.includes(data.tone) ? data.tone : null,
      themeColor: /^#[0-9a-fA-F]{6}$/.test(String(data.themeColor || '')) ? data.themeColor : null,
      whatsapp: str(data.whatsapp, 24),
      description: str(data.description, 300),
      storeNameInvented: data.storeNameInvented === true,
      design: null,
    };
    // Design : chaque champ validé individuellement — un design partiel est OK.
    if (data.design && typeof data.design === 'object') {
      const hex = (v) => (/^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? v : null);
      const FONTS = ['inter', 'poppins', 'montserrat', 'playfair', 'lora', 'dmsans', 'raleway', 'nunito'];
      const RADII = ['sm', 'md', 'lg', 'xl'];
      const d = {
        primaryColor: hex(data.design.primaryColor),
        ctaColor: hex(data.design.ctaColor),
        backgroundColor: hex(data.design.backgroundColor),
        textColor: hex(data.design.textColor),
        secondaryColor: hex(data.design.secondaryColor),
        font: FONTS.includes(data.design.font) ? data.design.font : null,
        borderRadius: RADII.includes(data.design.borderRadius) ? data.design.borderRadius : null,
      };
      const kept = Object.fromEntries(Object.entries(d).filter(([, v]) => v != null));
      if (Object.keys(kept).length) out.design = kept;
    }
    res.json({ success: true, data: out });
  } catch (err) {
    console.error('[Stores] ai-brief error:', err.message);
    res.status(502).json({ success: false, message: 'Extraction IA indisponible' });
  }
});

router.post('/', requireEcomAuth, checkPlanLimit('stores'), async (req, res) => {
  try {
    const { name, subdomain, country, storeCurrency, market } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Nom de boutique requis' });
    }

    // ── MARCHÉ OBLIGATOIRE — code pays ISO 3166-1 alpha-2, sans défaut. ──
    // Liste extensible (pas d'enum figé) : tout code à 2 lettres est accepté ;
    // repli : nom de pays FR courant envoyé par d'anciens clients → code.
    const resolvedMarket = resolveMarketCode(market || country);
    if (!resolvedMarket) {
      return res.status(400).json({
        success: false,
        error: 'MARKET_REQUIRED',
        message: 'Marché requis : indique le pays de la boutique (code ISO à 2 lettres, ex. CM, CI, SN, BJ, TG…).'
      });
    }

    // Limite EFFECTIVE de boutiques : override par espace (super admin) ?? plan.
    // checkPlanLimit applique déjà la même règle — ce garde-fou route couvre
    // les cas où le middleware est bypassé et remplace l'ancien plafond fixe.
    const storeCount = await Store.countDocuments({ workspaceId: req.workspaceId, isActive: true });
    const { max: effectiveMax } = await getEffectiveStoreLimit(req.workspaceId).catch(() => ({ max: MAX_STORES_PER_WORKSPACE }));
    const hardMax = effectiveMax == null || effectiveMax === -1 ? Infinity : effectiveMax;
    if (storeCount >= hardMax) {
      return res.status(403).json({ success: false, message: `Limite de boutiques atteinte (${storeCount}/${hardMax === Infinity ? '∞' : hardMax}) pour cet espace` });
    }

    // ── MIGRATION AUTOMATIQUE de la boutique LEGACY (portée par le workspace) ──
    // Créer une « seconde boutique » ne doit JAMAIS écraser la première : si le
    // workspace porte encore une boutique legacy (aucun doc Store), on la
    // matérialise D'ABORD en doc Store — même sous-domaine, mêmes réglages,
    // mêmes pages — elle devient la boutique principale et récupère ses
    // produits/commandes (storeId null). La nouvelle boutique est ensuite
    // créée À CÔTÉ, jamais à la place.
    if (storeCount === 0) {
      const wsFull = await Workspace.findById(req.workspaceId)
        .select('name subdomain storeSettings storeTheme storePages storeFooter storeLegalPages storeDomains createdAt')
        .lean();
      if (wsFull && hasLegacyWorkspaceStore(wsFull)) {
        let legacySub = String(wsFull.subdomain || '').toLowerCase().trim();
        if (!legacySub) {
          let base = generateSubdomain(wsFull.storeSettings?.storeName || wsFull.name || 'boutique');
          let candidate = base; let attempt = 0;
          while (!(await isSubdomainAvailable(candidate))) { attempt += 1; candidate = `${base}-${attempt}`; }
          legacySub = candidate;
        }
        const legacyStore = await Store.create({
          workspaceId: req.workspaceId,
          name: wsFull.storeSettings?.storeName || wsFull.name || 'Boutique',
          subdomain: legacySub,
          isActive: true,
          storeSettings: wsFull.storeSettings || { isStoreEnabled: true },
          ...(wsFull.storeTheme ? { storeTheme: wsFull.storeTheme } : {}),
          ...(wsFull.storePages ? { storePages: wsFull.storePages } : {}),
          ...(wsFull.storeFooter ? { storeFooter: wsFull.storeFooter } : {}),
          ...(wsFull.storeLegalPages ? { storeLegalPages: wsFull.storeLegalPages } : {}),
          ...(wsFull.storeDomains ? { storeDomains: wsFull.storeDomains } : {}),
          createdBy: req.ecomUser._id,
          ...(wsFull.createdAt ? { createdAt: wsFull.createdAt } : {}),
        });
        await Promise.all([
          Workspace.updateOne({ _id: req.workspaceId }, { $set: { primaryStoreId: legacyStore._id } }),
          StoreProduct.updateMany({ workspaceId: req.workspaceId, storeId: null }, { $set: { storeId: legacyStore._id } }),
          StoreOrder.updateMany({ workspaceId: req.workspaceId, storeId: null }, { $set: { storeId: legacyStore._id } }),
        ]);
        invalidateStoreCache(legacySub);
        console.log(`✅ [Stores] Boutique legacy migrée en doc Store ${legacyStore._id} (${legacySub}) — la nouvelle boutique sera créée à côté`);
      }
    }

    // Determine subdomain
    let finalSubdomain = subdomain ? subdomain.toLowerCase().trim() : null;
    if (!finalSubdomain) {
      // Auto-generate + ensure unique
      let base = generateSubdomain(name);
      let candidate = base;
      let attempt = 0;
      while (!(await isSubdomainAvailable(candidate))) {
        attempt++;
        candidate = `${base}-${attempt}`;
      }
      finalSubdomain = candidate;
    } else {
      if (!/^[a-z0-9-]{3,30}$/.test(finalSubdomain)) {
        return res.status(400).json({ success: false, message: 'Sous-domaine invalide (3-30 caractères alphanumériques et tirets)' });
      }
      if (!(await isSubdomainAvailable(finalSubdomain))) {
        return res.status(409).json({ success: false, message: 'Ce sous-domaine est déjà utilisé' });
      }
    }

    const initialCountry = String(country || '').trim().slice(0, 120);
    const initialCurrency = String(storeCurrency || '').trim().toUpperCase().slice(0, 12) || 'XAF';

    // TOUTE boutique naît COMPLÈTE : sections d'accueil + footer + pages
    // légales (À propos, CGV, confidentialité…) initialisées immédiatement
    // avec un contenu statique de qualité. La génération IA du wizard vient
    // ensuite ENRICHIR par-dessus — mais même si elle échoue, le storefront
    // n'est jamais vide.
    const seed = { storeName: name.trim(), country: initialCountry, storeCurrency: initialCurrency };
    let initialPages = null;
    let initialFooterLegal = { footer: null, legalPages: null };
    try {
      initialPages = { sections: buildFallbackSections(seed) };
      initialFooterLegal = buildFallbackFooterAndLegal(seed);
    } catch (e) {
      console.warn('[Stores] sections par défaut indisponibles:', e.message);
    }

    const store = await Store.create({
      workspaceId: req.workspaceId,
      name: name.trim(),
      subdomain: finalSubdomain,
      isActive: true,
      market: resolvedMarket,
      storeSettings: {
        isStoreEnabled: true,
        storeName: name.trim(),
        storeDescription: '',
        storeLogo: '',
        storeBanner: '',
        storePhone: '',
        storeWhatsApp: '',
        storeThemeColor: '#0F6B4F',
        storeCurrency: initialCurrency,
        currency: initialCurrency,
        country: initialCountry,
        productPageConfig: {
          general: {
            countries: initialCountry ? [initialCountry] : []
          }
        }
      },
      storePages: initialPages,
      storeFooter: initialFooterLegal.footer,
      storeLegalPages: initialFooterLegal.legalPages,
      createdBy: req.ecomUser._id
    });

    // If this is the first store for the workspace, set as primary
    const ws = await Workspace.findById(req.workspaceId).select('primaryStoreId').lean();
    if (!ws?.primaryStoreId) {
      await Workspace.updateOne({ _id: req.workspaceId }, { $set: { primaryStoreId: store._id } });
    }

    // Onboarding « boutique d'abord » : la boutique existe désormais, lever le
    // blocage d'accès au reste de la plateforme pour ce nouveau compte.
    if (req.ecomUser?.needsStoreSetup) {
      try {
        await EcomUser.updateOne({ _id: req.ecomUser._id }, { $set: { needsStoreSetup: false } });
        invalidateUserCache(req.ecomUser._id);
        console.log(`[STORE_ONBOARDING] completed user=${req.ecomUser.email} store=${store._id}`);
      } catch (e) {
        console.warn('[STORE_ONBOARDING] clear flag failed:', e.message);
      }
    }

    res.status(201).json({ success: true, data: store });
  } catch (err) {
    console.error('Erreur création store:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/stores/check-subdomain/:subdomain — availability check
// IMPORTANT: must be defined before /:storeId to avoid route conflict
router.get('/check-subdomain/:subdomain', requireEcomAuth, async (req, res) => {
  try {
    const clean = req.params.subdomain.toLowerCase().trim();
    if (!/^[a-z0-9-]{3,30}$/.test(clean)) {
      return res.json({ success: true, available: false, reason: 'Format invalide' });
    }
    const available = await isSubdomainAvailable(clean, req.query.excludeStoreId || null, req.workspaceId);
    res.json({ success: true, available });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/stores/:storeId — get one store
router.get('/:storeId', requireEcomAuth, async (req, res) => {
  try {
    const store = await Store.findOne({
      _id: req.params.storeId,
      workspaceId: req.workspaceId,
      isActive: true
    }).lean();

    if (!store) return res.status(404).json({ success: false, message: 'Boutique non trouvée' });

    res.json({ success: true, data: store });
  } catch (err) {
    console.error('Erreur get store:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/stores/:storeId — update store config
router.put('/:storeId', requireEcomAuth, async (req, res) => {
  try {
    const store = await Store.findOne({
      _id: req.params.storeId,
      workspaceId: req.workspaceId
    });
    if (!store) return res.status(404).json({ success: false, message: 'Boutique non trouvée' });

    // Marché : code ISO 2 lettres uniquement. Closeuse : null (désassigner) ou
    // un utilisateur closeuse du workspace — validé plus bas.
    if (req.body.market !== undefined) {
      const m = resolveMarketCode(req.body.market);
      if (!m) return res.status(400).json({ success: false, message: 'Marché invalide (code pays ISO à 2 lettres attendu)' });
      store.market = m;
    }
    if (req.body.closerId !== undefined) {
      if (req.body.closerId === null || req.body.closerId === '') {
        store.closerId = null;
      } else {
        const closer = await EcomUser.findOne({
          _id: req.body.closerId,
          role: 'ecom_closeuse',
          $or: [{ workspaceId: req.workspaceId }, { 'workspaces.workspaceId': req.workspaceId }],
        }).select('_id').lean();
        if (!closer) return res.status(400).json({ success: false, message: 'Closeuse introuvable dans cet espace' });
        store.closerId = closer._id;
      }
    }

    const allowed = ['name', 'storeSettings', 'storeTheme', 'storePages', 'storePixels', 'storePayments', 'storeDomains', 'storeDeliveryZones', 'whatsappAutoConfirm', 'whatsappOrderTemplate', 'whatsappAutoInstanceId', 'whatsappAutoImageUrl', 'whatsappAutoAudioUrl', 'whatsappAutoVideoUrl', 'whatsappAutoDocumentUrl', 'whatsappAutoSendOrder', 'whatsappAutoProductMediaRules'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (typeof req.body[key] === 'object' && !Array.isArray(req.body[key]) && req.body[key] !== null && typeof store[key] === 'object') {
          store[key] = { ...store[key], ...req.body[key] };
        } else {
          store[key] = req.body[key];
        }
      }
    }
    store.markModified('storeSettings');
    store.markModified('storeTheme');
    store.markModified('storePages');
    store.markModified('storePixels');
    store.markModified('storePayments');
    store.markModified('storeDomains');
    store.markModified('storeDeliveryZones');
    await store.save();

    res.json({ success: true, data: store });
  } catch (err) {
    console.error('Erreur update store:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/stores/:storeId/subdomain — update subdomain
router.put('/:storeId/subdomain', requireEcomAuth, async (req, res) => {
  try {
    const { subdomain } = req.body;
    if (!subdomain?.trim()) return res.status(400).json({ success: false, message: 'Sous-domaine requis' });

    const clean = subdomain.toLowerCase().trim();
    if (!/^[a-z0-9-]{3,30}$/.test(clean)) {
      return res.status(400).json({ success: false, message: 'Sous-domaine invalide (3-30 caractères)' });
    }

    const store = await Store.findOne({ _id: req.params.storeId, workspaceId: req.workspaceId });
    if (!store) return res.status(404).json({ success: false, message: 'Boutique non trouvée' });

    const previousSubdomain = store.subdomain || null;
    console.log('🔄 PUT /stores/:storeId/subdomain — store:', store._id, 'workspace:', req.workspaceId, 'old:', previousSubdomain, 'new:', clean);

    if (store.subdomain !== clean && !(await isSubdomainAvailable(clean, store._id, req.workspaceId))) {
      console.log('🔄 Subdomain conflict for:', clean);
      return res.status(409).json({ success: false, message: 'Ce sous-domaine est déjà utilisé' });
    }

    store.subdomain = clean;
    await store.save();

    // Sync workspace subdomain if this is the primary store
    const ws = await Workspace.findById(req.workspaceId).select('primaryStoreId').lean();
    if (String(ws?.primaryStoreId) === String(store._id)) {
      await Workspace.findByIdAndUpdate(req.workspaceId, { $set: { subdomain: clean } });
    }

    console.log('✅ Store subdomain updated:', previousSubdomain, '→', clean, '— store:', store._id);
    res.json({ success: true, data: { subdomain: clean } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Ce sous-domaine est déjà utilisé' });
    }
    console.error('❌ Erreur update subdomain:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/stores/:storeId/set-primary — set as primary store
router.post('/:storeId/set-primary', requireEcomAuth, async (req, res) => {
  try {
    const store = await Store.findOne({ _id: req.params.storeId, workspaceId: req.workspaceId, isActive: true }).select('_id').lean();
    if (!store) return res.status(404).json({ success: false, message: 'Boutique non trouvée' });

    await Workspace.updateOne({ _id: req.workspaceId }, { $set: { primaryStoreId: store._id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/stores/:storeId — soft delete
router.delete('/:storeId', requireEcomAuth, async (req, res) => {
  try {
    const store = await Store.findOne({ _id: req.params.storeId, workspaceId: req.workspaceId });
    if (!store) return res.status(404).json({ success: false, message: 'Boutique non trouvée' });

    // La suppression de la dernière boutique est autorisée : le marchand
    // retombe sur le wizard de création (primaryStoreId est alors désaffecté).
    const ws = await Workspace.findById(req.workspaceId).select('primaryStoreId').lean();

    const subdomain = store.subdomain;
    store.isActive = false;
    // Libérer le sous-domaine (index unique) pour permettre sa réutilisation :
    // le doc archivé est renommé, la boutique supprimée garde son historique.
    if (subdomain && !subdomain.includes('--deleted-')) {
      store.subdomain = `${subdomain}--deleted-${Date.now()}`;
    }
    await store.save();

    // Purge public store cache so the subdomain returns 404 immediately
    if (subdomain) invalidateStoreCache(subdomain); invalidateStorefrontCache(subdomain);

    // If it was primary, promote another store — or unset if none remains
    if (String(ws?.primaryStoreId) === String(store._id)) {
      const next = await Store.findOne({ workspaceId: req.workspaceId, isActive: true, _id: { $ne: store._id } }).select('_id').lean();
      await Workspace.updateOne(
        { _id: req.workspaceId },
        next ? { $set: { primaryStoreId: next._id } } : { $unset: { primaryStoreId: 1 } }
      );
    }

    res.json({ success: true, message: 'Boutique supprimée' });
  } catch (err) {
    console.error('Erreur delete store:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── Synchro Google Sheets des commandes ────────────────────────────────────
// Le marchand relie sa boutique à un Google Sheet : chaque nouvelle commande
// storefront y est ajoutée en temps réel (service account, voir storeSheetSync.js).

// GET /api/ecom/stores/:storeId/sheet-sync — config + email du service account
router.get('/:storeId/sheet-sync', requireEcomAuth, async (req, res) => {
  try {
    const store = await Store.findOne({ _id: req.params.storeId, workspaceId: req.workspaceId })
      .select('storeSheetSync')
      .lean();
    if (!store) return res.status(404).json({ success: false, message: 'Boutique non trouvée' });

    const { isSaConfigured, getSaEmail } = await import('../services/storeSheetSync.js');
    res.json({
      success: true,
      data: {
        config: store.storeSheetSync || { enabled: false, spreadsheetId: '', sheetName: '' },
        saConfigured: isSaConfigured(),
        saEmail: getSaEmail()
      }
    });
  } catch (err) {
    console.error('Erreur get sheet-sync:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/stores/:storeId/sheet-sync — { enabled, spreadsheetUrl|spreadsheetId, sheetName }
router.put('/:storeId/sheet-sync', requireEcomAuth, async (req, res) => {
  try {
    const store = await Store.findOne({ _id: req.params.storeId, workspaceId: req.workspaceId });
    if (!store) return res.status(404).json({ success: false, message: 'Boutique non trouvée' });

    const { enabled, spreadsheetUrl, spreadsheetId, sheetName } = req.body || {};
    const { extractSpreadsheetId } = await import('../services/googleSheetsImport.js');
    const resolvedId = extractSpreadsheetId(spreadsheetUrl || spreadsheetId || '');

    if (enabled === true && !resolvedId) {
      return res.status(400).json({ success: false, message: 'URL ou ID de Google Sheet invalide' });
    }

    store.storeSheetSync = {
      ...(store.storeSheetSync || {}),
      enabled: enabled === true,
      spreadsheetId: resolvedId || store.storeSheetSync?.spreadsheetId || '',
      sheetName: typeof sheetName === 'string' ? sheetName.trim() : (store.storeSheetSync?.sheetName || '')
    };
    store.markModified('storeSheetSync');
    await store.save();

    res.json({ success: true, message: 'Configuration enregistrée', data: store.storeSheetSync });
  } catch (err) {
    console.error('Erreur put sheet-sync:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/stores/:storeId/sheet-sync/test — écrit une ligne de test
router.post('/:storeId/sheet-sync/test', requireEcomAuth, async (req, res) => {
  try {
    const store = await Store.findOne({ _id: req.params.storeId, workspaceId: req.workspaceId }).lean();
    if (!store) return res.status(404).json({ success: false, message: 'Boutique non trouvée' });

    const { extractSpreadsheetId } = await import('../services/googleSheetsImport.js');
    // Permet de tester une config pas encore enregistrée (envoyée dans le body)
    const spreadsheetId = extractSpreadsheetId(
      req.body?.spreadsheetUrl || req.body?.spreadsheetId || store.storeSheetSync?.spreadsheetId || ''
    );
    const sheetName = typeof req.body?.sheetName === 'string'
      ? req.body.sheetName.trim()
      : (store.storeSheetSync?.sheetName || '');

    if (!spreadsheetId) {
      return res.status(400).json({ success: false, message: 'URL ou ID de Google Sheet invalide' });
    }

    const { testSheetSync, isSaConfigured, getSaEmail } = await import('../services/storeSheetSync.js');
    if (!isSaConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Service account Google non configuré côté serveur (GOOGLE_SHEETS_SA_KEY_JSON).'
      });
    }

    await testSheetSync(spreadsheetId, sheetName);
    await Store.updateOne(
      { _id: store._id },
      { $set: { 'storeSheetSync.lastSyncAt': new Date(), 'storeSheetSync.lastError': null } }
    );
    res.json({ success: true, message: `Ligne de test écrite dans la feuille ✓ (partagée avec ${getSaEmail()})` });
  } catch (err) {
    console.error('Erreur test sheet-sync:', err.message);
    res.status(422).json({ success: false, message: err.message });
  }
});

export default router;
