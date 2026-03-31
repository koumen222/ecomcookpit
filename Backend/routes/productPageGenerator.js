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
    for (const f of imageFiles.slice(0, 8)) {
      try {
        const uploaded = await uploadImage(f.buffer, f.originalname || `photo-${Date.now()}.jpg`, {
          workspaceId: req.workspaceId,
          uploadedBy: userId,
          mimeType: f.mimetype
        });
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

    // Helper pour générer et uploader une image
    const generateAndUpload = async (prompt, baseBuffer, filename, mode = 'scene') => {
      if (!prompt) return null;
      try {
        const generatedDataUrl = await generatePosterImage(prompt, baseBuffer, { mode });
        if (!generatedDataUrl) return null;

        let imageBuffer;
        if (generatedDataUrl.startsWith('data:')) {
          imageBuffer = Buffer.from(generatedDataUrl.split(',')[1], 'base64');
        } else {
          const resp = await axios.get(generatedDataUrl, { responseType: 'arraybuffer', timeout: 15000 });
          imageBuffer = Buffer.from(resp.data);
        }

        // Resize to 1080x1100
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
        return uploaded?.url || null;
      } catch (err) {
        console.warn(`⚠️ Image ${filename} échouée:`, err.message);
        return null;
      }
    };

    // Préparer toutes les tâches de génération
    const imagePromises = [];
    const baseImageBuffer = imageFiles[0]?.buffer || null;

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

    // 4 Affiches publicitaires — baseImageBuffer pour garder le VRAI produit
    for (let i = 0; i < 4; i++) {
      const angle = gptResult.angles?.[i];
      if (angle?.prompt_affiche) {
        imagePromises.push(
          generateAndUpload(angle.prompt_affiche, baseImageBuffer, `poster-${i + 1}-${Date.now()}.png`, 'scene')
            .then(url => ({ type: 'poster', index: i, url, angle }))
        );
      } else {
        imagePromises.push(Promise.resolve({ type: 'poster', index: i, url: null, angle }));
      }
    }

    // Exécuter toutes les générations en parallèle
    const imageResults = await Promise.all(imagePromises);

    // Extraire les résultats
    let heroImageUrl = imageResults.find(r => r.type === 'hero')?.url || realPhotos[0] || null;
    let heroPosterImageUrl = imageResults.find(r => r.type === 'heroPoster')?.url || null;
    let beforeAfterImageUrl = imageResults.find(r => r.type === 'beforeAfter')?.url || null;

    const posterImages = imageResults
      .filter(r => r.type === 'poster')
      .sort((a, b) => a.index - b.index)
      .map(r => ({
        ...r.angle,
        poster_url: r.url || realPhotos[r.index] || realPhotos[0] || null,
        index: r.index + 1
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
