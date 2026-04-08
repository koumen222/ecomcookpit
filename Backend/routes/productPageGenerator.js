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

// ─── Color theme system ──────────────────────────────────────────────────────

/**
 * Returns a dominant color palette based on product category template.
 * Used to create visual coherence across all 5 ad images.
 */
function getProductColorTheme(template) {
  const themes = {
    beauty: {
      name: 'rose/beige',
      primary: '#E8A0BF',       // soft rose
      secondary: '#F5E6D0',     // warm beige
      dark: '#5B1A2A',          // deep burgundy
      gradient: 'soft rose (#E8A0BF) to warm beige (#F5E6D0)',
      darkGradient: 'deep burgundy (#5B1A2A) to warm rose (#C27083)',
      accent: '#D4845A',        // rose gold
      personClothing: 'soft pink, beige, or rose-colored clothing',
      mood: 'feminine, elegant, warm',
    },
    health: {
      name: 'vert',
      primary: '#4CAF50',       // natural green
      secondary: '#E8F5E9',     // mint
      dark: '#1B4332',          // deep forest
      gradient: 'fresh mint (#E8F5E9) to natural green (#81C784)',
      darkGradient: 'deep forest green (#1B4332) to emerald (#2D6A4F)',
      accent: '#27AE60',        // vibrant green
      personClothing: 'green, olive, or earth-toned clothing',
      mood: 'natural, healthy, energetic',
    },
    tech: {
      name: 'bleu/noir',
      primary: '#1565C0',       // tech blue
      secondary: '#0A1628',     // midnight
      dark: '#0A0E1A',          // deep dark
      gradient: 'midnight blue (#0A1628) to charcoal (#1A1A2E)',
      darkGradient: 'deep navy (#0A0E1A) to electric blue (#0066FF)',
      accent: '#00D4FF',        // electric cyan
      personClothing: 'dark blue, black, or modern grey clothing',
      mood: 'futuristic, sleek, powerful',
    },
    fashion: {
      name: 'or/doré',
      primary: '#C49A6C',       // warm gold
      secondary: '#F5E6D0',     // cream
      dark: '#2C1810',          // deep brown
      gradient: 'warm cream (#F5E6D0) to golden (#C49A6C)',
      darkGradient: 'deep brown (#2C1810) to warm gold (#C49A6C)',
      accent: '#DAA520',        // gold
      personClothing: 'warm gold, cream, or brown-toned clothing',
      mood: 'luxurious, editorial, bold',
    },
    home: {
      name: 'terracotta/brun',
      primary: '#C0622A',       // terracotta
      secondary: '#FFF8F0',     // warm cream
      dark: '#5D4037',          // chocolate
      gradient: 'warm cream (#FFF8F0) to sandy beige (#F5E6D0)',
      darkGradient: 'warm terracotta (#C0622A) to deep chocolate (#5D4037)',
      accent: '#D4845A',        // warm terracotta
      personClothing: 'warm terracotta, beige, or brown clothing',
      mood: 'cozy, warm, family-oriented',
    },
    general: {
      name: 'corail/moderne',
      primary: '#FF5722',       // vibrant coral
      secondary: '#FFF3E0',     // warm cream
      dark: '#1A1A2E',          // charcoal
      gradient: 'warm cream (#FFF3E0) to soft coral (#FFAB91)',
      darkGradient: 'deep midnight (#0A1628) to charcoal (#1A1A2E)',
      accent: '#FF5722',        // coral
      personClothing: 'coral, warm-toned, or modern casual clothing',
      mood: 'dynamic, modern, energetic',
    },
  };
  return themes[template] || themes.general;
}

// ─── Image prompt builders ────────────────────────────────────────────────────

/**
 * Hero — IMAGE 2: PRODUIT + BÉNÉFICE
 * Product clearly visible + main benefit + African person using it
 * Color theme integrated for visual coherence across all 5 images.
 */
function buildHeroPrompt(gptResult, hasProductRef, template = 'general') {
  const colorTheme = getProductColorTheme(template);
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

  // Accent color — use theme
  const accentColor = `${colorTheme.name} (${colorTheme.primary})`;

  return `Ultra realistic e-commerce product advertisement for the African francophone market. Square 1:1. High-definition photorealistic quality — must look like a high-end SMARTPHONE PHOTO, NOT AI-generated. Natural soft lighting, no aggressive filters, no cartoon style.

═══ IMAGE TYPE: PRODUIT + BÉNÉFICE PRINCIPAL ═══
Show "${productName}" clearly with its main benefit. The product is the hero of this image — shown in a natural usage moment.

═══ COLOR THEME — ${colorTheme.name.toUpperCase()} (MANDATORY) ═══
Dominant color: ${colorTheme.primary} — this color must be present throughout the image:
- Person's clothing: ${colorTheme.personClothing}
- Environment accents: objects, fabrics, or decor in ${colorTheme.name} tones
- Overall mood: ${colorTheme.mood}
- Text accents: key words in ${colorTheme.primary}
The image must feel visually coherent with this ${colorTheme.name} color story.

═══ AFRICAN PERSON — ABSOLUTELY MANDATORY ═══
⚠️ NON-NEGOTIABLE: An authentic Black African person MUST be prominently visible in this image.
- Real dark skin (natural Black African complexion), realistic African facial features, natural African hair (afro, braids, locs, twists, or headwrap)
- NOT caricatural, NOT exaggerated features — realistic, dignified, natural appearance
- Wearing simple everyday African clothes (not exaggerated luxury) — casual, clean, relatable
- SUBTLE facial expression — natural smile or calm confidence. NOT theatrical, NOT exaggerated joy, NOT mannequin pose
- Natural attitude as in real daily life — relaxed, genuine, approachable
- Their FACE must be clearly visible (not just hands!) — they occupy at least 35% of the frame
- They are actively using, holding, or demonstrating the product in a natural way

═══ SCENE & ENVIRONMENT ═══
Realistic African daily-life setting matching the product category:
- If food/drink: African kitchen, dining room, outdoor family meal
- If tech/gadget: desk in an African home, workspace, living room
- If beauty/skincare: African bathroom, bedroom vanity, morning routine
- If fashion: African city street, modern local interior
- If health/sport: local park, courtyard, African home
- If home/household: African living room, kitchen, real home with local decor
The setting must be coherent with a REAL African environment — natural light, soft and warm, NOT artificial studio lighting. Slightly blurred background (bokeh) to focus on the person and product.

═══ PRODUCT PLACEMENT ═══
• ${productBlock}
• Product at its REAL SIZE — not oversized, not miniature. Natural proportions
• Placed naturally in the scene: in hands, on a table, on bathroom shelf, etc.
• Sharp, clear, no distortion — every label and detail perfectly readable
• Product occupies 35-45% of the frame — prominent but natural, not forced

═══ BENEFIT STRIP (side or bottom, 25%) ═══
• 3-4 benefit items in a clean row or column:
  ✓ ${benefits[0]}
  ✓ ${benefits[1]}
  ✓ ${benefits[2]}
  ✓ ${benefits[3]}
• Clean modern sans-serif typography, small icons in ${accentColor}

═══ TEXT OVERLAYS (MANDATORY — PERFECT FRENCH) ═══

TOP of image (bold headline spanning full width):
"${headline}"
Font: large bold modern sans-serif, dark text with key words in ${accentColor}

Below headline (subheadline, smaller):
"${subheadline}"
Font: medium weight, dark gray

Social proof badge (rounded pill shape, ${accentColor} background, white text):
"${badgeText} ✓"

BOTTOM STRIP (full width, light gray background):
Labels separated by bullets: "${labelsLine}"
Font: small, clean, professional

BOTTOM CENTER — CTA button (${accentColor} background, white bold text, rounded corners):
"${ctaText}"

═══ STYLE RULES — STRICT ═══
• PHOTOREALISTIC — must look like a real photograph, NOT AI-generated. No cartoon, no uncanny valley
• ALL French text: 100% PERFECT spelling with every accent (é, è, ê, à, ù, ç, î, ô). ZERO errors. Simple, direct, African-local tone
• Soft, clean, natural visual style — NOT flashy, NOT over-saturated, NOT aggressive filters
• Natural warm lighting — like real daylight in an African home
• NO body distortion, NO product distortion, NO visual inconsistencies
• NO price in numbers, NO phone number, NO URL, NO watermark
• Modern typography: clean sans-serif, high contrast, perfectly aligned
• Product packaging sharp and clear — every label readable
• The African person is THE FACE of this ad — confident, natural, relatable. Their presence makes the ad authentic for the African market
• Final mood: professional, credible, natural — could be a real brand campaign photo`;
}

/**
 * Builds an INFOGRAPHIC image prompt that visually illustrates the SPECIFIC angle text.
 * Each slide (index 0-3) gets a DIFFERENT infographic layout style.
 * Category-specific design (beauty, tech, fashion, health, home, general).
 */
function buildAngleImagePrompt(angle, gptResult, hasProductRef, template = 'general', slideIndex = 0) {
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
• Final feel: a REAL professional product photo that could run as a Facebook/TikTok Ad for African consumers`;

  return basePrompt + africanRealismBlock;
}

/**
 * Returns 3 archetype layout prompts — each corresponds to a specific ad creative type:
 *   Slide 0: PREUVE / RÉSULTAT — someone using the product with visible result
 *   Slide 1: STYLE DE VIE — product impact in daily African life
 *   Slide 2: CONFIANCE / CRÉDIBILITÉ — trust, quality, effectiveness
 * Color theme integrated for visual coherence.
 */
function getInfographicLayouts(template, ctx) {
  const { title, productNote, targetPerson, headlineShort, promesseShort, angleTitle, angleExplication, b1, b2, b3 } = ctx;
  const colorTheme = getProductColorTheme(template);
  const niche = getNicheDetails(template);

  return [
    // ─── SLIDE 0: PREUVE / RÉSULTAT (IMAGE 3) ───────────────────
    `Square 1:1 PROOF & RESULTS AD for "${title}" — African market. Photorealistic like a HIGH-END SMARTPHONE PHOTO. Ultra HD.

═══ TYPE: PREUVE / RÉSULTAT ═══
Show someone ACTIVELY USING the product with a VISIBLE result.

═══ COLOR THEME: ${colorTheme.name.toUpperCase()} ═══
Dominant color throughout: ${colorTheme.primary}. Person wears ${colorTheme.personClothing}. Environment accents in ${colorTheme.name} tones.

COMPOSITION:
- PERSON (55% of frame): ${targetPerson} — authentic Black African person (dark skin, natural African features, natural African hair). ${niche.preuve.action}. The RESULT is ${niche.preuve.result}. ${niche.preuve.closeup}
- Expression: SUBTLE, natural satisfaction — NOT theatrical. Genuine. Like a real person who is happy with results
- Clothing: ${colorTheme.personClothing} — simple, everyday African style
- PRODUCT (30%): ${productNote} — at REAL SIZE, natural placement (in hands, on surface nearby). Sharp, clear, no distortion
- SETTING: ${niche.preuve.setting}. Natural warm lighting
- PROPS: ${niche.preuve.props}
- TEXT OVERLAY: "${headlineShort}" — short French headline (4-6 words max) in ${colorTheme.primary}. PERFECT French spelling
- Small benefit tag: "${promesseShort}" on frosted glass badge

Style: soft, clean, natural colors. NO over-saturation, NO aggressive filters. PHOTOREALISTIC.
NO price, NO phone, NO URL, NO watermark.`,

    // ─── SLIDE 1: STYLE DE VIE (IMAGE 4) ────────────────────────
    `Square 1:1 LIFESTYLE AD for "${title}" — African market. Photorealistic like a HIGH-END SMARTPHONE PHOTO. Ultra HD.

═══ TYPE: STYLE DE VIE — IMPACT QUOTIDIEN ═══
${niche.lifestyle.scene}

═══ COLOR THEME: ${colorTheme.name.toUpperCase()} ═══
Dominant color throughout: ${colorTheme.primary}. Person wears ${colorTheme.personClothing}. Environment accents in ${colorTheme.name} tones.

COMPOSITION:
- PERSON (dominant 60%): ${targetPerson} — authentic Black African person in their DAILY LIFE. ${niche.lifestyle.activity}. Radiating ${niche.lifestyle.mood}
- Expression: NATURAL and SUBTLE — genuine confidence, calm happiness, self-assurance. NOT exaggerated joy
- Clothing: ${colorTheme.personClothing} — simple, clean, everyday African style
- PRODUCT: ${productNote} — visible but naturally placed. REAL SIZE, not forced into the scene
- SETTING: ${niche.lifestyle.setting}. Natural warm daylight, local decor. Coherent African environment
- TEXT OVERLAY: Short inspiring French phrase (4-6 words) related to ${angleTitle ? `"${headlineShort}"` : 'lifestyle benefit'}. ${colorTheme.primary} accent color. PERFECT French
- Optional: 2-3 subtle benefit icons or small frosted tags

Style: warm, authentic, relatable. Natural colors, soft natural light. PHOTOREALISTIC — like a real lifestyle photo.
NO price, NO phone, NO URL, NO watermark.`,

    // ─── SLIDE 2: CONFIANCE / CRÉDIBILITÉ (IMAGE 5) ─────────────
    `Square 1:1 TRUST & CREDIBILITY AD for "${title}" — African market. Photorealistic like a HIGH-END SMARTPHONE PHOTO. Ultra HD.

═══ TYPE: CONFIANCE / CRÉDIBILITÉ ═══
Build TRUST — show the product's seriousness, quality, natural effectiveness.

═══ COLOR THEME: ${colorTheme.name.toUpperCase()} ═══
Dominant dark background: ${colorTheme.darkGradient}. Accent color: ${colorTheme.accent}. Person wears ${colorTheme.personClothing}.

COMPOSITION:
- BACKGROUND: Premium gradient — ${colorTheme.darkGradient}. Dramatic but clean. Professional brand feel
- PRODUCT (40% of frame): ${niche.confiance.productDisplay}. ${productNote} — shown LARGE, sharp, premium lighting with subtle ${colorTheme.accent} glow. Every label and detail readable. Product is the STAR
- PERSON (35%): ${targetPerson} — authentic Black African person next to the product, calm confident expression, looking at camera with trust. Natural pose. Dressed in ${colorTheme.personClothing}
- EXPERT DETAILS: ${niche.confiance.expertNote}
- TRUST ELEMENTS:
  ${niche.confiance.trustBadges.split(', ').map(b => `• ${b} — glass-morphism badge in ${colorTheme.accent}`).join('\n  ')}
  • Customer stat: "+5000 clients satisfaits" — subtle text
- HEADLINE: "${headlineShort}" — bold condensed French text, perfect spelling, ${colorTheme.accent} accent on key word
- Overall feel: this brand is SERIOUS, TRUSTWORTHY, PROFESSIONAL

Style: clean, premium, professional. Sharp product photography. PHOTOREALISTIC.
NO price, NO phone, NO URL, NO watermark.`,
  ];
}

/**
 * Niche-specific scene details for each template.
 * Returns contextual descriptions for proof, lifestyle, and trust archetypes.
 */
function getNicheDetails(template) {
  const niches = {
    beauty: {
      preuve: {
        action: 'applying serum/cream on face, doing skincare routine, massaging product into skin',
        result: 'visibly GLOWING skin, smoother complexion, radiant dewy finish, reduced blemishes',
        setting: 'modern bathroom vanity with round mirror and warm lighting, marble countertop, small plants',
        props: 'cotton pads, cosmetic bottles, rose petals, small mirror, skincare tools',
        closeup: 'Close-up on face/hands showing product application and skin texture improvement',
      },
      lifestyle: {
        scene: 'getting ready in the morning — applying product at her vanity, then confidently stepping out. Beautiful African woman in her daily beauty routine',
        setting: 'bright modern African bedroom or bathroom with natural light streaming through curtains, vanity with cosmetics, fresh flowers',
        activity: 'doing her beauty routine, admiring herself in the mirror, touching her glowing skin with confidence, heading out feeling beautiful',
        mood: 'self-care, feminine confidence, ritual of beauty, morning glow',
      },
      confiance: {
        productDisplay: 'product on white marble surface with rose petals scattered around, soft rose-gold backlighting, cream/serum texture dripping artistically',
        trustBadges: '"Ingrédients Naturels", "Testé Dermatologiquement", "Résultats Visibles en 7 Jours"',
        expertNote: 'cosmetic ingredient close-up textures, natural botanical elements (aloe, shea, cocoa butter), lab-quality aesthetic',
      },
    },
    tech: {
      preuve: {
        action: 'unboxing the device, setting it up, actively using it — tapping screen, connecting cables, demonstrating features',
        result: 'the device WORKING perfectly — bright screen display, LED indicators on, connected devices syncing, clear performance demo',
        setting: 'modern desk/workspace with clean setup, dark theme, subtle blue/purple LED ambient lighting, organized cables',
        props: 'laptop, phone, charging cables, wireless earbuds, smart accessories, USB connectors',
        closeup: 'Close-up on hands interacting with the device, screen reflections on face, tech details visible',
      },
      lifestyle: {
        scene: 'young African professional using the tech product in their daily workflow — at a co-working space, on commute, in modern office',
        setting: 'modern African co-working space or sleek home office — dual monitors, plant on desk, city view through window, modern African interior',
        activity: 'video calling, working on laptop with product nearby, listening to music with wireless device, gaming, content creating',
        mood: 'productive, connected, futuristic, efficient, modern African tech lifestyle',
      },
      confiance: {
        productDisplay: 'product floating on dark reflective surface with neon blue rim lighting, circuit-board pattern subtle in background, specs callouts with thin lines',
        trustBadges: '"Performance Maximale", "Technologie Avancée", "Garantie 1 An"',
        expertNote: 'tech specs overlay (battery, processor, connectivity icons), sleek minimalist HUD-style design elements, carbon fiber texture hints',
      },
    },
    fashion: {
      preuve: {
        action: 'trying on the clothing/accessory, styling an outfit, adjusting the piece in front of a large mirror',
        result: 'the outfit TRANSFORMING their look — perfect fit visible, fabric draping beautifully, the accessory elevating the entire style',
        setting: 'stylish dressing room or bedroom with full-length mirror, good lighting, clothing rack visible in background',
        props: 'hangers, fashion accessories, shoes, handbag, jewelry, sunglasses, styling tools',
        closeup: 'Medium shot showing the full outfit or close-up on fabric texture, stitching quality, accessory detail',
      },
      lifestyle: {
        scene: 'African person wearing the fashion item confidently in an urban setting — street style, going out, social gathering',
        setting: 'vibrant African city street, trendy café terrace, colorful market area, modern boutique district — warm golden hour light',
        activity: 'walking confidently down the street, meeting friends at café, arriving at an event, casual urban stroll showcasing the outfit',
        mood: 'editorial street style, confident, trendy, expressive, African urban fashion',
      },
      confiance: {
        productDisplay: 'fashion item displayed on premium dark surface — fabric texture highlighted, gold/warm accent lighting, fashion editorial composition',
        trustBadges: '"Qualité Premium", "Tissu Haut de Gamme", "Style Authentique"',
        expertNote: 'fabric close-up showing quality weave/texture, elegant gold thread details, fashion magazine editorial aesthetic, warm metallic accents',
      },
    },
    health: {
      preuve: {
        action: 'taking the supplement, preparing a health drink, using the wellness product — measuring dose, mixing, consuming',
        result: 'visible ENERGY and VITALITY — person looking refreshed, active, strong, healthy glow, bright eyes, athletic posture',
        setting: 'bright kitchen counter with fruits and vegetables, or outdoor fitness area with natural greenery, morning sunlight',
        props: 'fresh fruits, green smoothie, water bottle, measuring spoon, natural ingredients (ginger, lemon, herbs), yoga mat',
        closeup: 'Close-up on product with natural ingredients around it, person\'s energized expression, healthy food preparation',
      },
      lifestyle: {
        scene: 'active African person incorporating the health product into their daily wellness routine — morning exercise, healthy breakfast, outdoor activity',
        setting: 'outdoor park or garden in African neighborhood, bright modern kitchen, rooftop terrace with plants — fresh morning light, green nature',
        activity: 'stretching/exercising outdoors, preparing a healthy meal with product nearby, jogging in the park, doing yoga, playing with kids energetically',
        mood: 'vitality, freshness, natural energy, wellness, active healthy living',
      },
      confiance: {
        productDisplay: 'product surrounded by fresh natural ingredients (leaves, fruits, herbs, seeds) on dark green/earth-toned background, natural spotlight',
        trustBadges: '"100% Naturel", "Efficacité Clinique", "Sans Effets Secondaires"',
        expertNote: 'natural ingredient macro shots (herbal leaves, golden capsules, organic textures), green purity aesthetic, nature meets science',
      },
    },
    home: {
      preuve: {
        action: 'using the home product — cleaning, organizing, decorating, cooking with it, setting it up in the living space',
        result: 'the HOME visibly IMPROVED — cleaner surface, better organized space, cozier atmosphere, the product making the home better',
        setting: 'warm African home interior — living room with colorful fabrics, kitchen with local spices, bedroom with warm textiles',
        props: 'African wax-print cushions, wooden furniture, terracotta pots, woven baskets, local decor, family photos on wall',
        closeup: 'Before/after feel — the area where product is used looks visibly improved, cleaner, more organized, more beautiful',
      },
      lifestyle: {
        scene: 'African family enjoying their home — cooking together, relaxing in living room, hosting guests, the product naturally part of the home',
        setting: 'warm African household — colorful living room with African textiles, outdoor courtyard with terracotta tiles, cozy kitchen with local spices',
        activity: 'family cooking together, children playing in organized room, couple relaxing on terrace, hosting friends for dinner, enjoying a clean and beautiful home',
        mood: 'warmth, family, comfort, African home pride, togetherness, cozy domestic happiness',
      },
      confiance: {
        productDisplay: 'product on warm wooden surface with terracotta and natural fiber textures, warm amber accent lighting, homey premium aesthetic',
        trustBadges: '"Qualité Maison", "Durable et Fiable", "Approuvé par les Familles"',
        expertNote: 'warm wood textures, woven natural fibers, terracotta tiles, cozy domestic premium feel, family-oriented trust',
      },
    },
    general: {
      preuve: {
        action: 'actively using the product, demonstrating it, showing how it works in a real practical context',
        result: 'visible positive CHANGE — the product delivers on its promise, the result is OBVIOUS in the image',
        setting: 'clean modern African interior with neutral warm tones, natural daylight, minimal clutter',
        props: 'everyday items that complement the product usage, clean modern accessories',
        closeup: 'Medium shot showing both person and product clearly, result visible',
      },
      lifestyle: {
        scene: 'African person living their daily life with the product naturally integrated — it just fits into their world',
        setting: 'modern African environment — home, street, terrace, office — warm natural light, authentic local atmosphere',
        activity: 'going about their day, walking, working, relaxing, socializing — product is naturally part of the moment',
        mood: 'authentic, relatable, aspirational, warm, modern African daily life',
      },
      confiance: {
        productDisplay: 'product on dark premium surface with bold accent lighting, gradient background, floating premium aesthetic',
        trustBadges: '"Qualité Garantie", "Satisfaction Client", "Livraison Rapide"',
        expertNote: 'clean premium product photography, bold gradient accent, universal trust aesthetic',
      },
    },
  };

  return niches[template] || niches.general;
}

/**
 * 3 flash prompts — matching the 3 ad creative archetypes:
 *   0: PREUVE / RÉSULTAT (Image 3)
 *   1: STYLE DE VIE (Image 4)
 *   2: CONFIANCE / CRÉDIBILITÉ (Image 5)
 * Color theme + niche-specific details. Always African persons + product visible + French text.
 */
function buildFlashPrompts(gptResult, hasProductRef, method = 'PAS', template = 'general') {
  const title = gptResult.title || 'product';
  const targetPerson = gptResult.hero_target_person || 'authentic African person';
  const benefits = gptResult.benefits_bullets || [];
  const b1 = (benefits[0] || '').replace(/^[^\w]*/,'');
  const b2 = (benefits[1] || '').replace(/^[^\w]*/,'');
  const b3 = (benefits[2] || '').replace(/^[^\w]*/,'');
  const productNote = hasProductRef
    ? `THE EXACT REFERENCE PRODUCT ("${title}") must be shown large, sharp, dominant — same packaging, shape, color, label. Use the provided product image as reference.`
    : `A premium product packaging for "${title}" shown large, sharp, dominant.`;

  const ct = getProductColorTheme(template);
  const niche = getNicheDetails(template);

  // ── Image 3 : PREUVE / RÉSULTAT ──────────────────────────────────────
  const preuvePrompt = `Square 1:1 AD CREATIVE — PREUVE / RÉSULTAT for "${title}". Ultra HD, 4K. PHOTOREALISTIC smartphone-quality photograph.

COLOR THEME: dominant ${ct.name}. Primary ${ct.primary}, secondary ${ct.secondary}, dark ${ct.dark}. Gradient: ${ct.gradient}.

CONCEPT: Someone USING the product with a VISIBLE, TANGIBLE result.
- BACKGROUND: ${ct.gradient} — clean, modern, premium feel
- PERSON (dominant 55%): ${targetPerson} — African person with authentic dark skin, natural African hair, simple everyday clothing. They are ${niche.preuve.action}. The RESULT is ${niche.preuve.result}. ${niche.preuve.closeup}. Expression: genuine satisfied smile, natural and subtle. Warm ${ct.mood} lighting on skin
- PRODUCT: clearly visible in hands or being applied — ${productNote}
- SETTING: ${niche.preuve.setting}
- PROPS: ${niche.preuve.props}
- RESULT PROOF: The visual SHOWS the benefit — ${niche.preuve.result}. The transformation is OBVIOUS without text
- OVERLAY: 2 small frosted-glass badges in ${ct.accent} accent:
  "${b1}" + "${b2}"
  Thin ${ct.primary} border, clean French text

MANDATORY: Real smartphone photo quality. African person with visible face. Product clearly shown. Result VISIBLE. ALL text perfect French. NO cartoon, NO AI artifacts, NO watermark.`;

  // ── Image 4 : STYLE DE VIE ──────────────────────────────────────────
  const lifestylePrompt = `Square 1:1 AD CREATIVE — STYLE DE VIE for "${title}". Ultra HD, 4K. PHOTOREALISTIC smartphone-quality photograph.

COLOR THEME: dominant ${ct.name}. Primary ${ct.primary}, accent ${ct.accent}. Mood: ${ct.mood}.

CONCEPT: ${niche.lifestyle.scene}
- BACKGROUND: ${niche.lifestyle.setting}. NOT studio. The setting must feel AUTHENTIC and RECOGNIZABLE to African consumers
- PERSON (dominant 60%): ${targetPerson} — African person in natural daily-life context, wearing ${ct.personClothing}. ${niche.lifestyle.activity}. Genuine warm expression, NOT posed. Warm golden natural light creating highlights on dark skin
- PRODUCT: visible in hands or nearby, integrated into the scene — ${productNote}
- ATMOSPHERE: ${niche.lifestyle.mood}. Warm, aspirational but RELATABLE. This is someone's real life made better by the product
- OVERLAY: 1 small frosted-glass card in ${ct.primary} tint: short French lifestyle tagline

MANDATORY: Real smartphone photo quality. African person with visible face. Real African setting. Product naturally integrated. ALL text perfect French. NO cartoon, NO AI artifacts, NO watermark.`;

  // ── Image 5 : CONFIANCE / CRÉDIBILITÉ ────────────────────────────────
  const confiancePrompt = `Square 1:1 AD CREATIVE — CONFIANCE / CRÉDIBILITÉ for "${title}". Ultra HD, 4K. PHOTOREALISTIC smartphone-quality photograph.

COLOR THEME: dominant ${ct.name}. Dark gradient: ${ct.darkGradient}. Accent: ${ct.accent}.

CONCEPT: TRUST, QUALITY, PREMIUM — dark luxurious background, the product is KING.
- BACKGROUND: ${ct.darkGradient} — deep, rich, premium, luxurious. Dramatic cinematic feel
- PRODUCT (dominant 45%): ${niche.confiance.productDisplay}. ${productNote} Sharp, premium, ELEVATED. The product is the STAR
- PERSON (35%): ${targetPerson} — African person with confident powerful expression, dramatic rim lighting with ${ct.primary} color cast on their skin, editorial portrait quality. They TRUST this product — calm confidence, not theatrical
- EXPERT DETAILS: ${niche.confiance.expertNote}
- TRUST ELEMENTS: 3 frosted glass-morphism badges on dark background:
  ${niche.confiance.trustBadges.split(', ').map(b => `• ${b}`).join('\n  ')}
  Each: dark translucent card, white text, thin ${ct.accent} border
- BOTTOM: thin ${ct.accent} accent line

MANDATORY: Real smartphone photo quality. African person with visible face. Premium dark aesthetic. Product DOMINANT. ALL text perfect French. NO cartoon, NO AI artifacts, NO watermark.`;

  return [
    { prompt: preuvePrompt, type: 'preuve_resultat' },
    { prompt: lifestylePrompt, type: 'style_de_vie' },
    { prompt: confiancePrompt, type: 'confiance_credibilite' },
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
        .select('storeSettings.country storeSettings.city storeSettings.storeName name freeGenerationsRemaining paidGenerationsRemaining totalGenerations simpleGenerationsRemaining');

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

      // Crédit sera décrémenté APRÈS génération réussie (pas avant)
      console.log(`✅ Génération autorisée. Crédits disponibles: ${totalRemaining}`);
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
      generateAndUpload(buildHeroPrompt(gptResult, !!baseImageBuffer, visualTemplate), baseImageBuffer, `hero-${Date.now()}.png`, 'hero')
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

    // ── Flash images — 3 affiches marketing (preuve, lifestyle, confiance) ─
    const angles = gptResult.angles || [];
    const flashPrompts = buildFlashPrompts(gptResult, !!baseImageBuffer, approach, visualTemplate);
    const maxFlash = flashPrompts.length;

    for (let i = 0; i < maxFlash; i++) {
      const flash = flashPrompts[i];
      const angle = angles[i] || null;

      // Build an infographic prompt that visually illustrates the angle as an infographic
      const africanRealism = `\n\n═══ AFRICAN MARKET REALISM — MANDATORY ═══\n• PHOTOREALISTIC — must look like a real photograph. No cartoon, no AI artifacts\n• African person: authentic dark skin, natural African features, natural African hair. Simple everyday clothing, SUBTLE expressions — NOT theatrical\n• Setting: real African environment, natural warm lighting. Product at REAL proportions\n• Soft, clean, natural style. ALL French text 100% PERFECT. NO distortion, NO inconsistencies`;
      const anglePrompt = angle
        ? buildAngleImagePrompt(angle, gptResult, !!baseImageBuffer, visualTemplate, i)
        : flash.prompt + africanRealism;

      imagePromises.push(
        generateAndUpload(anglePrompt, baseImageBuffer, `flash-${i + 1}-${Date.now()}.png`, 'scene')
          .then(url => ({ type: 'poster', index: i, url, angle, flashType: flash.type }))
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

    // Testimonials sans images individuelles + images de groupe et social proof
    const finalTestimonials = (gptResult.testimonials || []).map(t => ({ ...t, image: '' }));
    const testimonialsGroupImage = null;
    const testimonialsSocialProofImage = null;


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
      testimonialsGroupImage: testimonialsGroupImage || null,
      testimonialsSocialProofImage: testimonialsSocialProofImage || null,
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

    // ══════════════════════════════════════════════════════════════════════════
    // DÉCRÉMENTER LE CRÉDIT — seulement APRÈS génération réussie
    // ══════════════════════════════════════════════════════════════════════════
    if (workspace) {
      const freshWs = await EcomWorkspace.findById(workspace._id);
      const sr = freshWs.simpleGenerationsRemaining || 0;
      const fr = freshWs.freeGenerationsRemaining || 0;
      const pr = freshWs.paidGenerationsRemaining || 0;

      if (sr > 0) {
        freshWs.simpleGenerationsRemaining = sr - 1;
      } else if (fr > 0) {
        freshWs.freeGenerationsRemaining = fr - 1;
      } else if (pr > 0) {
        freshWs.paidGenerationsRemaining = pr - 1;
      }
      freshWs.totalGenerations = (freshWs.totalGenerations || 0) + 1;
      freshWs.lastGenerationAt = new Date();
      await freshWs.save();

      const newRemaining = (freshWs.simpleGenerationsRemaining || 0) + (freshWs.freeGenerationsRemaining || 0) + (freshWs.paidGenerationsRemaining || 0);
      console.log(`💳 Crédit décrémenté après succès. Restants: ${newRemaining}`);
    }

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

    // Récupérer le nombre de générations restantes pour l'inclure dans la réponse
    const updatedWorkspace = workspace ? await EcomWorkspace.findById(workspace._id)
      .select('freeGenerationsRemaining paidGenerationsRemaining totalGenerations simpleGenerationsRemaining')
      .lean() : null;

    const generationsInfo = updatedWorkspace ? {
      remaining: (updatedWorkspace.simpleGenerationsRemaining || 0) + (updatedWorkspace.freeGenerationsRemaining || 0) + (updatedWorkspace.paidGenerationsRemaining || 0),
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
