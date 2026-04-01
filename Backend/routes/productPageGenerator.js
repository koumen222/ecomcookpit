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
 * Hero PRO — African Facebook-ads layout matching the reference style:
 * TOP: bold headline (keyword in red) | LEFT: product large | RIGHT: person showing problem
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
   - RIGHT HALF: Realistic ${targetPerson}. Authentic Black African person, dark brown skin, natural hair, standing in a simple modern African home interior. Looking down at or holding the problem area (e.g. belly, skin, hair) with a concerned/frustrated expression.
3. LEFT SIDE OVERLAY (on top of product area): A bold red rounded-rectangle badge with white bold text: "${ctaText}". Directly below the badge: a thick curved red arrow pointing DOWN toward the product.

Text rules: ALL French text must have PERFECT spelling with every accent (é, è, à, ê, û, ç etc). Zero spelling errors.

Style: commercial Facebook advertising style, bright clean white background, high contrast, 4K quality, professional ad photography, scroll-stopping, no watermark, no price, no URL.`;
}

/**
 * 4 flash prompts — generic, reusable, no text overlay, no product reference.
 * cache: true — same image works for any product.
 */
function buildFlashPrompts() {
  return [
    // 0 — lifestyle (mise en situation)
    {
      prompt: 'African person using a product in a natural lifestyle scene, modern African home interior, soft daylight, authentic relaxed moment, no brand visible, no product label, commercial lifestyle photography, high quality, 4K, no text overlay, no watermark',
      type: 'lifestyle',
    },
    // 1 — benefit: beauty / skin
    {
      prompt: 'African person with clean glowing radiant skin, natural beauty, soft diffused lighting, close-up face, minimal clean background, fresh confident look, commercial skincare photography style, high quality, 4K, no brand, no text overlay, no watermark',
      type: 'benefit_beauty',
    },
    // 2 — benefit: energy / happiness
    {
      prompt: 'Happy African person smiling with full energy and confidence, natural warm light, clean modern African environment, genuine joyful expression, lifestyle photography, commercial advertising style, high quality, 4K, no brand, no text overlay, no watermark',
      type: 'benefit_energy',
    },
    // 3 — testimonial
    {
      prompt: 'Happy African customer holding a product with a satisfied smile, clean neutral background, authentic warm expression, waist-up portrait, lifestyle photo, no brand visible, no label, commercial photography, high quality, 4K, no text overlay, no watermark',
      type: 'testimonial',
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
    // Nouveaux paramètres copywriting avancés
    copywritingAngle,
    targetAudience,
    customerReviews,
    socialProofLinks,
    mainOffer,
    objections,
    keyBenefits,
    tone,
    language
  } = req.body || {};
  const imageFiles = req.files || [];
  const approach = marketingApproach || 'AIDA'; // Default to AIDA if not specified
  
  // Préparer le contexte copywriting avancé
  const copywritingContext = {
    angle: copywritingAngle || 'PROBLEME_SOLUTION',
    audience: targetAudience || '',
    reviews: customerReviews || '',
    socialProof: socialProofLinks || '',
    offer: mainOffer || '',
    objections: objections || '',
    benefits: keyBenefits || '',
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
          mimeType: 'image/jpeg'
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

    // ── Hero PRO — African FB-ads template (LEFT: product | RIGHT: person + problem) ──
    imagePromises.push(
      generateAndUpload(buildHeroPrompt(gptResult, !!baseImageBuffer), baseImageBuffer, `hero-${Date.now()}.png`, 'hero')
        .then(url => ({ type: 'hero', url }))
    );

    // ── 4 Flash images — generic, reusable, no text overlay (total = 1 hero + 4 flash = 5) ─
    const flashPrompts = buildFlashPrompts();
    for (let i = 0; i < flashPrompts.length; i++) {
      const flash = flashPrompts[i];
      const angle = gptResult.angles?.[i] || null;
      imagePromises.push(
        generateAndUpload(flash.prompt, null, `flash-${i + 1}-${Date.now()}.png`, 'scene')
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
    let heroImageUrl = imageResults.find(r => r?.type === 'hero')?.url || realPhotos[0] || null;

    const posterImages = imageResults
      .filter(r => r?.type === 'poster')
      .sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0))
      .map(r => ({
        ...r?.angle,
        poster_url: r?.url || realPhotos[r?.index] || realPhotos[0] || null,
        index: (r?.index ?? 0) + 1
      }));

    console.log('✅ Images générées:', {
      hero: !!heroImageUrl,
      flash: posterImages.filter(p => p.poster_url).length
    });

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
      heroImage: heroImageUrl || realPhotos[0] || null,
      angles: posterImages,
      raisons_acheter: gptResult.raisons_acheter || [],
      benefits_bullets: gptResult.benefits_bullets || [],
      conversion_blocks: gptResult.conversion_blocks || [],
      urgency_elements: gptResult.urgency_elements || null,
      faq: gptResult.faq || [],
      testimonials: gptResult.testimonials || [],
      reassurance: gptResult.reassurance || null,
      guide_utilisation: gptResult.guide_utilisation || null,
      description: description,
      realPhotos,
      allImages: [
        ...(heroImageUrl ? [heroImageUrl] : []),
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
