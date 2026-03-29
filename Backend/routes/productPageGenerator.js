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
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import { analyzeWithVision, generatePosterImage } from '../services/productPageGeneratorService.js';
import { uploadImage } from '../services/cloudflareImagesService.js';
import { scrapeAlibaba } from '../services/alibabaScraper.js';
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

  const { url, description: userDescription, skipScraping, marketingApproach } = req.body || {};
  const imageFiles = req.files || [];
  const approach = marketingApproach || 'AIDA'; // Default to AIDA if not specified

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
    // Mode URL Alibaba
    if (!url || typeof url !== 'string' || url.trim().length < 10) {
      releaseLock(userId);
      return res.status(400).json({ success: false, message: 'URL Alibaba requise' });
    }
    const cleanUrl = url.trim();
    if (!cleanUrl.includes('alibaba.com') && !cleanUrl.includes('aliexpress.com')) {
      releaseLock(userId);
      return res.status(400).json({ success: false, message: 'URL Alibaba ou AliExpress requise' });
    }
  }

  let scraped;
  let gptResult;
  let realPhotos = [];
  let posterImages = [];
  const cleanUrl = url?.trim() || '';
  let storeContext = {};

  try {
    if (req.workspaceId) {
      const workspace = await EcomWorkspace.findById(req.workspaceId)
        .select('storeSettings.country storeSettings.city')
        .lean();
      storeContext = {
        country: workspace?.storeSettings?.country || '',
        city: workspace?.storeSettings?.city || '',
      };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 1 : Scraping minimal OU utilisation de la description directe
    // ══════════════════════════════════════════════════════════════════════════
    if (isDescriptionMode) {
      console.log('📝 Étape 1: Mode description directe (skip scraping)');
      scraped = {
        title: 'Produit',
        description: userDescription.trim(),
        rawText: userDescription.trim()
      };
      console.log('✅ Description utilisée:', userDescription.slice(0, 100));
    } else {
      console.log('📡 Étape 1: Scraping', cleanUrl);
      scraped = await scrapeAlibaba(cleanUrl);
      console.log('✅ Scraping OK:', { title: scraped.title?.slice(0, 50) });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 2 : GPT-4o Vision → JSON structuré
    // ══════════════════════════════════════════════════════════════════════════
    console.log('🧠 Étape 2: GPT-4o analyse + copywriting, photos:', imageFiles.length);
    
    const imageBuffers = (imageFiles || []).map(f => f.buffer);
    
    gptResult = await analyzeWithVision(scraped, imageBuffers, approach, storeContext);
    
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

        const uploaded = await uploadImage(imageBuffer, filename, {
          workspaceId: req.workspaceId,
          uploadedBy: userId,
          mimeType: 'image/png'
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

    // Avant/Après
    imagePromises.push(
      generateAndUpload(gptResult.prompt_avant_apres, null, `before-after-${Date.now()}.png`, 'before_after')
        .then(url => ({ type: 'beforeAfter', url }))
    );

    // 4 Affiches publicitaires
    for (let i = 0; i < 4; i++) {
      const angle = gptResult.angles?.[i];
      if (angle?.prompt_affiche) {
        imagePromises.push(
          generateAndUpload(angle.prompt_affiche, null, `poster-${i + 1}-${Date.now()}.png`, 'scene')
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
      heroImage: heroImageUrl || realPhotos[0] || null,
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
    return res.json({ success: true, product: productPage });

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
