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

// ── Global generation lock ──────────────────────────────────────────────────
if (!globalThis.__aiProductGeneratorLock) {
  globalThis.__aiProductGeneratorLock = { locked: false, userId: null, startedAt: null };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Seules les images sont acceptées'), false);
  }
});

function releaseLock(userId) {
  if (globalThis.__aiProductGeneratorLock?.userId === userId) {
    globalThis.__aiProductGeneratorLock.locked = false;
    globalThis.__aiProductGeneratorLock.userId = null;
    globalThis.__aiProductGeneratorLock.startedAt = null;
  }
}

router.post('/', requireEcomAuth, validateEcomAccess('products', 'write'), upload.array('images', 8), async (req, res) => {
  const userId = req.user?.id || req.user?._id || 'anonymous';

  // ── Anti double-génération ────────────────────────────────────────────────
  const lock = globalThis.__aiProductGeneratorLock;
  if (lock.locked) {
    return res.status(429).json({ success: false, message: 'Génération déjà en cours' });
  }
  lock.locked = true;
  lock.userId = userId;
  lock.startedAt = Date.now();

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
      releaseLock(userId);
      return res.status(400).json({ success: false, message: 'Description requise (minimum 20 caractères)' });
    }
    if (!imageFiles || imageFiles.length === 0) {
      releaseLock(userId);
      return res.status(400).json({ success: false, message: 'Au moins une photo requise en mode description' });
    }
  } else {
    // Mode URL produit
    if (!url || typeof url !== 'string' || url.trim().length < 10) {
      releaseLock(userId);
      return res.status(400).json({ success: false, message: 'URL du produit requise' });
    }
    const cleanUrl = url.trim();
    // Validation basique de l'URL
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      releaseLock(userId);
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
        releaseLock(userId);
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
        releaseLock(userId);
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

    // Hero
    imagePromises.push(
      generateAndUpload(gptResult.prompt_affiche_hero, baseImageBuffer, `hero-${Date.now()}.png`, 'hero')
        .then(url => ({ type: 'hero', url }))
    );

    // Hero Poster (affiche graphique)
    imagePromises.push(
      generateAndUpload(gptResult.prompt_hero_poster, baseImageBuffer, `hero-poster-${Date.now()}.png`, 'hero_poster')
        .then(url => ({ type: 'heroPoster', url }))
    );

    // Avant/Après — baseImageBuffer pour garder le VRAI produit
    imagePromises.push(
      generateAndUpload(gptResult.prompt_avant_apres, baseImageBuffer, `before-after-${Date.now()}.png`, 'before_after')
        .then(url => ({ type: 'beforeAfter', url }))
    );

    // Diversité visuelle : mix de types de plans — jamais le même cadrage deux fois
    // Deux jeux de directives selon qu'on a une image produit de référence ou non.
    // Avec référence : le produit réel doit être visible dans chaque image.
    // Sans référence : scènes lifestyle pures — JAMAIS de produit inventé.
    const ANGLE_DIVERSITY_WITH_PRODUCT = [
      {
        directive: 'Medium shot lifestyle scene. Young Black African woman (25-30), natural afro hair, joyful expression — shown using or applying THE EXACT REFERENCE PRODUCT in a bright morning bathroom or kitchen. THE PRODUCT FROM THE REFERENCE IMAGE must be clearly visible and recognizable in her hand or in front of her. Show her face and emotion alongside the product. Natural environment, authentic moment.',
        mood: 'fresh, authentic, relatable',
      },
      {
        directive: 'Overhead flat lay product shot. THE EXACT REFERENCE PRODUCT is the absolute hero — placed centrally, large, sharp and dominant, occupying at least 60% of the frame. Surrounded by complementary natural ingredients (plants, fruits, herbs). The product packaging, color, label and shape must be perfectly reproduced from the reference. NO people, NO hands. Clean top-down composition, soft natural light, editorial magazine style.',
        mood: 'premium, clean, editorial',
      },
      {
        directive: 'Lifestyle environment scene. THE EXACT REFERENCE PRODUCT is prominently placed in the foreground, large and sharp — on a beautifully styled African home bathroom shelf or wellness corner. The product must be the unmistakable focal point of the scene; reproduce its exact packaging, shape and colors from the reference. Warm ambient lighting, real African interior aesthetics. NO hands holding the product.',
        mood: 'warm, aspirational, immersive',
      },
      {
        directive: 'Close-up lifestyle shot. Black African woman (35-45), braided hair, radiant glowing skin — shown actively applying or holding THE EXACT REFERENCE PRODUCT. The product must be clearly visible and recognizable next to her face or in her hands. Tight frame that shows both her emotion (satisfaction, confidence) and the product details. The product packaging must match the reference exactly.',
        mood: 'sensory, emotional, aspirational',
      },
      {
        directive: 'Stylized hero product shot. THE EXACT REFERENCE PRODUCT alone, filling at least 70% of the frame, dramatically lit against a rich textured African-inspired background (kente pattern, terracotta, deep green foliage). Reproduce the product shape, color, label and packaging with perfect fidelity from the reference. Studio quality, professional beauty photography. NO people, NO hands. Luxury brand aesthetic with bold color contrast.',
        mood: 'premium, bold, brand-forward',
      },
    ];

    // Sans image de référence : scènes lifestyle pures, ZÉRO produit inventé
    const ANGLE_DIVERSITY_NO_PRODUCT = [
      {
        directive: 'Lifestyle scene showing the RESULT, not the product. Young Black African woman (25-30), natural afro hair, glowing skin — radiant and confident in a bright bathroom or kitchen. Focus entirely on her expression of satisfaction and wellbeing. NO product visible, NO packaging, NO bottles or boxes. Pure emotion and result.',
        mood: 'fresh, authentic, relatable',
      },
      {
        directive: 'Aesthetic mood board flat lay. Beautiful African-inspired textures, fabrics and natural elements (kente cloth, wooden surfaces, tropical leaves, natural ingredients like shea butter or aloe). Evokes the product\'s benefit atmosphere without showing any product. Editorial, clean, top-down composition. NO invented products, NO packaging.',
        mood: 'premium, clean, editorial',
      },
      {
        directive: 'Wide lifestyle environment scene. A beautifully styled African home bathroom or wellness corner — candles, plants, natural wood, soft towels — evoking the ritual and benefit of the product without showing any product. The scene IS the message. Warm ambient lighting, real African interior aesthetics.',
        mood: 'warm, aspirational, immersive',
      },
      {
        directive: 'Close-up emotional lifestyle shot. Black African woman (35-45), braided hair, eyes closed in pure satisfaction — mid skincare or wellness ritual gesture (hands on face, fingers running through hair). No product visible. Focus entirely on the sensory moment, glowing skin, authentic emotion. Cinematic close-up.',
        mood: 'sensory, emotional, aspirational',
      },
      {
        directive: 'Bold abstract lifestyle scene. Black African man or woman, confident and stylish in a minimalist studio or urban African setting. Strong graphic composition with bold colors and shapes evoking energy and premium quality. NO product, NO packaging invented. Pure brand atmosphere.',
        mood: 'premium, bold, brand-forward',
      },
    ];

    const ANGLE_DIVERSITY = baseImageBuffer ? ANGLE_DIVERSITY_WITH_PRODUCT : ANGLE_DIVERSITY_NO_PRODUCT;

    // 5 Affiches publicitaires — diversité forcée par angle
    for (let i = 0; i < 5; i++) {
      const angle = gptResult.angles?.[i];
      const diversity = ANGLE_DIVERSITY[i];
      const basePrompt = angle?.prompt_affiche ||
        (angle?.titre_angle
          ? `Square 1:1 scroll-stopping ecommerce ad for "${gptResult.title || 'product'}". Bold French headline: "${(angle.titre_angle || '').slice(0, 60)}". No price, no CTA, no URL.`
          : null);

      // Injecter la directive adaptée (avec ou sans produit référence)
      const productBlock = baseImageBuffer
        ? `\nPRODUCT REFERENCE (NON-NEGOTIABLE): A real product image is provided. THE EXACT SAME PRODUCT — same packaging, shape, color, label — MUST appear clearly in the generated image. NEVER invent, replace or omit the product.\n`
        : `\nIMPORTANT: No product reference image is available. Do NOT invent or imagine any product, packaging, bottle or box. Generate a pure lifestyle/atmosphere scene only.\n`;

      const prompt = basePrompt
        ? `${basePrompt}${productBlock}\nVISUAL DIRECTIVE (follow strictly for this image only):\n${diversity.directive}\nMood: ${diversity.mood}.\nThis image MUST be visually different from all others in the series in terms of shot type and composition.`
        : null;

      if (prompt) {
        imagePromises.push(
          generateAndUpload(prompt, baseImageBuffer, `poster-${i + 1}-${Date.now()}.png`, 'scene')
            .then(url => ({ type: 'poster', index: i, url, angle }))
        );
      } else {
        imagePromises.push(Promise.resolve({ type: 'poster', index: i, url: null, angle }));
      }
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
    let heroPosterImageUrl = imageResults.find(r => r?.type === 'heroPoster')?.url || null;
    let beforeAfterImageUrl = imageResults.find(r => r?.type === 'beforeAfter')?.url || null;

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
      heroPoster: !!heroPosterImageUrl,
      beforeAfter: !!beforeAfterImageUrl,
      posters: posterImages.filter(p => p.poster_url).length
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
      heroPosterImage: heroPosterImageUrl || null,
      beforeAfterImage: beforeAfterImageUrl || null,
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
        ...(heroPosterImageUrl ? [heroPosterImageUrl] : []),
        ...(beforeAfterImageUrl ? [beforeAfterImageUrl] : []),
        ...realPhotos,
        ...posterImages.map(p => p.poster_url).filter(Boolean)
      ],
      sourceUrl: cleanUrl,
      createdByAI: true,
      generatedAt: new Date().toISOString()
    };

    releaseLock(userId);
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
    releaseLock(userId);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la génération'
    });
  }
});

export default router;
