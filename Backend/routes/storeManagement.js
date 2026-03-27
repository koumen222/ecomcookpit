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
        ctaText: 'Voir nos produits', ctaLink: '#products', alignment: 'center', backgroundImage: '',
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

    const prompt = `Tu es un expert en copywriting e-commerce et marketing digital. Tu génères des pages d'accueil pour boutiques en ligne vendant des produits physiques.

INFORMATIONS DE LA BOUTIQUE:
- Nom: ${s.storeName || 'Notre Boutique'}
- Catégorie: ${productTypeLabel}
- Produit phare: ${s.productDescription || ''}
- Description boutique: ${s.storeDescription || ''}
- Ton/Style: ${toneLabel}
- Audience: Genre: ${genders} | Âge: ${ages} | Zone: ${regions}${origins ? ` | Origine: ${origins}` : ''}
- Localisation: ${s.city || ''}${s.city && s.country ? ', ' : ''}${s.country || ''}
- Contact WhatsApp: ${s.storeWhatsApp || ''}

Génère une page d'accueil complète et persuasive en JSON avec exactement ce format:
{"sections": [...]}

Génère ces 7 sections dans cet ordre exact:

1. TYPE "hero" — config: {title (H1 accrocheur 5-10 mots), subtitle (sous-titre convaincant 1-2 phrases), ctaText (CTA bouton), ctaLink: "#products", alignment: "center", backgroundImage: ""}

2. TYPE "text" — section badges de confiance. config: {title: "Pourquoi des milliers de clients nous font confiance", content (markdown avec 4 badges: livraison rapide, qualité garantie, support WhatsApp, retours faciles — chacun avec emoji, titre en gras, 1 phrase), alignment: "center", backgroundColor: "#F9FAFB"}

3. TYPE "products" — config: {title (titre section produits adapté à la niche), subtitle (sous-titre engageant), layout: "grid", columns: 3, showPrice: true, showAddToCart: true, limit: 6}

4. TYPE "text" — section "Pourquoi nous choisir". config: {title (accrocheur selon le ton), content (markdown avec 4-5 arguments forts avec emojis, chacun en gras suivi d'une phrase d'explication), alignment: "left", backgroundColor: "#FFFFFF"}

5. TYPE "testimonials" — config: {title: "Ce que disent nos clients", items: (tableau de 3 témoignages avec name, location (ville réaliste de la zone ${regions}), content (60-100 mots, naturel et authentique), rating: 5), layout: "grid", showRating: true}

6. TYPE "faq" — config: {title: "Questions fréquentes", items: (tableau de 4 questions/réponses réalistes pour la niche et la région)}

7. TYPE "contact" — config: {title: "Contactez-nous", subtitle: "Nous répondons en moins de 30 minutes !", whatsapp: "${s.storeWhatsApp || ''}", address: "${s.city || ''}${s.city && s.country ? ', ' : ''}${s.country || ''}", showForm: true}

RÈGLES:
- Tout en français, zéro anglais dans le contenu visible
- Ton adapté: ${toneLabel.split('—')[0].trim()}
- Copy persuasif et naturel pour l'audience: ${genders}, ${ages}, zone ${regions}
- IDs uniques pour chaque section: "hero-1", "trust-1", "products-1", "why-us-1", "testimonials-1", "faq-1", "contact-1"
- visible: true pour toutes les sections
- Retourne UNIQUEMENT le JSON, rien d'autre`;

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

export default router;
