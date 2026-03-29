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
        ctaLink: '#products',
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

Génère une page d'accueil complète et persuasive en JSON: {"sections": [...]}

Génère exactement ces 7 sections dans cet ordre:

1. TYPE "hero"
config: { title (H1 percutant 5-10 mots, adapté niche+ton), subtitle (promesse convaincante 1-2 phrases), ctaText (texte bouton CTA actif), ctaLink: "#products", alignment: "center", backgroundImage: "" }

2. TYPE "badges"
config: { items: [ exactement 4 objets {icon: "emoji", title: "titre court 3-4 mots", desc: "1 phrase"} pour: livraison rapide, qualité garantie, support WhatsApp, retours faciles ] }

3. TYPE "products"
config: { title (titre section produits adapté niche), subtitle (accroche engageante), layout: "grid", columns: 3, showPrice: true, showAddToCart: true, limit: 6 }

4. TYPE "features"
config: { title (titre "Pourquoi nous choisir" adapté au ton), subtitle (sous-titre), items: [ exactement 4 objets {icon: "emoji", title: "titre avantage", desc: "2 phrases d'explication"} — avantages spécifiques à la niche et à la valeur de la boutique ] }

5. TYPE "testimonials"
config: { title: "Ce que disent nos clients", items: [ 3 objets {name: "Prénom Nom africain réaliste", location: "ville réaliste zone ${regions}", content: "témoignage naturel et enthousiaste de 40-70 mots", rating: 5} ], showRating: true }

6. TYPE "faq"
config: { title: "Questions fréquentes", items: [ 4 objets {question: "question réaliste", answer: "réponse rassurante 2-3 phrases"} — spécifiques à la niche, aux commandes, à la livraison en ${regions || 'Afrique'} ] }

7. TYPE "contact"
config: { title: "Contactez-nous", subtitle: "Réponse garantie en moins de 30 minutes !", whatsapp: "${s.storeWhatsApp || ''}", address: "${s.city || ''}${s.city && s.country ? ', ' : ''}${s.country || ''}", showForm: false }

RÈGLES STRICTES:
- Tout en français, zéro anglais
- Ton: ${toneLabel.split('—')[0].trim()}
- Copy persuasif adapté: ${genders}, ${ages}, zone ${regions}
- IDs: "hero-1", "badges-1", "products-1", "features-1", "testimonials-1", "faq-1", "contact-1"
- visible: true pour toutes
- JSON pur, rien d'autre`;

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

Génère une page d'accueil complète et persuasive en JSON: {"sections": [...]}

Génère exactement ces 7 sections dans cet ordre:

1. TYPE "hero"
config: { title (H1 percutant 5-10 mots, adapté niche+ton), subtitle (promesse convaincante 1-2 phrases), ctaText (texte bouton CTA actif), ctaLink: "#products", alignment: "center", backgroundImage: "" }

2. TYPE "badges"
config: { items: [ exactement 4 objets {icon: "emoji", title: "titre court 3-4 mots", desc: "1 phrase"} pour: livraison rapide, qualité garantie, support WhatsApp, retours faciles ] }

3. TYPE "products"
config: { title (titre section produits adapté niche), subtitle (accroche engageante), layout: "grid", columns: 3, showPrice: true, showAddToCart: true, limit: 6 }

4. TYPE "features"
config: { title (titre "Pourquoi nous choisir" adapté au ton), subtitle (sous-titre), items: [ exactement 4 objets {icon: "emoji", title: "titre avantage", desc: "2 phrases d'explication"} — avantages spécifiques à la niche et à la valeur de la boutique ] }

5. TYPE "testimonials"
config: { title: "Ce que disent nos clients", items: [ 3 objets {name: "Prénom Nom africain réaliste", location: "ville réaliste zone ${regions}", content: "témoignage naturel et enthousiaste de 40-70 mots", rating: 5} ], showRating: true }

6. TYPE "faq"
config: { title: "Questions fréquentes", items: [ 4 objets {question: "question réaliste", answer: "réponse rassurante 2-3 phrases"} — spécifiques à la niche, aux commandes, à la livraison en ${regions || 'Afrique'} ] }

7. TYPE "contact"
config: { title: "Contactez-nous", subtitle: "Réponse garantie en moins de 30 minutes !", whatsapp: "${s.storeWhatsApp || ''}", address: "${s.city || ''}${s.city && s.country ? ', ' : ''}${s.country || ''}", showForm: false }

RÈGLES STRICTES:
- Tout en français, zéro anglais
- Ton: ${toneLabel.split('—')[0].trim()}
- Copy persuasif adapté: ${genders}, ${ages}, zone ${regions}
- IDs: "hero-1", "badges-1", "products-1", "features-1", "testimonials-1", "faq-1", "contact-1"
- visible: true pour toutes
- JSON pur, rien d'autre`;

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
