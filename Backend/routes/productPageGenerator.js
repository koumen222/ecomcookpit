/**
 * Product Page Generator Route
 * POST /api/ai/product-generator
 *
 * Architecture simple & fiable :
 * 1. Scrape title + description (minimal)
 * 2. Clean text
 * 3. GPT → JSON structuré (angles, raisons, FAQ, description, prompts affiches)
 * 4. Parse JSON
 * 5. Loop angles → generate 3 affiches publicitaires
 * 6. Assemble product page
 */

import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import { analyzeWithVision, generatePosterImage } from '../services/productPageGeneratorService.js';
import { uploadImage } from '../services/cloudflareImagesService.js';
import { extractProductInfo } from '../services/geminiProductExtractor.js';
import EcomWorkspace from '../models/Workspace.js';
import FeatureUsageLog from '../models/FeatureUsageLog.js';

const router = express.Router();

// ─── Image prompt builders ────────────────────────────────────────────────────

/**
 * Hero PRO — African Facebook-ads layout:
 * TOP: bold headline (keyword in red) | LEFT: product large | RIGHT: person showing RESULT
 * LEFT overlay: red CTA badge + curved arrow pointing to product
 */
function buildHeroPrompt(gptResult, hasProductRef) {
  const productName = gptResult.title || 'product';
  const targetPerson = gptResult.hero_target_person || 'beautiful young African woman';
  const ctaText = (gptResult.hero_cta || 'JE COMMANDE MAINTENANT').toUpperCase();

  // Headline: use the hero_headline or derive from the problem/solution
  const headline = gptResult.hero_headline
    ? gptResult.hero_headline.toUpperCase()
    : (gptResult.problem_section?.pain_points?.[0]
        ? `DITES ADIEU À ${gptResult.problem_section.pain_points[0].slice(0, 50).toUpperCase()} !`
        : `DÉCOUVREZ ${productName.toUpperCase()} — RÉSULTATS EN 7 JOURS !`);

  // Subheadline: hero_slogan or first sentence of solution
  const subheadline = gptResult.hero_slogan
    || gptResult.solution_section?.description?.split('.')[0]
    || `Le produit qui transforme votre quotidien et révèle votre vraie beauté.`;

  // Benefits: take the 4 benefits_bullets, strip emoji prefix for clean list
  const benefits = (gptResult.benefits_bullets || []).slice(0, 4).map(b =>
    b.replace(/^[\s\S]{1,3}/, '').trim().slice(0, 50)
  );
  while (benefits.length < 4) benefits.push('Résultats visibles rapidement');

  // Social proof badge
  const socialCount = gptResult.urgency_elements?.social_proof_count || '+5 000 clients satisfaits';
  const storeCountry = gptResult._storeCountry || '';
  const badgeText = storeCountry
    ? `${socialCount} au ${storeCountry}`
    : `${socialCount} — Avis vérifiés`;

  // Bottom trust labels from conversion_blocks or defaults
  const trustLabels = (gptResult.conversion_blocks || [])
    .slice(0, 4)
    .map(b => b.text || '')
    .filter(Boolean);
  if (trustLabels.length < 3) {
    trustLabels.push('Paiement à la livraison', 'Livraison rapide', 'Satisfait ou remboursé');
  }
  const labelsLine = trustLabels.slice(0, 4).join('  •  ');

  // Product placement description
  const productBlock = hasProductRef
    ? `THE EXACT product from the reference image (same packaging, shape, colors, label, every detail identical) — placed large and dominant on the LEFT side of the frame, on a glossy surface, studio lighting, ultra sharp`
    : `premium packaging of "${productName}" — placed large on the LEFT side, on a glossy surface, studio lighting, ultra sharp`;

  // Derive background color palette from product category
  const text = `${productName} ${subheadline}`.toLowerCase();
  let bgPalette, accentColor, personDescription;
  if (text.includes('orange') || text.includes('vitamine c') || text.includes('agrume')) {
    bgPalette = 'soft white to warm light orange gradient (#FFF8F0 to #FFE8CC)';
    accentColor = 'vivid orange (#FF6B00)';
  } else if (text.includes('blanc') || text.includes('éclat') || text.includes('glow') || text.includes('lumineux') || text.includes('tache') || text.includes('teint')) {
    bgPalette = 'soft white to pale gold gradient (#FFFFFF to #FFF8E7)';
    accentColor = 'warm gold (#D4A017)';
  } else if (text.includes('vert') || text.includes('naturel') || text.includes('aloe') || text.includes('bio') || text.includes('plante')) {
    bgPalette = 'soft white to light mint green gradient (#FFFFFF to #E8F5E9)';
    accentColor = 'emerald green (#059669)';
  } else if (text.includes('rose') || text.includes('femme') || text.includes('pink') || text.includes('beauty') || text.includes('beauté')) {
    bgPalette = 'soft white to blush pink gradient (#FFFFFF to #FFF0F3)';
    accentColor = 'deep rose (#C2185B)';
  } else if (text.includes('noir') || text.includes('charbon') || text.includes('détox') || text.includes('purifiant')) {
    bgPalette = 'soft white to light gray gradient (#FFFFFF to #F5F5F5)';
    accentColor = 'charcoal black (#212121)';
  } else {
    bgPalette = 'clean white to very light warm gradient (#FFFFFF to #FFF9F0)';
    accentColor = 'vibrant coral (#FF5722)';
  }

  // Person: adapt based on target
  const personLower = targetPerson.toLowerCase();
  if (personLower.includes('man') || personLower.includes('homme') || personLower.includes('male')) {
    personDescription = `handsome young African man, dark skin, short clean haircut, confident radiant smile, showing the positive result of using the product, healthy glowing look`;
  } else {
    personDescription = `beautiful young African woman, dark glowing skin, natural hair (afro or braids or pressed), radiant confident smile, showing the positive result of using the product, healthy luminous complexion`;
  }

  return `Ultra realistic high-end skincare advertising poster. Square 1:1. Professional product photography meets graphic design. 4K quality, sharp details, cinematic lighting.

═══ BACKGROUND ═══
${bgPalette}. Clean minimal fresh atmosphere. Bright studio lighting.

═══ LAYOUT (STRICT — 3 COLUMNS) ═══

LEFT COLUMN (35% of frame):
• ${productBlock}
• Around the product: 2-3 natural prop elements related to the product ingredients (sliced fruits, leaves, botanicals, or cream swatches — must match the product type)
• Clean glossy surface reflection under the product

CENTER COLUMN (30% of frame):
• ${personDescription}
• Upper body portrait, face and shoulders visible
• Warm professional studio lighting with soft rim light
• Expression: happy, confident, radiant — genuinely loving the product result
• Natural authentic African features

RIGHT COLUMN (35% of frame):
• 4 benefit items in a clean vertical list, each with a small colored icon:
  ✓ ${benefits[0]}
  ✓ ${benefits[1]}
  ✓ ${benefits[2]}
  ✓ ${benefits[3]}
• Clean modern sans-serif typography
• Icons in ${accentColor}

═══ TEXT OVERLAYS (MANDATORY — CRITICAL SPELLING) ═══

TOP of image (bold headline spanning full width):
"${headline}"
Font: large bold modern sans-serif, dark text with key transformation words in ${accentColor}

Below headline (subheadline, smaller):
"${subheadline}"
Font: medium weight, dark gray

CENTER TOP — Social proof badge (rounded pill shape, ${accentColor} background, white text):
"${badgeText} ✓"

BOTTOM STRIP (full width, light gray background):
Labels separated by bullets: "${labelsLine}"
Font: small, clean, professional

BOTTOM CENTER — CTA button (${accentColor} background, white bold text, rounded corners):
"${ctaText}"
Below button (tiny text): "Offre spéciale – stock limité"

═══ STYLE RULES ═══
• ALL French text: 100% PERFECT spelling with every accent (é, è, ê, à, ù, ç, î, ô etc). ZERO errors.
• NO price in numbers, NO phone number, NO URL, NO watermark
• Ultra sharp product details — every label and texture of the packaging perfectly visible
• Cinematic lighting with product glow and person rim light
• Modern typography: clean sans-serif, high contrast, perfectly aligned
• Mood: premium skincare brand launch, scroll-stopping, impossible to ignore`;
}

/**
 * Builds an image prompt that visually illustrates the SPECIFIC angle text shown above it.
 * The scene, person situation, and emotion are derived directly from the angle content.
 */
function buildAngleImagePrompt(angle, gptResult, hasProductRef, template = 'general') {
  const title = gptResult.title || 'product';
  const targetPerson = gptResult.hero_target_person || 'authentic Black African person';
  const problemSection = gptResult.problem_section || {};
  const solutionSection = gptResult.solution_section || {};

  const productNote = hasProductRef
    ? `THE EXACT SAME product from the reference image (same packaging, color, shape, label — critical) shown large and sharp`
    : `"${title}" product shown large and sharp`;

  // Extract angle content to drive the scene
  const angleTitle = (angle.titre_angle || '').slice(0, 120);
  const angleExplication = (angle.explication || angle.message_principal || '').slice(0, 200);
  const anglePromesse = (angle.promesse || '').slice(0, 100);

  // Detect the emotional/situational context from the angle text
  const text = `${angleTitle} ${angleExplication} ${anglePromesse}`.toLowerCase();

  // Determine scene situation based on angle content
  let sceneSituation = '';
  let personEmotion = '';
  let sceneContext = '';

  if (text.includes('problème') || text.includes('douleur') || text.includes('souffr') || text.includes('marre') || text.includes('fatiguée') || text.includes('terne')) {
    // PROBLEM angle → show the person experiencing the problem, relatable frustration
    sceneSituation = `African person showing the FRUSTRATION or PROBLEM described: "${angleTitle.slice(0, 80)}". Relatable real-life moment of experiencing this issue`;
    personEmotion = 'concerned, frustrated, but relatable — not exaggerated';
    sceneContext = 'everyday realistic setting where this problem occurs';
  } else if (text.includes('résultat') || text.includes('transformation') || text.includes('après') || text.includes('visible') || text.includes('efficace')) {
    // RESULT angle → show the clear positive outcome
    sceneSituation = `African person showing the POSITIVE RESULT described: "${angleTitle.slice(0, 80)}". Clear visible transformation or benefit`;
    personEmotion = 'radiant, confident, happy with results — genuine satisfaction';
    sceneContext = 'bright clean setting showing the improvement clearly';
  } else if (text.includes('naturel') || text.includes('ingrédient') || text.includes('formule') || text.includes('composition')) {
    // INGREDIENTS angle → show product in natural context
    sceneSituation = `African person with the product in a natural wellness context, ingredients or natural elements visible around them`;
    personEmotion = 'calm, confident, glowing health';
    sceneContext = 'natural setting with plants, warm light, clean aesthetic';
  } else if (text.includes('confiance') || text.includes('soi') || text.includes('belle') || text.includes('beau') || text.includes('rayonn')) {
    // CONFIDENCE angle → show person feeling great
    sceneSituation = `African person exuding confidence and self-assurance as described: "${anglePromesse.slice(0, 60)}"`;
    personEmotion = 'proud, confident, beaming — feeling their best';
    sceneContext = 'modern stylish setting, good lighting on face/body';
  } else if (text.includes('simple') || text.includes('facile') || text.includes('rapide') || text.includes('quotidien') || text.includes('routine')) {
    // SIMPLICITY angle → show easy everyday use
    sceneSituation = `African person using the product easily in their daily routine — showing how simple and natural it is`;
    personEmotion = 'relaxed, at ease, casually happy';
    sceneContext = 'everyday home or personal setting, morning or evening routine';
  } else if (text.includes('garantie') || text.includes('qualité') || text.includes('fiable') || text.includes('conforme') || text.includes('sécurité')) {
    // TRUST angle → show product quality, trust
    sceneSituation = `African person holding the product with trust and satisfaction — product quality clearly visible`;
    personEmotion = 'reassured, confident, nodding approval';
    sceneContext = 'clean neutral setting emphasizing quality and trust';
  } else {
    // Default → show person benefiting from the product in the context of the angle
    sceneSituation = `African person experiencing the benefit described: "${angleTitle.slice(0, 80)}"`;
    personEmotion = 'happy, satisfied, authentic';
    sceneContext = 'natural lifestyle setting matching the product category';
  }

  // Build the French overlay text from the actual angle content
  const overlayTitle = angleTitle.split(' ').slice(0, 6).join(' ');
  const overlaySubtext = anglePromesse.split(' ').slice(0, 8).join(' ');

  return `Square 1:1 high-converting ecommerce lifestyle image for "${title}". Ultra HD, 4K, sharp, professional photography.

SCENE: ${sceneSituation}
PERSON: ${targetPerson} — ${personEmotion}. Authentic Black African, dark brown skin, natural features. Real person, not stock-photo generic.
SETTING: ${sceneContext}
PRODUCT: ${productNote}. Product MUST be clearly visible and prominent (minimum 30% of frame), held or used by the person or placed prominently in scene.

TEXT OVERLAY (MANDATORY — overlay on image):
- Main title (bold, large, high contrast): "${overlayTitle}"
${overlaySubtext ? `- Sub-line (smaller, lighter): "${overlaySubtext}"` : ''}
⚠️ CRITICAL: ALL French text must be 100% PERFECTLY SPELLED with correct accents (é,è,ê,à,ù,ç etc). ZERO spelling errors. ZERO typos.

STYLE: Warm natural lighting. Tight composition, no empty margins. Authentic, not generic stock photo. ${
  template === 'beauty' ? 'Soft feminine beauty aesthetic, warm rose/cream tones.' :
  template === 'health' ? 'Fresh clean health aesthetic, green/white tones.' :
  template === 'tech' ? 'Clean modern tech aesthetic, blue/white tones.' :
  template === 'fitness' ? 'Energetic sporty aesthetic, bold colors.' :
  'Clean modern lifestyle aesthetic.'
}

NO price, NO phone number, NO URL, NO CTA button. Mood: authentic, trustworthy, scroll-stopping.`;
}

/**
 * 4 flash prompts — INFOGRAPHIES avec des designs UNIQUES par slide ET par catégorie produit.
 * Chaque template (beauty, tech, fashion, health, home, general) a sa propre structure visuelle.
 * TOUJOURS: personnes africaines cibles + produit visible + texte français.
 */
function buildFlashPrompts(gptResult, hasProductRef, method = 'PAS', template = 'general') {
  const title = gptResult.title || 'product';
  const targetPerson = gptResult.hero_target_person || 'authentic African person';
  const benefits = gptResult.benefits_bullets || [];
  const b1 = (benefits[0] || '').replace(/^[^\w]*/,'');
  const b2 = (benefits[1] || '').replace(/^[^\w]*/,'');
  const b3 = (benefits[2] || '').replace(/^[^\w]*/,'');
  const b4 = (benefits[3] || '').replace(/^[^\w]*/,'');
  const productNote = hasProductRef
    ? `THE EXACT REFERENCE PRODUCT ("${title}") must be shown large, sharp, dominant — same packaging, shape, color, label. Use the provided product image as reference.`
    : `A premium product packaging for "${title}" shown large, sharp, dominant.`;

  // ─── BEAUTY / COSMÉTIQUE ─────────────────────────────────────────────
  if (template === 'beauty') {
    return [
      {
        prompt: `Square 1:1 LUXURY BEAUTY INFOGRAPHIC for "${title}". Premium beauty editorial with real photography. Ultra HD, 4K.

COMPOSITION: Elegant skincare/beauty hero.
- BACKGROUND: Soft blush pink (#FFF0F0) to warm ivory (#FFF8F2) gradient. Clean, luxurious, feminine energy
- TOP: Elegant serif headline in deep rose gold (#8B4558): product name + French beauty promise. Refined, not loud
- CENTER: ${productNote} Product with soft pink studio glow, delicate light reflections, cream texture drops floating around it
- 4 benefit badges as elegant pill shapes with thin rose gold borders:
  "${b1}", "${b2}", "${b3}", "${b4}"
- PERSON (45% of frame): ${targetPerson} — African woman with glowing radiant skin, close-up beauty portrait, warm soft studio light with golden rim, natural confident beauty expression, skin texture visible and luminous

ALL text PERFECT French. Elegant, clean, beauty editorial feel. NO heavy graphics.`,
        type: 'beauty_hero',
      },
      {
        prompt: `Square 1:1 BEAUTY INGREDIENTS INFOGRAPHIC for "${title}". Clean cosmetic science layout. Ultra HD, 4K.

COMPOSITION: Ingredients spotlight.
- BACKGROUND: Pure white (#FFFFFF) with very subtle warm pink radial glow at center
- LAYOUT: Asymmetric — product LEFT (40%), ingredient info RIGHT (60%)
- LEFT: ${productNote} Product with cosmetic texture swatches (cream, serum drops, powder) artfully arranged around the product. Macro photography quality
- RIGHT: 3 key ingredients in clean vertical list. Each: elegant circular icon (watercolor style in soft pink/green/gold) + ingredient name in bold + short French benefit. Connected to product with thin dotted lines
- PERSON: ${targetPerson} — African woman applying product to skin, hands visible, close-up beauty shot, warm directional lighting creating skin luminosity
- BOTTOM: thin elegant bar — rose gold background, white text: French quality tagline

Clean, scientific yet feminine. NO heavy badges. PERFECT French.`,
        type: 'beauty_ingredients',
      },
      {
        prompt: `Square 1:1 BEAUTY ROUTINE INFOGRAPHIC for "${title}". Warm bathroom/vanity lifestyle. Ultra HD, 4K.

COMPOSITION: Beauty routine steps.
- BACKGROUND: Warm lifestyle scene — modern bathroom vanity with marble surface, warm ambient morning light through window, soft bokeh. NOT studio white
- PERSON (dominant 55%): ${targetPerson} — African woman in her beauty routine moment, natural hair wrapped in silk scarf or loose, applying or admiring the product, genuine self-care smile, warm golden morning light on skin
- PRODUCT: visible on the vanity surface or in hands — ${productNote}
- OVERLAY: 3 numbered frosted-glass rounded steps floating elegantly:
  Step 1: brief French action (applying/preparing)
  Step 2: brief French action (using)
  Step 3: brief French result (glowing/radiant)
  Each step: soft white glass card with rose gold number
- Color palette: warm golden, champagne, soft pink accents

Warm, intimate, aspirational beauty moment. PERFECT French.`,
        type: 'beauty_routine',
      },
      {
        prompt: `Square 1:1 BEAUTY RESULTS INFOGRAPHIC for "${title}". Bold transformation energy. Ultra HD, 4K.

COMPOSITION: Glowing results social proof.
- BACKGROUND: Rich gradient — deep burgundy (#5B1A2A) fading to warm rose (#C27083). Luxurious, dramatic, premium
- TOP: Bold white condensed headline: inspiring French phrase about beauty transformation. LARGE and punchy
- CENTER-LEFT: ${targetPerson} — African woman with RADIANTLY glowing skin, confidence pose, looking at camera with pride. Dramatic beauty lighting with warm rim light. Her skin GLOWS against the dark gradient
- CENTER-RIGHT: ${productNote} Product with white glow aura, floating elegantly
- STAT BADGES (3): Large white numbers on glass-morphism dark circles:
  • "97%" + "peau plus éclatante"
  • "+3000" + "clientes satisfaites"
  • "14 jours" + "résultats visibles"
- BOTTOM: 3 small white benefit pills with soft pink icons

Dramatic, luxurious, confidence-boosting beauty energy. PERFECT French.`,
        type: 'beauty_results',
      },
    ];
  }

  // ─── TECH / ÉLECTRONIQUE ───────────────────────────────────────────
  if (template === 'tech') {
    return [
      {
        prompt: `Square 1:1 TECH PRODUCT INFOGRAPHIC for "${title}". Dark premium tech aesthetic. Ultra HD, 4K.

COMPOSITION: Tech hero showcase.
- BACKGROUND: Deep dark gradient — midnight blue (#0A0E1A) to charcoal (#1A1A2E). Subtle circuit board line pattern faintly visible. Tech premium feel
- TOP: Bold white condensed uppercase headline + ONE keyword in electric blue (#00AAFF). Product name + French tech promise
- CENTER: ${productNote} Product with dramatic blue-white rim lighting, floating on dark reflective surface, electric blue glow emanating from behind. The product DOMINATES — sharp, futuristic
- 4 feature badges as dark glass-morphism rectangles with electric blue borders:
  "${b1}", "${b2}", "${b3}", "${b4}"
  Each with a thin neon-style icon
- PERSON (35%): ${targetPerson} — African man or woman in modern casual outfit, interacting with the device, face lit by screen glow, focused confident expression

Dark, sleek, futuristic tech feel. NO botanical elements. PERFECT French.`,
        type: 'tech_hero',
      },
      {
        prompt: `Square 1:1 TECH SPECS INFOGRAPHIC for "${title}". Clean technical layout. Ultra HD, 4K.

COMPOSITION: Technical specifications.
- BACKGROUND: Clean dark navy (#0D1B2A) with very subtle blue-grey grid pattern
- LAYOUT: Product centered with specs radiating outward
- CENTER: ${productNote} Product large, sharp, 3D render feel with dramatic lighting. Blue accent lights on edges
- AROUND PRODUCT: 4-5 specification callout lines extending from product to labels:
  Each: thin blue line from product feature → small icon + bold spec label in white + detail in grey
  (e.g., battery icon → "AUTONOMIE" → detail, bluetooth icon → "CONNECTIVITÉ" → detail)
- PERSON: ${targetPerson} — African tech professional, modern style, holding or unboxing the product, warm confident expression. Small inset or lower portion
- BOTTOM: thin electric blue bar with tech certification badges

Clean technical design, dark premium tech. PERFECT French specs labels.`,
        type: 'tech_specs',
      },
      {
        prompt: `Square 1:1 TECH LIFESTYLE INFOGRAPHIC for "${title}". Modern usage context. Ultra HD, 4K.

COMPOSITION: Tech in everyday life.
- BACKGROUND: Modern African indoor scene — sleek living room, bright coworking space, or home office with warm LED lighting and clean modern furniture. NOT studio
- PERSON (dominant 60%): ${targetPerson} — African person in modern casual outfit, ACTIVELY using "${title}" in a natural tech context (gaming, working, listening, computing). Engaged expression, natural pose, warm mixed lighting (ambient + device glow)
- PRODUCT: clearly visible in use — ${productNote}
- OVERLAY: 3 floating dark glass-morphism cards with blue accent:
  "CONFIGURATION" + step 1, "UTILISATION" + step 2, "PERFORMANCE" + step 3
  Each card: thin rounded rectangle, dark transparent, white text, electric blue icon
- Color palette: dark navy, electric blue, warm ambient orange from environment

Modern tech lifestyle, NOT studio. PERFECT French.`,
        type: 'tech_lifestyle',
      },
      {
        prompt: `Square 1:1 TECH PERFORMANCE AD for "${title}". Vibrant dynamic energy. Ultra HD, 4K.

COMPOSITION: Performance results.
- BACKGROUND: Electric gradient — deep blue (#0044AA) to vivid cyan (#00DDFF) to dark teal. Geometric light rays and subtle particle effects. High-energy, dynamic
- TOP: Bold white condensed headline about performance/speed/power in French. PUNCHY
- CENTER-LEFT: ${targetPerson} — African person in dynamic confident pose, tech-savvy look, illuminated by the gradient colors reflecting on their skin
- CENTER-RIGHT: ${productNote} Product with white-blue glow effect, sharp and dominant
- PERFORMANCE STATS (3 badges): Large bold white numbers on dark translucent circles:
  • Performance metric ("10h+" autonomie, etc.)
  • User count ("+5000 utilisateurs")
  • Speed/quality metric
- BOTTOM: 3 small dark cards with blue icons + French tech labels

High-energy tech ad. Electric blue dominant. PERFECT French.`,
        type: 'tech_performance',
      },
    ];
  }

  // ─── MODE / FASHION ──────────────────────────────────────────────
  if (template === 'fashion') {
    return [
      {
        prompt: `Square 1:1 FASHION EDITORIAL INFOGRAPHIC for "${title}". High-fashion African editorial. Ultra HD, 4K.

COMPOSITION: Fashion lookbook hero.
- BACKGROUND: Warm cream to champagne gold (#FFF8E7 to #F0E4CC) gradient. Elegant fashion editorial warmth
- TOP: Refined serif headline in deep charcoal with gold accent on key word. Product name + French fashion promise. Elegant, NOT loud
- CENTER: ${productNote} Product displayed beautifully — flat lay on textured surface OR worn/held by model
- GOLD ACCENTS: thin elegant gold foil lines at 2 corners, minimal and luxurious
- PERSON (50%): ${targetPerson} — African model in editorial fashion pose, wearing or showcasing the product, confident sophisticated expression, dramatic fashion photography lighting with warm tones. Magazine cover quality
- 3 style badges as elegant gold-bordered pills: "STYLE UNIQUE", "QUALITÉ PREMIUM", "ÉDITION LIMITÉE" or product-specific

Fashion editorial, warm gold tones, African haute couture energy. PERFECT French.`,
        type: 'fashion_editorial',
      },
      {
        prompt: `Square 1:1 FASHION DETAIL INFOGRAPHIC for "${title}". Product craft details. Ultra HD, 4K.

COMPOSITION: Craftsmanship spotlight.
- BACKGROUND: Split — LEFT soft cream (#FAF5EB), RIGHT rich terracotta (#A0522D to #8B4513) creating a warm African-luxury contrast
- LEFT (45%): Close-up detail shots of the product — texture, stitching, fabric, material quality. Macro photography feel. ${productNote}
- RIGHT (55%): ${targetPerson} — African model wearing/holding the product in a styling context, confident editorial pose, warm golden studio light
- 3 quality callouts on the LEFT with thin gold connecting lines to product details:
  • Material/fabric quality
  • Design detail
  • Unique craftsmanship point
  Each: small gold icon + bold French label + thin description
- BOTTOM: elegant terracotta bar with white text "FAIT AVEC PASSION" or similar

Craftsmanship, warm African luxury. PERFECT French.`,
        type: 'fashion_craft',
      },
      {
        prompt: `Square 1:1 FASHION STYLING INFOGRAPHIC for "${title}". Street style / lifestyle. Ultra HD, 4K.

COMPOSITION: How to style / wear.
- BACKGROUND: Vibrant urban African scene — colorful market street, modern African city backdrop, bright natural daylight with warm golden tones. NOT studio white
- PERSON (dominant 65%): ${targetPerson} — African fashion-forward person, confidently wearing/using "${title}" in street-style context. Dynamic pose (walking, turning, posing). Bright natural light, vivid colors. This IS the image
- PRODUCT: worn or held prominently — ${productNote}
- OVERLAY: 2-3 floating gold-accent glass cards:
  "COMMENT PORTER" or "STYLE TIP 1" + brief French styling advice
  Connected with thin gold dotted lines to relevant parts of the outfit
- Color palette: warm gold, terracotta, vibrant African prints/colors in background

Vibrant African street style energy. PERFECT French.`,
        type: 'fashion_styling',
      },
      {
        prompt: `Square 1:1 FASHION SOCIAL PROOF AD for "${title}". Bold aspirational energy. Ultra HD, 4K.

COMPOSITION: Fashion social proof.
- BACKGROUND: Rich warm gradient — deep chocolate brown (#3E2723) to warm gold (#C9A84C). Luxurious, aspirational
- TOP: Bold cream/gold condensed headline about style/confidence/exclusivity in French
- CENTER: ${targetPerson} — African model in confident pose with the product, looking directly at camera, editorial lighting with warm golden rim light. Aspirational, powerful
- PRODUCT: visible alongside person — ${productNote}
- STATS (3): Cream/gold numbers on dark translucent badges:
  • "EXCLUSIVE" + limited edition note
  • Customer count + satisfaction
  • Style rating or similar
- BOTTOM: gold accent line + 3 small cream quality icons

Luxurious African fashion ad. PERFECT French.`,
        type: 'fashion_social',
      },
    ];
  }

  // ─── SANTÉ / NUTRITION ───────────────────────────────────────────
  if (template === 'health') {
    return [
      {
        prompt: `Square 1:1 HEALTH & WELLNESS INFOGRAPHIC for "${title}". Clean energetic health design. Ultra HD, 4K.

COMPOSITION: Wellness hero.
- BACKGROUND: Fresh gradient — white (#FFFFFF) to light mint green (#E8F5E9) to soft teal (#B2DFDB). Clean, fresh, healthy energy
- TOP: Bold condensed headline in deep emerald green (#1B5E20): product name + French health promise. Strong but not aggressive
- CENTER: ${productNote} Product with fresh green/golden glow aura, surrounded by photorealistic ingredients (fruits, herbs, seeds) floating naturally around it
- 4 benefit badges as green-tinted rounded cards:
  "${b1}", "${b2}", "${b3}", "${b4}"
  Each with clean health icon (leaf, shield, lightning, heart)
- PERSON (40%): ${targetPerson} — African person in sporty/active wear, energetic confident expression, healthy glowing look, full of vitality. Bright natural lighting

Fresh, clean, energetic health design. NO dark/heavy graphics. PERFECT French.`,
        type: 'health_hero',
      },
      {
        prompt: `Square 1:1 HEALTH INGREDIENTS INFOGRAPHIC for "${title}". Natural science layout. Ultra HD, 4K.

COMPOSITION: Natural ingredients spotlight.
- BACKGROUND: Pure white with subtle green radial glow. Ultra clean
- LAYOUT: Product upper-center, ingredients fanning out below
- TOP-CENTER: ${productNote} Product hero shot with soft shadow, surrounded by REAL photorealistic natural ingredients (specific to THIS product — fruits, plants, vitamins, minerals)
- BELOW PRODUCT: 4 ingredient cards arranged in a 2x2 grid:
  Each card: rounded white card with green accent border, realistic ingredient photo icon + ingredient name BOLD + 1-line French benefit
- PERSON: ${targetPerson} — African person holding or taking the product, healthy glow, natural smile. Positioned to the side or bottom, complementing the ingredients focus
- CERTIFICATION SEAL: "100% NATUREL" green stamp badge, upper-left

Clean, natural, trustworthy health design. PERFECT French.`,
        type: 'health_ingredients',
      },
      {
        prompt: `Square 1:1 HEALTH LIFESTYLE INFOGRAPHIC for "${title}". Active natural context. Ultra HD, 4K.

COMPOSITION: Healthy lifestyle in action.
- BACKGROUND: Bright outdoor African scene — morning jog in park, yoga on terrace, or fresh kitchen with fruits. Bright natural daylight, warm and energetic. NOT studio
- PERSON (dominant 60%): ${targetPerson} — African person in active/healthy context, using or taking "${title}" during their wellness routine. Genuine energetic smile, full of life. Natural morning sunlight creating warm highlights
- PRODUCT: visible in hands or nearby — ${productNote}
- OVERLAY: 3 floating frosted-glass green-accent cards:
  "MATIN" + routine step 1, "JOUR" + step 2, "RÉSULTAT" + step 3
  Clean glass-morphism, white text, green icons
- Color palette: natural green, warm gold, fresh white

Active, natural, healthy lifestyle. NOT clinical. PERFECT French.`,
        type: 'health_lifestyle',
      },
      {
        prompt: `Square 1:1 HEALTH RESULTS AD for "${title}". Bold energetic transformation. Ultra HD, 4K.

COMPOSITION: Health transformation results.
- BACKGROUND: Vibrant gradient — electric teal (#00C9A7) to deep emerald (#028A6E) to forest (#064635). Energetic, fresh, powerful
- TOP: Bold white condensed headline about health transformation/energy/results in French
- CENTER: ${targetPerson} — African person FULL OF ENERGY — dynamic active pose, celebrating health, flexing, stretching, or running. Gradient colors reflecting on their skin. Radiating vitality
- PRODUCT: floating/held with white glow aura — ${productNote}
- HEALTH STATS (3): Large bold white numbers on dark translucent circles:
  • Energy/result metric
  • Customer satisfaction count
  • Speed of results
- BOTTOM: 3 small white cards with green icons + French health labels

Vibrant, energetic, transformational health ad. PERFECT French.`,
        type: 'health_results',
      },
    ];
  }

  // ─── MAISON / HOME ──────────────────────────────────────────────
  if (template === 'home') {
    return [
      {
        prompt: `Square 1:1 HOME PRODUCT INFOGRAPHIC for "${title}". Warm cozy home design. Ultra HD, 4K.

COMPOSITION: Home product hero.
- BACKGROUND: Warm beige (#F5F0E8) to soft terracotta tint (#FFF0E6). Cozy, inviting, home warmth. Subtle wood texture strip at bottom
- TOP: Bold condensed headline in dark warm brown (#3E2723): product name + French home promise. Warm and trustworthy
- CENTER: ${productNote} Product large on wooden surface, warm ambient lighting, soft shadow. Small indoor plant (monstera/succulent) as subtle prop
- 4 benefit badges as warm-toned rounded cards (terracotta/brown):
  "${b1}", "${b2}", "${b3}", "${b4}"
  Each with home-related icon (house, clock, sparkle, shield)
- PERSON (40%): ${targetPerson} — African person in comfortable home setting, using the product naturally, warm genuine smile, cozy home lighting

Warm, cozy, trustworthy home design. PERFECT French.`,
        type: 'home_hero',
      },
      {
        prompt: `Square 1:1 HOME FEATURES INFOGRAPHIC for "${title}". Clean practical layout. Ultra HD, 4K.

COMPOSITION: Practical features spotlight.
- BACKGROUND: Soft warm white (#FAFAF5) with warm wood accents on edges
- LAYOUT: Left panel (info) / Right panel (product in context)
- LEFT (45%): 3 practical features listed with generous spacing. Each: terracotta icon + bold French feature name + short practical benefit. Clean warm typography
- RIGHT (55%): ${productNote} Product shown IN USE in a realistic home context (kitchen counter, living room shelf, bathroom). Warm ambient home lighting
- PERSON: ${targetPerson} — African person using the product in their home, natural comfortable pose, warm genuine expression
- BOTTOM: warm terracotta bar with quality badge and French tagline

Practical, warm, trustworthy home product feel. PERFECT French.`,
        type: 'home_features',
      },
      {
        prompt: `Square 1:1 HOME LIFESTYLE INFOGRAPHIC for "${title}". Real home context. Ultra HD, 4K.

COMPOSITION: Product in home life.
- BACKGROUND: Real African home interior — modern warm living room, bright kitchen, or cozy bedroom. Warm natural light through windows, lived-in but clean. NOT studio
- PERSON (dominant 60%): ${targetPerson} — African person in comfortable home clothes, NATURALLY using "${title}" in their everyday home routine. Relaxed genuine smile, warm atmosphere. This person is LIVING with the product
- PRODUCT: in use or prominently placed — ${productNote}
- OVERLAY: 2-3 small frosted-glass warm-toned cards:
  "FACILE" + usage step, "RAPIDE" + benefit, "EFFICACE" + result
  Warm brown/terracotta accents

Warm real home life energy. NOT commercial. PERFECT French.`,
        type: 'home_lifestyle',
      },
      {
        prompt: `Square 1:1 HOME SOCIAL PROOF AD for "${title}". Warm family trust. Ultra HD, 4K.

COMPOSITION: Family trust & satisfaction.
- BACKGROUND: Warm gradient — soft terracotta (#C0622A) to warm brown (#5D4037) to deep chocolate. Cozy, warm, trustworthy
- TOP: Bold cream condensed headline about home comfort/family/daily life in French
- CENTER: ${targetPerson} — African person or family in warm home setting, happy with the product result, genuine satisfied expression, warm golden lighting
- PRODUCT: visible in context — ${productNote}
- STATS (3): Cream numbers on warm dark translucent badges:
  • Family satisfaction metric
  • Customer count
  • Daily usage or durability metric
- BOTTOM: 3 small cream cards with terracotta icons + French home labels

Warm, family-oriented, trustworthy. PERFECT French.`,
        type: 'home_social',
      },
    ];
  }

  // ─── GÉNÉRAL / DEFAULT ───────────────────────────────────────────
  return [
    {
      prompt: `Square 1:1 BOLD ADVERTISING INFOGRAPHIC for "${title}". Premium graphic design with real photography. Ultra HD, 4K.

COMPOSITION: Dark premium poster — WHY THIS PRODUCT.
- BACKGROUND: Rich deep gradient (dark midnight blue #0a1628 fading to charcoal black #1a1a2e). Dramatic, cinematic, premium
- TOP: Bold UPPERCASE white headline with ONE keyword in vibrant accent color (electric blue, gold, or coral). Product name + French promise
- CENTER: ${productNote} Product with dramatic cinematic rim lighting, warm product glow effect, soft reflection on dark glossy surface
- 4 benefit badges as luminous glass-morphism rounded rectangles:
  "${b1}", "${b2}", "${b3}", "${b4}"
  Connected with thin luminous lines
- PERSON (40%): ${targetPerson} — dramatic rim lighting, confident powerful expression, studio-quality portrait with cinematic color grading

Dark, bold, scroll-stopping. ALL text PERFECT French.`,
      type: 'general_hero',
    },
    {
      prompt: `Square 1:1 SPLIT-SCREEN EDITORIAL INFOGRAPHIC for "${title}". Clean modern magazine layout. Ultra HD, 4K.

COMPOSITION: Split-screen editorial — FEATURES.
- LAYOUT: Vertical split — LEFT 45% info panel, RIGHT 55% product + person
- LEFT: Background soft warm beige (#F5F0E8). Bold headline in dark charcoal. 3 key features listed vertically with accent dots + bold names + descriptions
- RIGHT: Background contrasting warm cream. ${productNote} Product large with premium lighting. ${targetPerson} applying/holding the product, warm studio lighting, confident expression
- Geometric frame accent (gold or accent color)

Clean editorial magazine feel. PERFECT French.`,
      type: 'general_editorial',
    },
    {
      prompt: `Square 1:1 LIFESTYLE INFOGRAPHIC for "${title}". Warm contextual photography. Ultra HD, 4K.

COMPOSITION: Lifestyle how-to — PERSON IS THE HERO.
- BACKGROUND: Warm natural scene — modern African home, bright terrace, or cozy space. NOT studio white
- PERSON (dominant 60%): ${targetPerson} — African person actively using "${title}" in a natural everyday moment. Genuine warm smile, warm golden natural lighting
- PRODUCT: visible in hands or nearby — ${productNote}
- OVERLAY: 2-3 numbered frosted-glass steps floating around the person with dotted lines
- Color palette: warm amber, golden, soft accents

Warm, human, relatable lifestyle. PERFECT French.`,
      type: 'general_lifestyle',
    },
    {
      prompt: `Square 1:1 VIBRANT SOCIAL MEDIA AD for "${title}". Bold colorful energy. Ultra HD, 4K.

COMPOSITION: Results & social proof — DYNAMIC ENERGY.
- BACKGROUND: Bold vibrant gradient (coral #FF6B6B → magenta #C850C0 → purple #6C63FF). Alive, energetic, modern
- TOP: Bold white condensed headline about transformation/results in French
- CENTER-LEFT: ${targetPerson} — ACTIVE dynamic pose, full of positive energy, gradient colors reflected on skin
- CENTER-RIGHT: ${productNote} Product with white glow effect
- STAT BADGES (3): Large bold white numbers on dark glass-morphism circles
- BOTTOM: 3 small white benefit pills

BOLD, vibrant, energetic. PERFECT French.`,
      type: 'general_vibrant',
    },
  ];
}

// Plusieurs générations simultanées autorisées — lock supprimé

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Seules les images sont acceptées'), false);
  }
});

router.post('/', requireEcomAuth, validateEcomAccess('products', 'write'), upload.array('images', 8), async (req, res) => {
  const userId = req.user?.id || req.user?._id || 'anonymous';

  const {
    url,
    description: userDescription,
    skipScraping,
    marketingApproach,
    visualTemplate: rawVisualTemplate,
    // Paramètres copywriting simplifiés
    targetAvatar,
    mainProblem,
    tone,
    language
  } = req.body || {};
  const imageFiles = req.files || [];
  const approach = marketingApproach || 'PAS';
  const visualTemplate = rawVisualTemplate || 'general';

  // Contexte copywriting simplifié : méthode + avatar + problème
  const copywritingContext = {
    method: approach,
    avatar: targetAvatar || '',
    problem: mainProblem || '',
    tone: tone || 'urgence',
    language: language || 'français'
  };

  // ── Validation selon le mode ──────────────────────────────────────────────
  const isDescriptionMode = skipScraping === 'true' || skipScraping === true;

  if (isDescriptionMode) {
    // Mode description directe
    if (!userDescription || typeof userDescription !== 'string' || userDescription.trim().length < 20) {
      return res.status(400).json({ success: false, message: 'Description requise (minimum 20 caractères)' });
    }
    if (!imageFiles || imageFiles.length === 0) {
      return res.status(400).json({ success: false, message: 'Au moins une photo requise en mode description' });
    }
  } else {
    // Mode URL produit
    if (!url || typeof url !== 'string' || url.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'URL du produit requise' });
    }
    const cleanUrl = url.trim();
    // Validation basique de l'URL
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return res.status(400).json({ success: false, message: 'URL invalide - doit commencer par http:// ou https://' });
    }
  }

  let scraped;
  let gptResult;
  let realPhotos = [];
  let posterImages = [];
  const cleanUrl = url?.trim() || '';
  let storeContext = {};

  try {
    let workspace;
    if (req.workspaceId) {
      workspace = await EcomWorkspace.findById(req.workspaceId)
        .select('storeSettings.country storeSettings.city storeSettings.storeName name freeGenerationsRemaining paidGenerationsRemaining totalGenerations');

      if (!workspace) {
        return res.status(404).json({ success: false, message: 'Workspace introuvable' });
      }

      storeContext = {
        country: workspace?.storeSettings?.country || '',
        city: workspace?.storeSettings?.city || '',
        shopName: workspace?.storeSettings?.storeName || workspace?.name || '',
      };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // VÉRIFICATION DES LIMITES DE GÉNÉRATION
    // ══════════════════════════════════════════════════════════════════════════
    if (workspace) {
      const freeRemaining = workspace.freeGenerationsRemaining || 0;
      const paidRemaining = workspace.paidGenerationsRemaining || 0;
      const totalRemaining = freeRemaining + paidRemaining;

      if (totalRemaining <= 0) {
        return res.status(403).json({
          success: false,
          limitReached: true,
          message: '🎯 Tu as utilisé tes 3 générations gratuites !\n\nPour continuer à générer des pages produit optimisées, débloque une nouvelle génération pour seulement 1500 FCFA.',
          freeRemaining: 0,
          paidRemaining: 0,
          totalGenerations: workspace.totalGenerations || 0
        });
      }

      // Décrémenter le compteur (priorité : gratuit d'abord, puis payant)
      if (freeRemaining > 0) {
        workspace.freeGenerationsRemaining = freeRemaining - 1;
      } else if (paidRemaining > 0) {
        workspace.paidGenerationsRemaining = paidRemaining - 1;
      }

      workspace.totalGenerations = (workspace.totalGenerations || 0) + 1;
      workspace.lastGenerationAt = new Date();
      await workspace.save();

      console.log(`✅ Génération autorisée. Reste: ${workspace.freeGenerationsRemaining} gratuite(s) + ${workspace.paidGenerationsRemaining} payante(s)`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 1 : Extraction des infos produit avec Gemini OU utilisation de la description directe
    // ══════════════════════════════════════════════════════════════════════════
    if (isDescriptionMode) {
      console.log('📝 Étape 1: Mode description directe (skip extraction Gemini)');
      scraped = {
        title: 'Produit',
        description: userDescription.trim(),
        rawText: userDescription.trim()
      };
      console.log('✅ Description utilisée:', userDescription.slice(0, 100));
    } else {
      console.log('🤖 Étape 1: Extraction Gemini depuis', cleanUrl);
      scraped = await extractProductInfo(cleanUrl);
      console.log('✅ Extraction Gemini OK:', { title: scraped.title?.slice(0, 50) });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 2 : GPT-4o Vision → JSON structuré
    // ══════════════════════════════════════════════════════════════════════════
    console.log('🧠 Étape 2: GPT-4o analyse + copywriting, photos:', imageFiles.length);

    const imageBuffers = (imageFiles || []).map(f => f.buffer);

    gptResult = await analyzeWithVision(scraped, imageBuffers, approach, storeContext, copywritingContext);

    console.log('✅ GPT OK:', {
      title: gptResult.title?.slice(0, 40),
      angles: gptResult.angles?.length,
      raisons: gptResult.raisons_acheter?.length,
      faq: gptResult.faq?.length
    });

    // ══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 3 : Upload des photos utilisateur → R2
    // ══════════════════════════════════════════════════════════════════════════
    console.log('📸 Étape 3: Upload', imageFiles.length, 'photos');
    const UPLOAD_TIMEOUT_MS = 30000; // 30s max par photo
    const uploadWithTimeout = (uploadPromise) =>
      Promise.race([
        uploadPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timeout')), UPLOAD_TIMEOUT_MS))
      ]);
    for (const f of imageFiles.slice(0, 8)) {
      try {
        const uploaded = await uploadWithTimeout(
          uploadImage(f.buffer, f.originalname || `photo-${Date.now()}.jpg`, {
            workspaceId: req.workspaceId,
            uploadedBy: userId,
            mimeType: f.mimetype
          })
        );
        if (uploaded?.url) realPhotos.push(uploaded.url);
      } catch (uploadErr) {
        console.warn('⚠️ Upload photo échoué:', uploadErr.message);
      }
    }
    console.log('✅ Photos uploadées:', realPhotos.length);

    // ══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 4 : Générer TOUTES les images EN PARALLÈLE (Hero + Avant/Après + 4 Affiches)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('🎨 Étape 4: Génération de toutes les images en parallèle...');

    const axios = (await import('axios')).default;

    // Helper pour générer et uploader une image — avec 1 retry automatique
    const generateAndUpload = async (prompt, baseBuffer, filename, mode = 'scene') => {
      if (!prompt) return null;

      const attempt = async () => {
        const generatedDataUrl = await generatePosterImage(prompt, baseBuffer, { mode });
        if (!generatedDataUrl) throw new Error('generatePosterImage returned null');

        let imageBuffer;
        if (generatedDataUrl.startsWith('data:')) {
          imageBuffer = Buffer.from(generatedDataUrl.split(',')[1], 'base64');
        } else {
          const resp = await axios.get(generatedDataUrl, { responseType: 'arraybuffer', timeout: 15000 });
          imageBuffer = Buffer.from(resp.data);
        }

        imageBuffer = await sharp(imageBuffer)
          .resize(1080, 1100, { fit: 'cover', position: 'centre' })
          .jpeg({ quality: 92 })
          .toBuffer();

        const resizedFilename = filename.replace(/\.[^.]+$/, '.jpg');
        const uploaded = await uploadImage(imageBuffer, resizedFilename, {
          workspaceId: req.workspaceId,
          uploadedBy: userId,
          mimeType: 'image/jpeg',
          optimize: false,
        });
        if (!uploaded?.url) throw new Error('Upload retourné sans URL');
        return uploaded.url;
      };

      // 1ère tentative
      try {
        return await attempt();
      } catch (err1) {
        console.warn(`⚠️ Image ${filename} tentative 1 échouée: ${err1.message} — retry...`);
      }
      // Retry unique avec 3s de délai
      await new Promise(r => setTimeout(r, 3000));
      try {
        return await attempt();
      } catch (err2) {
        console.warn(`⚠️ Image ${filename} tentative 2 échouée: ${err2.message}`);
        return null;
      }
    };

    // Préparer toutes les tâches de génération
    const imagePromises = [];

    // Normaliser l'image de référence produit : JPEG 768px max, pour que Gemini
    // reçoive un format cohérent (mimeType + taille raisonnable pour inline data).
    // Sans ça : PNG brut envoyé comme "image/jpeg" → Gemini ignore la référence.
    let baseImageBuffer = null;
    if (imageFiles[0]?.buffer) {
      try {
        baseImageBuffer = await sharp(imageFiles[0].buffer)
          .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 88 })
          .toBuffer();
        console.log(`📐 Image de référence normalisée: ${Math.round(baseImageBuffer.length / 1024)}Ko JPEG 768px`);
      } catch (sharpErr) {
        console.warn('⚠️ Normalisation image échouée, utilisation du buffer brut:', sharpErr.message);
        baseImageBuffer = imageFiles[0].buffer;
      }
    }

    // Si aucune image uploadée mais URL fournie → extraire og:image de la page produit
    if (!baseImageBuffer && cleanUrl) {
      try {
        console.log('🔍 Aucune image uploadée — extraction og:image depuis', cleanUrl);
        const pageResp = await axios.get(cleanUrl, {
          timeout: 12000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EcomBot/1.0)' },
          maxRedirects: 5,
          responseType: 'text',
        });
        const html = typeof pageResp.data === 'string' ? pageResp.data : '';
        // Try og:image, then twitter:image, then first large <img>
        const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
          || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
        const imgUrl = ogMatch?.[1];
        if (imgUrl) {
          const imgResp = await axios.get(imgUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EcomBot/1.0)' },
            maxRedirects: 3,
          });
          baseImageBuffer = await sharp(Buffer.from(imgResp.data))
            .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 88 })
            .toBuffer();
          console.log(`✅ og:image téléchargée et normalisée: ${Math.round(baseImageBuffer.length / 1024)}Ko`);
        } else {
          console.warn('⚠️ Aucun og:image trouvé sur la page');
        }
      } catch (ogErr) {
        console.warn('⚠️ Extraction og:image échouée:', ogErr.message);
      }
    }

    // ── Hero PRO — African FB-ads template (LEFT: product | RIGHT: person + problem) ──
    imagePromises.push(
      generateAndUpload(buildHeroPrompt(gptResult, !!baseImageBuffer), baseImageBuffer, `hero-${Date.now()}.png`, 'hero')
        .then(url => ({ type: 'hero', url }))
    );

    // ── Avant/Après — deuxième image forte, transformation réaliste ──
    const beforeAfterPrompt = gptResult.prompt_avant_apres || null;
    if (beforeAfterPrompt) {
      imagePromises.push(
        generateAndUpload(beforeAfterPrompt, baseImageBuffer, `before-after-${Date.now()}.png`, 'before_after')
          .then(url => ({ type: 'before_after', url }))
      );
    }

    // ── 4 Flash images — chaque image illustre EXACTEMENT l'angle textuel au-dessus ─
    const angles = gptResult.angles || [];
    const flashPrompts = buildFlashPrompts(gptResult, !!baseImageBuffer, approach, visualTemplate);

    for (let i = 0; i < flashPrompts.length; i++) {
      const flash = flashPrompts[i];
      const angle = angles[i] || null;

      // Build an angle-specific prompt that makes the image match the text above it
      const anglePrompt = angle
        ? buildAngleImagePrompt(angle, gptResult, !!baseImageBuffer, visualTemplate)
        : flash.prompt;

      imagePromises.push(
        generateAndUpload(anglePrompt, baseImageBuffer, `flash-${i + 1}-${Date.now()}.png`, 'scene')
          .then(url => ({ type: 'poster', index: i, url, angle, flashType: flash.type }))
      );
    }

    // ── Testimonial photos — person holding / using the product ─────────────
    const testimonials = gptResult.testimonials || [];
    const productNameForAvatar = gptResult.title || 'the product';
    const targetPersonBase = gptResult.hero_target_person || 'authentic Black African person';

    for (let i = 0; i < testimonials.length; i++) {
      const t = testimonials[i];

      // Vary the gender/age to make testimonials look diverse and real
      const personVariants = [
        `african woman, 28-35 years old, natural hair, warm smile`,
        `african man, 30-40 years old, casual shirt, confident expression`,
        `african woman, 22-30 years old, braided hair, happy satisfied look`,
        `african man, 35-45 years old, relaxed look, genuine smile`,
        `african woman, 25-35 years old, natural makeup, glowing skin`,
        `african man, 28-38 years old, modern casual outfit, proud expression`,
        `african woman, 30-42 years old, professional look, warm smile`,
        `african man, 25-35 years old, sporty style, energetic expression`,
      ];
      const personDesc = personVariants[i % personVariants.length];

      // The product reference ensures we show the actual product being held
      const productRef = baseImageBuffer
        ? `holding or using THE EXACT SAME product shown in the reference image (same packaging, color, shape — this is crucial)`
        : `holding or using "${productNameForAvatar}" product clearly visible in their hands`;

      const avatarPrompt = `Square 1:1 ultra realistic lifestyle photo. ${personDesc}, ${productRef}.
Natural indoor or outdoor African setting (modern home, bright terrace, or simple clean background).
Warm natural lighting, golden hour or soft daylight. Authentic happy satisfied expression — showing they love the product result.
The product is CLEARLY VISIBLE and prominent in the image — at least 30% of frame.
Person looks real, skin texture visible, natural hair. NOT a stock photo look. Candid authentic feel.
4K quality, sharp focus, no watermarks, no text overlays, no price, no URL.
Mood: genuine customer who is very happy with their purchase and results.`;

      imagePromises.push(
        (async () => {
          try {
            const { generateNanoBananaImage, generateNanoBananaImageToImage } = await import('../services/nanoBananaService.js');

            // Use image-to-image if we have a product reference (ensures product looks correct)
            let dataUrl;
            if (baseImageBuffer) {
              dataUrl = await generateNanoBananaImageToImage(avatarPrompt, baseImageBuffer, '1:1', 1);
            } else {
              dataUrl = await generateNanoBananaImage(avatarPrompt, '1:1', 1);
            }

            if (!dataUrl) return { type: 'avatar', index: i, url: null };
            let buf = dataUrl.startsWith('data:')
              ? Buffer.from(dataUrl.split(',')[1], 'base64')
              : Buffer.from((await axios.get(dataUrl, { responseType: 'arraybuffer', timeout: 15000 })).data);

            // Keep full size (400x400) for testimonials — they appear larger on page
            buf = await sharp(buf).resize(400, 400, { fit: 'cover', position: 'centre' }).jpeg({ quality: 88 }).toBuffer();

            const uploadResult = await uploadImage(buf, `testimonial-${i}-${Date.now()}.jpg`, {
              workspaceId: req.workspaceId,
              uploadedBy: userId,
            });
            return { type: 'avatar', index: i, url: uploadResult?.url || null };
          } catch (err) {
            console.warn(`⚠️ Testimonial photo ${i} failed:`, err.message);
            return { type: 'avatar', index: i, url: null };
          }
        })()
      );
    }

    // Exécuter toutes les générations en parallèle avec timeout global de 180s
    const IMAGE_TIMEOUT_MS = 180000;
    const withTimeout = (promise, fallback) =>
      Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve(fallback), IMAGE_TIMEOUT_MS))
      ]);

    const imageResults = await Promise.allSettled(
      imagePromises.map(p => withTimeout(p, null))
    ).then(results => results.map(r => (r.status === 'fulfilled' ? r.value : null)));

    // Extraire les résultats (nulls possibles si timeout)
    let heroImageUrl = imageResults.find(r => r?.type === 'hero')?.url || null;
    let beforeAfterUrl = imageResults.find(r => r?.type === 'before_after')?.url || null;

    const posterImages = imageResults
      .filter(r => r?.type === 'poster')
      .sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0))
      .map(r => ({
        ...r?.angle,
        poster_url: r?.url || null,
        index: (r?.index ?? 0) + 1,
        flashType: r?.flashType || null
      }));

    console.log('✅ Images générées:', {
      hero: !!heroImageUrl,
      beforeAfter: !!beforeAfterUrl,
      flash: posterImages.filter(p => p.poster_url).length
    });

    // Inject avatar URLs into testimonials
    const avatarResults = imageResults.filter(r => r?.type === 'avatar');
    const finalTestimonials = (gptResult.testimonials || []).map((t, i) => {
      const avatar = avatarResults.find(a => a?.index === i);
      return { ...t, image: avatar?.url || t.image || '' };
    });
    console.log(`✅ Avatars témoignages: ${avatarResults.filter(a => a?.url).length}/${finalTestimonials.length}`);


    // ══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 5 : Assembler la description avec les images
    // ══════════════════════════════════════════════════════════════════════════
    console.log('📝 Étape 5: Assemblage de la description');

    let description = '';

    // Replace {{IMAGE_X}} with actual poster URLs
    for (let i = 1; i <= 4; i++) {
      const poster = posterImages[i - 1];
      const placeholder = `{{IMAGE_${i}}}`;
      if (poster?.poster_url) {
        const imgTag = `![${poster.titre_angle || 'Affiche'}](${poster.poster_url})`;
        description = description.replace(placeholder, imgTag);
      } else {
        description = description.replace(placeholder, '');
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 6 : Assemblage final du produit
    // ══════════════════════════════════════════════════════════════════════════
    console.log('✅ Étape 6: Assemblage final');

    const productPage = {
      title: gptResult.title || scraped.title || '',
      hero_headline: gptResult.hero_headline || null,
      hero_slogan: gptResult.hero_slogan || null,
      hero_baseline: gptResult.hero_baseline || null,
      hero_cta: gptResult.hero_cta || null,
      urgency_badge: gptResult.urgency_badge || null,
      problem_section: gptResult.problem_section || null,
      solution_section: gptResult.solution_section || null,
      stats_bar: gptResult.stats_bar || [],
      offer_block: gptResult.offer_block || null,
      seo: gptResult.seo || null,
      heroImage: heroImageUrl || null,
      beforeAfterImage: beforeAfterUrl || null,
      angles: posterImages,
      raisons_acheter: gptResult.raisons_acheter || [],
      benefits_bullets: gptResult.benefits_bullets || [],
      conversion_blocks: gptResult.conversion_blocks || [],
      urgency_elements: gptResult.urgency_elements || null,
      faq: gptResult.faq || [],
      testimonials: finalTestimonials,
      reassurance: gptResult.reassurance || null,
      guide_utilisation: gptResult.guide_utilisation || null,
      description: description,
      realPhotos,
      allImages: [
        ...(heroImageUrl ? [heroImageUrl] : []),
        ...(beforeAfterUrl ? [beforeAfterUrl] : []),
        ...posterImages.map(p => p.poster_url).filter(Boolean)
      ],
      sourceUrl: cleanUrl,
      createdByAI: true,
      generatedAt: new Date().toISOString()
    };

    console.log('✅ Page produit générée avec succès');

    // Track feature usage
    if (req.workspaceId && req.user) {
      const currentFree = workspace?.freeGenerationsRemaining || 0;
      const genType = currentFree > 0 ? 'free' : 'paid';
      FeatureUsageLog.create({
        workspaceId: req.workspaceId,
        userId: req.user._id || req.user.id,
        feature: 'product_page_generator',
        meta: {
          generationType: genType,
          productUrl: cleanUrl || null,
          productName: gptResult?.title || scraped?.title || null,
          success: true
        }
      }).catch(() => { });
    }

    // Récupérer le nombre de générations restantes pour l'inclure dans la réponse
    const updatedWorkspace = workspace ? await EcomWorkspace.findById(workspace._id)
      .select('freeGenerationsRemaining paidGenerationsRemaining totalGenerations')
      .lean() : null;

    const generationsInfo = updatedWorkspace ? {
      freeRemaining: updatedWorkspace.freeGenerationsRemaining || 0,
      paidRemaining: updatedWorkspace.paidGenerationsRemaining || 0,
      totalUsed: updatedWorkspace.totalGenerations || 0
    } : null;

    return res.json({
      success: true,
      product: productPage,
      generations: generationsInfo
    });

  } catch (error) {
    console.error('❌ Erreur génération:', error.message);
    console.error('❌ Stack:', error.stack);

    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la génération'
    });
  }
});

export default router;
