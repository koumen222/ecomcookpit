/**
 * Product Page Generator Route
 * POST /api/ai/product-generator
 *
 * Accepts multipart/form-data: { url, withImages?, images[] }
 * Streams progress via SSE, then returns full structured product page.
 */

import express from 'express';
import multer from 'multer';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import {
  analyzeWithVision,
  uploadBufferToR2
} from '../services/productPageGeneratorService.js';
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

router.post('/', requireEcomAuth, upload.array('images', 8), async (req, res) => {
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
      const uploaded = await uploadBufferToR2(f.buffer, f.mimetype, req.workspaceId, userId);
      if (uploaded?.url) realPhotos.push(uploaded.url);
    }

    // ── Step 4: Assemble final product using imageIndex mapping ───────────────
    console.log('✅ Step 4: Assembling product page');

    // Map each section to the user photo indicated by imageIndex
    const sections = (pageStructure.sections || []).map((s) => ({
      title: s.title || '',
      description: s.description || '',
      marketingGoal: s.marketingGoal || '',
      image: realPhotos[s.imageIndex] ?? realPhotos[0] ?? null
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
      allImages: realPhotos.filter(Boolean),
      sourceUrl: cleanUrl,
      createdByAI: true,
      generatedAt: new Date().toISOString()
    };

    res.json({ success: true, product: productPage });

  } catch (error) {
    console.error('❌ Product page generator error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erreur lors de la génération de la page produit' 
    });
  } finally {
    // Release lock
    if (globalThis.__aiProductGeneratorLock?.userId === userId) {
      globalThis.__aiProductGeneratorLock.locked = false;
      globalThis.__aiProductGeneratorLock.userId = null;
      globalThis.__aiProductGeneratorLock.startedAt = null;
    }
  }
});

export default router;
