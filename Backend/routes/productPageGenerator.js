/**
 * Product Page Generator Route
 * POST /api/ai/product-generator
 *
 * Architecture simple & fiable :
 * 1. Scrape title + description (minimal)
 * 2. Clean text
 * 3. GPT → JSON structuré (angles, raisons, FAQ, description, prompts affiches)
 * 4. Parse JSON
 * 5. Loop angles → generate 5 affiches publicitaires (1 par angle marketing)
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

// ─── In-memory store for async image generation jobs ──────────────────────────
const imageJobs = new Map();
const JOB_TTL = 30 * 60 * 1000; // 30min
// Clean expired jobs every 5min
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of imageJobs) {
    if (now - job.createdAt > JOB_TTL) imageJobs.delete(id);
  }
}, 5 * 60 * 1000);

// ─── Image prompt builders ────────────────────────────────────────────────────

/**
 * Niche-based accent color for hero image
 */
function getNicheAccentColor(template) {
  const nicheColors = {
    health:  { color: 'natural green (#2E7D32)',  name: 'green',     mood: 'healthy, natural, organic' },
    beauty:  { color: 'rose gold / soft pink (#E91E63)', name: 'pink',  mood: 'luxurious, feminine, elegant' },
    tech:    { color: 'electric blue (#1565C0)',   name: 'blue',      mood: 'modern, innovative, trustworthy' },
    fashion: { color: 'elegant gold (#F59E0B)',    name: 'gold',      mood: 'premium, stylish, trendy' },
    home:    { color: 'warm amber (#EF6C00)',      name: 'amber',     mood: 'warm, cozy, reliable' },
    general: { color: 'vibrant coral (#FF5722)',   name: 'coral',     mood: 'energetic, bold, eye-catching' },
  };
  return nicheColors[template] || nicheColors.general;
}

function buildVisualPromptDirectives(visualPrefs = {}) {
  return '';
}

function buildHumanPhotoRealismRules() {
  return `

═══ HUMAN REALISM — NON-NEGOTIABLE ═══
• The person must look like a REAL photographed human being, not a synthetic AI face
• Keep natural skin texture, pores, tiny imperfections, realistic teeth, realistic eyes, realistic ears, realistic hands
• Natural facial asymmetry is required. Do NOT make the face too perfect, too smooth, too glossy, too symmetrical, or wax-like
• Hands and fingers must be anatomically correct: no extra fingers, fused fingers, broken wrists, duplicated limbs, or distorted nails
• Hairline, braids, locs, afro texture, edges and baby hairs must look naturally photographed, never plastic or painted
• Avoid uncanny AI traits: plastic skin, fake smile, glassy eyes, over-beautified face, over-sharpened pores, blurred accessories, broken jewelry, distorted backgrounds
• Final result must feel like a real commercial photo captured by a skilled photographer with a real model`;
}

function buildSemanticIllustrationRules({ mainClaim = '', supportText = '', promise = '', bullets = [] } = {}) {
  const bulletList = bullets.filter(Boolean).slice(0, 4).join(' | ');
  return `

═══ SEMANTIC ILLUSTRATION — MANDATORY ═══
• The image must VISUALLY EXPLAIN the exact marketing message, not just decorate it
• Main claim to illustrate: "${mainClaim || 'specific product benefit'}"
• Supporting text to reflect: "${supportText || 'specific product explanation'}"
• Concrete promise to make visible: "${promise || 'credible visible result'}"
${bulletList ? `• Benefit cues that must be visible through the scene, icons, callouts or body language: ${bulletList}` : ''}
• If the text mentions a problem, show that problem concretely in the visual context, expression, body zone, object state, or environment
• If the text mentions relief, transformation, comfort, cleanliness, speed, confidence, simplicity or another result, make that exact result readable in the image itself
• Infographic elements must NOT be generic decoration. Every icon, badge, mini-scene, annotation, object and gesture must correspond to what the text says
• Do not use random smiling portraits unrelated to the copy. The person, the product and the infographic elements must all tell the same story`;
}

function buildThreePeopleHoldingProductRules() {
  return `

═══ THREE REAL PEOPLE — MANDATORY ═══
• The image must feature EXACTLY 3 authentic photographed Black African people, not illustrations, not avatars, not synthetic faces
• All 3 people must look like real commercial-photo subjects with natural skin texture, natural asymmetry, realistic hands and realistic expressions
• Each of the 3 people must be clearly visible in the composition, not hidden in the background
• At least 2 of them must clearly HOLD the exact product in hand, and ideally all 3 are interacting with or presenting the product naturally
• The product must be visible in their hands at a believable size with correct finger placement and natural grip
• Prefer a trio composition, 3-panel composition, or grouped scene showing three distinct real people rather than icons or generic infographic characters`;
}

/**
 * Hero — Product in action layout:
 * The product is shown being USED in its real context (not a cosmetic studio pose).
 * Bold headline + product dominant + contextual usage scene.
 */
function buildHeroPrompt(gptResult, hasProductRef, template = 'general', visualPrefs = {}) {
  const productName = gptResult.title || 'product';
  const ctaText = (gptResult.hero_cta || 'JE COMMANDE MAINTENANT').toUpperCase();

  // Headline: use the hero_headline or derive from the problem/solution
  const headline = gptResult.hero_headline
    ? gptResult.hero_headline.toUpperCase()
    : (gptResult.problem_section?.pain_points?.[0]
        ? `DITES ADIEU À ${gptResult.problem_section.pain_points[0].slice(0, 50).toUpperCase()} !`
        : `DÉCOUVREZ ${productName.toUpperCase()} !`);

  // Subheadline: hero_slogan or first sentence of solution
  const subheadline = gptResult.hero_slogan
    || gptResult.solution_section?.description?.split('.')[0]
    || `Le produit indispensable pour votre quotidien.`;

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
    ? `THE EXACT product from the reference image (same packaging, shape, colors, label, every detail identical) — large, dominant, ultra sharp`
    : `premium packaging of "${productName}" — large, dominant, ultra sharp`;

  // Accent color — dynamic per niche
  const niche = getNicheAccentColor(template);
  const accentColor = niche.color;
  const customVisualDirectives = buildVisualPromptDirectives(visualPrefs);
  const realismRules = buildHumanPhotoRealismRules();
  const semanticRules = buildSemanticIllustrationRules({
    mainClaim: headline,
    supportText: subheadline,
    promise: badgeText,
    bullets: benefits,
  });
  const threePeopleRules = buildThreePeopleHoldingProductRules();

  return `Ultra realistic e-commerce product advertisement for the African francophone market. Square 1:1. High-definition photorealistic quality — must look like a REAL professional photograph, NOT AI-generated. Natural soft lighting, no aggressive filters, no cartoon style.

═══ CONCEPT ═══
A professional product advertisement for "${productName}" targeting African consumers. The image MUST be a SPLIT LAYOUT (two-column composition) like a real Facebook / TikTok ad. The image must feel AUTHENTIC — like a real ad designed by a professional agency.

═══ SPLIT LAYOUT — MANDATORY TWO-COLUMN COMPOSITION ═══
⚠️ The image MUST be divided into TWO clear zones side by side:

【LEFT SIDE — ~55% of frame】PEOPLE + PRODUCT ZONE
• EXACTLY 3 authentic Black African people occupying the left half of the image as a believable trio composition
• Real dark skin (natural Black African complexion), natural African hair (afro, braids, locs, twists, or headwrap)
• Wearing simple everyday African clothes — colorful traditional or casual, clean, relatable
• SUBTLE facial expressions — warm natural smiles, confident, NOT theatrical, NOT exaggerated
• They are HOLDING THE PRODUCT IN HAND naturally — at least 2 of the 3 people must clearly hold the product, and the hand and the product must both be clearly visible, as in a real commercial photo
• ${productBlock}
• The product packaging also visible (box, carton, etc.) near or behind the trio
• Their FACES must be clearly visible — they are the human face of this ad
• Warm natural lighting, soft background (blurred African home interior, bokeh)

【RIGHT SIDE — ~45% of frame】BENEFITS + CTA ZONE
• Clean white or very light background — NO clutter, professional spacing
• Elements stacked vertically from top to bottom:

  1. SOCIAL PROOF BADGE (top right area):
     Rounded pill shape with ${accentColor} background, white bold text:
     "${badgeText} ✓"

  2. BENEFIT CHECKMARKS (4 items, stacked vertically with generous spacing):
     Each benefit has a small circular ${accentColor} checkmark icon (✓) on the left, then the benefit text on the right:
     ✓ ${benefits[0]}
     ✓ ${benefits[1]}
     ✓ ${benefits[2]}
     ✓ ${benefits[3]}
     Font: clean modern sans-serif, dark gray text, 14-16px equivalent

═══ TOP ZONE — HEADLINE (spanning full width above the split) ═══
Line 1 (LARGE, BOLD, dominant — the biggest text in the image):
"${headline}"
Font: extra-bold modern sans-serif, dark text (#1a1a1a) with key emotional words in ${accentColor}

Line 2 (smaller subheadline, below the headline):
"${subheadline}"
Font: medium weight, dark gray (#555)

═══ BOTTOM ZONE — TRUST BAR + CTA (spanning full width below the split) ═══
TRUST STRIP (full width, light gray background):
"${labelsLine}"
Font: small (12px equivalent), clean, professional, separated by bullet dots

CTA BUTTON (centered, below trust strip):
"${ctaText}"
Style: ${accentColor} background, white bold text, large rounded corners, prominent

═══ STYLE RULES — STRICT ═══
• PHOTOREALISTIC — must look like a real photograph combined with clean graphic overlay, NOT AI-generated. No cartoon, no uncanny valley
• The SPLIT LAYOUT is NON-NEGOTIABLE — left side is photographic (person + product), right side is clean graphic design (badges + benefits)
• ALL French text: 100% PERFECT spelling with every accent (é, è, ê, à, ù, ç, î, ô). ZERO errors. Simple, direct, African-local tone
• Soft, clean, natural visual style — NOT flashy, NOT over-saturated, NOT aggressive filters
• Natural warm lighting on the person — like real daylight in an African home
• NO body distortion, NO product distortion, NO visual inconsistencies
• NO price in numbers, NO phone number, NO URL, NO watermark
• Modern typography: clean sans-serif, high contrast, perfectly aligned
• Product packaging sharp and clear — every label readable
• The African person is THE FACE of this ad — confident, natural, relatable. Their presence makes the ad authentic for the African market
• COLOR IDENTITY: The dominant accent color is ${accentColor} — use it for CTA button, checkmark icons, badge background, and key headline words. This color conveys a ${niche.mood} feel matching the product niche
• Even if text is present, the scene must still be understandable WITHOUT reading the text: the human expression, body zone, gesture and context must already communicate the same situation and benefit
• Final mood: professional, credible, natural — could be a real brand campaign photo from a top African beauty/lifestyle brand${realismRules}${semanticRules}${threePeopleRules}${customVisualDirectives}`;
}

/**
 * Builds an INFOGRAPHIC image prompt that visually illustrates the SPECIFIC angle text.
 * Each slide (index 0-3) gets a DIFFERENT infographic layout style.
 * Category-specific design (beauty, tech, fashion, health, home, general).
 */
function buildAngleImagePrompt(angle, gptResult, hasProductRef, template = 'general', slideIndex = 0, visualPrefs = {}, method = 'PAS') {
  const title = gptResult.title || 'product';
  const targetPerson = gptResult.hero_target_person || 'authentic Black African person';
  const benefits = gptResult.benefits_bullets || gptResult.raisons_acheter || [];
  const b1 = benefits[0]?.text || benefits[0] || '';
  const b2 = benefits[1]?.text || benefits[1] || '';
  const b3 = benefits[2]?.text || benefits[2] || '';

  const productNote = hasProductRef
    ? `THE EXACT SAME product from the reference image (same packaging, color, shape, label — critical) shown large and sharp`
    : `"${title}" product shown large and sharp`;

  // Extract angle content
  const angleTitle = (angle.titre_angle || '').slice(0, 120);
  const angleExplication = (angle.explication || angle.message_principal || '').slice(0, 200);
  const anglePromesse = (angle.promesse || '').slice(0, 100);

  // Short versions for text overlays
  const headlineShort = angleTitle.split(' ').slice(0, 7).join(' ');
  const promesseShort = anglePromesse.split(' ').slice(0, 8).join(' ');

  // ─── PAS METHOD: PROBLÈME ANGLE (slide 0) → PROBLEM COLLAGE ────────
  // When using PAS, the first angle is PROBLÈME — show a realistic collage
  // of real people experiencing the problem, NOT a polished marketing poster.
  if (method === 'PAS' && slideIndex === 0) {
    const painPoints = gptResult.problem_section?.pain_points || [];
    const problemTitle = gptResult.problem_section?.title || angleTitle;
    const pain1 = painPoints[0] || angleExplication;
    const pain2 = painPoints[1] || '';
    const pain3 = painPoints[2] || '';

    const problemCollagePrompt = `Square 1:1 PHOTOREALISTIC PROBLEM AWARENESS IMAGE for "${title}". This is NOT a marketing poster — it is a RAW, EMOTIONAL, DOCUMENTARY-STYLE collage showing REAL PEOPLE suffering from the problem this product solves. Ultra HD, 4K.

═══ CONCEPT ═══
A single square image composed as a PHOTO COLLAGE / MOSAIC of 3-4 real photographs arranged in a grid or overlapping layout. Each photo shows a DIFFERENT real African person visibly experiencing the EXACT problem that "${title}" solves. The overall mood is DARK, SERIOUS, EMPATHETIC — like an awareness campaign or documentary.

═══ COLLAGE LAYOUT ═══
- BACKGROUND: Dark, moody — deep charcoal (#1A1A1A) to black gradient, or dark textured surface
- PHOTO GRID: 3-4 real photographs arranged as a collage (mix of sizes — one larger main photo + 2-3 smaller ones). Photos can overlap slightly, have thin dark borders or be arranged in an editorial grid
- Each photo: REAL Black African person (authentic dark skin, natural African features, natural hair) showing the problem PHYSICALLY and VISIBLY:
  • Photo 1 (largest, ~40% of frame): Close-up of a person showing the main problem — "${pain1}". Their face or body clearly shows discomfort, frustration, or the visible symptom. Expression is GENUINE distress — not theatrical, but real everyday struggle
  • Photo 2: Another person (different age/gender) also experiencing the problem from a different angle — ${pain2 ? `"${pain2}"` : 'related aspect of the same problem'}. Candid, documentary feel
  • Photo 3: ${pain3 ? `A third person showing "${pain3}"` : 'Close-up detail shot of the problem itself — the affected area, the symptom, the frustration'}. Raw, unfiltered
  • Optional Photo 4: Wider shot showing the social/emotional impact of the problem — isolation, embarrassment, discomfort in a social setting

═══ TEXT OVERLAYS ═══
- MAIN HEADLINE (large, bold, top or center): "${problemTitle}" — in French, bold white or red condensed sans-serif font on dark background. The text should feel like a WARNING or AWARENESS campaign headline
- Optional small pain point labels near each photo in thin white text
- Overall text style: raw, editorial, awareness campaign — NOT marketing/sales copy
- NO product shown, NO solution mentioned — this image is ONLY about the PROBLEM

═══ MOOD & STYLE ═══
- Documentary / awareness campaign aesthetic — dark, moody, empathetic
- Photos must look like REAL candid photographs — not studio shots, not posed. Think photojournalism
- Natural imperfect lighting — like real photos taken in real African homes, bathrooms, streets
- Each person wears simple everyday African clothing
- The collage must make the viewer FEEL the problem before they see the solution
- Color grading: desaturated, slightly cold/blue tint on the photos to convey discomfort. Dark vignettes
- NO smiling, NO positivity — this is the PROBLEM slide. Raw reality
- NO product visible anywhere — the product comes later as the solution

═══ STRICT RULES ═══
• PHOTOREALISTIC — every photo in the collage must look like a REAL photograph
• African people ONLY: authentic dark skin, natural African features, natural African hair
• The PROBLEM must be VISIBLE — not just a sad face. Show the actual symptom, condition, frustration physically
• ALL French text must be 100% PERFECTLY spelled with all accents
• NO price, NO URL, NO phone, NO CTA button
• NO product — this is about the PROBLEM only
• Final feel: a powerful awareness image that makes you empathize with people experiencing this problem${buildHumanPhotoRealismRules()}${buildVisualPromptDirectives(visualPrefs)}`;

    return problemCollagePrompt;
  }

  // ─── INFOGRAPHIC LAYOUTS PER SLIDE INDEX ──────────────────────
  const layouts = getInfographicLayouts(template, {
    title, productNote, targetPerson, headlineShort, promesseShort,
    angleTitle, angleExplication, b1, b2, b3,
  });

  const basePrompt = layouts[slideIndex % layouts.length];
  
  // Append mandatory African realism guidelines to every angle image
  const africanRealismBlock = `

═══ AFRICAN MARKET REALISM — MANDATORY RULES ═══
• PHOTOREALISTIC — must look like a real photograph, NOT AI-generated. No cartoon, no uncanny valley, no visible AI artifacts
• African person: authentic dark skin, natural African features (NOT caricatural), natural African hair (afro, braids, locs, twists, headwrap)
• Simple everyday African clothing — clean, relatable, NOT exaggerated luxury
• SUBTLE facial expressions — natural, NOT theatrical or exaggerated. Genuine confidence, not forced poses
• Setting must feel like a REAL African environment — natural warm lighting, not artificial studio
• Product at REAL proportions — not oversized or miniature. Sharp, clear, no distortion
• Soft, clean, natural visual style — NOT flashy, NOT over-saturated, NOT aggressive filters
• ALL French text: 100% PERFECT spelling with every accent. Simple, direct, local African tone
• NO body distortion, NO visual inconsistencies, NO uncanny facial features
• If the angle text talks about a visible problem, the person and scene must clearly show that exact problem before the viewer reads the text
• If the angle text talks about a result or promise, the person and scene must clearly show that exact result in a believable way
• The image must work as a persuasive visual even if the text overlay is hidden
• Final feel: a REAL professional product photo that could run as a Facebook/TikTok Ad for African consumers${buildHumanPhotoRealismRules()}${buildSemanticIllustrationRules({
    mainClaim: angleTitle,
    supportText: angleExplication,
    promise: anglePromesse,
    bullets: [b1, b2, b3],
  })}${buildThreePeopleHoldingProductRules()}`;

  const customVisualDirectives = buildVisualPromptDirectives(visualPrefs);

  return basePrompt + africanRealismBlock + customVisualDirectives;
}

/**
 * Returns 4 infographic layout prompts per category template.
 * Each layout is a complete, unique infographic design.
 */
function getInfographicLayouts(template, ctx) {
  const { title, productNote, targetPerson, headlineShort, promesseShort, angleTitle, angleExplication, b1, b2, b3 } = ctx;

  // ─── BEAUTY ───────────────────────────────────────────────────
  if (template === 'beauty') {
    return [
      // Slide 0: Hero showcase — product + headline + badges
      `Square 1:1 LUXURY BEAUTY INFOGRAPHIC for "${title}". Premium editorial design. Ultra HD, 4K.

COMPOSITION: Elegant beauty showcase infographic.
- BACKGROUND: Soft gradient rose-gold (#F7E7DC) to warm blush (#FADBD8). Elegant, feminine, premium
- TOP (20%): Bold dark headline: "${headlineShort}" — large serif font, elegant, with key word in rose-gold accent
- CENTER (50%): ${productNote} displayed large with soft cinematic glow, rose-gold rim light, petals or cream swirl decorative elements around product
- BOTTOM (30%): 3 horizontal glass-morphism benefit cards in a row:
  "${b1}", "${b2}", "${b3}"
  Each with a small beauty icon (sparkle, leaf, droplet). Soft pink/rose-gold accents
${promesseShort ? `- BOTTOM STRIP: Subtle elegant text: "${promesseShort}"` : ''}

Style: Luxury skincare brand campaign. Clean infographic layout, NOT a photo. PERFECT French with all accents.
NO price, NO phone number, NO URL, NO watermark.`,

      // Slide 1: Ingredients / Features — clean science layout
      `Square 1:1 BEAUTY INGREDIENTS INFOGRAPHIC for "${title}". Clean cosmetic science layout. Ultra HD, 4K.

COMPOSITION: Clean ingredient/feature spotlight infographic.
- BACKGROUND: Pure white (#FFFFFF) with soft rose accent lines and geometric shapes
- HEADLINE (top center): "${headlineShort}" — bold modern sans-serif, dark text
- LEFT PANEL (40%): 3 key features/ingredients listed vertically with generous spacing:
  Each: elegant circular icon (leaf, molecule, droplet) + bold French label + 1-line description
  Alternating soft pink/white background strips
- RIGHT PANEL (60%): ${productNote} — product shown at angle with ingredient/botanical elements floating around it (leaves, flowers, droplets)
- CONNECTING LINES: Thin elegant rose-gold lines from ingredient labels to relevant parts of the product
- BOTTOM BAR: Soft blush strip with small trust icons (cruelty-free, natural, dermatologically tested)

Clean, scientific, trustworthy beauty infographic. ALL text PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      // Slide 2: Step-by-step / Routine — numbered process
      `Square 1:1 BEAUTY ROUTINE INFOGRAPHIC for "${title}". Step-by-step guide layout. Ultra HD, 4K.

COMPOSITION: Numbered routine/how-to infographic.
- BACKGROUND: Warm cream (#FFF8F0) with soft watercolor blush accents in corners
- HEADLINE (top): "${headlineShort}" — elegant dark serif, centered
- MAIN AREA: Vertical or Z-shaped flow of 3 numbered steps:
  STEP 1: Circled "1" in rose-gold + icon + short French instruction
  STEP 2: Circled "2" in rose-gold + icon + short French instruction  
  STEP 3: Circled "3" in rose-gold + icon + short French instruction
  Connected by dotted rose-gold arrows between steps
- PRODUCT: ${productNote} — shown alongside step 2 (the application step), glowing
- RESULT BADGE (bottom right): Frosted glass rounded rectangle: "${promesseShort}" with sparkle icon
- ${targetPerson} small portrait in corner showing happy result

Warm, instructional, aspirational beauty infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      // Slide 3: Results / Social proof — bold transformation
      `Square 1:1 BEAUTY RESULTS INFOGRAPHIC for "${title}". Bold transformation energy. Ultra HD, 4K.

COMPOSITION: Results & proof infographic with bold stats.
- BACKGROUND: Bold gradient — deep plum (#2D1B36) to rich rose (#8B2252). Dark luxury
- TOP: Large bold white condensed headline: "${headlineShort}" with one word in gold accent
- CENTER: Split layout:
  LEFT (45%): ${targetPerson} — African woman with radiant glowing skin, confident expression, golden rim lighting. Visible transformation/glow
  RIGHT (45%): ${productNote} — product with dramatic lighting and golden glow effect
- STAT BADGES (3): Large bold gold numbers on dark glass-morphism circles arranged below:
  • "98%" + satisfaction metric
  • "2x" + improvement metric
  • "+500" + customer count
- BOTTOM: 3 small gold pill-shaped benefit labels with sparkle icons

Bold, premium, results-driven beauty infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      // Slide 4: Community & African identity — bold representation
      `Square 1:1 BEAUTY COMMUNITY INFOGRAPHIC for "${title}". African beauty celebration. Ultra HD, 4K.

COMPOSITION: Bold African beauty identity celebration infographic.
- BACKGROUND: Rich warm gradient — deep chocolate brown (#3E2723) to warm gold (#C49A6C). Pan-African luxury warmth
- TOP (15%): Bold gold condensed headline: "${headlineShort}" — powerful, celebratory
- CENTER (55%): DOMINANT African woman (dark skin, natural African hair — afro, braids, locs, or wrap) — full beauty portrait, GLOWING radiant skin, joyful confident expression, warm golden rim lighting. She is the STAR of this image. Her beauty is the MESSAGE
- PRODUCT: ${productNote} — held in her hands or placed beside her face, product catches golden light
- COMMUNITY BADGES (3): 3 warm-toned glass cards arranged below:
  "Beauté Africaine" + crown icon, "Résultats Prouvés" + sparkle, "Confiance" + heart
  Gold text on dark warm glass
- BOTTOM STRIP: Elegant warm gold bar: "${promesseShort}" with traditional African pattern accent

Celebratory, radiant, African beauty pride infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,
    ];
  }

  // ─── TECH ─────────────────────────────────────────────────────
  if (template === 'tech') {
    return [
      // Slide 0: Dark premium tech showcase
      `Square 1:1 TECH PRODUCT INFOGRAPHIC for "${title}". Dark premium tech aesthetic. Ultra HD, 4K.

COMPOSITION: Premium tech product showcase infographic.
- BACKGROUND: Dark gradient — midnight blue (#0A1628) to charcoal (#1A1A2E). Circuit board pattern subtly visible
- TOP: Bold white UPPERCASE headline: "${headlineShort}" — one keyword in electric blue (#00D4FF) accent
- CENTER (60%): ${productNote} — product with dramatic blue LED rim lighting, subtle reflection on dark glossy surface, tech glow effects
- AROUND PRODUCT: 4 floating glass-morphism spec cards with thin blue borders:
  "${b1}", "${b2}", each with a tech icon (chip, lightning, shield, speed)
  Connected to product by thin luminous blue lines
${promesseShort ? `- BOTTOM: Electric blue accent bar with text: "${promesseShort}"` : ''}

Dark, futuristic, premium tech infographic. ALL text PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      // Slide 1: Specs comparison layout
      `Square 1:1 TECH SPECS INFOGRAPHIC for "${title}". Clean technical specification layout. Ultra HD, 4K.

COMPOSITION: Technical specifications infographic with data visualization.
- BACKGROUND: Clean dark (#141422) with subtle grid pattern overlay
- HEADLINE (top): "${headlineShort}" — bold white, icon accent in blue
- LEFT (45%): Vertical specs panel with 4 feature rows:
  Each: blue icon → bold white feature name → metric/value in electric blue
  Separated by subtle blue lines. Clean monospace-like font
- RIGHT (55%): ${productNote} — exploded/angled view showing the product details, blue accent lighting
  Thin labeled callout lines pointing to key product features
- BOTTOM BAR: Dark glass-morphism strip with 3 tech badges (performance, durability, design)

Clean, precise, data-driven tech infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      // Slide 2: Lifestyle usage context
      `Square 1:1 TECH LIFESTYLE INFOGRAPHIC for "${title}". Modern usage context. Ultra HD, 4K.

COMPOSITION: Tech product in real usage infographic.
- BACKGROUND: Modern workspace or daily-life setting — clean desk, city backdrop, or modern room. Blue/gray tones
- HEADLINE (top overlay, frosted glass): "${headlineShort}" — white bold on dark semi-transparent bar
- MAIN (60%): ${targetPerson} — African person using "${title}" in a modern context, natural tech-savvy pose, focused or impressed expression
- PRODUCT: ${productNote} — in use, prominent, glowing screen or LED indicators visible
- INFO CARDS: 3 floating frosted-glass dark cards around the scene:
  "RAPIDE" + speed benefit, "FIABLE" + reliability, "DESIGN" + aesthetic
  Each with thin blue icon and French label
- BOTTOM: Subtle blue gradient bar with tech trust badges

Modern, aspirational tech lifestyle infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      // Slide 3: Performance stats & social proof
      `Square 1:1 TECH PERFORMANCE INFOGRAPHIC for "${title}". Bold performance data. Ultra HD, 4K.

COMPOSITION: Performance results infographic with bold metrics.
- BACKGROUND: Electric gradient — deep navy (#0A1628) to electric blue (#0066FF) to purple (#6C63FF). Bold, energetic
- TOP: Bold white headline: "${headlineShort}" — one word highlighted in bright cyan
- CENTER: Horizontal layout:
  LEFT: ${productNote} — product silhouette with electric blue/cyan glow radiating outward
  RIGHT: ${targetPerson} — African person showing satisfaction with the tech product, blue-lit expression
- STAT SECTION: 3 large bold stat circles in a row:
  • Bold white number + metric label
  • Bold white number + metric label  
  • Bold white number + metric label
  Glass-morphism circle backgrounds with blue glow
- BOTTOM: 3 electric blue pill badges with white text: French benefits

Bold, data-driven, high-performance tech infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      // Slide 4: African tech community — bold representation
      `Square 1:1 TECH COMMUNITY INFOGRAPHIC for "${title}". African tech empowerment. Ultra HD, 4K.

COMPOSITION: African tech user empowerment infographic.
- BACKGROUND: Rich gradient — dark charcoal (#1A1A2E) to electric teal (#00BFA5). Modern, empowering
- TOP (15%): Bold white condensed headline: "${headlineShort}" — key word in bright teal accent
- CENTER (55%): DOMINANT confident African person (dark skin, natural African features) — using or showcasing "${title}" with pride, modern tech-savvy pose, face lit by device glow, dynamic confident expression. This person is the FACE of African tech innovation
- PRODUCT: ${productNote} — held or displayed prominently, electric teal glow around product edges
- COMMUNITY STATS (3): 3 glass-morphism dark cards:
  "Innovation" + rocket icon, "Confiance" + shield, "Performance" + zap
  Bright teal accents on dark glass
- BOTTOM: Teal accent bar with modern African city skyline silhouette

Empowering, modern, African tech pride infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,
    ];
  }

  // ─── FASHION ──────────────────────────────────────────────────
  if (template === 'fashion') {
    return [
      `Square 1:1 FASHION EDITORIAL INFOGRAPHIC for "${title}". High-fashion African editorial. Ultra HD, 4K.

COMPOSITION: Bold fashion editorial infographic.
- BACKGROUND: Split diagonal — rich warm gold (#C49A6C) top-left / deep dark brown (#2C1810) bottom-right
- HEADLINE (top): "${headlineShort}" — bold condensed white uppercase, magazine-style editorial typography
- CENTER: ${targetPerson} — African person styled fashion-forward, wearing/holding "${title}", powerful confident editorial pose, golden warm lighting
- PRODUCT: ${productNote} — prominently displayed, texture and craftsmanship details visible
- FEATURE CARDS: 3 elegant floating cards with gold borders:
  Style, Quality, Design — each with a fashion icon + short French label
- BOTTOM: Gold accent line + elegant French tagline: "${promesseShort}"

High-fashion, bold, editorial infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      `Square 1:1 FASHION CRAFT INFOGRAPHIC for "${title}". Product detail spotlight. Ultra HD, 4K.

COMPOSITION: Craftsmanship details infographic.
- BACKGROUND: Warm textured cream (#F5F0E8) with subtle fabric/leather texture pattern
- HEADLINE: "${headlineShort}" — dark serif, elegant
- MAIN: Close-up macro view of ${productNote} — showing material quality, stitching, texture, craftsmanship details
  3-4 thin gold callout lines pointing from labels to specific product details
  Labels: Material name, Finish quality, Design element — in elegant French
- BOTTOM: 3 horizontal craft badges: "Fait main", "Qualité premium", "Design unique" — gold icons on dark cream cards

Detailed, artisanal, quality-focused fashion infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      `Square 1:1 FASHION STYLING INFOGRAPHIC for "${title}". Street style lookbook. Ultra HD, 4K.

COMPOSITION: How-to-style infographic.
- BACKGROUND: Modern urban setting — trendy African city street, modern architecture, warm natural light
- HEADLINE (overlay): "${headlineShort}" — bold white on dark frosted bar
- MAIN (60%): ${targetPerson} — African person styled head-to-toe, showing how "${title}" fits into a complete look, candid fashion-forward pose
- PRODUCT: ${productNote} — highlighted with subtle outline or glow to draw attention
- STYLE TIPS: 3 frosted-glass cards floating around:
  Tip icons (shirt, palette, star) + short French styling advice
- BOTTOM: Warm gold strip with style hashtags

Trendy, aspirational, street-style fashion infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      `Square 1:1 FASHION SOCIAL PROOF INFOGRAPHIC for "${title}". Bold results & influence. Ultra HD, 4K.

COMPOSITION: Social proof & popularity infographic.
- BACKGROUND: Gradient — rich gold (#C49A6C) to deep burgundy (#5D1A2C). Premium warmth
- TOP: Bold white condensed headline: "${headlineShort}"
- CENTER: ${targetPerson} — African person looking stunning with "${title}", warm golden glamour lighting, editorial expression
- PRODUCT: ${productNote} — visible and glamorous
- STATS (3): Large bold gold numbers on dark glass circles:
  • Customer satisfaction %
  • People wearing/using it
  • Style rating
- BOTTOM: 3 small gold pill badges: French style benefits

Bold, influential, social-proof fashion infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      // Slide 4: African fashion identity — bold representation
      `Square 1:1 FASHION IDENTITY INFOGRAPHIC for "${title}". African fashion pride. Ultra HD, 4K.

COMPOSITION: Bold African fashion identity celebration infographic.
- BACKGROUND: Split diagonal — rich kente-inspired warm gold (#DAA520) top / deep burgundy (#4A0E2A) bottom. Pan-African luxury
- TOP (15%): Bold gold condensed headline: "${headlineShort}" — powerful, fashion-forward
- CENTER (60%): DOMINANT African person (dark skin, natural African hair or headwrap, bold confident pose) — wearing/showcasing "${title}" with pride and elegance. Fashion editorial pose, warm golden cinematic lighting. This person IS the style icon
- PRODUCT: ${productNote} — visible and elevated, catching golden highlight
- STYLE CARDS (3): 3 elegant gold-bordered glass cards:
  "Style Unique" + star icon, "Fierté" + crown, "Tendance" + flame
  Gold text on dark warm glass
- BOTTOM: Rich warm burgundy bar with elegant French tagline: "${promesseShort}"

Celebratory, powerful, African fashion pride infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,
    ];
  }

  // ─── HEALTH / WELLNESS ────────────────────────────────────────
  if (template === 'health') {
    return [
      `Square 1:1 HEALTH WELLNESS INFOGRAPHIC for "${title}". Clean energetic health design. Ultra HD, 4K.

COMPOSITION: Health product showcase infographic.
- BACKGROUND: Fresh gradient — white (#FFFFFF) to mint green (#E8F8F5). Clean, healthy, energetic
- TOP: Bold dark headline: "${headlineShort}" — one keyword highlighted in emerald green (#27AE60)
- CENTER: ${productNote} — product displayed large with natural elements (leaves, fruits, herbs) arranged around it
- BENEFIT BADGES: 4 rounded green-bordered cards around the product:
  "${b1}", "${b2}", "${b3}" — each with health icon (leaf, heart, shield, muscle)
  Connected by thin green dotted lines
${promesseShort ? `- BOTTOM: Green accent bar: "${promesseShort}" with leaf icon` : ''}

Fresh, clean, health-focused infographic. ALL text PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      `Square 1:1 HEALTH INGREDIENTS INFOGRAPHIC for "${title}". Natural science layout. Ultra HD, 4K.

COMPOSITION: Natural ingredients spotlight infographic.
- BACKGROUND: Clean white with soft green watercolor splashes in corners
- HEADLINE: "${headlineShort}" — bold modern, dark green accent
- LEFT PANEL (40%): 3-4 key ingredients/features listed vertically:
  Each: circular nature icon (leaf, herb, molecule) + bold green label + benefit description
  Clean, generous spacing, green accent dots
- RIGHT PANEL (60%): ${productNote} — product surrounded by natural ingredient elements (fresh leaves, botanical illustrations, natural extracts)
  Thin green callout lines from ingredients to product areas
- BOTTOM: Clean green bar with trust badges (naturel, certifié, efficace)

Clean, scientific, natural health infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      `Square 1:1 HEALTH ROUTINE INFOGRAPHIC for "${title}". Active wellness lifestyle. Ultra HD, 4K.

COMPOSITION: Daily health routine step-by-step infographic.
- BACKGROUND: Bright natural scene — sunlit green tones, fresh morning energy, clean white overlay
- HEADLINE (top): "${headlineShort}" — bold dark, green accent
- FLOW: 3 numbered health steps in horizontal or Z-pattern:
  STEP 1: Green circled "1" + icon + short French instruction
  STEP 2: Green circled "2" + icon + short French instruction
  STEP 3: Green circled "3" + icon + short French instruction
  Connected by green dotted arrows
- PRODUCT: ${productNote} — shown at the center step, highlighted
- PERSON: ${targetPerson} — small portrait in corner, healthy energetic expression
- RESULT BADGE: Frosted green glass badge: "${promesseShort}"

Energetic, healthy, step-by-step infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      `Square 1:1 HEALTH RESULTS INFOGRAPHIC for "${title}". Bold wellness results. Ultra HD, 4K.

COMPOSITION: Health results & social proof infographic.
- BACKGROUND: Bold gradient — deep forest green (#1B4332) to emerald (#2D6A4F). Dark wellness luxury
- TOP: Large bold white headline: "${headlineShort}" with one word in bright lime green
- CENTER: Split:
  LEFT: ${targetPerson} — African person radiating health and energy, bright natural expression, green-tinted rim lighting  
  RIGHT: ${productNote} — product with natural glow, leaf elements around it
- STATS (3): Bold white numbers on dark glass-morphism circles:
  • Satisfaction % + label
  • Improvement metric + label
  • Daily users + label
- BOTTOM: 3 lime-green pill badges with white text: French health benefits

Bold, results-driven, wellness infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      // Slide 4: African wellness community — bold representation
      `Square 1:1 HEALTH COMMUNITY INFOGRAPHIC for "${title}". African wellness empowerment. Ultra HD, 4K.

COMPOSITION: Bold African wellness celebration infographic.
- BACKGROUND: Rich gradient — deep forest green (#1B4332) to warm golden green (#8BC34A). Vibrant, healthy, empowering
- TOP (15%): Bold white condensed headline: "${headlineShort}" — key word in bright lime accent
- CENTER (55%): DOMINANT confident African person (dark skin, natural African features, radiant healthy glow) — actively demonstrating vitality and wellness with "${title}". Dynamic energetic pose, bright natural outdoor lighting, JOYFUL healthy expression. This person EMBODIES the health transformation
- PRODUCT: ${productNote} — held proudly or displayed beside the person, catching natural sunlight
- WELLNESS BADGES (3): 3 fresh glass-morphism green cards:
  "Santé Naturelle" + leaf icon, "Énergie" + lightning, "Bien-être" + sun
  Lime-green text on frosted dark glass
- BOTTOM: Fresh green gradient bar with nature elements

Vibrant, empowering, African wellness pride infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,
    ];
  }

  // ─── HOME ─────────────────────────────────────────────────────
  if (template === 'home') {
    return [
      `Square 1:1 HOME PRODUCT INFOGRAPHIC for "${title}". Warm cozy home design. Ultra HD, 4K.

COMPOSITION: Home product showcase infographic.
- BACKGROUND: Warm soft gradient — cream (#FFF8F0) to warm sand (#F5E6D0). Cozy, inviting
- TOP: Bold warm dark headline: "${headlineShort}" — one keyword in terracotta (#C0622A) accent
- CENTER: ${productNote} — product displayed large in a warm home setting vignette (wooden table, soft fabric, warm light), cozy home-styling props
- BENEFIT CARDS: 3 warm-toned rounded cards below product:
  "${b1}", "${b2}", "${b3}" — each with home icon (house, clock, sparkle)
  Terracotta/warm brown accents
${promesseShort ? `- BOTTOM: Warm terracotta bar: "${promesseShort}"` : ''}

Warm, cozy, home-focused infographic. ALL text PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      `Square 1:1 HOME FEATURES INFOGRAPHIC for "${title}". Practical features layout. Ultra HD, 4K.

COMPOSITION: Practical home features infographic.
- BACKGROUND: Clean warm white (#FAFAF5) with warm wood-texture accent border
- HEADLINE: "${headlineShort}" — bold warm serif, dark text
- LEFT (40%): 3 practical features listed with generous spacing:
  Each: terracotta circle icon + bold French label + short practical benefit
  Alternating warm cream/white strips
- RIGHT (60%): ${productNote} — product shown in realistic home context (kitchen counter, shelf, bathroom)
  Thin warm lines connecting features to product areas
- BOTTOM: Warm terracotta bar with quality badges (durable, pratique, élégant)

Practical, warm, trustworthy home infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      `Square 1:1 HOME LIFESTYLE INFOGRAPHIC for "${title}". Real home context. Ultra HD, 4K.

COMPOSITION: Home lifestyle usage infographic.
- BACKGROUND: Warm natural home interior — bright kitchen, cozy living room. Warm natural light
- HEADLINE (overlay): "${headlineShort}" — bold on warm frosted bar
- MAIN: ${targetPerson} — African person naturally using "${title}" in their home, comfortable warm expression
- PRODUCT: ${productNote} — in use, prominent
- INFO CARDS: 3 frosted warm-glass cards:
  "FACILE" + usage tip, "RAPIDE" + benefit, "EFFICACE" + result
  Terracotta/warm brown accents
- BOTTOM: Warm strip with home trust icons

Warm, authentic home-life infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      `Square 1:1 HOME TRUST INFOGRAPHIC for "${title}". Family satisfaction design. Ultra HD, 4K.

COMPOSITION: Home trust & satisfaction infographic.
- BACKGROUND: Gradient — warm terracotta (#C0622A) to deep warm brown (#5D4037). Cozy, trustworthy
- TOP: Bold cream condensed headline: "${headlineShort}"
- CENTER: ${targetPerson} — African person or family in warm home setting, happy with product, golden warm lighting
- PRODUCT: ${productNote} — visible in home context
- STATS (3): Cream numbers on warm dark glass badges:
  • Family satisfaction % + label
  • Customer count + label
  • Durability/daily use metric + label
- BOTTOM: 3 small cream cards with terracotta icons: French home benefits

Warm, family-focused, trustworthy home infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

      // Slide 4: African home & family — bold representation
      `Square 1:1 HOME FAMILY INFOGRAPHIC for "${title}". African family warmth. Ultra HD, 4K.

COMPOSITION: Bold African family home celebration infographic.
- BACKGROUND: Warm rich gradient — deep chocolate (#3E2723) to warm terracotta (#D4845A). African home warmth
- TOP (15%): Bold warm cream condensed headline: "${headlineShort}" — inviting, family-centered
- CENTER (55%): DOMINANT African family scene (dark skin, natural African features) — a person or family warmly using "${title}" in their modern African home. Genuine warm smiles, cozy golden ambient lighting, lived-in warm atmosphere. The FACES are clearly visible and joyful
- PRODUCT: ${productNote} — integrated naturally into the home scene, catching warm golden light
- HOME VALUES (3): 3 warm glass-morphism cards:
  "Famille" + heart icon, "Confort" + home, "Qualité" + star
  Warm cream text on dark terracotta glass
- BOTTOM: Rich warm terracotta bar with traditional African textile pattern accent

Warm, genuine, African family home pride infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,
    ];
  }

  // ─── GENERAL / DEFAULT ────────────────────────────────────────
  return [
    // Slide 0: Bold dark premium showcase
    `Square 1:1 BOLD ADVERTISING INFOGRAPHIC for "${title}". Premium graphic design. Ultra HD, 4K.

COMPOSITION: Dark premium product showcase infographic.
- BACKGROUND: Rich deep gradient — midnight blue (#0A1628) to charcoal (#1A1A2E). Dramatic, cinematic
- TOP: Bold UPPERCASE white headline: "${headlineShort}" — one keyword in vibrant accent color (electric blue, gold, or coral)
- CENTER: ${productNote} — product with dramatic cinematic rim lighting, warm glow, soft reflection on dark surface
- BENEFIT BADGES: 4 glass-morphism rounded rectangles:
  "${b1}", "${b2}", "${b3}" — connected with thin luminous lines
- PERSON (35%): ${targetPerson} — dramatic rim lighting, confident expression

Dark, bold, scroll-stopping infographic. ALL text PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

    // Slide 1: Clean editorial split-screen
    `Square 1:1 SPLIT-SCREEN EDITORIAL INFOGRAPHIC for "${title}". Clean magazine layout. Ultra HD, 4K.

COMPOSITION: Split-screen features infographic.
- LAYOUT: Vertical split — LEFT 45% info panel, RIGHT 55% product visual
- LEFT: Soft warm beige (#F5F0E8) background. Bold dark headline: "${headlineShort}". 3 key features listed vertically with accent dots + bold names + descriptions
- RIGHT: Contrasting warm cream. ${productNote} — product large with premium lighting
  ${targetPerson} — holding/using the product, confident expression
- GEOMETRIC ACCENT: Gold or accent color frame border

Clean, editorial, magazine-style infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

    // Slide 2: Lifestyle how-to steps
    `Square 1:1 LIFESTYLE HOW-TO INFOGRAPHIC for "${title}". Step-by-step guide. Ultra HD, 4K.

COMPOSITION: Numbered how-to lifestyle infographic.
- BACKGROUND: Warm cream (#FFF8F0) with soft accent watercolor corners
- HEADLINE: "${headlineShort}" — bold dark centered
- MAIN AREA: 3 numbered steps in Z-pattern flow:
  STEP 1: Circled "1" in accent color + icon + short French instruction
  STEP 2: Circled "2" in accent color + icon + short French instruction
  STEP 3: Circled "3" in accent color + icon + short French instruction
  Connected by dotted arrows
- PRODUCT: ${productNote} — shown alongside main step, highlighted
- RESULT: Frosted glass badge: "${promesseShort}"

Warm, instructional, lifestyle infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

    // Slide 3: Vibrant results & stats
    `Square 1:1 VIBRANT RESULTS INFOGRAPHIC for "${title}". Bold colorful energy. Ultra HD, 4K.

COMPOSITION: Results & social proof infographic with bold metrics.
- BACKGROUND: Bold gradient — coral (#FF6B6B) to magenta (#C850C0) to purple (#6C63FF). Energetic, modern
- TOP: Bold white condensed headline: "${headlineShort}"
- CENTER: Split:
  LEFT: ${targetPerson} — African person with dynamic positive energy, gradient colors reflected on skin
  RIGHT: ${productNote} — product with white glow effect
- STAT BADGES (3): Large bold white numbers on dark glass circles:
  • Satisfaction % + metric
  • Improvement metric + label
  • Customer count + label
- BOTTOM: 3 white pill-shaped benefit labels: French benefits

Bold, vibrant, data-driven infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,

    // Slide 4: African identity & community — bold representation
    `Square 1:1 COMMUNITY IDENTITY INFOGRAPHIC for "${title}". African pride & empowerment. Ultra HD, 4K.

COMPOSITION: Bold African community celebration infographic.
- BACKGROUND: Rich warm gradient — deep dark brown (#2C1810) to vibrant warm gold (#DAA520). Pan-African luxury, warmth
- TOP (15%): Bold gold condensed headline: "${headlineShort}" — powerful, celebratory, warm
- CENTER (55%): DOMINANT confident African person (dark skin, natural African hair — afro, braids, locs, or headwrap) — proudly using or showcasing "${title}". Their FACE is clearly visible with a confident, radiant expression. Warm golden cinematic rim lighting. This person IS the voice of the product — they represent African excellence and confidence
- PRODUCT: ${productNote} — held or displayed prominently beside the person, catching golden highlight
- IDENTITY BADGES (3): 3 warm gold-bordered glass cards:
  "Excellence" + crown icon, "Confiance" + shield, "Notre Choix" + heart
  Gold text on dark warm glass
- BOTTOM: Rich warm gold bar with subtle traditional African geometric pattern

Celebratory, empowering, African pride infographic. PERFECT French.
NO price, NO phone number, NO URL, NO watermark.`,
  ];
}

/**
 * 4 lifestyle prompts — photos réalistes de personnes africaines tenant LE produit
 * de référence (même packaging exact). Aucune infographie, aucun texte overlay.
 * Alimente la galerie photo "Photos du produit" sur la page produit.
 */
function buildPeopleHoldingProductPrompts(gptResult, visualPrefs = {}) {
  const title = gptResult.title || 'product';
  const productNote = `THE EXACT product from the reference image — same packaging, same shape, same color, same label. Use the provided product reference image. NEVER invent, redesign or replace the product.`;

  const baseRules = `
═══ MANDATORY REAL PHOTO RULES ═══
• Must look like a REAL smartphone/camera photograph of a real human being — NOT AI art, NOT a render, NOT a cartoon
• Authentic Black African person (dark brown skin, natural African features, natural African hair or headwrap). Natural skin texture and pores. Realistic hands with correct finger count and natural grip
• Simple everyday African clothing, relatable — NOT runway fashion, NOT luxury glam
• Natural warm lighting (daylight, window light, soft indoor light). NO studio beauty retouch, NO plastic skin, NO oversharpened details
• The person is HOLDING the product in their hands clearly and naturally — the product and the fingers must both be sharp and unambiguous
• ${productNote}
• Tight or mid-range crop. Square 1:1. Photorealistic quality
• NO text overlay, NO caption, NO price, NO CTA, NO logo, NO frame, NO marketing layout — this is a candid-style product photo, not an ad
• NO extra objects around the product, no clutter. The product is the visual focus together with the person's face and hands
${buildHumanPhotoRealismRules()}`;

  return [
    `Photorealistic candid lifestyle photo of an African woman (25-35 years old, natural hair or braids, soft everyday smile) holding "${title}" in both hands at chest level. Indoor African home setting — soft natural window light, slightly blurred cozy background (living room, bedroom, or kitchen corner). She is looking at the product with a confident, natural, trustworthy expression — like she's about to show it to a friend.
${baseRules}`,

    `Photorealistic candid lifestyle photo of an African man (28-40 years old, short natural hair or close cut, calm confident expression) holding "${title}" in one hand, product turned slightly toward the camera so the packaging is clearly visible. Casual clothing (simple t-shirt or shirt). Soft daylight from a window, neutral home or office background with gentle bokeh. He looks straight at the camera with a subtle reassuring half-smile.
${baseRules}`,

    `Photorealistic close-up lifestyle photo of an African woman's hands holding "${title}" — hands are dark-skinned, natural, well-framed, fingers clearly gripping the product naturally. Slight portion of her face/neck/shoulder visible in soft focus in the background. Warm natural lighting, shallow depth of field. Feels like a genuine product showcase photo a real customer would share on WhatsApp or Instagram.
${baseRules}`,

    `Photorealistic candid lifestyle photo of an African person (any gender, 30-45 years old) outside in a bright warm African daylight — courtyard, street, garden or terrace with soft sunlight. They hold "${title}" in their hand, presenting it naturally toward the camera while smiling genuinely. Real everyday clothes, natural hair. The background is a real African environment, slightly blurred.
${baseRules}`,
  ];
}

/**
 * 5 flash prompts — INFOGRAPHIES avec des designs UNIQUES par slide ET par catégorie produit.
 * Chaque template (beauty, tech, fashion, health, home, general) a sa propre structure visuelle.
 * TOUJOURS: personnes africaines cibles + produit visible + texte français.
 */
function buildFlashPrompts(gptResult, hasProductRef, method = 'PAS', template = 'general', visualPrefs = {}) {
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
      {
        prompt: `Square 1:1 AFRICAN BEAUTY PRIDE AD for "${title}". Bold African representation. Ultra HD, 4K.

COMPOSITION: African beauty identity celebration.
- BACKGROUND: Rich warm gradient — deep chocolate (#3E2723) to luxurious gold (#C49A6C). Pan-African warmth
- TOP: Bold gold condensed headline about African beauty/confidence in French
- CENTER (dominant 60%): Stunning African woman (dark skin, natural African hair — afro, braids, or headwrap) holding or using "${title}" with PRIDE. Her FACE is the focal point — radiant, confident, glowing. Golden warm rim lighting. She embodies African beauty excellence
- PRODUCT: visible in her hands or beside her face — ${productNote}
- CELEBRATION BADGES: 3 warm gold glass cards:
  "Beauté Africaine" + crown, "Notre Fierté" + heart, "Résultats" + sparkle
- BOTTOM: Warm gold bar with African-inspired geometric pattern

Celebratory, radiant, African beauty pride. PERFECT French.`,
        type: 'beauty_identity',
      },
    ].map((entry) => ({ ...entry, prompt: `${entry.prompt}${buildVisualPromptDirectives(visualPrefs)}` }));
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
      {
        prompt: `Square 1:1 AFRICAN TECH EMPOWERMENT AD for "${title}". Bold African representation. Ultra HD, 4K.

COMPOSITION: African tech user empowerment.
- BACKGROUND: Rich gradient — dark charcoal (#1A1A2E) to electric teal (#00BFA5). Modern, empowering
- TOP: Bold white headline about African innovation/technology in French
- CENTER (dominant 60%): Confident African person (dark skin, natural African features) — using or showcasing "${title}" with pride. FACE clearly visible — focused, tech-savvy, empowered expression. Modern urban context with teal tech glow on their face
- PRODUCT: visible and prominent — ${productNote}
- TECH BADGES: 3 dark glass-morphism teal-bordered cards:
  "Innovation" + rocket, "Puissance" + zap, "Notre Technologie" + chip
- BOTTOM: Teal bar with modern African city skyline silhouette

Empowering, modern, African tech pride. PERFECT French.`,
        type: 'tech_identity',
      },
    ].map((entry) => ({ ...entry, prompt: `${entry.prompt}${buildVisualPromptDirectives(visualPrefs)}` }));
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
      {
        prompt: `Square 1:1 AFRICAN FASHION IDENTITY AD for "${title}". Bold African style representation. Ultra HD, 4K.

COMPOSITION: African fashion pride & identity.
- BACKGROUND: Split diagonal — warm kente gold (#DAA520) top / deep burgundy (#4A0E2A) bottom. Pan-African luxury
- TOP: Bold gold headline about African style/elegance in French
- CENTER (dominant 60%): Stunning African person (dark skin, natural African hair or headwrap, bold confident editorial pose) — wearing or showcasing "${title}" with pride and elegance. Their FACE is the star — radiant, confident, fashion-forward. Golden warm cinematic lighting
- PRODUCT: visible and elevated — ${productNote}
- STYLE BADGES: 3 gold-bordered elegant cards:
  "Style Unique" + star, "Fierté Africaine" + crown, "Tendance" + flame
- BOTTOM: Rich burgundy bar with African textile pattern

Celebratory, powerful, African fashion pride. PERFECT French.`,
        type: 'fashion_identity',
      },
    ].map((entry) => ({ ...entry, prompt: `${entry.prompt}${buildVisualPromptDirectives(visualPrefs)}` }));
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
      {
        prompt: `Square 1:1 AFRICAN WELLNESS PRIDE AD for "${title}". Bold African health representation. Ultra HD, 4K.

COMPOSITION: African wellness empowerment.
- BACKGROUND: Rich gradient — deep forest green (#1B4332) to warm golden (#DAA520). Healthy, empowering
- TOP: Bold white headline about African health/vitality in French
- CENTER (dominant 60%): Radiant African person (dark skin, natural African features, healthy vibrant glow) — actively using or holding "${title}" with pride. Their FACE clearly visible — joyful, energetic, healthy expression. Bright natural outdoor lighting or warm gym/wellness setting
- PRODUCT: visible and prominent — ${productNote}
- WELLNESS BADGES: 3 fresh green glass cards:
  "Santé Naturelle" + leaf, "Notre Énergie" + sun, "Résultats" + muscle
- BOTTOM: Fresh green bar with nature elements

Vibrant, empowering, African wellness pride. PERFECT French.`,
        type: 'health_identity',
      },
    ].map((entry) => ({ ...entry, prompt: `${entry.prompt}${buildVisualPromptDirectives(visualPrefs)}` }));
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
      {
        prompt: `Square 1:1 AFRICAN FAMILY HOME AD for "${title}". Bold African family representation. Ultra HD, 4K.

COMPOSITION: African family home pride.
- BACKGROUND: Warm rich gradient — deep chocolate (#3E2723) to warm terracotta (#D4845A). Cozy, African warmth
- TOP: Bold warm cream headline about African family life/comfort in French
- CENTER (dominant 60%): African family or person (dark skin, natural African features) — using "${title}" in their warm modern home. Their FACES clearly visible — genuine warm smiles, cozy golden ambient lighting. They look happy and comfortable with the product
- PRODUCT: visible in home context — ${productNote}
- HOME BADGES: 3 warm terracotta glass cards:
  "Famille" + heart, "Notre Foyer" + home, "Qualité" + star
- BOTTOM: Warm terracotta bar with African textile pattern

Warm, genuine, African family home pride. PERFECT French.`,
        type: 'home_identity',
      },
    ].map((entry) => ({ ...entry, prompt: `${entry.prompt}${buildVisualPromptDirectives(visualPrefs)}` }));
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
    {
      prompt: `Square 1:1 AFRICAN PRIDE PRODUCT AD for "${title}". Bold African community representation. Ultra HD, 4K.

COMPOSITION: African identity celebration — THE PEOPLE ARE THE AD.
- BACKGROUND: Warm rich gradient — deep dark brown (#2C1810) to vibrant gold (#DAA520). Pan-African luxury
- TOP: Bold gold condensed headline about African excellence/confidence in French
- CENTER (dominant 60%): ${targetPerson} — DOMINANT confident African person (dark skin, natural African hair — afro, braids, locs, or headwrap). Their FACE is the HERO — radiant, proud, confident expression. Warm golden cinematic rim lighting. They are actively using or holding "${title}" — this person REPRESENTS the African consumer
- CENTER-RIGHT: ${productNote} Product displayed with golden glow
- COMMUNITY BADGES (3): Warm gold glass cards:
  "Excellence" + crown, "Notre Choix" + heart, "Confiance" + shield
- BOTTOM: Rich gold bar with subtle traditional African geometric pattern

Celebratory, empowering, African community pride. PERFECT French.`,
      type: 'general_identity',
    },
  ].map((entry) => ({ ...entry, prompt: `${entry.prompt}${buildVisualPromptDirectives(visualPrefs)}` }));
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

// ── GET /info — fetch credit info for modal ──────────────────
router.get('/info', requireEcomAuth, async (req, res) => {
  try {
    const wsId = req.workspaceId;
    if (!wsId) return res.json({ success: true, generations: null });

    const workspace = await EcomWorkspace.findById(wsId)
      .select('simpleGenerationsRemaining freeGenerationsRemaining paidGenerationsRemaining totalGenerations')
      .lean();

    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace introuvable' });

    const remaining = (workspace.simpleGenerationsRemaining || 0) + (workspace.freeGenerationsRemaining || 0) + (workspace.paidGenerationsRemaining || 0);

    res.json({
      success: true,
      generations: {
        remaining,
        totalUsed: workspace.totalGenerations || 0,
      }
    });
  } catch (err) {
    console.error('[ProductGenerator] GET /info error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ── GET /images/:jobId — Poll async image generation status ───────────────────
router.get('/images/:jobId', requireEcomAuth, (req, res) => {
  const job = imageJobs.get(req.params.jobId);
  if (!job) return res.json({ success: true, status: 'not_found', images: {} });

  const images = {};
  if (job.heroImage) images.heroImage = job.heroImage;
  if (job.beforeAfterImage) images.beforeAfterImage = job.beforeAfterImage;
  if (job.angles?.length) images.angles = job.angles;
  if (job.peoplePhotos?.length) images.peoplePhotos = job.peoplePhotos;

  res.json({
    success: true,
    status: job.status, // 'generating' | 'done' | 'error'
    progress: job.progress || 0,
    total: job.total || 0,
    images,
  });
});

router.post('/', requireEcomAuth, validateEcomAccess('products', 'write'), upload.array('images', 8), async (req, res) => {
  const userId = req.user?.id || req.user?._id || 'anonymous';

  const {
    url,
    description: userDescription,
    skipScraping,
    marketingApproach,
    visualTemplate: rawVisualTemplate,
    preferredColor: rawPreferredColor,
    heroVisualDirection: rawHeroVisualDirection,
    decorationDirection: rawDecorationDirection,
    titleColor: rawTitleColor,
    contentColor: rawContentColor,
    // Paramètres copywriting simplifiés
    targetAvatar,
    mainProblem,
    tone,
    language
  } = req.body || {};
  const imageFiles = req.files || [];
  const approach = marketingApproach || 'PAS';
  const visualTemplate = rawVisualTemplate || 'general';
  const preferredColor = typeof rawPreferredColor === 'string' ? rawPreferredColor.trim().slice(0, 80) : '';
  const heroVisualDirection = typeof rawHeroVisualDirection === 'string' ? rawHeroVisualDirection.trim().slice(0, 180) : '';
  const decorationDirection = typeof rawDecorationDirection === 'string' ? rawDecorationDirection.trim().slice(0, 180) : '';
  const titleColor = typeof rawTitleColor === 'string' ? rawTitleColor.trim().slice(0, 30) : '';
  const contentColor = typeof rawContentColor === 'string' ? rawContentColor.trim().slice(0, 30) : '';

  // Contexte copywriting simplifié : méthode + avatar + problème
  const copywritingContext = {
    method: approach,
    avatar: targetAvatar || '',
    problem: mainProblem || '',
    tone: tone || 'urgence',
    language: language || 'français'
  };

  const visualContext = {
    template: visualTemplate,
    preferredColor,
    heroVisualDirection,
    decorationDirection,
    titleColor,
    contentColor,
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
        .select('storeSettings.country storeSettings.city storeSettings.storeName storeSettings.storeCurrency storeSettings.currency name freeGenerationsRemaining paidGenerationsRemaining totalGenerations simpleGenerationsRemaining');

      if (!workspace) {
        return res.status(404).json({ success: false, message: 'Workspace introuvable' });
      }

      storeContext = {
        country: workspace?.storeSettings?.country || '',
        city: workspace?.storeSettings?.city || '',
        currency: workspace?.storeSettings?.storeCurrency || workspace?.storeSettings?.currency || '',
        shopName: workspace?.storeSettings?.storeName || workspace?.name || '',
      };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // VÉRIFICATION DES LIMITES DE GÉNÉRATION
    // ══════════════════════════════════════════════════════════════════════════
    if (workspace) {
      const simpleRemaining = workspace.simpleGenerationsRemaining || 0;
      const freeRemaining = workspace.freeGenerationsRemaining || 0;
      const paidRemaining = workspace.paidGenerationsRemaining || 0;
      const totalRemaining = simpleRemaining + freeRemaining + paidRemaining;

      if (totalRemaining <= 0) {
        return res.status(403).json({
          success: false,
          limitReached: true,
          message: '🎯 Tu n\'as plus de crédits !\n\nAchète des crédits pour générer des pages produit.',
          remaining: 0,
          totalGenerations: workspace.totalGenerations || 0,
          pricing: { unit: 300 }
        });
      }

      // Décrémenter: simpleRemaining d'abord, puis free, puis paid
      if (simpleRemaining > 0) {
        workspace.simpleGenerationsRemaining = simpleRemaining - 1;
      } else if (freeRemaining > 0) {
        workspace.freeGenerationsRemaining = freeRemaining - 1;
      } else {
        workspace.paidGenerationsRemaining = paidRemaining - 1;
      }

      workspace.totalGenerations = (workspace.totalGenerations || 0) + 1;
      workspace.lastGenerationAt = new Date();
      await workspace.save();

      const newRemaining = (workspace.simpleGenerationsRemaining || 0) + (workspace.freeGenerationsRemaining || 0) + (workspace.paidGenerationsRemaining || 0);
      console.log(`✅ Génération autorisée. Crédits restants: ${newRemaining}`);
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

    gptResult = await analyzeWithVision(scraped, imageBuffers, approach, storeContext, copywritingContext, visualContext);

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
    // RESPOND EARLY — Send text data immediately, generate images in background
    // ══════════════════════════════════════════════════════════════════════════
    const jobId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Testimonials sans images individuelles
    const finalTestimonials = (gptResult.testimonials || []).map(t => ({ ...t, image: '' }));

    const productPage = {
      title: gptResult.title || scraped.title || '',
      currency: storeContext.currency || '',
      targetMarket: storeContext.country || '',
      country: storeContext.country || '',
      city: storeContext.city || '',
      locale: '',
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
      heroImage: null,
      beforeAfterImage: null,
      angles: (gptResult.angles || []).map((a, i) => ({ ...a, poster_url: null, index: i + 1 })),
      raisons_acheter: gptResult.raisons_acheter || [],
      benefits_bullets: gptResult.benefits_bullets || [],
      conversion_blocks: gptResult.conversion_blocks || [],
      urgency_elements: gptResult.urgency_elements || null,
      faq: gptResult.faq || [],
      testimonials: finalTestimonials,
      testimonialsGroupImage: null,
      testimonialsSocialProofImage: null,
      reassurance: gptResult.reassurance || null,
      guide_utilisation: gptResult.guide_utilisation || null,
      description: '',
      realPhotos,
      allImages: [],
      sourceUrl: cleanUrl,
      createdByAI: true,
      generatedAt: new Date().toISOString(),
      imageJobId: jobId,
      visualTemplate,
      preferredColor,
      heroVisualDirection,
      decorationDirection,
      titleColor,
      contentColor,
    };

    // Récupérer le nombre de générations restantes
    const updatedWorkspace = workspace ? await EcomWorkspace.findById(workspace._id)
      .select('freeGenerationsRemaining paidGenerationsRemaining totalGenerations simpleGenerationsRemaining')
      .lean() : null;

    const generationsInfo = updatedWorkspace ? {
      remaining: (updatedWorkspace.simpleGenerationsRemaining || 0) + (updatedWorkspace.freeGenerationsRemaining || 0) + (updatedWorkspace.paidGenerationsRemaining || 0),
      totalUsed: updatedWorkspace.totalGenerations || 0
    } : null;

    // Track feature usage
    if (req.workspaceId && req.user) {
      FeatureUsageLog.create({
        workspaceId: req.workspaceId,
        userId: req.user._id || req.user.id,
        feature: 'product_page_generator',
        meta: {
          productUrl: cleanUrl || null,
          productName: gptResult?.title || scraped?.title || null,
          success: true
        }
      }).catch(() => { });
    }

    // ── RESPOND NOW — client gets the preview immediately
    console.log('📤 Réponse envoyée, génération images en arrière-plan (jobId:', jobId, ')');
    res.json({
      success: true,
      product: productPage,
      generations: generationsInfo,
      imageJobId: jobId,
    });

    // ══════════════════════════════════════════════════════════════════════════
    // BACKGROUND — Generate all images asynchronously
    // ══════════════════════════════════════════════════════════════════════════
    const jobData = { status: 'generating', progress: 0, total: 0, heroImage: null, beforeAfterImage: null, angles: [], peoplePhotos: [], createdAt: Date.now() };
    imageJobs.set(jobId, jobData);

    // Fire and forget — errors won't crash the response
    (async () => {
      try {
    console.log('🎨 [BG] Génération de toutes les images en parallèle...');

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
      generateAndUpload(buildHeroPrompt(gptResult, !!baseImageBuffer, visualTemplate, visualContext), baseImageBuffer, `hero-${Date.now()}.png`, 'hero')
        .then(url => ({ type: 'hero', url }))
    );

    // ── Avant/Après ──
    const beforeAfterPrompt = gptResult.prompt_avant_apres || null;
    if (beforeAfterPrompt) {
      imagePromises.push(
        generateAndUpload(beforeAfterPrompt, baseImageBuffer, `before-after-${Date.now()}.png`, 'before_after')
          .then(url => ({ type: 'before_after', url }))
      );
    }

    // ── Flash images — 5 affiches marketing (1 par angle) ─
    const angles = gptResult.angles || [];
    const flashPrompts = buildFlashPrompts(gptResult, !!baseImageBuffer, approach, visualTemplate, visualContext);
    const maxFlash = flashPrompts.length;

    for (let i = 0; i < maxFlash; i++) {
      const flash = flashPrompts[i];
      const angle = angles[i] || null;

      // Build an infographic prompt that visually illustrates the angle as an infographic
      const africanRealism = `\n\n═══ AFRICAN MARKET REALISM — MANDATORY ═══\n• PHOTOREALISTIC — must look like a real photograph. No cartoon, no AI artifacts\n• African person: authentic dark skin, natural African features, natural African hair. Simple everyday clothing, SUBTLE expressions — NOT theatrical\n• Setting: real African environment, natural warm lighting. Product at REAL proportions\n• Soft, clean, natural style. ALL French text 100% PERFECT. NO distortion, NO inconsistencies${buildHumanPhotoRealismRules()}${buildSemanticIllustrationRules({
        mainClaim: angle?.titre_angle || gptResult.hero_headline || title,
        supportText: angle?.explication || angle?.message_principal || '',
        promise: angle?.promesse || '',
        bullets: gptResult.benefits_bullets || [],
      })}`;
      const anglePrompt = angle
        ? buildAngleImagePrompt(angle, gptResult, !!baseImageBuffer, visualTemplate, i, visualContext, approach)
        : flash.prompt + africanRealism;

      imagePromises.push(
        generateAndUpload(anglePrompt, baseImageBuffer, `flash-${i + 1}-${Date.now()}.png`, 'scene')
          .then(url => ({ type: 'poster', index: i, url, angle, flashType: flash.type }))
      );
    }

    // ── People photos — 4 photos lifestyle de personnes réelles tenant le produit ──
    const peoplePhotoPrompts = buildPeopleHoldingProductPrompts(gptResult, visualContext);
    peoplePhotoPrompts.forEach((peoplePrompt, idx) => {
      imagePromises.push(
        generateAndUpload(peoplePrompt, baseImageBuffer, `people-${idx + 1}-${Date.now()}.png`, 'scene')
          .then(url => ({ type: 'people_photo', index: idx, url }))
      );
    });

    // Exécuter toutes les générations en parallèle avec timeout global de 180s
    const IMAGE_TIMEOUT_MS = 180000;
    const withTimeout = (promise, fallback) =>
      Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve(fallback), IMAGE_TIMEOUT_MS))
      ]);

    jobData.total = imagePromises.length;

    // Wrap each promise to update progress
    const trackedPromises = imagePromises.map(p =>
      withTimeout(p, null).then(result => {
        jobData.progress++;
        return result;
      })
    );

    const imageResults = await Promise.allSettled(trackedPromises)
      .then(results => results.map(r => (r.status === 'fulfilled' ? r.value : null)));

    // Extraire les résultats
    jobData.heroImage = imageResults.find(r => r?.type === 'hero')?.url || null;
    jobData.beforeAfterImage = imageResults.find(r => r?.type === 'before_after')?.url || null;

    jobData.angles = imageResults
      .filter(r => r?.type === 'poster')
      .sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0))
      .map(r => ({
        ...r?.angle,
        poster_url: r?.url || null,
        index: (r?.index ?? 0) + 1,
        flashType: r?.flashType || null
      }));

    jobData.peoplePhotos = imageResults
      .filter(r => r?.type === 'people_photo')
      .sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0))
      .map(r => r?.url)
      .filter(Boolean);

    jobData.status = 'done';
    console.log('✅ [BG] Images terminées:', {
      hero: !!jobData.heroImage,
      beforeAfter: !!jobData.beforeAfterImage,
      posters: jobData.angles.filter(p => p.poster_url).length,
      peoplePhotos: jobData.peoplePhotos.length,
    });

      } catch (bgErr) {
        console.error('❌ [BG] Erreur génération images:', bgErr.message);
        jobData.status = 'error';
      }
    })();

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
