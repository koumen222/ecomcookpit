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

  const { url, description: userDescription, skipScraping } = req.body || {};
  const imageFiles = req.files || [];

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

  try {
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
    
    gptResult = await analyzeWithVision(scraped, imageBuffers);
    
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
    // ÉTAPE 4 : Générer l'AFFICHE HERO (image principale)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('🎨 Étape 4a: Génération de l\'affiche HERO...');
    let heroImageUrl = null;
    
    if (gptResult.prompt_affiche_hero) {
      try {
        const baseImageBuffer = imageFiles[0]?.buffer || null;
        const generatedDataUrl = await generatePosterImage(gptResult.prompt_affiche_hero, baseImageBuffer);
        
        if (generatedDataUrl) {
          let imageBuffer;
          if (generatedDataUrl.startsWith('data:')) {
            const base64Data = generatedDataUrl.split(',')[1];
            imageBuffer = Buffer.from(base64Data, 'base64');
          } else {
            const axios = (await import('axios')).default;
            const resp = await axios.get(generatedDataUrl, { responseType: 'arraybuffer', timeout: 15000 });
            imageBuffer = Buffer.from(resp.data);
          }

          const uploaded = await uploadImage(
            imageBuffer,
            `hero-${Date.now()}.png`,
            { workspaceId: req.workspaceId, uploadedBy: userId, mimeType: 'image/png' }
          );
          heroImageUrl = uploaded?.url || null;
          console.log('✅ Affiche HERO générée et uploadée');
        }
      } catch (heroErr) {
        console.warn('⚠️ Affiche HERO échouée:', heroErr.message);
        heroImageUrl = realPhotos[0] || null;
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 4b : Générer 4 AFFICHES PUBLICITAIRES avec NanoBanana
    // ══════════════════════════════════════════════════════════════════════════
    console.log('🎨 Étape 4b: Génération de 4 affiches publicitaires...');
    
    for (let i = 0; i < 4; i++) {
      const angle = gptResult.angles[i];
      if (!angle || !angle.prompt_affiche) {
        console.warn(`⚠️ Angle ${i + 1} manquant ou sans prompt, skip`);
        posterImages.push({
          ...angle,
          poster_url: realPhotos[i] || realPhotos[0] || null,
          index: i + 1
        });
        continue;
      }

      try {
        console.log(`🎨 Affiche ${i + 1}/4: "${angle.titre_angle}"`);        
        
        // Use original image for image-to-image (first image as reference)
        const baseImageBuffer = imageFiles[i]?.buffer || imageFiles[0]?.buffer || null;
        
        const generatedDataUrl = await generatePosterImage(angle.prompt_affiche, baseImageBuffer);
        
        if (!generatedDataUrl) {
          throw new Error('Aucune image générée par NanoBanana');
        }

        // Convert data URL or URL to buffer for R2 upload
        let imageBuffer;
        if (generatedDataUrl.startsWith('data:')) {
          const base64Data = generatedDataUrl.split(',')[1];
          imageBuffer = Buffer.from(base64Data, 'base64');
        } else {
          const axios = (await import('axios')).default;
          const resp = await axios.get(generatedDataUrl, { responseType: 'arraybuffer', timeout: 15000 });
          imageBuffer = Buffer.from(resp.data);
        }

        // Upload to R2
        const uploaded = await uploadImage(
          imageBuffer,
          `poster-${i + 1}-${Date.now()}.png`,
          { workspaceId: req.workspaceId, uploadedBy: userId, mimeType: 'image/png' }
        );

        posterImages.push({
          ...angle,
          poster_url: uploaded?.url || realPhotos[i] || null,
          index: i + 1
        });
        console.log(`✅ Affiche ${i + 1} uploadée`);

      } catch (posterErr) {
        console.warn(`⚠️ Affiche ${i + 1} échouée:`, posterErr.message);
        posterImages.push({
          ...angle,
          poster_url: realPhotos[i] || realPhotos[0] || null,
          index: i + 1
        });
      }
    }

    console.log('✅ Affiches générées:', posterImages.filter(p => p.poster_url).length, '/ 4');

    // ══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 5 : Assembler la description avec les images
    // ══════════════════════════════════════════════════════════════════════════
    console.log('📝 Étape 5: Assemblage de la description');
    
    let description = gptResult.description_optimisee || '';
    
    // Ajouter un titre h3 avant la description
    if (description) {
      description = `### Description du produit\n\n${description}`;
    }
    
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
      angles: posterImages,
      raisons_acheter: gptResult.raisons_acheter || [],
      faq: gptResult.faq || [],
      testimonials: gptResult.testimonials || [],
      description: description,
      realPhotos,
      allImages: [
        ...(heroImageUrl ? [heroImageUrl] : []),
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
