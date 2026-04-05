import express from 'express';
import Groq from 'groq-sdk';
import EcomWorkspace from '../models/Workspace.js';
import Store from '../models/Store.js';
import { requireEcomAuth, requireWorkspace } from '../middleware/ecomAuth.js';
import { requireStoreOwner } from '../middleware/storeAuth.js';

// Helper: get active Store for the current request (from activeStoreId or primaryStoreId)
async function getActiveStore(req) {
  const storeId = req.activeStoreId;
  if (storeId) {
    const store = await Store.findOne({ _id: storeId, workspaceId: req.workspaceId });
    if (store) return store;
  }
  // Fallback: primary store
  const ws = await EcomWorkspace.findById(req.workspaceId).select('primaryStoreId').lean();
  if (ws?.primaryStoreId) {
    return Store.findOne({ _id: ws.primaryStoreId, workspaceId: req.workspaceId });
  }
  return null;
}

// ─── Groq client (lazy) ──────────────────────────────────────────────────────
let _groq = null;
function getGroq() {
  if (!_groq && process.env.GROQ_API_KEY) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

// ─── Labels pour le prompt IA ────────────────────────────────────────────────
const PRODUCT_TYPE_LABELS = {
  beaute: 'Beauté & Soins (cosmétiques, skincare, maquillage)',
  fitness: 'Fitness & Sport (équipements, vêtements sport)',
  mode: 'Mode & Fashion (vêtements, accessoires, bijoux)',
  tech: 'Tech & Gadgets (électronique, accessoires tech)',
  maison: 'Maison & Déco (décoration, mobilier, rangement)',
  sante: 'Bien-être & Santé (compléments, produits naturels)',
  enfants: 'Enfants & Bébés (jouets, vêtements enfants)',
  autre: 'Produits divers',
};

// ─── Images hero — niche × région africaine (Unsplash CDN) ───────────────────
// Priorité : niche+pays → niche seul → défaut
// Clé région : 'central' (Cameroun/RDC/Congo) | 'west' (Sénégal/CI/Bénin/Togo/Mali)
//              | 'nigeria' (Nigeria/Ghana) | 'default'

const NICHE_REGION_IMAGES = {
  // ── Beauté / Cosmétique ──────────────────────────────────────────────────────
  beaute: {
    // Femme africaine skincare — Cameroun / Afrique Centrale
    central: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1920&q=80&auto=format',
    // Femme beauté Afrique de l'Ouest (Sénégal / CI)
    west:    'https://images.unsplash.com/photo-1531123414780-f74242c2b052?w=1920&q=80&auto=format',
    // Femme beauty Nigeria / Ghana
    nigeria: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=1920&q=80&auto=format',
    default: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1920&q=80&auto=format',
  },
  // ── Mode / Fashion ───────────────────────────────────────────────────────────
  mode: {
    // Tenue traditionnelle Cameroun / Afrique Centrale
    central: 'https://images.unsplash.com/photo-1589802829985-817e51171b92?w=1920&q=80&auto=format',
    // Wax / tissu africain Afrique de l'Ouest
    west:    'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=1920&q=80&auto=format',
    nigeria: 'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=1920&q=80&auto=format',
    default: 'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=1920&q=80&auto=format',
  },
  // ── Fitness / Sport ──────────────────────────────────────────────────────────
  fitness: {
    default: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=1920&q=80&auto=format',
  },
  // ── Tech / Gadgets ───────────────────────────────────────────────────────────
  tech: {
    default: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1920&q=80&auto=format',
  },
  // ── Maison / Déco ────────────────────────────────────────────────────────────
  maison: {
    default: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1920&q=80&auto=format',
  },
  // ── Bien-être / Santé ────────────────────────────────────────────────────────
  sante: {
    default: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1920&q=80&auto=format',
  },
  // ── Enfants ──────────────────────────────────────────────────────────────────
  enfants: {
    default: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1920&q=80&auto=format',
  },
  // ── Autre / Général ──────────────────────────────────────────────────────────
  autre: {
    central: 'https://images.unsplash.com/photo-1589802829985-817e51171b92?w=1920&q=80&auto=format',
    west:    'https://images.unsplash.com/photo-1531123414780-f74242c2b052?w=1920&q=80&auto=format',
    nigeria: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=1920&q=80&auto=format',
    default: 'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=1920&q=80&auto=format',
  },
};

// Pays → région
const COUNTRY_TO_REGION = {
  cameroun: 'central', gabon: 'central', rdc: 'central', congo: 'central',
  centrafrique: 'central', tchad: 'central',
  senegal: 'west', mali: 'west', burkina: 'west', togo: 'west',
  benin: 'west', guinee: 'west', mauritanie: 'west',
  // "côte d'ivoire" après normalisation → "cote d ivoire"
  'cote d ivoire': 'west', 'ivory coast': 'west',
  nigeria: 'nigeria', ghana: 'nigeria',
};

function normalizeCountryKey(country) {
  if (!country) return '';
  return country.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function injectHeroImage(sections, productType, country) {
  const countryKey = normalizeCountryKey(country);

  // Trouver la région à partir du pays (exact puis partiel)
  let region = COUNTRY_TO_REGION[countryKey];
  if (!region) {
    const match = Object.keys(COUNTRY_TO_REGION).find(k =>
      countryKey.includes(k) || k.includes(countryKey)
    );
    region = match ? COUNTRY_TO_REGION[match] : 'default';
  }

  const nicheMap = NICHE_REGION_IMAGES[productType] || NICHE_REGION_IMAGES.autre;

  // Priorité : niche+région → niche défaut → défaut global
  const img = nicheMap[region] || nicheMap.default
    || NICHE_REGION_IMAGES.autre.default;

  return sections.map(sec => {
    if (sec.type === 'hero' && !sec.config?.backgroundImage) {
      return { ...sec, config: { ...sec.config, backgroundImage: img } };
    }
    return sec;
  });
}

const TONE_LABELS = {
  premium: 'Premium & Luxe — élégance, exclusivité, raffinement. Vocabulaire haut de gamme.',
  naturel: 'Naturel & Authentique — sincérité, bio, transparence. Ton doux et honnête.',
  dynamique: 'Dynamique & Énergique — enthousiasme, action, jeunesse. Exclamations, rythme.',
  confiance: 'Confiance & Solidité — sérieux, garanties, preuves. Ton rassurant et factuel.',
  tendance: 'Tendance & Fashion — moderne, hype, lifestyle. Ton influenceur, lifestyle.',
  chaleureux: 'Chaleureux & Proche — communauté, famille, bienveillance. Ton ami proche.',
};

// ─── Fallback sections si Groq échoue ────────────────────────────────────────
function buildFallbackSections(s) {
  const storeName = s.storeName || 'Notre Boutique';
  const productType = PRODUCT_TYPE_LABELS[s.productType] || 'Produits de qualité';
  const city = s.city || 'votre ville';
  const whatsapp = s.storeWhatsApp || '';

  return [
    {
      id: 'hero-1', type: 'hero', visible: true,
      config: {
        title: s.storeDescription 
          ? `${storeName}`
          : `Bienvenue chez ${storeName}`,
        subtitle: s.storeDescription || `Découvrez notre sélection exclusive. Qualité garantie, livraison rapide partout.`,
        ctaText: 'Découvrir nos produits',
        ctaLink: '/products',
        alignment: 'center',
        backgroundImage: '',
      }
    },
    {
      id: 'badges-1', type: 'badges', visible: true,
      config: {
        items: [
          { icon: '🚚', title: 'Livraison Rapide', desc: 'Expédition sous 24-48h dans toute la région' },
          { icon: '✅', title: 'Qualité Garantie', desc: 'Produits authentiques et certifiés' },
          { icon: '💬', title: 'Support WhatsApp', desc: 'Réponse rapide à toutes vos questions' },
          { icon: '🔄', title: 'Retours Faciles', desc: 'Satisfait ou remboursé sous 7 jours' },
        ]
      }
    },
    {
      id: 'products-1', type: 'products', visible: true,
      config: {
        title: 'Nos Produits',
        subtitle: 'Une sélection soigneusement choisie pour vous',
        layout: 'grid',
        columns: 3,
        showPrice: true,
        showAddToCart: true,
        limit: 6
      }
    },
    {
      id: 'features-1', type: 'features', visible: true,
      config: {
        title: 'Pourquoi nous choisir ?',
        subtitle: 'Des avantages qui font la différence',
        items: [
          { icon: '⭐', title: 'Qualité Premium', desc: 'Nous sélectionnons uniquement les meilleurs produits pour vous garantir une satisfaction totale.' },
          { icon: '💰', title: 'Prix Compétitifs', desc: 'Des tarifs justes et transparents, sans surprise. Le meilleur rapport qualité-prix.' },
          { icon: '🛡️', title: 'Paiement Sécurisé', desc: 'Vos transactions sont protégées. Payez en toute confiance.' },
          { icon: '❤️', title: 'Service Client Dédié', desc: 'Une équipe à votre écoute pour vous accompagner avant et après votre achat.' },
        ]
      }
    },
    {
      id: 'testimonials-1', type: 'testimonials', visible: true,
      config: {
        title: 'Ce que disent nos clients',
        items: [
          { name: 'Marie K.', location: city, content: 'Excellente boutique ! Produits de qualité et livraison rapide. Je recommande vivement.', rating: 5 },
          { name: 'Paul M.', location: city, content: 'Service client au top, ils ont répondu à toutes mes questions. Très satisfait de mon achat.', rating: 5 },
          { name: 'Aïcha B.', location: city, content: 'Belle découverte ! Les produits correspondent parfaitement à la description. Merci !', rating: 5 },
        ],
        showRating: true
      }
    },
    {
      id: 'faq-1', type: 'faq', visible: true,
      config: {
        title: 'Questions Fréquentes',
        items: [
          { question: 'Quels sont les délais de livraison ?', answer: 'Nous livrons généralement sous 24 à 48 heures dans les grandes villes et sous 3 à 5 jours dans les autres localités.' },
          { question: 'Comment passer commande ?', answer: 'Vous pouvez commander directement sur notre site ou nous contacter via WhatsApp pour une assistance personnalisée.' },
          { question: 'Quels modes de paiement acceptez-vous ?', answer: 'Nous acceptons les paiements Mobile Money, carte bancaire et paiement à la livraison dans certaines zones.' },
          { question: 'Puis-je retourner un produit ?', answer: 'Oui, vous disposez de 7 jours pour retourner un produit non utilisé dans son emballage d\'origine.' },
        ]
      }
    },
    {
      id: 'contact-1', type: 'contact', visible: true,
      config: {
        title: 'Besoin d\'aide ?',
        subtitle: 'Notre équipe est disponible pour répondre à toutes vos questions',
        whatsapp: whatsapp,
        address: s.city && s.country ? `${s.city}, ${s.country}` : '',
      }
    }
  ];
}

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// STORE MANAGEMENT ROUTES — Configure storefront (authenticated, admin only)
// ═══════════════════════════════════════════════════════════════════════════════

// Reserved subdomains that cannot be claimed
const RESERVED_SUBDOMAINS = [
  'www', 'api', 'app', 'admin', 'dashboard', 'mail', 'ftp',
  'store', 'shop', 'scalor', 'help', 'support', 'docs', 'blog',
  'static', 'cdn', 'assets', 'dev', 'staging', 'test'
];

/**
 * GET /store-manage/config
 * Get current store configuration for the workspace.
 */
router.get('/config', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    // Try Store first (multi-store), fallback to Workspace (legacy)
    const store = await getActiveStore(req);
    const workspace = await EcomWorkspace.findById(req.workspaceId).select('name subdomain storeSettings').lean();

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    const source = store || workspace;
    const subdomain = store?.subdomain || workspace?.subdomain || null;
    const defaultSettings = {
      isStoreEnabled: false, storeName: '', storeDescription: '', storeLogo: '', storeBanner: '',
      storePhone: '', storeWhatsApp: '', storeThemeColor: '#0F6B4F', storeCurrency: 'XAF',
      productType: '', audience: { gender: [], ageRange: [], region: [], origin: [] },
      tone: '', city: '', country: '', secondaryColor: '', productDescription: ''
    };

    res.json({
      success: true,
      data: {
        storeId: store?._id || null,
        name: source.name || workspace.name,
        subdomain,
        storeSettings: source.storeSettings || defaultSettings,
        storeUrl: subdomain ? `https://${subdomain}.scalor.net` : null
      }
    });
  } catch (error) {
    console.error('Erreur GET /store-manage/config:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * PUT /store-manage/config
 * Update store configuration (name, description, logo, etc).
 */
router.put('/config', requireEcomAuth, requireWorkspace, requireStoreOwner, async (req, res) => {
  try {
    const {
      storeName, storeDescription, storeLogo, storeBanner,
      storePhone, storeWhatsApp, storeThemeColor, storeCurrency,
      isStoreEnabled,
      // Nouveaux champs pour génération IA
      productType, audience, tone, city, country,
      secondaryColor, productDescription,
      // Product page builder config (visual builder)
      productPageConfig
    } = req.body;

    const update = {};

    if (storeName !== undefined) update['storeSettings.storeName'] = storeName;
    if (storeDescription !== undefined) update['storeSettings.storeDescription'] = storeDescription;
    if (storeLogo !== undefined) update['storeSettings.storeLogo'] = storeLogo;
    if (storeBanner !== undefined) update['storeSettings.storeBanner'] = storeBanner;
    if (storePhone !== undefined) update['storeSettings.storePhone'] = storePhone;
    if (storeWhatsApp !== undefined) update['storeSettings.storeWhatsApp'] = storeWhatsApp;
    if (storeThemeColor !== undefined) {
      update['storeSettings.storeThemeColor'] = storeThemeColor;
      // Sync primaryColor so it always takes priority over legacy storeThemeColor in the lookup chain
      update['storeSettings.primaryColor'] = storeThemeColor;
    }
    if (storeCurrency !== undefined) update['storeSettings.storeCurrency'] = storeCurrency;
    if (isStoreEnabled !== undefined) update['storeSettings.isStoreEnabled'] = isStoreEnabled;
    // Nouveaux champs
    if (productType !== undefined) update['storeSettings.productType'] = productType;
    if (audience !== undefined) update['storeSettings.audience'] = audience;
    if (tone !== undefined) update['storeSettings.tone'] = tone;
    if (city !== undefined) update['storeSettings.city'] = city;
    if (country !== undefined) update['storeSettings.country'] = country;
    if (secondaryColor !== undefined) update['storeSettings.secondaryColor'] = secondaryColor;
    if (productDescription !== undefined) update['storeSettings.productDescription'] = productDescription;
    // Product page builder config
    if (productPageConfig !== undefined) update['storeSettings.productPageConfig'] = productPageConfig;

    // Write to Store if available, fallback to Workspace (legacy)
    const store = await getActiveStore(req);
    let subdomain;
    if (store) {
      await Store.findByIdAndUpdate(store._id, { $set: update });
      const updated = await Store.findById(store._id).select('name subdomain storeSettings').lean();
      subdomain = updated?.subdomain || null;
      res.json({
        success: true,
        message: 'Configuration boutique mise à jour',
        data: {
          storeId: store._id,
          name: updated?.name || updated?.storeSettings?.storeName,
          subdomain,
          storeSettings: updated?.storeSettings,
          storeUrl: subdomain ? `https://${subdomain}.scalor.net` : null
        }
      });
    } else {
      const workspace = await EcomWorkspace.findByIdAndUpdate(
        req.workspaceId, { $set: update }, { new: true }
      ).select('name subdomain storeSettings').lean();
      if (!workspace) return res.status(404).json({ success: false, message: 'Workspace introuvable' });
      subdomain = workspace.subdomain;
      res.json({
        success: true,
        message: 'Configuration boutique mise à jour',
        data: {
          name: workspace.name,
          subdomain,
          storeSettings: workspace.storeSettings,
          storeUrl: subdomain ? `https://${subdomain}.scalor.net` : null
        }
      });
    }
  } catch (error) {
    console.error('Erreur PUT /store-manage/config:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * PUT /store-manage/subdomain
 * Set or update the store subdomain.
 * Validates uniqueness and format.
 */
router.put('/subdomain', requireEcomAuth, requireWorkspace, requireStoreOwner, async (req, res) => {
  try {
    let { subdomain } = req.body;

    if (!subdomain) {
      return res.status(400).json({ success: false, message: 'Sous-domaine requis' });
    }

    // Sanitize: lowercase, alphanumeric + hyphens only, 3-30 chars
    subdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-|-$/g, '');

    if (subdomain.length < 3 || subdomain.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Le sous-domaine doit contenir entre 3 et 30 caractères'
      });
    }

    if (RESERVED_SUBDOMAINS.includes(subdomain)) {
      return res.status(400).json({
        success: false,
        message: 'Ce sous-domaine est réservé'
      });
    }

    // Check uniqueness across Store + Workspace
    const [storeConflict, wsConflict] = await Promise.all([
      Store.findOne({ subdomain, workspaceId: { $ne: req.workspaceId } }).select('_id').lean(),
      EcomWorkspace.findOne({ subdomain, _id: { $ne: req.workspaceId } }).select('_id').lean()
    ]);

    if (storeConflict || wsConflict) {
      return res.status(409).json({ success: false, message: 'Ce sous-domaine est déjà pris' });
    }

    // Update Store if available, otherwise Workspace
    const store = await getActiveStore(req);
    if (store) {
      await Store.findByIdAndUpdate(store._id, { $set: { subdomain } });
    }
    // Always keep workspace.subdomain in sync for legacy public resolver fallback
    const workspace = await EcomWorkspace.findByIdAndUpdate(
      req.workspaceId, { $set: { subdomain } }, { new: true }
    ).select('subdomain').lean();

    res.json({
      success: true,
      message: 'Sous-domaine configuré',
      data: {
        subdomain: workspace.subdomain,
        storeUrl: `https://${workspace.subdomain}.scalor.net`
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Ce sous-domaine est déjà pris'
      });
    }
    console.error('Erreur PUT /store-manage/subdomain:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * Generate subdomain from store name
 * Converts store name to URL-friendly subdomain format
 */
function generateSubdomainFromStoreName(storeName) {
  if (!storeName) return '';
  
  return storeName
    .toLowerCase()
    .normalize('NFD')                    // Remove accents
    .replace(/[\u0300-\u036f]/g, '')     // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '')         // Keep only letters, numbers, spaces
    .replace(/\s+/g, '-')                 // Replace spaces with hyphens
    .replace(/-+/g, '-')                  // Replace multiple hyphens with single
    .replace(/^-|-$/g, '')                // Remove leading/trailing hyphens
    .substring(0, 30);                    // Limit to 30 chars
}

/**
 * POST /store-manage/generate-subdomain
 * Generate subdomain from store name and check availability
 */
router.post('/generate-subdomain', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const { storeName } = req.body;
    
    if (!storeName || storeName.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nom de boutique requis' 
      });
    }

    let subdomain = generateSubdomainFromStoreName(storeName);
    
    if (subdomain.length < 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le nom de boutique est trop court pour générer un sous-domaine' 
      });
    }

    if (RESERVED_SUBDOMAINS.includes(subdomain)) {
      // Add number suffix if reserved
      let suffix = 1;
      let originalSubdomain = subdomain;
      do {
        subdomain = `${originalSubdomain}-${suffix}`.substring(0, 30);
        suffix++;
      } while (RESERVED_SUBDOMAINS.includes(subdomain) && suffix < 100);
    }

    // Check availability and add number suffix if taken
    let finalSubdomain = subdomain;
    let suffix = 1;
    let isAvailable = false;
    
    while (!isAvailable && suffix <= 99) {
      const [wsEx, storeEx] = await Promise.all([
        EcomWorkspace.findOne({ subdomain: finalSubdomain, _id: { $ne: req.workspaceId } }).select('_id').lean(),
        Store.findOne({ subdomain: finalSubdomain }).select('_id').lean()
      ]);
      if (!wsEx && !storeEx) {
        isAvailable = true;
      } else {
        finalSubdomain = `${subdomain}-${suffix}`.substring(0, 30);
        suffix++;
      }
    }

    if (!isAvailable) {
      return res.status(409).json({ 
        success: false, 
        message: 'Impossible de générer un sous-domaine disponible' 
      });
    }

    res.json({
      success: true,
      data: {
        subdomain: finalSubdomain,
        fullDomain: `${finalSubdomain}.scalor.net`,
        storeUrl: `https://${finalSubdomain}.scalor.net`
      }
    });
  } catch (error) {
    console.error('Erreur POST /store-manage/generate-subdomain:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * GET /store-manage/subdomain/check/:subdomain
 * Check if a subdomain is available.
 */
router.get('/subdomain/check/:subdomain', requireEcomAuth, async (req, res) => {
  try {
    let { subdomain } = req.params;
    subdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');

    if (subdomain.length < 3 || RESERVED_SUBDOMAINS.includes(subdomain)) {
      return res.json({ success: true, data: { available: false } });
    }

    const [wsExisting, storeExisting] = await Promise.all([
      EcomWorkspace.findOne({ subdomain }).select('_id').lean(),
      Store.findOne({ subdomain }).select('_id').lean()
    ]);
    res.json({
      success: true,
      data: { available: !wsExisting && !storeExisting }
    });
  } catch (error) {
    console.error('Erreur GET /store-manage/subdomain/check:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * POST /store-manage/generate-homepage
 * Generate a complete AI homepage using store configuration.
 * Uses Groq to produce hero, trust badges, products, why-us, testimonials, FAQ, contact.
 */
router.post('/generate-homepage', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const workspace = await EcomWorkspace.findById(req.workspaceId)
      .select('storeSettings')
      .lean();

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    // Merge req.body over DB settings so wizard data always takes priority
    const s = { ...(workspace.storeSettings || {}), ...req.body };
    const groq = getGroq();

    if (!groq) {
      // Fallback immédiat si pas de clé Groq
      return res.json({ success: true, sections: buildFallbackSections(s) });
    }

    const productTypeLabel = PRODUCT_TYPE_LABELS[s.productType] || s.productType || 'Produits divers';
    const toneLabel = TONE_LABELS[s.tone] || s.tone || 'Chaleureux & Proche';
    const genders = (s.audience?.gender || []).join(', ') || 'tous';
    const ages = (s.audience?.ageRange || []).join(', ') || 'tous âges';
    const regions = (s.audience?.region || []).join(', ') || 'international';
    const origins = (s.audience?.origin || []).join(', ') || '';

    const prompt = `Tu es un expert en copywriting pour le e-commerce africain. Tu crées des pages de vente pour des boutiques en ligne qui s'adressent à des consommateurs africains (Cameroun, Côte d'Ivoire, Sénégal, RDC, Bénin, Togo, etc.).

BOUTIQUE:
- Nom: ${s.storeName || 'Notre Boutique'}
- Catégorie: ${productTypeLabel}
- Produit phare: ${s.productDescription || ''}
- Description: ${s.storeDescription || ''}
- Ton: ${toneLabel}
- Audience: ${genders} | ${ages} | ${regions}
- Ville/Pays: ${s.city || ''}${s.city && s.country ? ', ' : ''}${s.country || ''}
- WhatsApp: ${s.storeWhatsApp || ''}

CONTEXTE AFRICAIN OBLIGATOIRE:
- Le copywriting doit résonner avec la culture africaine locale : valeurs familiales, communauté, fierté locale, beauté naturelle africaine, excellence
- Références réalistes : livraison à domicile, paiement à la livraison ou Mobile Money (MTN, Orange), commande WhatsApp
- Prénoms et noms africains authentiques pour les témoignages (ex: Amina, Fatou, Kouassi, Brice, etc.)
- Villes africaines réelles pour les témoignages selon la zone: ${regions}
- Aucune référence western générique — tout doit être ancré dans le quotidien africain
- Le titre hero doit être percutant, différenciant, avec un angle émotionnel fort lié à la niche

Génère la page en JSON: {"sections": [...]}

Sections dans cet ordre:

1. TYPE "hero"
config: { title (accroche puissante 5-10 mots, émotionnelle, liée à la transformation qu'apporte le produit), subtitle (1-2 phrases de promesse concrète, bénéfice client réel), ctaText (appel à l'action actif et engageant), ctaLink: "/products", alignment: "center", backgroundImage: "" }

2. TYPE "badges"
config: { items: [ 4 badges de confiance {icon: "emoji", title: "3-4 mots", desc: "1 phrase rassurante"} : livraison rapide (délais locaux), qualité certifiée, support WhatsApp réactif, retours acceptés ] }

3. TYPE "products"
config: { title (angle niche), subtitle (accroche produits), layout: "grid", columns: 3, showPrice: true, showAddToCart: true, limit: 6 }

4. TYPE "features"
config: { title (pourquoi nous, ancré dans la réalité africaine), subtitle, items: [ 4 avantages {icon: "emoji", title, desc (2 phrases spécifiques à la boutique et au marché local)} ] }

5. TYPE "testimonials"
config: { title: "Ils nous font confiance", items: [ 3 {name: "prénom+nom africain authentique", location: "ville réelle ${regions}", content: "témoignage vivant 50-80 mots, ton naturel africain, mentionne un bénéfice concret", rating: 5} ] }

6. TYPE "faq"
config: { title: "Vos questions, nos réponses", items: [ 4 {question: "vraie question client africain", answer: "réponse claire, rassurante, mentionne Mobile Money/livraison locale si pertinent"} ] }

7. TYPE "contact"
config: { title: "Parlons-en sur WhatsApp", subtitle: "On vous répond en moins de 10 minutes !", whatsapp: "${s.storeWhatsApp || ''}", address: "${s.city || ''}${s.city && s.country ? ', ' : ''}${s.country || ''}", showForm: false }

RÈGLES:
- 100% français, zéro anglais
- Ton: ${toneLabel.split('—')[0].trim()}
- IDs: "hero-1", "badges-1", "products-1", "features-1", "testimonials-1", "faq-1", "contact-1"
- visible: true
- JSON pur uniquement, sans markdown`;

    let sections;
    try {
      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Tu es un expert copywriter e-commerce. Tu génères uniquement du JSON valide, jamais de texte en dehors du JSON.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 4000,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const raw = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      sections = parsed.sections;

      if (!Array.isArray(sections) || sections.length === 0) {
        throw new Error('Sections invalides retournées par le modèle');
      }

      // S'assurer que toutes les sections ont visible: true et un id
      sections = sections.map((sec, i) => ({
        ...sec,
        id: sec.id || `${sec.type}-${i + 1}`,
        visible: true,
      }));
      sections = injectHeroImage(sections, s.productType, s.country);

      console.log(`✅ AI homepage generated: ${sections.length} sections for workspace ${req.workspaceId}`);
    } catch (aiError) {
      console.warn('⚠️ Groq homepage generation failed, using fallback:', aiError.message);
      sections = buildFallbackSections(s);
    }

    res.json({ success: true, sections });
  } catch (error) {
    console.error('Erreur POST /store-manage/generate-homepage:', error.message);
    res.status(500).json({ success: false, message: 'Erreur lors de la génération de la page' });
  }
});

/**
 * POST /store-manage/regenerate-homepage
 * Re-generate homepage for an existing boutique.
 * Resets storePages then calls the same AI generation logic.
 */
router.post('/regenerate-homepage', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    // Reset existing pages first (Store + Workspace)
    const activeStoreForRegen = await getActiveStore(req);
    if (activeStoreForRegen) {
      await Store.findByIdAndUpdate(activeStoreForRegen._id, { $set: { storePages: null } });
    }
    await EcomWorkspace.findByIdAndUpdate(req.workspaceId, { $set: { storePages: null } });

    const workspace = await EcomWorkspace.findById(req.workspaceId)
      .select('storeSettings')
      .lean();

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    // Merge req.body over DB settings so caller data always takes priority
    const s = { ...(workspace.storeSettings || {}), ...req.body };
    const groq = getGroq();

    if (!groq) {
      return res.json({ success: true, sections: buildFallbackSections(s) });
    }

    const productTypeLabel = PRODUCT_TYPE_LABELS[s.productType] || s.productType || 'Produits divers';
    const toneLabel = TONE_LABELS[s.tone] || s.tone || 'Chaleureux & Proche';
    const genders = (s.audience?.gender || []).join(', ') || 'tous';
    const ages = (s.audience?.ageRange || []).join(', ') || 'tous âges';
    const regions = (s.audience?.region || []).join(', ') || 'international';
    const origins = (s.audience?.origin || []).join(', ') || '';

    const prompt = `Tu es un expert en copywriting pour le e-commerce africain. Tu crées des pages de vente pour des boutiques en ligne qui s'adressent à des consommateurs africains (Cameroun, Côte d'Ivoire, Sénégal, RDC, Bénin, Togo, etc.).

BOUTIQUE:
- Nom: ${s.storeName || 'Notre Boutique'}
- Catégorie: ${productTypeLabel}
- Produit phare: ${s.productDescription || ''}
- Description: ${s.storeDescription || ''}
- Ton: ${toneLabel}
- Audience: ${genders} | ${ages} | ${regions}
- Ville/Pays: ${s.city || ''}${s.city && s.country ? ', ' : ''}${s.country || ''}
- WhatsApp: ${s.storeWhatsApp || ''}

CONTEXTE AFRICAIN OBLIGATOIRE:
- Le copywriting doit résonner avec la culture africaine locale : valeurs familiales, communauté, fierté locale, beauté naturelle africaine, excellence
- Références réalistes : livraison à domicile, paiement à la livraison ou Mobile Money (MTN, Orange), commande WhatsApp
- Prénoms et noms africains authentiques pour les témoignages (ex: Amina, Fatou, Kouassi, Brice, etc.)
- Villes africaines réelles pour les témoignages selon la zone: ${regions}
- Aucune référence western générique — tout doit être ancré dans le quotidien africain
- Le titre hero doit être percutant, différenciant, avec un angle émotionnel fort lié à la niche

Génère la page en JSON: {"sections": [...]}

Sections dans cet ordre:

1. TYPE "hero"
config: { title (accroche puissante 5-10 mots, émotionnelle, liée à la transformation qu'apporte le produit), subtitle (1-2 phrases de promesse concrète, bénéfice client réel), ctaText (appel à l'action actif et engageant), ctaLink: "/products", alignment: "center", backgroundImage: "" }

2. TYPE "badges"
config: { items: [ 4 badges de confiance {icon: "emoji", title: "3-4 mots", desc: "1 phrase rassurante"} : livraison rapide (délais locaux), qualité certifiée, support WhatsApp réactif, retours acceptés ] }

3. TYPE "products"
config: { title (angle niche), subtitle (accroche produits), layout: "grid", columns: 3, showPrice: true, showAddToCart: true, limit: 6 }

4. TYPE "features"
config: { title (pourquoi nous, ancré dans la réalité africaine), subtitle, items: [ 4 avantages {icon: "emoji", title, desc (2 phrases spécifiques à la boutique et au marché local)} ] }

5. TYPE "testimonials"
config: { title: "Ils nous font confiance", items: [ 3 {name: "prénom+nom africain authentique", location: "ville réelle ${regions}", content: "témoignage vivant 50-80 mots, ton naturel africain, mentionne un bénéfice concret", rating: 5} ] }

6. TYPE "faq"
config: { title: "Vos questions, nos réponses", items: [ 4 {question: "vraie question client africain", answer: "réponse claire, rassurante, mentionne Mobile Money/livraison locale si pertinent"} ] }

7. TYPE "contact"
config: { title: "Parlons-en sur WhatsApp", subtitle: "On vous répond en moins de 10 minutes !", whatsapp: "${s.storeWhatsApp || ''}", address: "${s.city || ''}${s.city && s.country ? ', ' : ''}${s.country || ''}", showForm: false }

RÈGLES:
- 100% français, zéro anglais
- Ton: ${toneLabel.split('—')[0].trim()}
- IDs: "hero-1", "badges-1", "products-1", "features-1", "testimonials-1", "faq-1", "contact-1"
- visible: true
- JSON pur uniquement, sans markdown`;

    let sections;
    try {
      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Tu es un expert copywriter e-commerce. Tu génères uniquement du JSON valide.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 4000,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const raw = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      sections = parsed.sections;
      if (!Array.isArray(sections) || sections.length === 0) throw new Error('Sections invalides');
      sections = sections.map((sec, i) => ({ ...sec, id: sec.id || `${sec.type}-${i + 1}`, visible: true }));
      sections = injectHeroImage(sections, s.productType, s.country);
    } catch (aiError) {
      console.warn('⚠️ Groq regenerate failed, using fallback:', aiError.message);
      sections = buildFallbackSections(s);
    }

    // Save the new sections — to Store if available, else Workspace
    const activeStore = await getActiveStore(req);
    if (activeStore) {
      await Store.findByIdAndUpdate(activeStore._id, { $set: { storePages: { sections } } });
    } else {
      await EcomWorkspace.findByIdAndUpdate(req.workspaceId, { $set: { storePages: { sections } } });
    }

    console.log(`✅ Homepage regenerated: ${sections.length} sections for workspace ${req.workspaceId}`);
    res.json({ success: true, sections });
  } catch (error) {
    console.error('Erreur POST /store-manage/regenerate-homepage:', error.message);
    res.status(500).json({ success: false, message: 'Erreur lors de la régénération' });
  }
});

export default router;
