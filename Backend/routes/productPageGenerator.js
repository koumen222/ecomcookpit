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

  // ── SSE Headers et heartbeat ─────────────────────────────────────────────
  let heartbeat = null;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.status(200);
  res.flushHeaders();

  const send = (type, payload) => {
    if (!res.writableEnded) {
      const data = JSON.stringify({ type, timestamp: Date.now(), ...payload });
      res.write(`data: ${data}\n\n`);
    }
  };

  const cleanup = () => {
    console.log('⏹️ Client disconnected during generation');

    if (heartbeat !== null) {
      clearInterval(heartbeat);
      heartbeat = null;
    }

    if (!res.writableEnded) {
      res.end();
    }

    if (globalThis.__aiProductGeneratorLock?.userId === userId) {
      globalThis.__aiProductGeneratorLock.locked = false;
      globalThis.__aiProductGeneratorLock.userId = null;
      globalThis.__aiProductGeneratorLock.startedAt = null;
    }
  };

  req.on('close', cleanup);
  req.on('end', cleanup);

  heartbeat = setInterval(() => {
    try {
      res.write(`event: ping\ndata: {}\n\n`);
    } catch (err) {
      console.log('⚠️ SSE write failed');
    }
  }, 15000);

  // ── Safety timeout: release lock after 5 minutes ─────────────────────────
  const safetyTimer = setTimeout(() => {
    if (!res.writableEnded) {
      console.warn('⏱️ Product generator timeout (300s) for userId:', userId);
      send('error', { message: 'Timeout : la génération a dépassé 5 minutes. Réessayez.' });
      cleanup();
    }
  }, 300000);

  try {
    // ── Step 1: Scrape Alibaba ────────────────────────────────────────────────
    // ── Step 1: Scrape Alibaba ────────────────────────────────────────────────
    console.log('📡 Step 1: Scraping', cleanUrl);
    send('progress', { step: 1, total: 4, label: '🔍 Analyse de la page Alibaba...' });
    const scraped = await scrapeAlibaba(cleanUrl);
    console.log('✅ Scraping done:', { title: scraped.title, images: scraped.images.length });
    if (res.writableEnded) return;

    // ── Step 2: GPT-4o Vision + Copywriting ──────────────────────────────────
    console.log('🧠 Step 2: Vision analysis, photos:', imageFiles.length);
    send('progress', {
      step: 2, total: 4,
      label: `🧠 Copywriting IA${imageFiles.length > 0 ? ` (${imageFiles.length} photo(s) analysées)` : ''}...`
    });
    const imageBuffers = imageFiles.map(f => f.buffer);
    const pageStructure = await analyzeWithVision(scraped, imageBuffers);
    console.log('✅ Vision done:', { title: pageStructure.mainTitle, sections: pageStructure.sections?.length });
    if (res.writableEnded) return;

    // ── Step 3: Upload user photos to R2 ──────────────────────────────────────
    console.log('📸 Step 3: Uploading photos:', imageFiles.length);
    send('progress', { step: 3, total: 4, label: `📸 Sauvegarde des photos (${imageFiles.length})...` });
    const realPhotos = [];
    for (const f of imageFiles.slice(0, 8)) {
      if (res.writableEnded) break;
      const uploaded = await uploadBufferToR2(f.buffer, f.mimetype, req.workspaceId, userId);
      if (uploaded?.url) realPhotos.push(uploaded.url);
    }
    if (res.writableEnded) return;

    // ── Step 4: Assemble final product using imageIndex mapping ───────────────
    console.log('✅ Step 4: Assembling product page');
    send('progress', { step: 4, total: 4, label: '✅ Assemblage de la page produit...' });

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

    send('done', { product: productPage });
    if (!res.writableEnded) res.end();

  } catch (error) {
    console.error('❌ Product page generator error:', error.message);
    if (!res.writableEnded) {
      send('error', { message: error.message || 'Erreur lors de la génération de la page produit' });
      res.end();
    }
  } finally {
    clearTimeout(safetyTimer);
    cleanup();
  }
});

export default router;
