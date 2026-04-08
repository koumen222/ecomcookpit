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

  return [
    // ─── SLIDE 0: PREUVE / RÉSULTAT (IMAGE 3) ───────────────────
    `Square 1:1 PROOF & RESULTS AD for "${title}" — African market. Photorealistic like a HIGH-END SMARTPHONE PHOTO. Ultra HD.

═══ TYPE: PREUVE / RÉSULTAT ═══
Show someone ACTIVELY USING the product with a VISIBLE result.

═══ COLOR THEME: ${colorTheme.name.toUpperCase()} ═══
Dominant color throughout: ${colorTheme.primary}. Person wears ${colorTheme.personClothing}. Environment accents in ${colorTheme.name} tones.

COMPOSITION:
- PERSON (55% of frame): ${targetPerson} — authentic Black African person (dark skin, natural African features, natural African hair). ACTIVELY using "${title}" — applying, holding, demonstrating. The RESULT of using the product is VISUALLY VISIBLE on them (clearer skin, shinier hair, relief, energy, etc.)
- Expression: SUBTLE, natural satisfaction — NOT theatrical. Genuine. Like a real person who is happy with results
- Clothing: ${colorTheme.personClothing} — simple, everyday African style
- PRODUCT (30%): ${productNote} — at REAL SIZE, natural placement (in hands, on surface nearby). Sharp, clear, no distortion
- SETTING: Realistic African home (${template === 'beauty' ? 'bathroom, vanity' : template === 'health' ? 'bright room, kitchen' : template === 'tech' ? 'desk, living room' : 'home interior'}). Natural warm lighting
- TEXT OVERLAY: "${headlineShort}" — short French headline (4-6 words max) in ${colorTheme.primary}. PERFECT French spelling
- Small benefit tag: "${promesseShort}" on frosted glass badge

Style: soft, clean, natural colors. NO over-saturation, NO aggressive filters. PHOTOREALISTIC.
NO price, NO phone, NO URL, NO watermark.`,

    // ─── SLIDE 1: STYLE DE VIE (IMAGE 4) ────────────────────────
    `Square 1:1 LIFESTYLE AD for "${title}" — African market. Photorealistic like a HIGH-END SMARTPHONE PHOTO. Ultra HD.

═══ TYPE: STYLE DE VIE — IMPACT QUOTIDIEN ═══
Show the IMPACT of the product in everyday African life. Confidence, well-being, comfort.

═══ COLOR THEME: ${colorTheme.name.toUpperCase()} ═══
Dominant color throughout: ${colorTheme.primary}. Person wears ${colorTheme.personClothing}. Environment accents in ${colorTheme.name} tones.

COMPOSITION:
- PERSON (dominant 60%): ${targetPerson} — authentic Black African person in their DAILY LIFE, radiating confidence and well-being THANKS to "${title}". Natural candid moment — walking in the street, relaxing at home, with family, at work, or in a social moment
- Expression: NATURAL and SUBTLE — genuine confidence, calm happiness, self-assurance. NOT exaggerated joy. Like someone living their best life naturally
- Clothing: ${colorTheme.personClothing} — simple, clean, everyday African style
- PRODUCT: ${productNote} — visible but naturally placed (on table, in bag, in hand, on shelf). REAL SIZE, not forced into the scene
- SETTING: Real African daily-life scene — modern African neighborhood, home, market, terrace, local café. Natural warm daylight, local decor. Coherent African environment
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
- PRODUCT (40% of frame): ${productNote} — shown LARGE, sharp, premium lighting with subtle ${colorTheme.accent} glow. Every label and detail readable. Product is the STAR
- PERSON (35%): ${targetPerson} — authentic Black African person next to the product, calm confident expression, looking at camera with trust. Natural pose. Dressed in ${colorTheme.personClothing}
- TRUST ELEMENTS:
  • "Qualité Garantie" or "Testé et Approuvé" – small badge in ${colorTheme.accent}
  • "100% Naturel" or "Efficacité Prouvée" — glass-morphism card
  • Customer stat: "+5000 clients satisfaits" — subtle text
- HEADLINE: "${headlineShort}" — bold condensed French text, perfect spelling, ${colorTheme.accent} accent on key word
- Overall feel: this brand is SERIOUS, TRUSTWORTHY, PROFESSIONAL

Style: clean, premium, professional. Sharp product photography. PHOTOREALISTIC.
NO price, NO phone, NO URL, NO watermark.`,
  ];
}

/**
 * 3 flash prompts — matching the 3 ad creative archetypes:
 *   0: PREUVE / RÉSULTAT (Image 3)
 *   1: STYLE DE VIE (Image 4)
 *   2: CONFIANCE / CRÉDIBILITÉ (Image 5)
 * Color theme integrated. Always African persons + product visible + French text.
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

  // ── Image 3 : PREUVE / RÉSULTAT ──────────────────────────────────────
  const preuvePrompt = `Square 1:1 AD CREATIVE — PREUVE / RÉSULTAT for "${title}". Ultra HD, 4K. PHOTOREALISTIC smartphone-quality photograph.

COLOR THEME: dominant ${ct.name}. Primary ${ct.primary}, secondary ${ct.secondary}, dark ${ct.dark}. Gradient: ${ct.gradient}.

CONCEPT: Someone USING the product with a VISIBLE, TANGIBLE result.
- BACKGROUND: ${ct.gradient} — clean, modern, premium feel
- PERSON (dominant 55%): ${targetPerson} — African person with authentic dark skin, natural African hair, simple everyday clothing. They are ACTIVELY using "${title}" and the RESULT is visible on their body/face/environment. Close-up or medium shot. Expression: genuine satisfied smile, natural and subtle. Warm ${ct.mood} lighting on skin
- PRODUCT: clearly visible in hands or being applied — ${productNote}
- RESULT PROOF: The visual SHOWS the benefit — glowing skin, energy, clean surface, organized space, etc. The transformation is OBVIOUS without text
- OVERLAY: 2 small frosted-glass badges in ${ct.accent} accent:
  "${b1}" + "${b2}"
  Thin ${ct.primary} border, clean French text

MANDATORY: Real smartphone photo quality. African person with visible face. Product clearly shown. Result VISIBLE. ALL text perfect French. NO cartoon, NO AI artifacts, NO watermark.`;

  // ── Image 4 : STYLE DE VIE ──────────────────────────────────────────
  const lifestylePrompt = `Square 1:1 AD CREATIVE — STYLE DE VIE for "${title}". Ultra HD, 4K. PHOTOREALISTIC smartphone-quality photograph.

COLOR THEME: dominant ${ct.name}. Primary ${ct.primary}, accent ${ct.accent}. Mood: ${ct.mood}.

CONCEPT: The product integrated into DAILY AFRICAN LIFE — the viewer sees themselves.
- BACKGROUND: Real African environment — modern home interior, bright market street, cozy terrace, or vibrant neighborhood. Warm natural daylight, lived-in atmosphere. NOT studio. The setting must feel AUTHENTIC and RECOGNIZABLE to African consumers
- PERSON (dominant 60%): ${targetPerson} — African person in natural daily-life context, wearing ${ct.personClothing}. NATURALLY using or holding "${title}" as part of their routine. Dynamic natural pose (cooking, walking, relaxing, working). Genuine warm expression, NOT posed. Warm golden natural light creating highlights on dark skin
- PRODUCT: visible in hands or nearby, integrated into the scene — ${productNote}
- ATMOSPHERE: Warm, aspirational but RELATABLE. This is someone's real life made better by the product
- OVERLAY: 1 small frosted-glass card in ${ct.primary} tint: short French lifestyle tagline

MANDATORY: Real smartphone photo quality. African person with visible face. Real African setting. Product naturally integrated. ALL text perfect French. NO cartoon, NO AI artifacts, NO watermark.`;

  // ── Image 5 : CONFIANCE / CRÉDIBILITÉ ────────────────────────────────
  const confiancePrompt = `Square 1:1 AD CREATIVE — CONFIANCE / CRÉDIBILITÉ for "${title}". Ultra HD, 4K. PHOTOREALISTIC smartphone-quality photograph.

COLOR THEME: dominant ${ct.name}. Dark gradient: ${ct.darkGradient}. Accent: ${ct.accent}.

CONCEPT: TRUST, QUALITY, PREMIUM — dark luxurious background, the product is KING.
- BACKGROUND: ${ct.darkGradient} — deep, rich, premium, luxurious. Dramatic cinematic feel
- PRODUCT (dominant 45%): ${productNote} Product with dramatic ${ct.accent} rim lighting, floating on dark reflective surface, soft glow emanating from behind. Sharp, premium, ELEVATED. The product is the STAR
- PERSON (35%): ${targetPerson} — African person with confident powerful expression, dramatic rim lighting with ${ct.primary} color cast on their skin, editorial portrait quality. They TRUST this product — calm confidence, not theatrical
- TRUST ELEMENTS: 3 frosted glass-morphism badges on dark background:
  • "${b1}" with subtle icon
  • "${b3}" with subtle icon
  • "QUALITÉ PREMIUM" with star icon
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
