/**
 * Creative Image Generator — Premium Listing Images
 * POST /api/ecom/ai/creative-generator
 * 
 * Flow: User uploads product image + (URL or description)
 *       → Groq marketing analysis → image-to-image generation (6 slide types)
 */

import express from 'express';
import axios from 'axios';
import multer from 'multer';
import Groq from 'groq-sdk';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import { generateGptImage2ImageToImage, getImageGenerationStats } from '../services/nanoBananaService.js';
import { uploadImage } from '../services/cloudflareImagesService.js';
import { extractProductInfo } from '../services/geminiProductExtractor.js';
import FeatureUsageLog from '../models/FeatureUsageLog.js';
import CreativeAsset from '../models/CreativeAsset.js';
import EcomWorkspace from '../models/Workspace.js';

// All slides now use image-to-image mode (product reference mandatory)

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont acceptées'));
  },
});

let _groq = null;
function getGroq() {
  if (!_groq && process.env.GROQ_API_KEY) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

// ── Premium Listing Image Slide Types ─────────────────────────────────────────
const CREATIVE_FORMATS = [
  {
    id: 'hero-benefits',
    label: 'Bénéfices Clés',
    aspectRatio: '1:1',
    slideType: 'benefits',
    description: 'Produit centré + icônes bénéfices autour (style "Potent & Effective")',
  },
  {
    id: 'target-promise',
    label: 'Cible & Promesse',
    aspectRatio: '1:1',
    slideType: 'target',
    description: 'Public cible + produit + promesse de transformation',
  },
  {
    id: 'problem-solution',
    label: 'Problème / Solution',
    aspectRatio: '1:1',
    slideType: 'problem-solution',
    description: 'Le problème du client → le produit comme solution',
  },
  {
    id: 'how-to-use',
    label: 'Comment Utiliser',
    aspectRatio: '1:1',
    slideType: 'how-to-use',
    description: 'Mode d\'emploi étape par étape + lifestyle photo',
  },
  {
    id: 'ingredients-trust',
    label: 'Confiance & Qualité',
    aspectRatio: '1:1',
    slideType: 'trust',
    description: 'Badges certifications (GMO Free, Paraben Free, etc.)',
  },
  {
    id: 'comparison',
    label: 'Comparaison',
    aspectRatio: '1:1',
    slideType: 'comparison',
    description: 'Notre produit vs Autres — tableau ✓ / ✗',
  },
  {
    id: 'social-proof',
    label: 'Preuve Sociale',
    aspectRatio: '1:1',
    slideType: 'social-proof',
    description: 'Plusieurs clients satisfaits avec le produit',
  },
];

/**
 * Marketing analysis via Groq — accepts URL, description, or both
 */
async function analyzeProduct({ url, description }) {
  let productInfo = { title: '', description: description || '' };

  // If URL provided, try to extract info from it
  if (url) {
    try {
      console.log('📊 Extracting product info from URL via le service...');
      const extracted = await extractProductInfo(url);
      productInfo.title = extracted?.title || '';
      productInfo.description = (description ? description + '\n\n' : '') + (extracted?.description || '');
      console.log('✅ le service extraction:', productInfo.title || 'unknown');
    } catch (err) {
      console.warn('⚠️ le service extraction failed:', err.message);
      if (!description) {
        const urlParts = new URL(url);
        productInfo.title = urlParts.pathname.split('/').pop()?.replace(/[-_]/g, ' ') || urlParts.hostname;
        productInfo.description = `Produit trouvé sur: ${url}`;
      }
    }
  }

  if (!productInfo.title && !productInfo.description) {
    throw new Error('Veuillez fournir un lien produit OU une description');
  }

  // Marketing analysis via Groq
  const groq = getGroq();
  if (!groq) throw new Error('Clé du service non configurée');

  const contextParts = [];
  if (url) contextParts.push(`- URL: ${url}`);
  if (productInfo.title) contextParts.push(`- Nom: ${productInfo.title}`);
  contextParts.push(`- Description: ${(productInfo.description || '').slice(0, 2000)}`);

  const prompt = `Tu es un expert marketing e-commerce spécialisé dans le marché africain (Afrique francophone et anglophone).

Voici les informations du produit:
${contextParts.join('\n')}

Retourne un JSON avec EXACTEMENT cette structure:
{
  "productName": "Nom du produit ou de la marque",
  "category": "Catégorie (beauté, santé, tech, mode, maison, etc.)",
  "shortDescription": "Description courte percutante (1 phrase)",
  "keyBenefits": ["Bénéfice 1", "Bénéfice 2", "Bénéfice 3", "Bénéfice 4", "Bénéfice 5"],
  "painPoints": ["Situation quotidienne 1 où le client a besoin du produit", "Situation 2", "Situation 3", "Situation 4"],
  "usageSteps": ["Étape 1 d'utilisation CONCRÈTE du produit (ex: 'Ouvrir le sachet')", "Étape 2 (ex: 'Appliquer/Prendre')", "Étape 3 (ex: 'Profiter des résultats')"],
  "targetAudience": "Public cible africain",
  "emotionalHook": "Accroche émotionnelle puissante pour l'Afrique",
  "priceRange": "Gamme de prix si visible (en FCFA de préférence)",
  "brandColors": "Palette de couleurs idéale pour ce produit (ex: 'bleu lavande doux', 'vert menthe', 'orange chaud'). TOUJOURS proposer une palette même si pas visible",
  "promoAngle": "Angle promotionnel recommandé",
  "slogans": [
    "Slogan 1 — percutant",
    "Slogan 2 — avec urgence",
    "Slogan 3 — social proof"
  ]
}

IMPORTANT:
- Les painPoints sont des SITUATIONS QUOTIDIENNES où le client a besoin du produit (ex pour des patchs sommeil: "Après un voyage", "Surcharge d'écrans", "Pensées qui tournent", "Esprit surmené"). Ce sont des MOMENTS DE VIE reconnaissables, pas des symptômes médicaux
- Les usageSteps doivent être 3 étapes SIMPLES et CONCRÈTES propres à CE produit (ex: "Ouvrir", "Appliquer", "Profiter")
- Les keyBenefits doivent être des avantages SPÉCIFIQUES au produit, pas des banalités
- Adapte au contexte culturel africain
- Utilise un ton direct, émotionnel et persuasif
- Retourne UNIQUEMENT le JSON`;

  const response = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'Tu es un expert copywriting e-commerce Afrique. Retourne uniquement du JSON valide.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 2000,
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '{}';
  let cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Réponse le service invalide');
  cleaned = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(cleaned);
  }
}

/**
 * Build image prompt — Professional e-commerce listing design
 * Each template generates a specific layout matching Amazon/Shopify listing standards
 */
/**
 * Determine visual style based on product category
 * Returns style config: background, decorative elements, badge, accent colors, layout hints, icons
 */
function getCategoryStyle(category = '', brandColors = '') {
  const cat = (category || '').toLowerCase();

  // Listing marketplace vert naturel (inspire des creatives supplement/wellness)
  if (/listing-green|marketplace-green|wellness-listing|amazon-green/.test(cat)) {
    return {
      bgStyle: 'bright clean white background with soft pastel green radial gradients, subtle light wood base at bottom, premium natural wellness listing style',
      decorativeElements: 'fresh green leaves in corners, realistic ingredient elements (roots, herbs, capsules or drops matching product), soft layered light circles in background, clean spacing',
      badge: 'Round badge "NATURAL VITALITY" — rich emerald green (#0f7a46), white leaf icon, embossed premium seal',
      accentColor: brandColors || 'emerald green (#0f7a46) and fresh lime (#7cb342)',
      personStyle: 'African wellness lifestyle model, healthy confident expression, clean activewear or medical-lifestyle context, bright natural lighting',
      mood: 'clean, natural, modern marketplace listing, trust-driven, fresh vitality',
      benefitIcons: ['🌿 Ingrédients naturels', '⚡ Haute concentration', '🛡️ Testé en labo', '✅ Usage quotidien'],
      layoutStyle: 'green-listing-premium',
      problemColor: '#eef5ef',
      solutionHighlight: 'soft emerald glow halo with subtle white rim light around product bottle',
      trustBadges: ['LAB TESTED', 'NATURAL', 'NON GMO', 'PREMIUM FORMULA'],
      comparisonCriteria: ['Concentration active', 'Ingrédients naturels', 'Test laboratoire', 'Sans OGM', 'Durée de cure', 'Rapport qualité/prix'],
    };
  }

  // Tech / électronique / accessoires
  if (/tech|electron|phone|mobile|laptop|gadget|accessoire|câble|cable|casque|earphone|smartwatch/.test(cat)) {
    return {
      bgStyle: 'dark gradient background: deep navy #0a0f1e to midnight blue #0d1b2a, premium tech feel',
      decorativeElements: 'subtle blue-white light rays, small circuit-board or geometric line patterns in corners, very faint holographic shimmer overlay',
      badge: 'Round badge "TECH PRO" — dark electric blue (#0066ff), white lightning bolt icon center, bold tech text in arc, metallic emboss finish',
      accentColor: brandColors || 'electric blue (#0066ff) and silver',
      personStyle: 'young African professional, modern casual tech outfit, confident focused expression, looking at or interacting with the device',
      mood: 'sleek, premium, futuristic, high-performance',
      benefitIcons: ['⚡ Performance', '🔋 Longue durée', '📶 Connectivité', '🛡️ Durabilité'],
      layoutStyle: 'dark-tech',
      problemColor: '#0a0f1e',
      solutionHighlight: 'electric blue glow halo around the product',
      trustBadges: ['CERTIFIÉ', 'GARANTIE 1 AN', 'SAV RAPIDE', 'TECH PRO'],
      comparisonCriteria: ['Performance', 'Autonomie', 'Connectivité', 'Garantie', 'Prix', 'Support SAV'],
    };
  }

  // Mode / vêtements / textile
  if (/mode|vêtement|vetement|robe|wax|tissu|fashion|clothing|bijou|sac|chaussure|shoe|bag|jewel/.test(cat)) {
    return {
      bgStyle: 'soft warm cream-white (#faf7f2) with blush rose gradient (#fff0ec) on edges, elegant fashion editorial feel',
      decorativeElements: 'delicate gold foil brushstroke accents in 2 corners, thin single elegant lines, subtle fabric texture watermark, small scattered flower petals (rose or hibiscus)',
      badge: 'Round badge "MADE IN AFRICA" — rich gold (#c9a84c), elegant serif arc text, crown icon center, luxe embossed wax seal style',
      accentColor: brandColors || 'gold (#c9a84c) and warm cream',
      personStyle: 'stylish African woman or man, fashion-forward outfit featuring the product, editorial magazine pose, dramatic rim lighting, model-quality presentation',
      mood: 'luxurious, elegant, aspirational, African haute couture',
      benefitIcons: ['✨ Style unique', '👑 Qualité luxe', '🌍 Fait en Afrique', '💎 Exclusif'],
      layoutStyle: 'fashion-editorial',
      problemColor: '#f5f0e8',
      solutionHighlight: 'warm golden studio glow around the product on cream background',
      trustBadges: ['FAIT MAIN', 'ARTISAN LOCAL', 'WEARABLE ART', 'ÉDITION LIMITÉE'],
      comparisonCriteria: ['Qualité tissu', 'Originalité', 'Durabilité', 'Style', 'Confort', 'Valeur'],
    };
  }

  // Beauté / cosmétique / soins
  if (/beaut|cosmét|soin|skin|crème|creme|sérum|serum|makeup|maquillage|parfum|cheveux|hair/.test(cat)) {
    return {
      bgStyle: 'pure white (#ffffff) with very soft ivory radial glow at center (#fffdf9 at edges), clean luxury beauty aesthetic',
      decorativeElements: 'realistic botanical leaves and flowers (eucalyptus, rose petals, or plant matching the product ingredients) placed in upper-right and lower-left corners, vivid lush green and pink, elegantly composed flat-lay style',
      badge: 'Round badge "ALL NATURAL" — dark forest green (#1a5c2a), white leaf icon center, embossed wax stamp style',
      accentColor: brandColors || 'soft forest green (#1a5c2a) and gold (#c9a84c)',
      personStyle: 'African woman (very dark ebony skin, flawless radiant complexion), natural afro or long braids, applying or holding the product near her face, warm flattering studio lighting, close-up beauty portrait angle',
      mood: 'clean, luxurious, natural ingredients, skin-glowing, premium beauty editorial',
      benefitIcons: ['🌿 100% Naturel', '✨ Peau éclatante', '💧 Hydratation profonde', '🛡️ Sans Parabènes'],
      layoutStyle: 'beauty-flatlay',
      problemColor: '#f9f9f9',
      solutionHighlight: 'soft diffuse white light halo, product surrounded by botanicals',
      trustBadges: ['ALL NATURAL', 'SANS PARABÈNES', 'TESTÉ DERM.', 'VEGAN FRIENDLY'],
      comparisonCriteria: ['Ingrédients naturels', 'Résultats visibles', 'Sans Parabènes', 'Hydratation', 'Odeur', 'Dermatologique'],
    };
  }

  // Alimentation / nutrition / santé
  if (/aliment|food|nutri|santé|sante|supplement|complément|protéine|protein|minceur|régime|diet|bio|organic/.test(cat)) {
    return {
      bgStyle: 'pure white (#ffffff) with very subtle warm orange-yellow radial glow at center, fresh energetic feel',
      decorativeElements: 'photorealistic fresh ingredients scattered naturally: fruits (citrus slices, berries), herbs (mint, ginger), or grains/seeds — whichever matches the product — vibrant saturated colors, some slightly overlapping the product',
      badge: 'Round badge "100% NATUREL" — dark green (#1a5c2a), white leaf or shield icon, embossed stamp with "BIO" in bold',
      accentColor: brandColors || 'vibrant green (#2e7d32) and warm orange (#e65100)',
      personStyle: 'African person, sporty casual outfit, energetic healthy glowing expression, genuine confident smile, before/after transformation energy, full of vitality',
      mood: 'energetic, healthy, fresh, natural, transformational',
      benefitIcons: ['💪 Énergie Maximale', '🌿 100% Bio', '⚡ Résultats Rapides', '🛡️ Système Immunitaire'],
      layoutStyle: 'nutrition-energy',
      problemColor: '#f5f5f5',
      solutionHighlight: 'warm golden glow halo around product, fresh ingredients surrounding it',
      trustBadges: ['100% NATUREL', 'SANS ADDITIFS', 'BIO CERTIFIÉ', 'APPROUVÉ DIÉT.'],
      comparisonCriteria: ['Ingrédients naturels', 'Sans additifs', 'Efficacité prouvée', 'Goût', 'Certifié Bio', 'Rapport qualité/prix'],
    };
  }

  // Maison / décoration / cuisine
  if (/maison|home|deco|décor|cuisine|kitchen|ménage|menage|électroménager|electromenager/.test(cat)) {
    return {
      bgStyle: 'warm light background: soft beige (#f5f0e8) to warm white, natural wood texture strip along bottom edge, cozy home atmosphere',
      decorativeElements: 'small decorative indoor plants (monstera leaf, succulent) in one corner, subtle warm shadow from product, faint wood grain texture at base',
      badge: 'Round badge "QUALITÉ MAISON" — warm terracotta (#c0622a), white home/house icon center, embossed wax seal style',
      accentColor: brandColors || 'warm terracotta (#c0622a) and warm beige',
      personStyle: 'African family or woman in warm cozy home setting (modern African interior), casual comfortable everyday clothing, natural authentic smile, product integrated naturally in scene',
      mood: 'warm, cozy, trustworthy, practical, homely',
      benefitIcons: ['🏠 Facile à utiliser', '⏱️ Gain de temps', '💧 Efficace', '🌿 Sans produits nocifs'],
      layoutStyle: 'home-cozy',
      problemColor: '#f0ebe0',
      solutionHighlight: 'warm amber glow on product, placed on wood surface',
      trustBadges: ['QUALITÉ MAISON', 'DURABLE', 'FACILE D\'USAGE', 'GARANTI'],
      comparisonCriteria: ['Facilité d\'utilisation', 'Efficacité', 'Durabilité', 'Sécurité', 'Rapport qualité/prix', 'Design'],
    };
  }

  // Bébé / enfant / maternité
  if (/bébé|bebe|enfant|child|kids|maternité|maternite|jouet|toy/.test(cat)) {
    return {
      bgStyle: 'very soft pastel gradient: light sky blue (#e8f4fd) fading to mint green (#e8f7f0), gentle safe nursery feel',
      decorativeElements: 'small colorful stars, gentle curved pastel lines, tiny heart shapes, soft balloon shapes or clouds in two corners — childlike but clean and premium',
      badge: 'Round badge "SAFE FOR BABY" — soft teal (#2a7a6a), white baby star icon center, gentle emboss style',
      accentColor: brandColors || 'soft teal (#2a7a6a) and light sunny yellow',
      personStyle: 'African mother (warm smile, natural hair) holding or caring for baby, or joyful African child playing, soft warm diffuse lighting, genuine loving expression',
      mood: 'gentle, safe, caring, joyful, trustworthy for parents',
      benefitIcons: ['👶 Sûr pour bébé', '🌿 Sans toxines', '❤️ Testé & Approuvé', '🛡️ Certifié Pédiatre'],
      layoutStyle: 'baby-soft',
      problemColor: '#eef7fc',
      solutionHighlight: 'soft diffuse pastel glow around product, surrounded by small stars',
      trustBadges: ['SAFE FOR BABY', 'SANS TOXINES', 'PÉDIATRE OK', 'CERTIFIÉ'],
      comparisonCriteria: ['Sécurité bébé', 'Sans toxines', 'Douceur', 'Efficacité', 'Facilité', 'Confiance pédiatre'],
    };
  }

  // Default (général / autre)
  return {
    bgStyle: 'pure white (#ffffff) with very subtle radial center glow using the product accent color, clean premium feel',
    decorativeElements: 'subtle decorative geometric shapes or product-relevant elements, placed elegantly in corners, color-matched to accent',
    badge: 'Round badge "QUALITÉ PREMIUM" — dark navy (#0d1b2e) with brand accent color detail, relevant icon, embossed stamp style',
    accentColor: brandColors || 'dark navy (#0d1b2e) and white',
    personStyle: 'African person with confident genuine expression, clean modern styling, warm studio lighting',
    mood: 'premium, professional, trustworthy, aspirational',
    benefitIcons: ['✅ Qualité Garantie', '⚡ Résultats Rapides', '🌟 Premium', '🛡️ Certifié'],
    layoutStyle: 'generic-premium',
    problemColor: '#f5f5f5',
    solutionHighlight: 'subtle accent color glow halo around product',
    trustBadges: ['QUALITÉ PREMIUM', 'CERTIFIÉ', 'GARANTI', 'APPROUVÉ'],
    comparisonCriteria: ['Qualité', 'Efficacité', 'Durabilité', 'Rapport qualité/prix', 'Service client', 'Garantie'],
  };
}

function buildCreativePrompt(analysis, format, hasRefImage, visualTemplate = 'general', hasLogo = false) {
  const { keyBenefits, painPoints, usageSteps, brandColors, slogans, emotionalHook, category } = analysis;

  const b1 = keyBenefits?.[0] || 'Efficace';
  const b2 = keyBenefits?.[1] || 'Naturel';
  const b3 = keyBenefits?.[2] || 'Premium';
  const p1 = painPoints?.[0] || 'Fatigue';
  const p2 = painPoints?.[1] || 'Stress';
  const p3 = painPoints?.[2] || 'Inconfort';
  const s1 = usageSteps?.[0] || 'Ouvrir';
  const s2 = usageSteps?.[1] || 'Appliquer';
  const s3 = usageSteps?.[2] || 'Profiter des résultats';
  const slogan = slogans?.[0] || emotionalHook || 'Découvrez la différence';
  const accent = brandColors || 'emerald green and white';

  const finalCategory = (visualTemplate && visualTemplate !== 'general') ? visualTemplate : category;
  const style = getCategoryStyle(finalCategory, brandColors);

  const logoInstruction = hasLogo
    ? 'BRAND LOGO: A brand logo image is provided as reference. Place it prominently but elegantly — top-left or top-right corner, respecting proportions, on a clean background zone. Do not distort or recolor the logo.'
    : '';

  // ── Concise style anchor (injected into every prompt) ──────────────────────
  const ANCHOR = `
Style: premium e-commerce listing, square 1:1, photorealistic HD, clean ${style.mood} aesthetic.
Background: ${style.bgStyle}.
Product: ${hasRefImage ? 'use the reference image — reproduce packaging faithfully, exact colors and logo' : 'create a realistic product render'}.
${logoInstruction}
Decorative elements: ${style.decorativeElements}.
People (if any): dark-skinned African person, natural hair, warm confident expression, studio lighting.
Typography: bold condensed sans-serif, French text only, razor-sharp, dominant headlines.`.trim();

  const slidePrompts = {

    // ── 1. Bénéfices clés ───────────────────────────────────────────────────────
    'benefits': `
Premium product listing image — BENEFITS SHOWCASE.
Hero product shot centered-right, large and vibrant, ${style.solutionHighlight}.
Left side: African lifestyle model naturally using the product, warm magazine portrait lighting.
4 benefit cards arranged around the product (white rounded cards, icon + short French text):
"${b1}" · "${b2}" · "${b3}" · "Satisfaction garantie".
Bold headline top: "${slogan}".
Accent color: ${accent}. Bottom badge: ★★★★★ "Des milliers de clients satisfaits".
${ANCHOR}`.trim(),

    // ── 2. Cible & Promesse ─────────────────────────────────────────────────────
    'target': `
Premium product listing image — LIFESTYLE GRID (2×2 scenes).
Top banner: brand color fill, large white headline "${slogan}".
4 square scenes showing the product in real-life moments: at home, at work, outdoors, everyday routine.
Each scene: African person using the product naturally, product clearly visible, warm vibrant lighting.
Thin accent-color dividers between cells. Bottom-left corner: certification seal.
Accent color: ${accent}.
${ANCHOR}`.trim(),

    // ── 3. Problème / Solution ──────────────────────────────────────────────────
    'problem-solution': `
Premium product listing image — BEFORE / AFTER split screen.
LEFT half "LE PROBLÈME": cold desaturated scene, frustrated African person, grey-blue tint.
Three red pill badges: "${p1}" · "${p2}" · "${p3}".
RIGHT half "LA SOLUTION": bright warm scene, same person relieved and confident, product hero shot prominent.
Three benefit badges in accent color: "${b1}" · "${b2}" · "${b3}".
Center divider: bold arrow pointing right, text "LA SOLUTION".
Bottom strip: "${slogan}" in accent color pill.
Accent color: ${accent}.
${ANCHOR}`.trim(),

    // ── 4. Mode d'emploi ────────────────────────────────────────────────────────
    'how-to-use': `
Premium product listing image — HOW TO USE (3 steps).
Bold headline: "3 ÉTAPES SIMPLES".
Three numbered steps with icons and short French labels: "1 — ${s1}" → "2 — ${s2}" → "3 — ${s3}".
Steps connected by accent-color arrows. Product hero shot below steps, clean and prominent.
African model top-right, holding the product, warm confident expression.
Footer badge: "RÉSULTATS GARANTIS".
Accent color: ${accent}.
${ANCHOR}`.trim(),

    // ── 5. Confiance & Qualité ──────────────────────────────────────────────────
    'trust': `
Premium product listing image — TRUST & QUALITY.
Centered hero product shot, very large, dramatic studio lighting with soft glow halo.
6 round certification seals arranged symmetrically around the product (3 left, 3 right):
labels: "${b1}" · "${b2}" · "${b3}" · "Lab Tested" · "Natural" · "Certified".
Bold headline top: "${b1.toUpperCase()} · ${b2.toUpperCase()}".
Bottom bar (dark navy): 4 quality seals in a row, white icons.
Accent color: ${accent}.
${ANCHOR}`.trim(),

    // ── 6. Comparaison ──────────────────────────────────────────────────────────
    'comparison': `
Premium product listing image — COMPARISON TABLE.
Top: our product (vibrant, bright, reference image) vs generic competitor (grey, blurred, faded).
Our product label: "✅ Le meilleur choix". Competitor label: "❌ Les autres".
Comparison table below (3 columns: Critère / Nous / Autres), 5 rows:
"${b1}" ✅ vs ❌ · "${b2}" ✅ vs ❌ · "${b3}" ✅ vs ❌ · "Qualité prouvée" ✅ vs ❌ · "Satisfaction garantie" ✅ vs ❌.
Bold headline: "POURQUOI NOUS CHOISIR ?".
Bottom pill badge: "LE MEILLEUR RAPPORT QUALITÉ / PRIX" in accent color.
Accent color: ${accent}.
${ANCHOR}`.trim(),

    // ── 7. Preuve sociale ───────────────────────────────────────────────────────
    'social-proof': `
Premium product listing image — SOCIAL PROOF.
Bold headline: "ILS L'ADORENT" with ★★★★★ golden stars row.
4 testimonial cards (2×2 grid, white rounded cards, soft shadow):
Each card: round profile photo of African person, ★★★★★, one short quote in French, first name + African city.
Product hero shot centered between cards, glowing, clearly recognizable.
Bottom badge: "★ +2000 clients satisfaits en Afrique" in accent color.
Accent color: ${accent}.
${ANCHOR}`.trim(),

  };

  return slidePrompts[format.slideType] || slidePrompts['benefits'];
}

/**
 * Scrape product images from URL — aggressive multi-pattern extraction
 */
async function scrapeProductImage(url) {
  try {
    console.log('🔍 Scraping product image from:', url);
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      maxRedirects: 5,
    });
    const html = response.data;
    if (typeof html !== 'string') return null;

    console.log(`📄 HTML fetched: ${html.length} chars`);

    let imageUrl = null;

    // ── Priority 1: Open Graph / Twitter meta tags ──
    const ogPatterns = [
      /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
      /name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
      /content=["']([^"']+)["'][^>]*name=["']twitter:image/i,
    ];
    for (const p of ogPatterns) {
      const m = html.match(p);
      if (m?.[1] && m[1].length > 10) { imageUrl = m[1]; console.log('📸 Found via OG/meta:', imageUrl.slice(0, 100)); break; }
    }

    // ── Priority 2: JSON-LD structured data (schema.org Product) ──
    if (!imageUrl) {
      const jsonLdBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      for (const block of jsonLdBlocks) {
        try {
          const data = JSON.parse(block[1]);
          const imgField = data?.image || data?.['@graph']?.find(g => g.image)?.image;
          if (imgField) {
            imageUrl = Array.isArray(imgField) ? imgField[0] : (typeof imgField === 'object' ? imgField.url : imgField);
            if (imageUrl) { console.log('📸 Found via JSON-LD:', imageUrl.slice(0, 100)); break; }
          }
        } catch {}
      }
    }

    // ── Priority 3: Inline JSON / __NEXT_DATA__ / window.__DATA__ etc ──
    if (!imageUrl) {
      // Look for image URLs in any embedded JSON/JS data
      const dataPatterns = [
        /"(?:image|img|photo|picture|thumbnail|src|url)":\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi,
        /"(?:image|img|photo|picture|thumbnail|src|url)":\s*"(https?:\/\/[^"]+\/[^"]*(?:product|item|img|image|upload|media)[^"]*)"/gi,
        // Cloudflare Images / R2 / imagedelivery
        /"(https?:\/\/(?:pub-|imagedelivery\.net|[^"]*\.r2\.dev)[^"]+)"/gi,
        // Shopify CDN
        /"(https?:\/\/cdn\.shopify\.com\/[^"]+)"/gi,
      ];
      for (const p of dataPatterns) {
        const matches = [...html.matchAll(p)];
        const candidate = matches.map(m => m[1]).find(u =>
          !/(icon|logo|favicon|sprite|pixel|tracking|badge|flag|avatar|placeholder)/i.test(u) &&
          u.length > 20
        );
        if (candidate) { imageUrl = candidate; console.log('📸 Found via inline data:', imageUrl.slice(0, 100)); break; }
      }
    }

    // ── Priority 4: Alibaba / AliExpress / 1688 specific ──
    if (!imageUrl) {
      const aliPatterns = [
        /(?:data-src|src)=["'](https?:\/\/[^"']*(?:alicdn|cbu01|sc04)\.com[^"']*)["']/i,
        /"(?:imageUrl|mainImage|imgUrl)":\s*"([^"]+)"/i,
      ];
      for (const p of aliPatterns) {
        const m = html.match(p);
        if (m?.[1]) { imageUrl = m[1]; console.log('📸 Found via Alibaba pattern:', imageUrl.slice(0, 100)); break; }
      }
    }

    // ── Priority 5: src/srcset on img tags ──
    if (!imageUrl) {
      // All img src= and srcset= URLs
      const allSrc = [
        ...html.matchAll(/src=["'](https?:\/\/[^"']+)["']/gi),
        ...html.matchAll(/srcset=["']([^"']+)["']/gi),
        ...html.matchAll(/data-src=["'](https?:\/\/[^"']+)["']/gi,),
        ...html.matchAll(/data-lazy-src=["'](https?:\/\/[^"']+)["']/gi),
        ...html.matchAll(/data-original=["'](https?:\/\/[^"']+)["']/gi),
      ];
      
      // From srcset, extract the first URL
      const candidates = allSrc.flatMap(m => {
        const val = m[1];
        if (val.includes(',')) return val.split(',').map(s => s.trim().split(/\s+/)[0]);
        return [val.split(/\s+/)[0]];
      }).filter(u =>
        /^https?:\/\//i.test(u) &&
        !/(icon|logo|favicon|sprite|pixel|tracking|badge|flag|avatar|placeholder|\.svg|\.gif|1x1|data:)/i.test(u) &&
        u.length > 20
      );

      // Prefer URLs that look like product images
      const productCandidate = candidates.find(u =>
        /(product|item|img|image|upload|media|photo|cdn|pub-|r2\.dev|imagedelivery)/i.test(u)
      );
      imageUrl = productCandidate || candidates[0] || null;
      if (imageUrl) console.log('📸 Found via img src/srcset:', imageUrl.slice(0, 100));
    }

    // ── Priority 6: background-image in style attributes ──
    if (!imageUrl) {
      const bgMatch = html.match(/background-image:\s*url\(["']?(https?:\/\/[^"')]+)["']?\)/i);
      if (bgMatch?.[1]) { imageUrl = bgMatch[1]; console.log('📸 Found via background-image:', imageUrl.slice(0, 100)); }
    }

    if (!imageUrl) {
      console.warn('⚠️ No product image found in HTML after all strategies');
      return null;
    }

    // Resolve relative / protocol-relative URLs
    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
    else if (imageUrl.startsWith('/')) {
      const base = new URL(url);
      imageUrl = base.origin + imageUrl;
    }

    console.log('📸 Downloading product image:', imageUrl.slice(0, 120));

    // Download the image as buffer — retry with fallback candidates if too small
    const tryDownload = async (imgUrl) => {
      try {
        let resolvedUrl = imgUrl;
        if (resolvedUrl.startsWith('//')) resolvedUrl = 'https:' + resolvedUrl;
        else if (resolvedUrl.startsWith('/')) resolvedUrl = new URL(url).origin + resolvedUrl;

        const imgResponse = await axios.get(resolvedUrl, {
          responseType: 'arraybuffer',
          timeout: 20000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': url,
            'Accept': 'image/*,*/*',
          },
        });
        const buffer = Buffer.from(imgResponse.data);
        // Check content-type is actually an image
        const ct = imgResponse.headers?.['content-type'] || '';
        if (ct && !ct.startsWith('image/')) {
          console.warn(`⚠️ Not an image (${ct}): ${resolvedUrl.slice(0, 80)}`);
          return null;
        }
        if (buffer.length < 2000) {
          console.warn(`⚠️ Image too small (${buffer.length}B), skipping: ${resolvedUrl.slice(0, 80)}`);
          return null;
        }
        return buffer;
      } catch (e) {
        console.warn(`⚠️ Download failed: ${e.message}`);
        return null;
      }
    };

    // Try main candidate first
    let buffer = await tryDownload(imageUrl);

    // If too small or failed, try all other candidates collected from img src
    if (!buffer) {
      console.log('🔄 Main image failed, trying fallback candidates...');
      const allSrc = [
        ...html.matchAll(/src=["'](https?:\/\/[^"']+)["']/gi),
        ...html.matchAll(/data-src=["'](https?:\/\/[^"']+)["']/gi),
      ];
      const fallbacks = allSrc.map(m => m[1]).filter(u =>
        !/(icon|logo|favicon|sprite|pixel|tracking|badge|flag|avatar|placeholder|\.svg|\.gif|1x1|data:)/i.test(u) &&
        u !== imageUrl && u.length > 20
      );
      // Prefer product-looking URLs
      fallbacks.sort((a, b) => {
        const scoreA = /(product|item|upload|media|photo|cdn|pub-|r2\.dev|imagedelivery)/i.test(a) ? 0 : 1;
        const scoreB = /(product|item|upload|media|photo|cdn|pub-|r2\.dev|imagedelivery)/i.test(b) ? 0 : 1;
        return scoreA - scoreB;
      });
      for (const fb of fallbacks.slice(0, 5)) {
        console.log(`  🔄 Trying fallback: ${fb.slice(0, 80)}`);
        buffer = await tryDownload(fb);
        if (buffer) break;
      }
    }

    if (!buffer) {
      console.warn('⚠️ All image candidates failed or too small');
      return null;
    }

    console.log(`✅ Product image downloaded: ${Math.round(buffer.length / 1024)}KB`);
    return buffer;
  } catch (err) {
    console.warn('⚠️ Failed to scrape product image:', err.message);
    return null;
  }
}

// ── POST /api/ecom/ai/creative-generator ──────────────────────────────────────
router.post('/', requireEcomAuth, upload.fields([
  { name: 'productImage', maxCount: 1 },
  { name: 'logoImage', maxCount: 1 },
]), async (req, res) => {
  let heartbeat;
  let clientDisconnected = false;
  let reservedCreativeCredits = 0;
  let refundedCreativeCredits = 0;
  const creatives = [];

  const refundUnusedCreativeCredits = async (reason = 'generation_failed') => {
    if (!req.workspaceId || reservedCreativeCredits <= refundedCreativeCredits) return;

    const successCount = creatives.filter(c => c.imageUrl).length;
    const refundCount = Math.max(0, reservedCreativeCredits - successCount - refundedCreativeCredits);
    if (refundCount <= 0) return;

    await EcomWorkspace.findByIdAndUpdate(req.workspaceId, {
      $inc: { creativeCreditsRemaining: refundCount },
    });
    refundedCreativeCredits += refundCount;
    console.log(`💳 Refunded ${refundCount} creative credit(s) (${reason}); charged=${successCount}`);
  };

  res.on('close', () => {
    if (!res.writableEnded) clientDisconnected = true;
  });
  try {
    const { url, description, formats: formatsRaw, visualTemplate } = req.body;
    const formats = typeof formatsRaw === 'string' ? JSON.parse(formatsRaw) : formatsRaw;
    const productImageBuffer = req.files?.productImage?.[0]?.buffer || null;
    const logoBuffer = req.files?.logoImage?.[0]?.buffer || null;

    if (!productImageBuffer && !url) {
      return res.status(400).json({ error: 'Veuillez fournir une image produit ou un lien produit (pour récupérer l\'image automatiquement)' });
    }

    // Validate URL if provided
    if (url) {
      try { new URL(url); } catch {
        return res.status(400).json({ error: 'URL invalide. Entrez une URL complète (ex: https://alibaba.com/produit)' });
      }
    }

    // Select formats
    const selectedFormats = formats?.length > 0
      ? CREATIVE_FORMATS.filter(f => formats.includes(f.id))
      : CREATIVE_FORMATS;

    console.log(`🎨 Creative Generator: image=${!!productImageBuffer} url=${url || 'none'} desc=${description ? 'yes' : 'no'} → ${selectedFormats.map(f => f.id).join(', ')}`);

    // Step 1: Marketing analysis
    console.log('📊 Step 1: Analyse marketing...');
    const analysis = await analyzeProduct({ url, description });
    console.log('✅ Analysis done:', analysis.productName);

    // Step 1b: If no image uploaded but URL provided, try scraping product image
    let resolvedImageBuffer = productImageBuffer;
    if (!resolvedImageBuffer && url) {
      console.log('🔍 No image uploaded — scraping product image from URL...');
      try {
        resolvedImageBuffer = await scrapeProductImage(url);
        if (resolvedImageBuffer) {
          console.log(`✅ Scraped product image: ${Math.round(resolvedImageBuffer.length / 1024)}KB`);
        } else {
          console.log('⚠️ No product image found from URL, continuing text-only');
        }
      } catch (scrapeErr) {
        console.warn('⚠️ Image scraping failed:', scrapeErr.message);
      }
    }

    // Step 2: Generate creatives — smart image usage
    const hasImage = !!resolvedImageBuffer;
    
    // STRICT: block generation without product image — all operations must be image-to-image
    if (!hasImage) {
      return res.status(400).json({ success: false, error: 'Aucune image produit fournie — impossible de générer en mode image-to-image. Uploadez une photo du produit.' });
    }

    // Reserve credits atomically before costly image calls.
    // Failed images are refunded after the batch, so one successful creative = one consumed credit.
    const neededCredits = selectedFormats.length;
    if (!req.workspaceId) {
      return res.status(400).json({ success: false, error: 'Workspace requis pour générer des créatives.' });
    }
    const reservedWorkspace = await EcomWorkspace.findOneAndUpdate(
      { _id: req.workspaceId, creativeCreditsRemaining: { $gte: neededCredits } },
      { $inc: { creativeCreditsRemaining: -neededCredits } },
      { new: true, select: 'creativeCreditsRemaining' }
    );

    if (!reservedWorkspace) {
      const workspace = await EcomWorkspace.findById(req.workspaceId).select('creativeCreditsRemaining').lean();
      const available = workspace?.creativeCreditsRemaining ?? 0;
      return res.status(402).json({
        success: false,
        error: `Crédits insuffisants. Vous avez ${available} crédit${available !== 1 ? 's' : ''} et avez besoin de ${neededCredits}.`,
        creditsRequired: neededCredits,
        creditsAvailable: available,
      });
    }
    reservedCreativeCredits = neededCredits;
    console.log(`💳 Reserved ${reservedCreativeCredits} creative credit(s); remaining=${reservedWorkspace.creativeCreditsRemaining}`);

    console.log(`🖼️ Step 2: Génération de ${selectedFormats.length} créa(s) avec image produit (image-to-image)...`);
    const statsBefore = getImageGenerationStats();

    // Send whitespace heartbeats every 15s to prevent proxy/load-balancer from
    // dropping the connection during long image generation (Railway cuts idle at ~60s).
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    heartbeat = setInterval(() => {
      if (clientDisconnected || res.writableEnded || res.destroyed) return;
      try {
        res.write(' ');
      } catch {
        clientDisconnected = true;
      }
    }, 15000);

    for (const format of selectedFormats) {
      try {
        const imagePrompt = buildCreativePrompt(analysis, format, true, visualTemplate, !!logoBuffer);
        console.log(`  🎨 Generating ${format.id} (image-to-image)...`);

        const imageDataUrl = await generateGptImage2ImageToImage(imagePrompt, resolvedImageBuffer, format.aspectRatio, logoBuffer || null);

        if (!imageDataUrl) {
          creatives.push({ id: format.id, label: format.label, aspectRatio: format.aspectRatio, imageUrl: null, error: 'Génération échouée' });
          console.warn(`  ❌ ${format.id} failed — no URL returned`);
          continue;
        }

        // Download from Kie.ai and upload to R2 for a permanent URL
        let finalUrl = imageDataUrl;
        try {
          let imgBuffer;
          const base64Match = imageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
          if (base64Match) {
            imgBuffer = Buffer.from(base64Match[1], 'base64');
          } else if (/^https?:\/\//i.test(imageDataUrl)) {
            const dlRes = await axios.get(imageDataUrl, { responseType: 'arraybuffer', timeout: 90000 });
            imgBuffer = Buffer.from(dlRes.data);
          }
          if (imgBuffer) {
            const uploaded = await uploadImage(imgBuffer, `creative-${format.id}-${Date.now()}.png`, {
              workspaceId: req.workspaceId || 'creative',
              uploadedBy: String(req.user?.id || req.ecomUser?._id || 'creative-generator'),
              optimize: false,
            });
            if (uploaded?.url) {
              finalUrl = uploaded.url;
              console.log(`  💾 ${format.id} stored → ${finalUrl.slice(0, 80)}`);
            } else {
              console.warn(`  ⚠️ ${format.id} R2 upload returned no URL — keeping le service URL`);
            }
          }
        } catch (uploadErr) {
          console.error(`  ❌ ${format.id} R2 upload failed: ${uploadErr.message} — keeping le service URL`);
        }

        creatives.push({ id: format.id, label: format.label, aspectRatio: format.aspectRatio, imageUrl: finalUrl, usedProductImage: true });

        // Save to DB — awaited so failures are visible in logs
        const resolvedUserId = req.user?.id || req.ecomUser?._id;
        if (req.workspaceId && resolvedUserId) {
          try {
            await CreativeAsset.create({
              workspaceId: req.workspaceId,
              userId: resolvedUserId,
              productName: analysis.productName || '',
              formatId: format.id,
              label: format.label,
              imageUrl: finalUrl,
              aspectRatio: format.aspectRatio,
              category: analysis.category || '',
              template: visualTemplate || '',
            });
            console.log(`  ✅ ${format.id} saved to gallery`);
          } catch (dbErr) {
            console.error(`  ❌ CreativeAsset save failed for ${format.id}:`, dbErr.message);
          }
        } else {
          console.warn(`  ⚠️ ${format.id} NOT saved — missing workspaceId (${req.workspaceId}) or userId (${resolvedUserId})`);
        }
      } catch (imgErr) {
        console.error(`  ❌ ${format.id} error:`, imgErr.message);
        creatives.push({ id: format.id, label: format.label, aspectRatio: format.aspectRatio, imageUrl: null, error: imgErr.message });
      }
    }

    // Charge only successfully generated images. Reserved but failed images are refunded.
    const successCount = creatives.filter(c => c.imageUrl).length;
    await refundUnusedCreativeCredits('partial_or_failed_generation');
    console.log(`💳 Charged ${successCount} creative credit(s)${clientDisconnected ? ' after client disconnect' : ''}`);

    // Calculate cost for this generation batch
    const statsAfter = getImageGenerationStats();
    const batchCost = {
      images: statsAfter.totalImages - statsBefore.totalImages,
      costUsd: +(statsAfter.totalCostUsd - statsBefore.totalCostUsd).toFixed(3),
      costFcfa: statsAfter.totalCostFcfa - statsBefore.totalCostFcfa,
    };
    console.log(`💰 Batch total: ${batchCost.images} images → ~$${batchCost.costUsd} (~${batchCost.costFcfa} FCFA)`);

    // Track feature usage
    const resolvedUserId = req.user?.id || req.ecomUser?._id;
    if (req.workspaceId && resolvedUserId) {
      FeatureUsageLog.create({
        workspaceId: req.workspaceId,
        userId: resolvedUserId,
        feature: 'creative_generator',
        meta: {
          slideCount: creatives.length,
          creditsReserved: reservedCreativeCredits,
          creditsUsed: successCount,
          creditsRefunded: refundedCreativeCredits,
          success: true
        }
      }).catch(() => {});
    }

    const updatedWorkspace = req.workspaceId
      ? await EcomWorkspace.findById(req.workspaceId).select('creativeCreditsRemaining').lean()
      : null;

    clearInterval(heartbeat);
    const responseBody = JSON.stringify({
      success: true,
      analysis,
      creatives,
      formats: CREATIVE_FORMATS,
      productImageFound: hasImage,
      cost: batchCost,
      creditsUsed: successCount,
      creditsRefunded: refundedCreativeCredits,
      creditsRemaining: updatedWorkspace?.creativeCreditsRemaining ?? 0,
    });
    if (!res.writableEnded) res.end(responseBody);
  } catch (err) {
    console.error('❌ Creative Generator error:', err);
    try {
      await refundUnusedCreativeCredits('request_error');
    } catch (refundErr) {
      console.error('❌ Creative credit refund failed:', refundErr.message);
    }
    if (heartbeat) clearInterval(heartbeat);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Erreur lors de la génération', message: err.message || 'Erreur lors de la génération' });
    } else if (!res.writableEnded) {
      res.end(JSON.stringify({ success: false, error: err.message || 'Erreur lors de la génération' }));
    }
  }
});

// ── GET /api/ai/creative-generator/formats ────────────────────────────────────
router.get('/formats', requireEcomAuth, async (_req, res) => {
  res.json({ formats: CREATIVE_FORMATS });
});

// ── GET /api/ecom/ai/creative-generator/gallery ───────────────────────────────
// List all stored creatives for the authenticated workspace, newest first
router.get('/gallery', requireEcomAuth, async (req, res) => {
  try {
    if (!req.workspaceId) return res.status(400).json({ error: 'workspaceId manquant' });
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const [assets, total] = await Promise.all([
      CreativeAsset.find({ workspaceId: req.workspaceId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CreativeAsset.countDocuments({ workspaceId: req.workspaceId }),
    ]);

    res.json({ success: true, assets, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/ecom/ai/creative-generator/gallery/:id ────────────────────────
router.delete('/gallery/:id', requireEcomAuth, async (req, res) => {
  try {
    if (!req.workspaceId) return res.status(400).json({ error: 'workspaceId manquant' });
    const asset = await CreativeAsset.findOneAndDelete({
      _id: req.params.id,
      workspaceId: req.workspaceId, // scope to workspace — no cross-workspace deletion
    });
    if (!asset) return res.status(404).json({ error: 'Visuel introuvable' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
