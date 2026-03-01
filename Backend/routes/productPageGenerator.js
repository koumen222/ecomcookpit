/**
 * Product Page Generator Route
 * POST /api/ai/product-generator
 *
 * Accepts multipart/form-data: { url, withImages?, images[] }
 * Streams progress via SSE, then returns full structured product page.
 */

import express from 'express';
import multer from 'multer';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import { analyzeWithVision, generateMarketingPoster } from '../services/productPageGeneratorService.js';
import { uploadImage } from '../services/cloudflareImagesService.js';
import { scrapeAlibaba } from '../services/alibabaScraper.js';

const router = express.Router();

// ── Global generation lock — prevents concurrent generations (production) ─────
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

// Log middleware pour diagnostiquer CORS
router.use((req, res, next) => {
  console.log('🔍 Product Generator Route Hit:', {
    method: req.method,
    path: req.path,
    origin: req.headers.origin,
    contentType: req.headers['content-type'],
    authorization: req.headers.authorization ? '***' : 'none'
  });
  next();
});

router.post('/', requireEcomAuth, validateEcomAccess('products', 'write'), upload.array('images', 8), async (req, res) => {
  const userId = req.user?.id || req.user?._id || 'anonymous';

  // ── Anti double-génération (verrou global) ────────────────────────────────
  const lock = globalThis.__aiProductGeneratorLock;
  if (lock.locked) {
    return res.status(429).json({
      success: false,
      message: 'Already generating'
    });
  }
  lock.locked = true;
  lock.userId = userId;
  lock.startedAt = Date.now();

  console.log('🎨 Product Page Generator started:', {
    url: req.body?.url,
    withImages: req.body?.withImages,
    filesCount: req.files?.length || 0,
    userId
  });

  const { url, withImages } = req.body || {};
  const imageFiles = req.files || [];
  const doImages = withImages !== 'false' && withImages !== false;

  if (!url || typeof url !== 'string' || url.trim().length < 10) {
    if (globalThis.__aiProductGeneratorLock?.userId === userId) {
      globalThis.__aiProductGeneratorLock.locked = false;
      globalThis.__aiProductGeneratorLock.userId = null;
      globalThis.__aiProductGeneratorLock.startedAt = null;
    }
    return res.status(400).json({ success: false, message: 'URL Alibaba requise' });
  }

  const cleanUrl = url.trim();
  if (!cleanUrl.includes('alibaba.com') && !cleanUrl.includes('aliexpress.com')) {
    if (globalThis.__aiProductGeneratorLock?.userId === userId) {
      globalThis.__aiProductGeneratorLock.locked = false;
      globalThis.__aiProductGeneratorLock.userId = null;
      globalThis.__aiProductGeneratorLock.startedAt = null;
    }
    return res.status(400).json({ success: false, message: 'URL Alibaba ou AliExpress requise' });
  }

  try {
    // ── Step 1: Scrape Alibaba ────────────────────────────────────────────────
    console.log('📡 Step 1: Scraping', cleanUrl);
    const scraped = await scrapeAlibaba(cleanUrl);
    console.log('✅ Scraping done:', { title: scraped.title, images: scraped.images.length });

    // ── Step 2: GPT-4o Vision + Copywriting ──────────────────────────────────
    console.log('🧠 Step 2: Vision analysis, photos:', imageFiles.length);
    const imageBuffers = imageFiles.map(f => f.buffer);
    const pageStructure = await analyzeWithVision(scraped, imageBuffers);
    console.log('✅ Vision done:', { title: pageStructure.mainTitle, sections: pageStructure.sections?.length });

    // ── Step 3: Upload user photos to R2 ──────────────────────────────────────
    console.log('📸 Step 3: Uploading photos:', imageFiles.length);
    const realPhotos = [];
    for (const f of imageFiles.slice(0, 8)) {
      const uploaded = await uploadImage(f.buffer, f.originalname || `photo-${Date.now()}.jpg`, {
        workspaceId: req.workspaceId,
        uploadedBy: userId,
        mimeType: f.mimetype
      });
      if (uploaded?.url) realPhotos.push(uploaded.url);
    }

    // ── Step 3.5: Generate marketing posters with DALL-E ───────────────────────
    console.log('🎨 Step 3.5: Generating marketing posters...');
    const marketingPosters = [];
    for (let i = 0; i < Math.min(pageStructure.sections.length, imageFiles.length); i++) {
      const section = pageStructure.sections[i];
      const baseImage = imageFiles[i];
      
      if (section.posterTitle && section.posterSubtitle && baseImage) {
        try {
          console.log(`🎨 Generating poster ${i + 1}: "${section.posterTitle}"`);
          const poster = await generateMarketingPoster(
            baseImage.buffer, 
            section.posterTitle, 
            section.posterSubtitle
          );
          
          // Upload poster to R2
          const posterUrl = await uploadImage(
            Buffer.from(poster.url.split(',')[1], 'base64'), // Convert data URL to buffer
            `poster-${i + 1}-${Date.now()}.png`,
            {
              workspaceId: req.workspaceId,
              uploadedBy: userId,
              mimeType: 'image/png'
            }
          );
          if (posterUrl?.url) {
            marketingPosters.push(posterUrl.url);
            console.log(`✅ Poster ${i + 1} uploaded successfully`);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to generate poster ${i + 1}:`, error.message);
          // Fallback: use original image
          marketingPosters.push(realPhotos[i]);
        }
      } else {
        // Fallback: use original image
        marketingPosters.push(realPhotos[i]);
      }
    }

    // ── Step 4: Assemble final product using imageIndex mapping ───────────────
    console.log('✅ Step 4: Assembling product page');

    // Map each section to the marketing poster (or fallback to original)
    const sections = (pageStructure.sections || []).map((s, index) => ({
      title: s.title || '',
      description: s.description || '',
      marketingGoal: s.marketingGoal || '',
      posterTitle: s.posterTitle || '',
      posterSubtitle: s.posterSubtitle || '',
      image: marketingPosters[index] ?? realPhotos[index] ?? realPhotos[0] ?? null
    }));

    const productPage = {
      title: pageStructure.mainTitle || scraped.title || '',
      hook: pageStructure.hook || '',
      problem: pageStructure.problem || '',
      solution: pageStructure.solution || '',
      howToUse: pageStructure.howToUse || '',
      whyChooseUs: pageStructure.whyChooseUs || '',
      cta: pageStructure.cta || '',
      productUnderstanding: pageStructure.productUnderstanding || {},
      sections,
      heroImage: realPhotos[0] || null,
      realPhotos,
      marketingPosters,
      allImages: [...realPhotos.filter(Boolean), ...marketingPosters.filter(Boolean)],
      sourceUrl: cleanUrl,
      createdByAI: true,
      generatedAt: new Date().toISOString()
    };

    // Release lock before response
    if (globalThis.__aiProductGeneratorLock?.userId === userId) {
      globalThis.__aiProductGeneratorLock.locked = false;
      globalThis.__aiProductGeneratorLock.userId = null;
      globalThis.__aiProductGeneratorLock.startedAt = null;
    }

    console.log('✅ Product generated successfully');
    return res.json({ success: true, product: productPage });

  } catch (error) {
    console.error('❌ Product page generator error:', error.message);
    
    // Release lock on error
    if (globalThis.__aiProductGeneratorLock?.userId === userId) {
      globalThis.__aiProductGeneratorLock.locked = false;
      globalThis.__aiProductGeneratorLock.userId = null;
      globalThis.__aiProductGeneratorLock.startedAt = null;
    }
    
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Erreur lors de la génération de la page produit' 
    });
  }
});

export default router;
