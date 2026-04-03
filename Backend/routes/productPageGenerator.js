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

const router = express.Router();

// ─── Image prompt builders ────────────────────────────────────────────────────

/**
 * Hero PRO — African Facebook-ads layout:
 * TOP: bold headline (keyword in red) | LEFT: product large | RIGHT: person showing RESULT
 * LEFT overlay: red CTA badge + curved arrow pointing to product
 */
function buildHeroPrompt(gptResult, hasProductRef) {
  const productName = gptResult.title || 'product';
  const targetPerson = gptResult.hero_target_person || 'authentic Black African person';
  const hookText = (gptResult.hero_headline || '').toUpperCase();
  const ctaText = (gptResult.hero_cta || 'ÇA COMMENCE ICI').toUpperCase();

  const productBlock = hasProductRef
    ? `THE EXACT product from the reference image (same packaging, shape, color, label) — placed large on the LEFT half of the frame, clean studio lighting, sharp focus, ultra realistic`
    : `premium product packaging of "${productName}" — placed large on the LEFT half of the frame, clean studio lighting, sharp focus, ultra realistic`;

  return `Square 1:1 high-converting Facebook ads product image. White or very light gray background.

MANDATORY EXACT LAYOUT:
1. TOP SECTION (20% of frame): Large bold black headline text centered: "${hookText}". The KEY transformation word or last phrase is in bold RED color. Text is perfectly readable, no distortion.
2. MAIN SCENE (bottom 80% of frame):
   - LEFT HALF: ${productBlock}. The product stands tall and dominant, occupying the full left side.
   - RIGHT HALF: Realistic ${targetPerson}. Authentic Black African person, dark brown skin, natural hair, in a bright modern setting. HAPPY, CONFIDENT, RADIANT expression — showing the POSITIVE RESULT of using the product. Big natural smile, glowing energy, satisfaction visible. The person looks transformed, healthy, and proud.
3. LEFT SIDE OVERLAY (on top of product area): A bold red rounded-rectangle badge with white bold text: "${ctaText}". Directly below the badge: a thick curved red arrow pointing DOWN toward the product.

Text rules: ALL French text must have PERFECT spelling with every accent (é, è, à, ê, û, ç etc). Zero spelling errors.

Style: commercial Facebook advertising style, bright clean white background, high contrast, 4K quality, professional ad photography, scroll-stopping, no watermark, no price, no URL.`;
}

/**
 * 4 flash prompts — INFOGRAPHIES MARKETPLACE style listing Amazon/Ozon Premium.
 * Chaque image est une infographie graphique (PAS une photo lifestyle).
 * WITH product ref: le vrai produit est intégré dans l'infographie.
 * WITHOUT: produit générique stylisé.
 */
function buildFlashPrompts(gptResult, hasProductRef, method = 'PAS') {
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

  const infographicBase = `Square 1:1 MARKETPLACE INFOGRAPHIC for "${title}". Mix of GRAPHIC DESIGN and REAL PHOTOGRAPHY — infographic layout with integrated photos of real people. Style: premium marketplace listing (Amazon A+ content, Ozon top sellers). White or very light background. Professional product rendering. Bold modern typography. Clean iconography. Authentic Black African people integrated naturally into the design. Premium feel.`;

  return [
    // Slide 1: Produit + Titre + Badges bénéfices + personne
    {
      prompt: `${infographicBase}

COMPOSITION: Product hero infographic — WHY THIS PRODUCT.
- BACKGROUND: Clean white or very light cream
- TOP: Bold dark navy blue headline in UPPERCASE condensed font: "POURQUOI" + product name/promise in French. Large, dominant
- CENTER: ${productNote} Product shown LARGE, 3D style, dramatic studio lighting, soft shadow. Olive branches framing naturally
- LEFT OF PRODUCT: 3-4 round certification SEAL BADGES (dark green "naturel", dark red "sans..."). Solid color circle + white icon + text in arc. Stamp/seal style
  Benefits: "${b1}", "${b2}", "${b3}", "${b4}"
- INTEGRATED PERSON: ${targetPerson} — authentic Black African person with dark skin, visible in the composition (behind or beside the product), looking confident, warm smile. Photo-quality portrait integrated into the infographic layout. The person adds trust and human connection

ALL text PERFECT French. Airy, premium. Product + person + badges = visual story.`,
      type: 'benefits_infographic',
    },
    // Slide 2: Composition/Formule + personne africaine utilisant le produit
    {
      prompt: `${infographicBase}

COMPOSITION: Product formula/ingredients infographic with person.
- BACKGROUND: White, clean and airy
- TOP-LEFT: Bold dark navy headline UPPERCASE: "FORMULE AMÉLIORÉE" or product-specific formula title
- RIGHT SIDE: ${productNote} Product at medium-large scale with golden/amber drops or ingredient particles floating around. Premium lighting
- LEFT SIDE: 3 key ingredients/features listed vertically:
  • Colored dot/icon + ingredient name BOLD + 2-line gray description
  • Thin lines/arrows from ingredients to the product
- BOTTOM or SIDE: ${targetPerson} — authentic Black African person, close-up portrait or hands applying/holding the product. Natural expression, warm studio lighting. Shows the product being USED by a real person
- Olive leaves as subtle decoration
- Navigation tabs at top ("produit | composition | action") with "composition" highlighted

PERFECT French. Infographic + real person photo integrated. Premium marketplace.`,
      type: 'formula_infographic',
    },
    // Slide 3: Mode d'emploi / Action (personne africaine dominante)
    {
      prompt: `${infographicBase}

COMPOSITION: How-to-use infographic — PERSON DOMINANT.
- BACKGROUND: White to very light green subtle gradient
- TOP-LEFT: "MODE D'EMPLOI" MASSIVE UPPERCASE bold dark navy — dominates upper-left quarter
- SUBTITLE: "Découvrez des résultats MAXIMUM" in italic gray
- RIGHT SIDE (50-60% of image): ${targetPerson} — authentic Black African person, dark skin, natural African hair (afro, braids, locks), BIG warm smile, holding or showing the product confidently. Mi-body portrait, studio lighting. This person is the MAIN VISUAL ELEMENT of this slide
- LEFT SIDE: 2 numbered steps:
  • Circle with "1" in accent color + action in French
  • Circle with "2" + action in French
  • Small icons next to each (pill, clock...)
- BOTTOM-LEFT: Round green "100% NATUREL" seal badge
- Product also visible near the person's hands
- Olive branches behind person and bottom-left

The PERSON dominates this image. Infographic elements support. PERFECT French.`,
      type: 'howto_infographic',
    },
    // Slide 4: Lifestyle/Résultat — personne africaine + produit + stats
    {
      prompt: `${infographicBase}

COMPOSITION: Lifestyle result with stats — person showing transformation.
- BACKGROUND: White/cream, clean
- TOP: Bold dark navy headline in French: inspiring phrase about taking control, regaining confidence, or achieving results
- CENTER: ${targetPerson} — authentic Black African person, dark skin, ACTIVE and DYNAMIC (jogging, stretching, smiling confidently, or showing results). Full of energy and confidence. Mid-body shot, warm natural lighting. The person is the HERO of this slide
- NEAR THE PERSON: ${productNote} Product visible next to or held by the person. Arrow or visual connection between them
- RIGHT SIDE or around: 3 stat badges/circles:
  • "100%" + short description
  • "98%" + short description  
  • Number + short description
  Each stat in a clean circle or rounded rectangle
- BOTTOM: 3 round benefit icons in a row with short French labels
- Olive branches in 2 corners

Person + product + stats = trustworthy visual proof. PERFECT French. Premium marketplace.`,
      type: 'lifestyle_stats',
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
    // Paramètres copywriting simplifiés
    targetAvatar,
    mainProblem,
    tone,
    language
  } = req.body || {};
  const imageFiles = req.files || [];
  const approach = marketingApproach || 'PAS'; // Default to PAS

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

    // ── 4 Flash images — adaptés à la méthode copywriting (total = 1 hero + 1 avant/après + 4 flash) ─
    const flashPrompts = buildFlashPrompts(gptResult, !!baseImageBuffer, approach);
    for (let i = 0; i < flashPrompts.length; i++) {
      const flash = flashPrompts[i];
      const angle = gptResult.angles?.[i] || null;
      imagePromises.push(
        generateAndUpload(flash.prompt, baseImageBuffer, `flash-${i + 1}-${Date.now()}.png`, 'scene')
          .then(url => ({ type: 'poster', index: i, url, angle, flashType: flash.type }))
      );
    }

    // ── Testimonial avatars — generate portrait images for each testimonial ─
    const testimonials = gptResult.testimonials || [];
    for (let i = 0; i < testimonials.length; i++) {
      const t = testimonials[i];
      const avatarPrompt = t.image_prompt || `realistic portrait photo of african person, natural smile, casual setting, warm lighting, headshot, clean background`;
      imagePromises.push(
        (async () => {
          try {
            const { generateNanoBananaImage } = await import('../services/nanoBananaService.js');
            const dataUrl = await generateNanoBananaImage(avatarPrompt, '1:1', 1);
            if (!dataUrl) return { type: 'avatar', index: i, url: null };
            let buf = dataUrl.startsWith('data:')
              ? Buffer.from(dataUrl.split(',')[1], 'base64')
              : Buffer.from((await axios.get(dataUrl, { responseType: 'arraybuffer', timeout: 15000 })).data);
            buf = await sharp(buf).resize(256, 256, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
            const url = await uploadImage(buf, `avatar-${i}-${Date.now()}.jpg`, {
              workspaceId: req.workspaceId,
              uploadedBy: userId,
            });
            return { type: 'avatar', index: i, url };
          } catch (err) {
            console.warn(`⚠️ Avatar ${i} generation failed:`, err.message);
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
