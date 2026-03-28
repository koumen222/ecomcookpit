import express from 'express';
import Groq from 'groq-sdk';
import EcomWorkspace from '../models/Workspace.js';
import { requireEcomAuth, requireWorkspace } from '../middleware/ecomAuth.js';
import { requireStoreOwner } from '../middleware/storeAuth.js';

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

// ─── Images hero — personnes africaines (Unsplash CDN) ────────────────────────
const NICHE_HERO_IMAGES = {
  // Femme africaine beauty / skincare naturelle
  beaute:  'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1920&q=80&auto=format',
  // Femme africaine sport / fitness
  fitness: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=1920&q=80&auto=format',
  // Mode africaine colorée / wax
  mode:    'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=1920&q=80&auto=format',
  // Jeune africain tech / laptop
  tech:    'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1920&q=80&auto=format',
  // Intérieur africain chaleureux
  maison:  'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1920&q=80&auto=format',
  // Femme africaine bien-être / nature
  sante:   'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1920&q=80&auto=format',
  // Enfants africains joyeux
  enfants: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1920&q=80&auto=format',
  // Marché / commerce africain
  autre:   'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=1920&q=80&auto=format',
};

function injectHeroImage(sections, productType) {
  const img = NICHE_HERO_IMAGES[productType] || NICHE_HERO_IMAGES.autre;
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
  return [
    {
      id: 'hero-1', type: 'hero', visible: true,
      config: {
        title: `Bienvenue chez ${s.storeName || 'notre boutique'}`,
        subtitle: s.storeDescription || 'Découvrez nos produits de qualité, livrés rapidement.',
        ctaText: 'Voir nos produits', ctaLink: '/products', alignment: 'center', backgroundImage: '',
      }
    },
    {
      id: 'products-1', type: 'products', visible: true,
      config: { title: 'Nos Produits Phares', subtitle: 'Une sélection soigneusement choisie pour vous', layout: 'grid', columns: 3, showPrice: true, showAddToCart: true, limit: 6 }
    },
    {
      id: 'contact-1', type: 'contact', visible: true,
      config: { title: 'Contactez-nous', subtitle: 'Une question ? Nous sommes là pour vous !', whatsapp: s.storeWhatsApp || '', showForm: true }
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
    const workspace = await EcomWorkspace.findById(req.workspaceId)
      .select('name subdomain storeSettings')
      .lean();

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    res.json({
      success: true,
      data: {
        name: workspace.name,
        subdomain: workspace.subdomain || null,
        storeSettings: workspace.storeSettings || {
          isStoreEnabled: false,
          storeName: '',
          storeDescription: '',
          storeLogo: '',
          storeBanner: '',
          storePhone: '',
          storeWhatsApp: '',
          storeThemeColor: '#0F6B4F',
          storeCurrency: 'XAF',
          // Nouveaux champs
          productType: '',
          audience: { gender: [], ageRange: [], region: [], origin: [] },
          tone: '',
          city: '',
          country: '',
          secondaryColor: '',
          productDescription: ''
        },
        storeUrl: workspace.subdomain ? `https://${workspace.subdomain}.scalor.net` : null
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
      secondaryColor, productDescription
    } = req.body;

    const update = {};

    if (storeName !== undefined) update['storeSettings.storeName'] = storeName;
    if (storeDescription !== undefined) update['storeSettings.storeDescription'] = storeDescription;
    if (storeLogo !== undefined) update['storeSettings.storeLogo'] = storeLogo;
    if (storeBanner !== undefined) update['storeSettings.storeBanner'] = storeBanner;
    if (storePhone !== undefined) update['storeSettings.storePhone'] = storePhone;
    if (storeWhatsApp !== undefined) update['storeSettings.storeWhatsApp'] = storeWhatsApp;
    if (storeThemeColor !== undefined) update['storeSettings.storeThemeColor'] = storeThemeColor;
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

    const workspace = await EcomWorkspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: update },
      { new: true }
    ).select('name subdomain storeSettings').lean();

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    res.json({
      success: true,
      message: 'Configuration boutique mise à jour',
      data: {
        name: workspace.name,
        subdomain: workspace.subdomain,
        storeSettings: workspace.storeSettings,
        storeUrl: workspace.subdomain ? `https://${workspace.subdomain}.scalor.net` : null
      }
    });
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

    // Check uniqueness
    const existing = await EcomWorkspace.findOne({
      subdomain,
      _id: { $ne: req.workspaceId }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Ce sous-domaine est déjà pris'
      });
    }

    const workspace = await EcomWorkspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: { subdomain } },
      { new: true }
    ).select('name subdomain storeSettings').lean();

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
      const existing = await EcomWorkspace.findOne({
        subdomain: finalSubdomain,
        _id: { $ne: req.workspaceId }
      }).select('_id').lean();
      
      if (!existing) {
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

    const existing = await EcomWorkspace.findOne({ subdomain }).select('_id').lean();
    res.json({
      success: true,
      data: { available: !existing }
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

    const s = workspace.storeSettings || {};
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
      sections = injectHeroImage(sections, s.productType);

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
    // Reset existing pages first
    await EcomWorkspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: { storePages: null } }
    );

    const workspace = await EcomWorkspace.findById(req.workspaceId)
      .select('storeSettings')
      .lean();

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    const s = workspace.storeSettings || {};
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
      sections = injectHeroImage(sections, s.productType);
    } catch (aiError) {
      console.warn('⚠️ Groq regenerate failed, using fallback:', aiError.message);
      sections = buildFallbackSections(s);
    }

    // Save the new sections
    await EcomWorkspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: { storePages: { sections } } }
    );

    console.log(`✅ Homepage regenerated: ${sections.length} sections for workspace ${req.workspaceId}`);
    res.json({ success: true, sections });
  } catch (error) {
    console.error('Erreur POST /store-manage/regenerate-homepage:', error.message);
    res.status(500).json({ success: false, message: 'Erreur lors de la régénération' });
  }
});

export default router;
