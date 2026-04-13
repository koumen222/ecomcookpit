import express from 'express';
import Groq from 'groq-sdk';
import EcomWorkspace from '../models/Workspace.js';
import Store from '../models/Store.js';
import { requireEcomAuth, requireWorkspace } from '../middleware/ecomAuth.js';
import { requireStoreOwner } from '../middleware/storeAuth.js';
import { invalidateStoreCache } from './storeApi.js';
import { generateNanoBananaImage } from '../services/nanoBananaService.js';
import { uploadToR2 } from '../services/cloudflareImagesService.js';
import axios from 'axios';

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

// ─── AI Image Generation for Homepage ────────────────────────────────────────

/**
 * Build prompt for hero background image (text-to-image, no product reference needed).
 * Modern upscale setting, Black/African people, NO text on image.
 */
function buildHomepageHeroImagePrompt(s) {
  const productTypeLabel = PRODUCT_TYPE_LABELS[s.productType] || 'lifestyle products';
  const nicheKeywords = {
    beaute: 'beauty, skincare, cosmetics, glowing skin, beauty products on vanity table',
    fitness: 'fitness, sport, gym equipment, athletic lifestyle, workout',
    mode: 'fashion, stylish outfit, trendy clothing, accessories, fashion editorial',
    tech: 'technology, gadgets, modern devices, digital lifestyle, sleek tech setup',
    maison: 'home decor, modern interior design, cozy living space, elegant furniture',
    sante: 'wellness, health, natural products, peaceful lifestyle, vitality',
    enfants: 'children, family, happy moments, playful, bright colorful environment',
    autre: 'premium lifestyle, modern shopping, aspirational living',
  };
  const niche = nicheKeywords[s.productType] || nicheKeywords.autre;

  return `Ultra-realistic 4K advertising photography for an online store selling ${productTypeLabel}.

SCENE: A confident, stylish Black African person in a MODERN UPSCALE environment — contemporary apartment, sleek studio, or chic urban setting. The scene evokes ${niche}.

SETTING: Modern, premium, aspirational. NOT a market, NOT a village, NOT traditional decor. Think luxury apartment, modern studio, high-end urban backdrop.

COMPOSITION: Wide 16:9 cinematic hero banner composition. The person is naturally posed, looking confident and aspirational. Warm natural lighting, soft bokeh background, professional quality.

MOOD: Premium, aspirational, trustworthy. The image should make you want to buy from this store. Scroll-stopping visual.

ABSOLUTELY NO TEXT on the image. No title, no headline, no words, no labels. Pure photographic image only.
NO logo, NO watermark, NO price, NO CTA button.`;
}

function buildLogoPrompt({ storeName = 'Boutique', productType = 'autre', themeColor = '#0F6B4F', tone = '', variant = 'wordmark' }) {
  const productTypeLabel = PRODUCT_TYPE_LABELS[productType] || 'retail';
  const toneHint = TONE_LABELS[tone]?.split('—')[0]?.trim() || 'premium';
  const variantInstructions = {
    wordmark: 'Create a clean premium wordmark logo with elegant typography and a subtle icon accent. The store name must be perfectly readable.',
    emblem: 'Create a premium emblem logo with a central icon inside a refined badge or seal, plus a compact readable brand name lockup.',
    monogram: 'Create a minimalist monogram or symbol-led logo using the initials or essence of the store name, paired with a small elegant wordmark.',
  };

  return `Create a professional ecommerce logo on a clean square canvas.

Brand name: ${storeName}
Category: ${productTypeLabel}
Brand tone: ${toneHint}
Primary brand color: ${themeColor}

${variantInstructions[variant] || variantInstructions.wordmark}

Rules:
- Square 1:1 logo presentation
- Clean premium brand identity for a modern ecommerce store
- White or very light neutral background only
- Use ${themeColor} as the main accent color
- Keep the logo centered, balanced, and fully visible
- No mockup on wall, no t-shirt, no business card, no 3D scene
- No extra decorative objects, no people, no environment
- No watermark, no fake UI, no pricing
- Typography must be sharp and readable if text is present
- Final result should look like a real finished brand logo proposal, not clipart`;
}

async function generateLogoOption({ storeName, productType, themeColor, tone, variant = 'wordmark' }) {
  const prompt = buildLogoPrompt({ storeName, productType, themeColor, tone, variant });
  const tempUrl = await generateNanoBananaImage(prompt, '1:1');
  const buffer = await downloadImageBuffer(tempUrl);
  const uploaded = await uploadToR2(buffer, `store-logo-${variant}-${Date.now()}.jpg`, 'image/jpeg');
  return {
    variant,
    url: uploaded?.success ? uploaded.url : tempUrl,
  };
}

/**
 * Download an image from URL and return as Buffer.
 */
async function downloadImageBuffer(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  return Buffer.from(response.data);
}

/**
 * Generate AI images for homepage hero and features sections.
 * Returns { heroImageUrl, featuresImageUrl }.
 * Non-blocking: if image generation fails, returns null for that image.
 */
async function generateHomepageImages(s) {
  const results = { heroImageUrl: null };

  try {
    const [heroResult] = await Promise.allSettled([
      (async () => {
        console.log('🎨 [Homepage] Generating AI hero image...');
        const heroPrompt = buildHomepageHeroImagePrompt(s);
        const heroTempUrl = await generateNanoBananaImage(heroPrompt, '16:9');
        const heroBuffer = await downloadImageBuffer(heroTempUrl);
        const heroR2 = await uploadToR2(heroBuffer, `homepage-hero-${Date.now()}.jpg`, 'image/jpeg');
        if (heroR2.success) {
          console.log('✅ [Homepage] Hero image generated and uploaded to R2');
          return heroR2.url;
        }
        console.warn('⚠️ [Homepage] Hero R2 upload failed, using temp URL');
        return heroTempUrl;
      })(),
    ]);

    results.heroImageUrl = heroResult.status === 'fulfilled' ? heroResult.value : null;

    if (heroResult.status === 'rejected') {
      console.warn('⚠️ [Homepage] Hero image generation failed:', heroResult.reason?.message);
    }
  } catch (err) {
    console.warn('⚠️ [Homepage] Image generation error:', err.message);
  }

  return results;
}

/**
 * Inject AI-generated images into homepage sections.
 */
function injectAIImages(sections, images) {
  return sections.map(sec => {
    if (sec.type === 'hero' && images.heroImageUrl) {
      return { ...sec, config: { ...sec.config, backgroundImage: images.heroImageUrl } };
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
    },
    {
      id: 'banner-1', type: 'banner', visible: true,
      config: {
        title: '🔥 Offre de lancement — Livraison GRATUITE !',
        content: `Profitez de la livraison offerte sur toutes vos commandes à ${city}. Offre limitée !`,
        ctaText: 'En profiter maintenant',
        ctaLink: '/products',
        backgroundImage: '',
      }
    },
    {
      id: 'newsletter-1', type: 'newsletter', visible: true,
      config: {
        title: 'Restez informé(e) !',
        subtitle: 'Inscrivez-vous pour recevoir nos offres exclusives et nouveautés en avant-première.',
        placeholder: 'Votre adresse email',
        buttonText: "S'inscrire",
      }
    },
  ];
}

// ─── Shared AI homepage generation ─────────────────────────────────────────────
/**
 * Build the Groq prompt for homepage section generation.
 * Used by both generate-homepage and regenerate-homepage.
 */
function buildHomepagePrompt(s) {
  const productTypeLabel = PRODUCT_TYPE_LABELS[s.productType] || s.productType || 'Produits divers';
  const toneLabel = TONE_LABELS[s.tone] || s.tone || 'Chaleureux & Proche';
  const genders = (s.audience?.gender || []).join(', ') || 'tous';
  const ages = (s.audience?.ageRange || []).join(', ') || 'tous âges';
  const regions = (s.audience?.region || []).join(', ') || 'international';

  return `Tu es un expert en copywriting pour le e-commerce africain. Tu crées des pages de vente pour des boutiques en ligne qui s'adressent à des consommateurs africains (Cameroun, Côte d'Ivoire, Sénégal, RDC, Bénin, Togo, etc.).

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

EXIGENCES COPYWRITING AVANCÉES:
- Chaque titre doit provoquer une réaction émotionnelle immédiate (curiosité, désir, peur de rater)
- Utilise des chiffres concrets et des preuves sociales quand possible ("Plus de 500 client(e)s satisfait(e)s", "Livraison en 24h à Douala")
- Les témoignages doivent être hyper-spécifiques : mentionner le produit exact, le résultat obtenu, le délai, la ville
- Les FAQ doivent adresser les vraies objections d'un client africain : authenticité du produit, fiabilité de la livraison, retour possible, modes de paiement locaux
- Le banner doit créer un sentiment d'urgence CRÉDIBLE (offre limitée, stock limité, bonus temporaire)

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

6. TYPE "banner"
config: { title: "🔥 Offre de lancement — Livraison GRATUITE !" ou promo attractive, content: "1-2 phrases urgence offre limitée", ctaText: "En profiter maintenant", ctaLink: "/products", backgroundImage: "" }

7. TYPE "faq"
config: { title: "Vos questions, nos réponses", items: [ 4 {question: "vraie question client africain", answer: "réponse claire, rassurante, mentionne Mobile Money/livraison locale si pertinent"} ] }

8. TYPE "contact"
config: { title: "Parlons-en sur WhatsApp", subtitle: "On vous répond en moins de 10 minutes !", whatsapp: "${s.storeWhatsApp || ''}", address: "${s.city || ''}${s.city && s.country ? ', ' : ''}${s.country || ''}", showForm: false }

9. TYPE "newsletter"
config: { title: "Restez informé(e) !", subtitle: "Inscrivez-vous pour recevoir nos offres exclusives et nouveautés en avant-première.", placeholder: "Votre adresse email", buttonText: "S'inscrire" }

RÈGLES:
- 100% français, zéro anglais
- Ton: ${toneLabel.split('—')[0].trim()}
- IDs: "hero-1", "badges-1", "products-1", "features-1", "testimonials-1", "banner-1", "faq-1", "contact-1", "newsletter-1"
- visible: true
- JSON pur uniquement, sans markdown`;
}

/**
 * Call Groq to generate homepage sections. Falls back to static sections on failure.
 * Shared by generate-homepage and regenerate-homepage so both always use the same logic.
 */
async function generateAIHomepageSections(s) {
  const groq = getGroq();
  if (!groq) return buildFallbackSections(s);

  try {
    // Generate text content AND AI images in parallel
    const [textResult, imagesResult] = await Promise.allSettled([
      // 1. Groq text generation
      (async () => {
        const prompt = buildHomepagePrompt(s);
        const response = await groq.chat.completions.create({
          model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `Tu es un expert copywriter e-commerce spécialisé dans le marché africain.

RÈGLES DE QUALITÉ NON-NÉGOCIABLES:
• Tu génères UNIQUEMENT du JSON valide, jamais de texte en dehors du JSON
• Chaque texte doit être spécifique au produit/niche de la boutique — JAMAIS de phrases génériques passe-partout
• Les titres hero doivent être émotionnels, concrets, et différenciants — pas de "Bienvenue chez..." ni de "Découvrez nos produits"
• Les témoignages doivent mentionner des détails précis : nom du produit, résultat concret, ville réelle
• Le storytelling doit être authentique, ancré dans la réalité africaine, pas du marketing occidental traduit
• Les FAQ doivent anticiper les vraies objections locales (authenticité, livraison, Mobile Money, retours)
• Chaque section doit servir la conversion — pas de remplissage décoratif`
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 6000,
          temperature: 0.7,
          response_format: { type: 'json_object' }
        });

        const raw = response.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(raw);
        const sections = parsed.sections;
        if (!Array.isArray(sections) || sections.length === 0) {
          throw new Error('Sections invalides retournées par le modèle');
        }
        return sections;
      })(),
      // 2. AI image generation (hero + "why choose us")
      generateHomepageImages(s),
    ]);

    // Process text result
    let sections;
    if (textResult.status === 'fulfilled') {
      sections = textResult.value;
    } else {
      console.warn('⚠️ Groq text generation failed, using fallback:', textResult.reason?.message);
      sections = buildFallbackSections(s);
    }

    // Normalize sections
    sections = sections.map((sec, i) => ({
      ...sec,
      id: sec.id || `${sec.type}-${i + 1}`,
      visible: true,
    }));

    // Inject AI-generated images (overrides Unsplash fallback)
    const aiImages = imagesResult.status === 'fulfilled' ? imagesResult.value : {};
    if (aiImages.heroImageUrl) {
      sections = injectAIImages(sections, aiImages);
    }

    // Fallback: inject Unsplash hero only if no AI hero image
    if (!aiImages.heroImageUrl) {
      sections = injectHeroImage(sections, s.productType, s.country);
    }

    return sections;
  } catch (aiError) {
    console.warn('⚠️ Groq homepage generation failed, using fallback:', aiError.message);
    return buildFallbackSections(s);
  }
}

// ─── Footer + Pages Légales — Génération IA ──────────────────────────────────

function buildFooterAndLegalPrompt(s) {
  const storeName = s.storeName || 'Notre Boutique';
  const country = s.country || 'Cameroun';
  const city = s.city || '';
  const whatsapp = s.storeWhatsApp || '';
  const email = s.storeEmail || '';
  const description = s.storeDescription || '';
  const productType = PRODUCT_TYPE_LABELS[s.productType] || s.productType || 'Produits divers';

  return `Tu es un expert en création de boutiques e-commerce pour le marché africain (paiement à la livraison).

BOUTIQUE:
- Nom: ${storeName}
- Catégorie: ${productType}
- Description: ${description}
- Pays cible: ${country}
- Ville: ${city || 'Non précisée'}
- WhatsApp: ${whatsapp}
- Email: ${email}
- Paiement: Paiement à la livraison (Cash on Delivery)
- Délai livraison: 24h à 72h

Génère en JSON un objet avec 2 clés: "footer" et "legalPages".

═══ 1. FOOTER ═══
Un footer professionnel et optimisé conversion. Objet JSON:
{
  "description": "Description courte orientée bénéfice client (1-2 phrases, simple et rassurante)",
  "quickLinks": [
    { "label": "Accueil", "href": "/" },
    { "label": "Nos Produits", "href": "/products" },
    { "label": "Suivi de commande", "href": "/track" }
  ],
  "legalLinks": [
    { "label": "Politique de confidentialité", "href": "/legal/confidentialite" },
    { "label": "Conditions Générales de Vente", "href": "/legal/cgv" },
    { "label": "Mentions légales", "href": "/legal/mentions" },
    { "label": "Politique de remboursement", "href": "/legal/remboursement" }
  ],
  "paymentMethods": ["Paiement à la livraison", "Mobile Money"],
  "deliveryInfo": "Livraison rapide en 24h à 72h dans tout le ${country}"
}

═══ 2. PAGES LÉGALES ═══
Objet JSON avec 4 clés. Chaque page est un objet { "title": "...", "content": "..." }.
Le content est du HTML simple (h2, h3, p, ul/li) — PAS de markdown.
Le langage doit être SIMPLE, accessible, compréhensible en Afrique francophone.
Style professionnel mais PAS de termes juridiques compliqués.
Adapté au pays: ${country}.

{
  "confidentialite": {
    "title": "Politique de Confidentialité",
    "content": "HTML avec sections: Données collectées (nom, téléphone, adresse de livraison), Utilisation des données (traitement commande, livraison, communication marketing), Protection des données, Partage avec partenaires (livreurs uniquement), Contact (WhatsApp/email de la boutique)"
  },
  "cgv": {
    "title": "Conditions Générales de Vente",
    "content": "HTML avec sections: Objet (vente en ligne avec livraison au ${country}), Processus de commande (commande via site/WhatsApp, confirmation, préparation, livraison), Paiement à la livraison (le client paie en espèces ou Mobile Money à la réception), Prix (en devise locale, TTC), Délais de livraison (24h à 72h selon la zone), Refus de commande (droit de refus si produit non conforme), Responsabilités, Litiges (résolution amiable par WhatsApp)"
  },
  "mentions": {
    "title": "Mentions Légales",
    "content": "HTML avec: Nom de la marque (${storeName}), Activité (vente en ligne de ${productType}), Contact (${whatsapp || email || 'WhatsApp de la boutique'}), Localisation (${city ? city + ', ' : ''}${country}), Hébergement (site hébergé par Scalor)"
  },
  "remboursement": {
    "title": "Politique de Remboursement",
    "content": "HTML avec sections: Principe (pas de paiement en ligne, paiement à la livraison uniquement), Vérification à la livraison (le client vérifie le produit avant de payer), Conditions de retour (produit défectueux ou erreur de commande uniquement), Procédure (contacter le support WhatsApp dans les 48h), Cas acceptés (produit défectueux, produit différent de la commande, colis endommagé), Cas non acceptés (changement d'avis après paiement, produit utilisé), Délai de traitement (remplacement ou remboursement sous 7 jours)"
  }
}

RÈGLES:
- 100% français simple et naturel
- Adapté au contexte e-commerce africain (COD, Mobile Money, WhatsApp)
- Le HTML doit être propre: h2 pour les titres de section, h3 pour sous-titres, p pour paragraphes, ul/li pour listes
- Pas de CSS inline dans le HTML
- Remplace les placeholders par les vraies infos de la boutique
- JSON pur uniquement, sans markdown ni texte autour`;
}

function buildFallbackFooterAndLegal(s) {
  const storeName = s.storeName || 'Notre Boutique';
  const country = s.country || 'Cameroun';
  const city = s.city || '';
  const whatsapp = s.storeWhatsApp || '';
  const email = s.storeEmail || '';
  const productType = PRODUCT_TYPE_LABELS[s.productType] || s.productType || 'Produits divers';
  const contact = whatsapp || email || 'notre support';

  return {
    footer: {
      description: `${storeName} — Votre boutique de confiance pour des produits de qualité livrés directement chez vous.`,
      quickLinks: [
        { label: 'Accueil', href: '/' },
        { label: 'Nos Produits', href: '/products' },
        { label: 'Suivi de commande', href: '/track' },
      ],
      legalLinks: [
        { label: 'Politique de confidentialité', href: '/legal/confidentialite' },
        { label: 'Conditions Générales de Vente', href: '/legal/cgv' },
        { label: 'Mentions légales', href: '/legal/mentions' },
        { label: 'Politique de remboursement', href: '/legal/remboursement' },
      ],
      paymentMethods: ['Paiement à la livraison', 'Mobile Money'],
      deliveryInfo: `Livraison rapide en 24h à 72h dans tout le ${country}`,
    },
    legalPages: {
      confidentialite: {
        title: 'Politique de Confidentialité',
        content: `<h2>Politique de Confidentialité</h2><p>${storeName} s'engage à protéger vos données personnelles.</p><h3>Données collectées</h3><p>Nous collectons uniquement les informations nécessaires au traitement de votre commande : nom, prénom, numéro de téléphone et adresse de livraison.</p><h3>Utilisation des données</h3><ul><li>Traitement et suivi de votre commande</li><li>Livraison de vos produits</li><li>Communication concernant votre commande</li></ul><h3>Protection</h3><p>Vos données sont stockées de manière sécurisée et ne sont jamais vendues à des tiers.</p><h3>Partage</h3><p>Vos informations de livraison sont partagées uniquement avec nos partenaires livreurs pour assurer la bonne réception de votre colis.</p><h3>Contact</h3><p>Pour toute question, contactez-nous via ${contact}.</p>`
      },
      cgv: {
        title: 'Conditions Générales de Vente',
        content: `<h2>Conditions Générales de Vente</h2><h3>Objet</h3><p>Les présentes conditions régissent la vente en ligne de ${productType} par ${storeName} au ${country}.</p><h3>Commande</h3><p>Vous pouvez passer commande via notre site ou par WhatsApp. Chaque commande est confirmée par un message de notre équipe.</p><h3>Paiement</h3><p>Le paiement se fait à la livraison (Cash on Delivery). Vous payez en espèces ou par Mobile Money au moment de la réception de votre colis.</p><h3>Livraison</h3><p>Nous livrons dans un délai de 24h à 72h selon votre zone${city ? ` (${city} et environs)` : ''}. Les frais de livraison sont indiqués lors de la commande.</p><h3>Refus</h3><p>Vous avez le droit de refuser votre commande à la livraison si le produit n'est pas conforme à votre commande.</p><h3>Litiges</h3><p>En cas de problème, contactez-nous via ${contact}. Nous privilégions toujours la résolution amiable.</p>`
      },
      mentions: {
        title: 'Mentions Légales',
        content: `<h2>Mentions Légales</h2><h3>Identité</h3><p>Nom de la marque : ${storeName}</p><p>Activité : Vente en ligne de ${productType}</p><h3>Contact</h3><p>${whatsapp ? `WhatsApp : ${whatsapp}` : ''}${whatsapp && email ? '<br/>' : ''}${email ? `Email : ${email}` : ''}</p><h3>Localisation</h3><p>${city ? city + ', ' : ''}${country}</p><h3>Hébergement</h3><p>Ce site est hébergé par Scalor (scalor.net).</p>`
      },
      remboursement: {
        title: 'Politique de Remboursement',
        content: `<h2>Politique de Remboursement</h2><h3>Principe</h3><p>Chez ${storeName}, vous payez uniquement à la réception de votre commande. Aucun paiement en ligne n'est requis.</p><h3>Vérification</h3><p>À la livraison, vous pouvez vérifier votre produit avant de payer. Si le produit ne correspond pas à votre commande, vous pouvez le refuser.</p><h3>Cas acceptés pour un retour</h3><ul><li>Produit défectueux ou endommagé</li><li>Produit différent de ce qui a été commandé</li><li>Colis endommagé pendant le transport</li></ul><h3>Cas non acceptés</h3><ul><li>Changement d'avis après paiement et réception</li><li>Produit déjà utilisé</li></ul><h3>Procédure</h3><p>Contactez notre support via ${contact} dans les 48h suivant la réception. Nous vous proposerons un remplacement ou un remboursement sous 7 jours.</p>`
      }
    }
  };
}

async function generateFooterAndLegalPages(s) {
  const groq = getGroq();
  if (!groq) return buildFallbackFooterAndLegal(s);

  try {
    const prompt = buildFooterAndLegalPrompt(s);
    const response = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Tu génères UNIQUEMENT du JSON valide. Pas de texte en dehors du JSON. Le JSON contient un objet avec 2 clés: "footer" (configuration du footer) et "legalPages" (4 pages légales en HTML simple). Le contenu doit être adapté au e-commerce africain avec paiement à la livraison.`
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 5000,
      temperature: 0.6,
      response_format: { type: 'json_object' }
    });

    const raw = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    if (!parsed.footer || !parsed.legalPages) {
      throw new Error('Structure footer/legalPages invalide');
    }

    console.log('✅ Footer + pages légales générés par IA');
    return parsed;
  } catch (err) {
    console.warn('⚠️ Footer/Legal generation failed, using fallback:', err.message);
    return buildFallbackFooterAndLegal(s);
  }
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
      storeFavicon: '', storeCountry: '', primaryColor: '#0F6B4F', accentColor: '#059669',
      backgroundColor: '#FFFFFF', textColor: '#111827', font: 'inter',
      announcement: '', announcementEnabled: false,
      productType: '', audience: { gender: [], ageRange: [], region: [], origin: [] },
      tone: '', city: '', country: '', secondaryColor: '', productDescription: '', categoryRegistry: []
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
 * POST /store-manage/generate-logos
 * Generate a single square logo proposal for the store creation wizard.
 */
router.post('/generate-logos', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const {
      storeName,
      productType = 'autre',
      themeColor = '#0F6B4F',
      tone = '',
      variant = 'wordmark',
    } = req.body || {};

    if (!String(storeName || '').trim()) {
      return res.status(400).json({ success: false, message: 'Le nom de la boutique est requis.' });
    }

    const logo = await generateLogoOption({
      storeName: String(storeName).trim().slice(0, 80),
      productType,
      themeColor: String(themeColor || '#0F6B4F').trim().slice(0, 20),
      tone: String(tone || '').trim().slice(0, 40),
      variant: String(variant || 'wordmark').trim().slice(0, 40),
    });

    if (!logo?.url) {
      return res.status(500).json({ success: false, message: 'Impossible de générer un logo pour le moment.' });
    }

    return res.json({ success: true, data: logo });
  } catch (error) {
    console.error('Erreur POST /store-manage/generate-logos:', error.message);
    return res.status(500).json({ success: false, message: 'Erreur lors de la génération du logo.' });
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
      storeFavicon, storeCountry,
      primaryColor, accentColor, backgroundColor, textColor, font,
      announcement, announcementEnabled,
      isStoreEnabled,
      // Nouveaux champs pour génération IA
      productType, audience, tone, city, country,
      secondaryColor, productDescription,
      // Product page builder config (visual builder)
      productPageConfig,
      categoryRegistry
    } = req.body;

    const update = {};

    if (storeName !== undefined) update['storeSettings.storeName'] = storeName;
    if (storeDescription !== undefined) update['storeSettings.storeDescription'] = storeDescription;
    if (storeLogo !== undefined) update['storeSettings.storeLogo'] = storeLogo;
    if (storeBanner !== undefined) update['storeSettings.storeBanner'] = storeBanner;
    if (storeFavicon !== undefined) update['storeSettings.storeFavicon'] = storeFavicon;
    if (storePhone !== undefined) update['storeSettings.storePhone'] = storePhone;
    if (storeWhatsApp !== undefined) update['storeSettings.storeWhatsApp'] = storeWhatsApp;
    if (storeCountry !== undefined) update['storeSettings.storeCountry'] = storeCountry;
    if (storeThemeColor !== undefined) {
      update['storeSettings.storeThemeColor'] = storeThemeColor;
      // Sync primaryColor so it always takes priority over legacy storeThemeColor in the lookup chain
      update['storeSettings.primaryColor'] = storeThemeColor;
    }
    if (primaryColor !== undefined) {
      update['storeSettings.primaryColor'] = primaryColor;
      if (storeThemeColor === undefined) {
        update['storeSettings.storeThemeColor'] = primaryColor;
      }
    }
    if (accentColor !== undefined) update['storeSettings.accentColor'] = accentColor;
    if (backgroundColor !== undefined) update['storeSettings.backgroundColor'] = backgroundColor;
    if (textColor !== undefined) update['storeSettings.textColor'] = textColor;
    if (font !== undefined) update['storeSettings.font'] = font;
    if (announcement !== undefined) update['storeSettings.announcement'] = announcement;
    if (announcementEnabled !== undefined) update['storeSettings.announcementEnabled'] = announcementEnabled;
    if (storeCurrency !== undefined) {
      update['storeSettings.storeCurrency'] = storeCurrency;
      update['storeSettings.currency'] = storeCurrency;
    }
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
    if (categoryRegistry !== undefined) {
      update['storeSettings.categoryRegistry'] = Array.from(
        new Set(
          (Array.isArray(categoryRegistry) ? categoryRegistry : [])
            .map((entry) => String(entry || '').trim())
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right, 'fr', { sensitivity: 'base' }));
    }

    // Write to Store if available, fallback to Workspace (legacy)
    const store = await getActiveStore(req);
    let subdomain;
    if (store) {
      await Store.findByIdAndUpdate(store._id, { $set: update });
      const updated = await Store.findById(store._id).select('name subdomain storeSettings').lean();
      subdomain = updated?.subdomain || null;
      // Invalidate public store cache so iframe preview reflects changes immediately
      if (subdomain) invalidateStoreCache(subdomain);
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
      if (subdomain) invalidateStoreCache(subdomain);
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

    // Check uniqueness across Store + Workspace (exclude current store, not just current workspace)
    const store = await getActiveStore(req);
    const storeQuery = { subdomain };
    if (store) storeQuery._id = { $ne: store._id };
    const [storeConflict, wsConflict] = await Promise.all([
      Store.findOne(storeQuery).select('_id').lean(),
      EcomWorkspace.findOne({ subdomain, _id: { $ne: req.workspaceId } }).select('_id').lean()
    ]);

    if (storeConflict || wsConflict) {
      return res.status(409).json({ success: false, message: 'Ce sous-domaine est déjà pris' });
    }

    // Update Store if available, otherwise Workspace
    if (store) {
      await Store.findByIdAndUpdate(store._id, { $set: { subdomain } });
      // Only sync workspace.subdomain if this is the primary store
      const ws = await EcomWorkspace.findById(req.workspaceId).select('primaryStoreId subdomain').lean();
      if (String(ws?.primaryStoreId) === String(store._id)) {
        await EcomWorkspace.findByIdAndUpdate(req.workspaceId, { $set: { subdomain } });
      }
    } else {
      await EcomWorkspace.findByIdAndUpdate(req.workspaceId, { $set: { subdomain } });
    }

    res.json({
      success: true,
      message: 'Sous-domaine configuré',
      data: {
        subdomain,
        storeUrl: `https://${subdomain}.scalor.net`
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
      .select('storeSettings subdomain')
      .lean();

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    // Merge req.body over DB settings so wizard data always takes priority
    const s = { ...(workspace.storeSettings || {}), ...req.body };

    // Générer homepage + footer/legal en parallèle
    const [sections, footerAndLegal] = await Promise.all([
      generateAIHomepageSections(s),
      generateFooterAndLegalPages(s),
    ]);

    // Sauvegarder sections + footer + pages légales en base
    const updateFields = {
      storePages: { sections },
    };
    if (footerAndLegal.footer) updateFields.storeFooter = footerAndLegal.footer;
    if (footerAndLegal.legalPages) updateFields.storeLegalPages = footerAndLegal.legalPages;

    // Save to Store if available, else Workspace
    const activeStore = await getActiveStore(req);
    if (activeStore) {
      await Store.findByIdAndUpdate(activeStore._id, { $set: updateFields });
    } else {
      await EcomWorkspace.findByIdAndUpdate(req.workspaceId, { $set: updateFields });
    }

    // Invalidate public store cache
    const subdomain = activeStore?.subdomain || workspace.subdomain;
    if (subdomain) invalidateStoreCache(subdomain);

    console.log(`✅ AI homepage generated: ${sections.length} sections + footer + legal pages for workspace ${req.workspaceId}`);
    res.json({ success: true, sections, footer: footerAndLegal.footer, legalPages: footerAndLegal.legalPages });
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
    const workspace = await EcomWorkspace.findById(req.workspaceId)
      .select('storeSettings subdomain')
      .lean();

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    // Merge req.body over DB settings so caller data always takes priority
    const s = { ...(workspace.storeSettings || {}), ...req.body };

    // Générer homepage + footer/legal en parallèle
    // NOTE: on ne reset plus storePages AVANT la génération pour ne pas perdre
    // l'ancienne page si Groq échoue → on écrase seulement après succès.
    const [sections, footerAndLegal] = await Promise.all([
      generateAIHomepageSections(s),
      generateFooterAndLegalPages(s),
    ]);

    // Save the new sections + footer + legal — to Store if available, else Workspace
    const activeStore = await getActiveStore(req);
    const updateFields = {
      storePages: { sections },
      storeFooter: footerAndLegal.footer || null,
      storeLegalPages: footerAndLegal.legalPages || null,
    };
    if (activeStore) {
      await Store.findByIdAndUpdate(activeStore._id, { $set: updateFields });
    } else {
      await EcomWorkspace.findByIdAndUpdate(req.workspaceId, { $set: updateFields });
    }

    // Invalidate public store cache
    const subdomain = activeStore?.subdomain || workspace.subdomain;
    if (subdomain) invalidateStoreCache(subdomain);

    console.log(`✅ Homepage regenerated: ${sections.length} sections + footer + legal for workspace ${req.workspaceId}`);
    res.json({ success: true, sections, footer: footerAndLegal.footer, legalPages: footerAndLegal.legalPages });
  } catch (error) {
    console.error('Erreur POST /store-manage/regenerate-homepage:', error.message);
    res.status(500).json({ success: false, message: 'Erreur lors de la régénération' });
  }
});

export default router;
