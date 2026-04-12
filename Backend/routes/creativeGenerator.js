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
import { generateNanoBananaImageToImage, getImageGenerationStats } from '../services/nanoBananaService.js';
import { uploadImage } from '../services/cloudflareImagesService.js';
import { extractProductInfo } from '../services/geminiProductExtractor.js';
import FeatureUsageLog from '../models/FeatureUsageLog.js';

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

function buildCreativePrompt(analysis, format, hasRefImage, visualTemplate = 'general') {
  const { productName, keyBenefits, painPoints, usageSteps, targetAudience, brandColors, slogans, emotionalHook, category } = analysis;
  const name = 'the product';
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

  // Adapt visual style based on template choice (fallback to AI category)
  const finalCategory = (visualTemplate && visualTemplate !== 'general') ? visualTemplate : category;
  const style = getCategoryStyle(finalCategory, brandColors);

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
  const benefitIcons = style.benefitIcons || [`✅ ${b1}`, `⚡ ${b2}`, `🌟 ${b3}`, `🛡️ ${b4}`];
  const bi1 = benefitIcons[0];
  const bi2 = benefitIcons[1];
  const bi3 = benefitIcons[2];
  const bi4 = benefitIcons[3];
  const trustBadges = style.trustBadges || ['QUALITÉ PREMIUM', 'CERTIFIÉ', 'GARANTI', 'APPROUVÉ'];
  const tb1 = trustBadges[0]; const tb2 = trustBadges[1]; const tb3 = trustBadges[2]; const tb4 = trustBadges[3];
  const cmpCriteria = style.comparisonCriteria || ['Qualité', 'Efficacité', 'Durabilité', 'Rapport qualité/prix', 'Service', 'Garantie'];
  const c1 = cmpCriteria[0]; const c2 = cmpCriteria[1]; const c3 = cmpCriteria[2];
  const c4 = cmpCriteria[3]; const c5 = cmpCriteria[4]; const c6 = cmpCriteria[5];
  const solutionHighlight = style.solutionHighlight || 'soft accent color glow around product';
  const layoutStyle = style.layoutStyle || 'generic-premium';

  const slidePrompts = {
    // ── 1. Problème / Solution ──────────────────────────────────────────────────
    'problem-solution': `
Generate a ULTRA HD square 1:1 professional e-commerce listing image for "${name}" (category: ${category || 'général'}) — Before/After split screen. Ultra-sharp, photorealistic, print-quality.

LAYOUT STYLE: ${layoutStyle} — SPLIT SCREEN vertical, 2 equal halves

LEFT HALF "LE PROBLÈME" (before state):
- Background: cold desaturated grey-white (#f0f0f0), slightly dark and bleak atmosphere
- Top label: "LE PROBLÈME" in large bold condensed uppercase black letters
- Scene: African person (dark ebony skin) with expression matching the problem context for ${name}. Cold flat lighting, desaturated, slightly blurred background
- 3 floating rounded pill-badges in dark red (#8b1a1a), white icon + white text:
  "😔 ${p1}" / "😓 ${p2}" / "😩 ${p3}"
- Subtle cold color grading: slight blue-grey tint on entire left half

RIGHT HALF "LA SOLUTION" (after state):
- Background: ${style.bgStyle} — vibrant, warm, bright
- Top label: "LA SOLUTION" in large bold condensed uppercase, color: ${styleAccent}
- Product "${name}": exact faithful reproduction of reference image. Hero shot 3D: ${solutionHighlight}. LARGE and prominent — 50% of right half
- ${style.personStyle}, transformed expression — relief, happiness, confidence
- 3 certification badges in vertical column (left of product): ${styleAccent} fill, white icon + text:
  "${bi1}" / "${bi2}" / "${bi3}"
- ${styleDecorations}

CENTER DIVIDER:
- Bold curved arrow (${styleAccent} color) with text "LA DIFFÉRENCE ${name.toUpperCase()}" pointing right
- Gradient transition stripe using ${styleAccent}

TOP-LEFT corner: ${styleBadge}

BOTTOM full width: pill badge "${slogan}" — ${styleAccent} background, white bold text

Typography: bold condensed sans-serif, ultra-sharp, French only. Zero blur, zero artifacts.
${COMMON_RULES}`,

    // ── 2. Bénéfices ────────────────────────────────────────────────────────────
    'benefits': `
Generate a ULTRA HD square 1:1 professional e-commerce listing image for "${name}" (category: ${category || 'général'}) — key benefits lifestyle style. Ultra-sharp, photorealistic, print-quality.

LAYOUT STYLE: ${layoutStyle} — hero product + person + 4 benefit icons

Background: ${style.bgStyle}
TOP-LEFT corner: ${styleBadge}

HEADLINE (top-center, VERY LARGE bold condensed uppercase dark navy #0d1b2e):
"${slogan}"
SUBTITLE below: "${b1} · ${b2} · ${b3}" in bold condensed ${styleAccent} color

RIGHT SIDE (55% width): Product "${name}" — exact faithful reproduction of reference image. 3D hero shot with ${solutionHighlight}. VERY LARGE, fills right portion. Ultra-detailed packaging.

LEFT SIDE: ${style.personStyle}, naturally holding or using "${name}" in context appropriate for ${category || 'le produit'}. Half-body, warm studio lighting, magazine portrait quality.

4 BENEFIT ICON BLOCKS (arranged vertically on left, or 2×2 grid at bottom):
Each block: rounded square card (white or semi-transparent), icon above, short text below — color ${styleAccent}
  Card 1: ${bi1}
  Card 2: ${bi2}
  Card 3: ${bi3}
  Card 4: ${bi4}

${styleDecorations}

BOTTOM: pill badge (${styleAccent} bg, white text): ★★★★★ "Approuvé par des milliers de clients"

Typography: bold condensed sans-serif, ultra-sharp, French only. Every benefit text in French, clear and large.
${COMMON_RULES}`,

    // ── 3. Situations d'usage (grille 2×2) ─────────────────────────────────────
    'target': `
Generate a ULTRA HD square 1:1 professional e-commerce listing image for "${name}" (category: ${category || 'général'}) — 4 real-life usage situations grid. Ultra-sharp, photorealistic, print-quality.

LAYOUT STYLE: ${layoutStyle} — 2×2 grid showing product in context

TOP BANNER (full width, above grid):
- Background: ${styleAccent} — rich, deep color fill
- Text: "${name.toUpperCase()} — ${slogan}" bold condensed white, very large

GRID — 4 equal square cells, thin ${styleAccent} separator lines between:
Consistent warm lighting and brand color palette across all 4 cells.

TOP-LEFT cell — "LA MAISON":
- ${style.personStyle} using "${name}" in a home context relevant to this product
- Product visible (faithfully reproduced packaging if reference provided)
- Bottom label strip (${styleAccent} semi-transparent): white bold "🏠 À la maison"

TOP-RIGHT cell — "AU TRAVAIL" ou "EN SOCIÉTÉ":
- African person in professional or social setting using "${name}"
- Modern bright African office or outdoor urban space
- Bottom label strip: white bold "💼 Au travail"

BOTTOM-LEFT cell — "EN DÉPLACEMENT":
- Outdoor scene (market, street, car), African person on the move with "${name}"
- Bright natural daylight, vibrant colors
- Bottom label strip: white bold "🚶 En déplacement"

BOTTOM-RIGHT cell — "CHAQUE JOUR":
- Simple authentic everyday moment, product used naturally
- Product "${name}" clearly visible and prominent
- Bottom label strip: white bold "⭐ Chaque jour"

TOP-LEFT corner of full image: ${styleBadge}

Typography: bold condensed sans-serif, ultra-sharp, French only.
${COMMON_RULES}`,

    // ── 4. Mode d'emploi ────────────────────────────────────────────────────────
    'how-to-use': `
Generate a ULTRA HD square 1:1 professional e-commerce listing image for "${name}" (category: ${category || 'général'}) — step-by-step how-to-use. Ultra-sharp, photorealistic, print-quality.

LAYOUT STYLE: ${layoutStyle} — numbered steps with product + person

Background: ${style.bgStyle}
TOP-LEFT: ${styleBadge}

TOP area:
- LEFT: HEADLINE "MODE D'EMPLOI" in VERY LARGE bold condensed uppercase dark navy (#0d1b2e) — dominant
- SUBTITLE: "Résultats GARANTIS en ${s3.length < 30 ? '3 étapes simples' : 'quelques étapes'}" italic grey, word GARANTIS in ${styleAccent}
- RIGHT: ${style.personStyle}, holding or using "${name}" — half-bust portrait, warm magazine lighting

CENTER — 3 NUMBERED STEPS horizontal flow:
Step 1: Large numbered circle (${styleAccent} fill, white "1"), relevant icon above (🖐️ or 📦 or 🌿 depending on context), bold text: "${s1}"
→ Arrow (${styleAccent} color, right-pointing)
Step 2: Large numbered circle (${styleAccent} fill, white "2"), relevant icon above (💧 or ✋ or 🔧), bold text: "${s2}"
→ Arrow (${styleAccent} color, right-pointing)
Step 3: Large numbered circle (${styleAccent} fill, white "3"), relevant icon above (✨ or 💪 or ⚡), bold text: "${s3}"

BOTTOM-CENTER: Product "${name}" — exact faithful reproduction of reference image. Flat lay or standing on surface with ${solutionHighlight}. Surrounded by ${styleDecorations}

BOTTOM-RIGHT: pill badge "${tb1}" — ${styleAccent} background, white bold

Typography: bold condensed sans-serif, ultra-sharp, French only. Steps large and easy to read.
${COMMON_RULES}`,

    // ── 5. Confiance & Qualité ──────────────────────────────────────────────────
    'trust': `
Generate a ULTRA HD square 1:1 professional e-commerce listing image for "${name}" (category: ${category || 'général'}) — trust, quality, certification style. Ultra-sharp, photorealistic, print-quality.

LAYOUT STYLE: ${layoutStyle} — centered product surrounded by certification badges

Background: ${style.bgStyle}
TOP-LEFT: ${styleBadge}

HEADLINE (top, VERY LARGE bold condensed uppercase dark navy #0d1b2e):
"${b1.toUpperCase()} & ${b2.toUpperCase()}"
SUBTITLE: "${b3} · ${b4}" condensed bold, color ${styleAccent}

CENTER: Product "${name}" — MASSIVE central hero shot. Exact faithful reproduction of reference image. 3D hyper-realistic: ${solutionHighlight}, soft drop shadow, subtle packaging reflections. Product IS the star — occupies 50-60% of frame.

${styleDecorations} placed in corners and edges, not covering the product

6 ROUND CERTIFICATION BADGES arranged symmetrically (3 left column + 3 right column) flanking the product:
Each badge: ${styleAccent} fill, white icon center, text in arc, embossed wax stamp look, thin curved line connecting to product
  LEFT: "${tb1}" (with relevant icon) / "${bi1}" / "${b1}"
  RIGHT: "${tb2}" (with relevant icon) / "${bi2}" / "${b2}"

BOTTOM: Horizontal strip of 4 quality trust seals (dark navy background):
  "${tb1}" | "${tb2}" | "${tb3}" | "${tb4}"

Typography: bold condensed sans-serif, ultra-sharp, French only.
${COMMON_RULES}`,

    // ── 6. Comparaison ──────────────────────────────────────────────────────────
    'comparison': `
Generate a ULTRA HD square 1:1 professional e-commerce listing image for "${name}" (category: ${category || 'général'}) — vs competition comparison table. Ultra-sharp, photorealistic, print-quality.

LAYOUT STYLE: ${layoutStyle} — comparison split

Background: ${style.bgStyle}
TOP-LEFT: ${styleBadge}

HEADLINE (VERY LARGE bold condensed uppercase dark navy):
"POURQUOI CHOISIR ${name.toUpperCase()} ?"

TWO PRODUCTS side by side (upper 40% of image):
LEFT — "${name}" (OUR PRODUCT):
  • Exact faithful reproduction of reference image, vivid colors, brilliant studio lighting with ${solutionHighlight}
  • ${styleDecorations} surrounding it
  • Label below: "✅ ${name}" bold ${styleAccent}

RIGHT — "Autres Marques" (COMPETITION):
  • Generic grey/blurred product silhouette, no logo, faded and desaturated, cold lighting
  • Label below: "❌ Autres marques" grey italic

COMPARISON TABLE (lower 50% of image), clear white background, 3 columns:
  Header left: "Critères" (grey) | Header center: "${name}" (${styleAccent} bg, white bold) | Header right: "Autres" (grey bg, white)
  Row 1: "${c1}" → ✅ Excellent | ❌ Insuffisant
  Row 2: "${c2}" → ✅ Prouvé | ❌ Non garanti
  Row 3: "${c3}" → ✅ Oui | ❌ Rare
  Row 4: "${c4}" → ✅ Meilleur | ❌ Médiocre
  Row 5: "${c5}" → ✅ Inclus | ❌ Absent
  Row 6: "${c6}" → ✅ Garanti | ❌ Aucune

BOTTOM: Wide pill badge "${name} — LE MEILLEUR CHOIX" ${styleAccent} background, white bold text, star icons

Visual contrast EXTREME: our product luminous and vibrant vs others dull and grey.
Typography: bold condensed sans-serif, ultra-sharp, French only.
${COMMON_RULES}`,

    // ── 7. Preuve sociale ───────────────────────────────────────────────────────
    'social-proof': `
Generate a ULTRA HD square 1:1 professional e-commerce listing image for "${name}" (category: ${category || 'général'}) — customer testimonials social proof. Ultra-sharp, photorealistic, print-quality.

LAYOUT STYLE: ${layoutStyle} — testimonial grid

Background: ${style.bgStyle}
TOP-LEFT: ${styleBadge}

HEADLINE (VERY LARGE bold condensed uppercase dark navy):
"ILS ADORENT ${name.toUpperCase()}"
★★★★★ row of 5 golden stars directly below headline (bright golden yellow)

4 TESTIMONIAL CARDS — 2×2 grid (each card white rounded rectangle, 12px radius, soft drop shadow):
Card 1:
  • Round profile photo (${styleAccent} border): African woman, dark ebony skin, natural braids, genuine happy expression
  • ★★★★★ golden stars
  • Quote: "« Vraiment efficace, je recommande à 100% ! »"
  • Name: "— Aminata K., Dakar"

Card 2:
  • Round profile photo: African man, beard, warm confident smile
  • ★★★★★
  • Quote: "« Je l'utilise tous les jours, c'est devenu indispensable »"
  • Name: "— Ousmane D., Abidjan"

Card 3:
  • Round profile photo: African woman, wax turban, radiant expression
  • ★★★★★
  • Quote: "« Les résultats sont visibles très rapidement ! »"
  • Name: "— Fatou M., Bamako"

Card 4:
  • Round profile photo: Young African woman, afro hair, natural smile
  • ★★★★★
  • Quote: "« Qualité exceptionnelle, livraison rapide »"
  • Name: "— Grâce T., Lomé"

CENTER (between/below cards): Product "${name}" — exact reference image, ${solutionHighlight}, small but clearly recognizable. ${styleDecorations} around it.

BOTTOM: Wide pill badge: ★ "Plus de 2 000 clients satisfaits en Afrique" ${styleAccent} background, white bold text

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
    const { url, description, formats: formatsRaw, visualTemplate } = req.body;
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
    
    // STRICT: block generation without product image — all operations must be image-to-image
    if (!hasImage) {
      return res.status(400).json({ success: false, error: 'Aucune image produit fournie — impossible de générer en mode image-to-image. Uploadez une photo du produit.' });
    }
    
    console.log(`🖼️ Step 2: Génération de ${selectedFormats.length} créa(s) avec image produit (image-to-image)...`);
    const creatives = [];
    const statsBefore = getImageGenerationStats();

    for (const format of selectedFormats) {
      try {
        const imagePrompt = buildCreativePrompt(analysis, format, true, visualTemplate);
        console.log(`  🎨 Generating ${format.id} (image-to-image)...`);
        
        let imageDataUrl;
        imageDataUrl = await generateNanoBananaImageToImage(imagePrompt, resolvedImageBuffer, format.aspectRatio, 1);
        
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

    // Track feature usage
    if (req.workspaceId && req.userId) {
      FeatureUsageLog.create({
        workspaceId: req.workspaceId,
        userId: req.userId,
        feature: 'creative_generator',
        meta: {
          slideCount: creatives.length,
          success: true
        }
      }).catch(() => {});
    }

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
