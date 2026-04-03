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
import { generateNanoBananaImage, generateNanoBananaImageToImage, getImageGenerationStats } from '../services/nanoBananaService.js';
import { uploadImage } from '../services/cloudflareImagesService.js';
import { extractProductInfo } from '../services/geminiProductExtractor.js';

// Slides qui incluent la photo produit dans le visuel
const SLIDES_WITH_PRODUCT_IMAGE = new Set(['benefits', 'how-to-use', 'trust', 'comparison', 'social-proof']);

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
      console.log('📊 Extracting product info from URL via Gemini...');
      const extracted = await extractProductInfo(url);
      productInfo.title = extracted?.title || '';
      productInfo.description = (description ? description + '\n\n' : '') + (extracted?.description || '');
      console.log('✅ Gemini extraction:', productInfo.title || 'unknown');
    } catch (err) {
      console.warn('⚠️ Gemini extraction failed:', err.message);
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
  if (!groq) throw new Error('Clé GROQ_API_KEY non configurée');

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
    model: 'llama-3.3-70b-versatile',
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
  if (start === -1 || end === -1) throw new Error('Réponse Groq invalide');
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

function buildCreativePrompt(analysis, format, hasRefImage) {
  const { productName, keyBenefits, painPoints, usageSteps, targetAudience, brandColors, slogans, emotionalHook, category } = analysis;
  const name = productName || 'produit';
  const benefits = (keyBenefits || []).slice(0, 4);
  const b1 = benefits[0] || 'Efficace';
  const b2 = benefits[1] || 'Naturel';
  const b3 = benefits[2] || 'Premium';
  const b4 = benefits[3] || 'Satisfaction garantie';
  const problems = (painPoints || []).slice(0, 4);
  const p1 = problems[0] || 'Fatigue';
  const p2 = problems[1] || 'Stress';
  const p3 = problems[2] || 'Inconfort';
  const p4 = problems[3] || 'Routine difficile';
  const steps = (usageSteps || []).slice(0, 3);
  const s1 = steps[0] || 'Ouvrir';
  const s2 = steps[1] || 'Appliquer';
  const s3 = steps[2] || 'Profiter du résultat';
  const accent = brandColors || 'vert menthe et blanc';
  const audience = targetAudience || 'jeune femme africaine';
  const slogan = (slogans || [])[0] || emotionalHook || `Découvrez ${name}`;

  // Adapt visual style based on product category
  const style = getCategoryStyle(category, brandColors);

  const refImageInstruction = hasRefImage
    ? 'CRITICAL — PRODUCT IMAGE: A reference product image is provided. You MUST reproduce the exact real product packaging faithfully: same colors, same logo, same label design, same shape. Never invent a generic product.'
    : 'No reference image provided — create a realistic professional product render consistent with the product description.';

  const COMMON_RULES = `
═══════════════════════════════════════════════════════════════
STYLE OBLIGATOIRE — Listing E-commerce Premium HD
═══════════════════════════════════════════════════════════════

${refImageInstruction}

QUALITÉ & RÉSOLUTION:
- Image CARRÉE 1:1, rendu ULTRA HD photoréaliste, qualité impression magazine
- Netteté maximale sur tous les éléments: texte razor-sharp, produit hyper-détaillé
- Zéro flou, zéro pixélisation, zéro artefact de génération
- Eclairage studio professionnel 3 points: fill light doux + key light latéral + rim light pour le produit

FOND (adapté à la catégorie "${category || 'général'}"):
- ${style.bgStyle}
- JAMAIS de texture aléatoire ou motif incohérent avec le produit
- Le fond doit renforcer l'identité du produit, pas la diluer

PRODUIT (élément le plus important):
- TOUJOURS intégrer l'image réelle du produit fournie en référence. Reproduire fidèlement le packaging: couleurs, logo, étiquette, forme exacte
- Rendu 3D hyper-réaliste: éclairage studio dramatique, ombres douces portées au sol, reflets subtils sur les surfaces
- Le produit occupe 40-60% de l'espace visuel selon le type de slide
- JAMAIS de produit générique ou inventé si une image de référence est fournie

ÉLÉMENTS DÉCORATIFS (adaptés à la catégorie):
- ${style.decorativeElements}

BADGE CERTIF (présent sur CHAQUE slide):
- ${style.badge}
- Effet gaufré, ombre légère, look sceau officiel certifié

AUTRES BADGES & SCEAUX:
- Style tampon rond, fond plein vert foncé ou couleur accent ${accent}
- Icône blanche au centre, texte court en arc autour
- Disposition: colonnes verticales à gauche du produit OU arc autour du produit

TYPOGRAPHIE:
- Titres: Police sans-serif BOLD CONDENSÉE très épaisse (style Impact / Montserrat ExtraBold)
- MAJUSCULES, couleur noir charbon ou bleu marine très foncé (#0d1b2e)
- Titres GRANDS et dominants — doivent être lus en premier
- Corps: police propre lisible, jamais inférieur à ce qui serait lisible sur mobile
- Texte UNIQUEMENT en FRANÇAIS. AUCUN texte anglais sauf badges génériques (ALL NATURAL, GMO FREE etc.)
- AUCUN Lorem ipsum, AUCUN placeholder, AUCUN texte inventé illisible

PERSONNAGES (quand présents):
- ${style.personStyle}
- Personnes noires africaines, peau foncée à ébène, traits africains authentiques
- Coiffures naturelles africaines: tresses, locks, afro, turban wax
- Expressions vivantes, sourires naturels confiants, énergie positive
- Qualité portrait magazine: éclairage studio chaud, mise au point nette, pas de flou artistique excessif

AMBIANCE GLOBALE: ${style.mood}
═══════════════════════════════════════════════════════════════`;

  const styleAccent = style.accentColor;
  const styleBadge = style.badge;
  const styleDecorations = style.decorativeElements;

  const slidePrompts = {
    // ── 1. Problème / Solution ──────────────────────────────────────────────────
    'problem-solution': `
Generate a ULTRA HD square 1:1 professional e-commerce listing image for "${name}" — Before/After split screen style. Ultra-sharp, photorealistic, print-quality render.

LAYOUT — SPLIT SCREEN vertical, 2 equal halves:

LEFT HALF "LE PROBLÈME" (before):
- Background: cold desaturated grey-white
- Top label: "LE PROBLÈME" in large bold condensed uppercase black letters
- Scene: African person (dark ebony skin) with expression of fatigue/stress/discomfort. Cold studio lighting, slightly desaturated mood
- 2-3 floating rounded pill-badges in dark red (#8b1a1a), white icon + white text: "${p1}" / "${p2}" / "${p3}"

RIGHT HALF "LA SOLUTION" (after):
- Background: ${style.bgStyle}
- Top label: "LA SOLUTION" in large bold condensed uppercase letters, color: ${styleAccent}
- Product "${name}": exact faithful reproduction of the provided reference product image. Hero shot 3D: dramatic studio lighting, soft ground shadow, subtle reflections. LARGE and prominent
- 3 certification badges in vertical column (left of product): ${styleAccent} fill, white icon + text in arc: "${b1}" / "${b2}" / "Résultats Garantis"
- ${styleDecorations}

CENTER DIVIDER:
- Bold curved arrow or gradient transition stripe between the two halves

TOP of full image:
- ${styleBadge}

Typography: bold condensed sans-serif, ultra-sharp, French only. Zero blur, zero artifacts.
${COMMON_RULES}`,

    // ── 2. Bénéfices ────────────────────────────────────────────────────────────
    'benefits': `
Generate a ULTRA HD square 1:1 professional e-commerce listing image for "${name}" — lifestyle benefits style. Ultra-sharp, photorealistic, print-quality render.

LAYOUT:
- Background: ${style.bgStyle}
- TOP-LEFT: ${styleBadge}
- HEADLINE top-center: "${slogan}" in LARGE bold condensed uppercase very dark navy (#0d1b2e). Dominant
- SUBTITLE below headline: "Simplifie votre quotidien" italic dark grey

- RIGHT SIDE (60% width): Product "${name}" — exact faithful reproduction of the provided reference product image. 3D hero shot, dramatic studio lighting (3-point), soft drop shadow, subtle packaging reflections. VERY LARGE, fills right portion
- LEFT SIDE: ${style.personStyle}, holding or using "${name}". Warm studio lighting, magazine portrait quality

- 4 round certification badges in vertical column along left edge, color ${styleAccent}, each: white icon + text in arc:
  "${b1}" / "${b2}" / "${b3}" / "Qualité Premium"

- ${styleDecorations}

- BOTTOM: Pill badge color ${styleAccent}: ★★★★★ + "Approuvé par nos clients"

Typography: bold condensed sans-serif, ultra-sharp, French only.
${COMMON_RULES}`,

    // ── 3. Situations d'usage (grille 2×2) ─────────────────────────────────────
    'target': `
Generate a ULTRA HD square 1:1 professional e-commerce listing image for "${name}" — 4 usage situations grid. Ultra-sharp, photorealistic, print-quality render.

LAYOUT — 2×2 equal grid with thin separator lines:

TOP BANNER (full width, above grid):
- Background: ${styleAccent} — dark, rich color
- Text: "${name.toUpperCase()} — Partout avec vous" bold condensed white, large

GRID (4 equal cells, consistent lighting and color palette matching the brand):

TOP-LEFT "À LA MAISON":
- Setting appropriate for "${name}" home use
- ${style.personStyle} using "${name}" at home, natural expression
- Bottom overlay label: white bold "🏠 Maison" on dark semi-transparent strip

TOP-RIGHT "AU TRAVAIL":
- Modern bright professional setting
- African person focused, product used in professional context
- Bottom overlay label: white bold "💼 Travail"

BOTTOM-LEFT "EN DÉPLACEMENT":
- Outdoor / urban / transport setting, bright daylight
- African person in movement, product easily accessible
- Bottom overlay label: white bold "🚗 Déplacement"

BOTTOM-RIGHT "AU QUOTIDIEN":
- Simple everyday life scene, authentic
- Product "${name}" clearly visible (exact packaging from reference if provided)
- Bottom overlay label: white bold "⭐ Quotidien"

TOP corner of full image: ${styleBadge}

Typography: bold condensed sans-serif, ultra-sharp, French only.
${COMMON_RULES}`,

    // ── 4. Mode d'emploi ────────────────────────────────────────────────────────
    'how-to-use': `
Generate a ULTRA HD square 1:1 professional e-commerce listing image for "${name}" — how to use / step-by-step style. Ultra-sharp, photorealistic, print-quality render.

LAYOUT:
- Background: ${style.bgStyle}
- TOP-LEFT: ${styleBadge}
- TOP-LEFT HEADLINE: "MODE D'EMPLOI" in VERY LARGE bold condensed uppercase dark navy — dominates upper-left quarter
- SUBTITLE: "Découvrez des résultats MAXIMUM" italic grey, word MAXIMUM in bold ${styleAccent} color

- TOP-RIGHT: ${style.personStyle}, holding "${name}" product. Half-bust. Warm studio lighting, magazine quality

- CENTER-LEFT area: 3 steps with large numbered circles (solid ${styleAccent} fill, white number):
  ① Large circle "1" + icon above + text: "${s1}"
  ② Large circle "2" + icon above + text: "${s2}"
  ③ Large circle "3" + icon above + text: "${s3}"
  Thin arrows connecting the 3 steps horizontally

- BOTTOM-CENTER: Product "${name}" — exact faithful reproduction of reference image. Flat lay or standing, elegant studio lighting

- ${styleDecorations}

Typography: bold condensed sans-serif, ultra-sharp, French only.
${COMMON_RULES}`,

    // ── 5. Confiance & Qualité ──────────────────────────────────────────────────
    'trust': `
Generate a ULTRA HD square 1:1 professional e-commerce listing image for "${name}" — trust and quality style. Ultra-sharp, photorealistic, print-quality render.

LAYOUT:
- Background: ${style.bgStyle}
- TOP-LEFT: ${styleBadge}
- HEADLINE: "PUISSANT & EFFICACE" in VERY LARGE bold condensed uppercase dark navy — dominant
- SUBTITLE: "${b1} · ${b2} · ${b3}" condensed bold, color ${styleAccent}

- CENTER: Product "${name}" — exact faithful reproduction of the reference product image. MASSIVE central hero shot. 3D hyper-realistic studio lighting (dramatic, 3-point), soft drop shadow at base, subtle reflections on packaging surface. The product IS the star.

- 4 round certification badges arranged in arc around the product (left column + right column):
  Each badge: ${styleAccent} fill, white icon center, text in arc, embossed stamp look
  "${b1}" / "${b2}" / "${b3}" / "Testé & Approuvé"
  Thin curved connecting lines from badges to product

- ${styleDecorations}

Typography: bold condensed sans-serif, ultra-sharp, French only.
${COMMON_RULES}`,

    // ── 6. Comparaison ──────────────────────────────────────────────────────────
    'comparison': `
Generate a ULTRA HD square 1:1 professional e-commerce listing image for "${name}" — comparison table style. Ultra-sharp, photorealistic, print-quality render.

LAYOUT:
- Background: ${style.bgStyle}
- TOP-LEFT: ${styleBadge}
- HEADLINE: "COMPAREZ AVEC LES AUTRES" VERY LARGE bold condensed uppercase dark navy — dominant

- TWO PRODUCTS side by side (upper half):
  LEFT — OUR PRODUCT: "${name}" — exact faithful reproduction of reference image. Beautiful 3D hero shot, studio lighting, vivid colors, sharp packaging. Label below: "Notre Produit" bold ${styleAccent}. ${styleDecorations} around it.
  RIGHT — OTHER BRANDS: Generic/blurred grey bottle/package, no logo, faded, desaturated. Label below: "Autres Marques" grey italic

- COMPARISON TABLE (lower half), 2 columns clearly separated:
  Column headers: "${name}" (${styleAccent} background, white bold) | "Autres" (grey background, white)
  6 rows, criteria on left, check/cross on right:
  "Facile à utiliser" → ✅ | ❌
  "Résultats rapides" → ✅ | ❌
  "${b1}" → ✅ | ❌
  "${b2}" → ✅ | ❌
  "Qualité Premium" → ✅ | ❌
  "Satisfaction Garantie" → ✅ | ❌

- BOTTOM: Pill badge "${name} — Le Meilleur Choix" ${styleAccent} background, white bold text

Visual contrast OBVIOUS: our product beautiful and vibrant vs other grey and faded.
Typography: bold condensed sans-serif, ultra-sharp, French only.
${COMMON_RULES}`,

    // ── 7. Preuve sociale ───────────────────────────────────────────────────────
    'social-proof': `
Generate a ULTRA HD square 1:1 professional e-commerce listing image for "${name}" — social proof testimonials style. Ultra-sharp, photorealistic, print-quality render.

LAYOUT:
- Background: ${style.bgStyle}
- TOP-LEFT: ${styleBadge}
- HEADLINE: "ILS ADORENT CE PRODUIT" VERY LARGE bold condensed uppercase dark navy — dominant
- ★★★★★ golden stars row directly below headline

- 4 TESTIMONIAL CARDS in 2×2 grid, each card:
  • White background, rounded corners (12px), soft drop shadow
  • Round profile photo (border ${styleAccent}): African person, dark ebony skin (woman with braids / man with beard / woman with wax turban / woman with afro). Natural expressions — genuine satisfaction, real-life feel, NOT stock photo look
  • ★★★★★ golden stars below photo
  • Short bold quote in quotes:
    "Franchement ça m'a changé la vie !" | "Je l'utilise tous les jours" | "Super pratique et efficace !" | "Résultats visibles rapidement"
  • First name: "— Aminata K." | "— Ousmane D." | "— Fatou M." | "— Grâce T."

- Product "${name}" — exact reference image reproduction — visible bottom-center, small but recognizable

- ${styleDecorations}

- BOTTOM: Wide pill badge: ★ "Plus de 2 000 clients satisfaits" ${styleAccent} background, white bold text

Typography: bold condensed sans-serif, ultra-sharp, French only.
${COMMON_RULES}`,
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
router.post('/', requireEcomAuth, upload.single('productImage'), async (req, res) => {
  try {
    const { url, description, formats: formatsRaw } = req.body;
    const formats = typeof formatsRaw === 'string' ? JSON.parse(formatsRaw) : formatsRaw;
    const productImageBuffer = req.file?.buffer || null;

    // Require at least image OR (url OR description)
    if (!productImageBuffer && !url && !description) {
      return res.status(400).json({ error: 'Veuillez fournir une image produit et/ou un lien ou une description' });
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
    console.log(`🖼️ Step 2: Génération de ${selectedFormats.length} créa(s)${hasImage ? ' avec image produit' : ' (text-to-image)'}...`);
    const creatives = [];
    const statsBefore = getImageGenerationStats();

    for (const format of selectedFormats) {
      try {
        const imagePrompt = buildCreativePrompt(analysis, format, hasImage);
        const useProductImage = hasImage && SLIDES_WITH_PRODUCT_IMAGE.has(format.slideType);
        console.log(`  🎨 Generating ${format.id} (${useProductImage ? 'image-to-image' : 'text-only'})...`);
        
        let imageDataUrl;
        if (useProductImage) {
          imageDataUrl = await generateNanoBananaImageToImage(imagePrompt, resolvedImageBuffer, format.aspectRatio, 1);
        } else {
          imageDataUrl = await generateNanoBananaImage(imagePrompt, format.aspectRatio, 1);
        }
        
        if (imageDataUrl) {
          let finalUrl = imageDataUrl;
          try {
            // Convert data URL to buffer for R2 upload
            const base64Match = imageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
            if (base64Match) {
              const imgBuffer = Buffer.from(base64Match[1], 'base64');
              const uploaded = await uploadImage(imgBuffer, `creative-${format.id}.png`, {
                workspaceId: req.workspaceId || 'creative',
                uploadedBy: req.userId || 'creative-generator',
                optimize: false,
              });
              if (uploaded?.url) finalUrl = uploaded.url;
            }
          } catch (uploadErr) {
            console.warn('⚠️ Upload R2 failed, returning base64:', uploadErr.message);
          }

          creatives.push({
            id: format.id,
            label: format.label,
            aspectRatio: format.aspectRatio,
            imageUrl: finalUrl,
            usedProductImage: useProductImage,
          });
          console.log(`  ✅ ${format.id} generated`);
        } else {
          creatives.push({
            id: format.id, label: format.label, aspectRatio: format.aspectRatio,
            imageUrl: null, error: 'Génération échouée',
          });
          console.warn(`  ❌ ${format.id} failed`);
        }
      } catch (imgErr) {
        console.error(`  ❌ ${format.id} error:`, imgErr.message);
        creatives.push({
          id: format.id, label: format.label, aspectRatio: format.aspectRatio,
          imageUrl: null, error: imgErr.message,
        });
      }
    }

    // Calculate cost for this generation batch
    const statsAfter = getImageGenerationStats();
    const batchCost = {
      images: statsAfter.totalImages - statsBefore.totalImages,
      costUsd: +(statsAfter.totalCostUsd - statsBefore.totalCostUsd).toFixed(3),
      costFcfa: statsAfter.totalCostFcfa - statsBefore.totalCostFcfa,
    };
    console.log(`💰 Batch total: ${batchCost.images} images → ~$${batchCost.costUsd} (~${batchCost.costFcfa} FCFA)`);

    res.json({
      success: true,
      analysis,
      creatives,
      formats: CREATIVE_FORMATS,
      productImageFound: hasImage,
      cost: batchCost,
    });
  } catch (err) {
    console.error('❌ Creative Generator error:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la génération' });
  }
});

// ── GET /api/ai/creative-generator/formats ────────────────────────────────────
router.get('/formats', requireEcomAuth, async (_req, res) => {
  res.json({ formats: CREATIVE_FORMATS });
});

export default router;
