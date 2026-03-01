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
  scrapeAlibaba,
  analyzeWithVision,
  generateSceneImage,
  downloadAndUploadToR2,
  uploadBufferToR2
} from '../services/productPageGeneratorService.js';

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

  // ── SSE headers ───────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.status(200);
  res.flushHeaders();

  let closed = false;

  const cleanup = () => {
    if (!closed) {
      closed = true;
      clearInterval(heartbeat);
      clearTimeout(safetyTimeout);
      if (globalThis.__aiProductGeneratorLock?.userId === userId) {
        globalThis.__aiProductGeneratorLock.locked = false;
        globalThis.__aiProductGeneratorLock.userId = null;
        globalThis.__aiProductGeneratorLock.startedAt = null;
      }
    }
  };

  req.on('close', () => {
    console.log('⚠️ SSE client disconnected (product-generator) userId:', userId);
    cleanup();
  });

  const send = (type, payload = {}) => {
    if (closed) return;
    try {
      res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
      if (typeof res.flush === 'function') res.flush();
    } catch (_) {}
  };

  // ── Heartbeat every 5s — keeps Railway proxy alive during GPT/DALL-E ──────
  const heartbeat = setInterval(() => {
    if (closed) return clearInterval(heartbeat);
    try {
      res.write('data: {"type":"ping"}\n\n');
      if (typeof res.flush === 'function') res.flush();
    } catch (_) { clearInterval(heartbeat); }
  }, 5000);

  // ── Hard timeout: 60s max — libère le verrou quoi qu'il arrive ────────────
  const safetyTimeout = setTimeout(() => {
    if (!closed) {
      console.warn('⏱️ Product generator timeout (60s) for userId:', userId);
      send('error', { message: 'Timeout : la génération a dépassé 60 secondes. Réessayez.' });
      res.end();
      cleanup();
    }
  }, 60000);

  try {
    // ── Step 1: Scrape Alibaba ────────────────────────────────────────────────
    console.log('📡 Step 1: Scraping', cleanUrl);
    send('progress', { step: 1, total: 5, label: '🔍 Analyse de la page Alibaba...' });
    const scraped = await scrapeAlibaba(cleanUrl);
    console.log('✅ Scraping done:', { title: scraped.title, images: scraped.images.length });
    if (closed) return;

    // ── Step 2: GPT-4o Vision ─────────────────────────────────────────────────
    console.log('🧠 Step 2: Vision analysis, photos:', imageFiles.length);
    send('progress', {
      step: 2, total: 5,
      label: `🧠 Analyse IA${imageFiles.length > 0 ? ` avec ${imageFiles.length} photo(s)` : ''}...`
    });
    const imageBuffers = imageFiles.map(f => f.buffer);
    const pageStructure = await analyzeWithVision(scraped, imageBuffers);
    console.log('✅ Vision done:', { title: pageStructure.product_title, sections: pageStructure.sections?.length });
    if (closed) return;

    // ── Upload user photos to R2 ──────────────────────────────────────────────
    const realPhotos = [];
    for (const f of imageFiles.slice(0, 4)) {
      if (closed) break;
      const uploaded = await uploadBufferToR2(f.buffer, f.mimetype, req.workspaceId, userId);
      if (uploaded?.url) realPhotos.push(uploaded.url);
    }

    // ── Step 3–4: Generate & upload DALL-E scene images ──────────────────────
    const finalImages = {};

    if (doImages) {
      const allPrompts = [
        { key: 'hero', prompt: pageStructure.hero_image_prompt },
        ...(pageStructure.sections || []).map((s, i) => ({
          key: `section_${i}`,
          prompt: s.image_scene_prompt
        })),
        { key: 'advantages', prompt: pageStructure.advantages_infographic_prompt }
      ].filter(p => p.prompt);

      for (let i = 0; i < allPrompts.length; i++) {
        if (closed) break;
        const { key, prompt } = allPrompts[i];

        send('progress', { step: 3, total: 5, label: `🎨 Génération image ${i + 1}/${allPrompts.length}...` });
        const generatedUrl = await generateSceneImage(prompt);
        if (!generatedUrl) continue;

        send('progress', { step: 4, total: 5, label: `☁️ Sauvegarde image ${i + 1}/${allPrompts.length}...` });
        const uploaded = await downloadAndUploadToR2(generatedUrl, req.workspaceId, userId);
        if (uploaded?.url) finalImages[key] = uploaded.url;
      }
    }

    if (closed) return;

    // ── Step 5: Assemble & send final product ─────────────────────────────────
    send('progress', { step: 5, total: 5, label: '✅ Assemblage de la page produit...' });

    const sections = (pageStructure.sections || []).map((s, i) => ({
      title: s.title || '',
      description: s.description || '',
      image: finalImages[`section_${i}`] || realPhotos[i + 1] || null
    }));

    const productPage = {
      title: pageStructure.product_title || scraped.title || '',
      hook: pageStructure.emotional_hook || '',
      heroImage: finalImages.hero || realPhotos[0] || null,
      sections,
      advantagesImage: finalImages.advantages || null,
      faq: pageStructure.faq || [],
      category: pageStructure.category || '',
      tags: pageStructure.tags || [],
      suggestedPrice: pageStructure.suggested_price || 0,
      seoTitle: pageStructure.seo_title || '',
      seoDescription: pageStructure.seo_description || '',
      whatsappMessage: pageStructure.whatsapp_message || '',
      realPhotos,
      allImages: [
        finalImages.hero || realPhotos[0],
        ...sections.map(s => s.image),
        finalImages.advantages
      ].filter(Boolean),
      sourceUrl: cleanUrl,
      createdByAI: true,
      generatedAt: new Date().toISOString()
    };

    send('done', { product: productPage });
    if (!closed) res.end();

  } catch (error) {
    console.error('❌ Product page generator error:', error.message);

    let msg = error.message || 'Erreur inattendue lors de la génération';
    if (msg.includes('bloqué') || msg.includes('blocked')) {
      msg = 'Alibaba a bloqué le scraping. Attendez 30 secondes et réessayez.';
    } else if (msg.includes('OpenAI') || msg.includes('API key')) {
      msg = 'Clé API OpenAI manquante ou invalide. Vérifiez OPENAI_API_KEY.';
    } else if (msg.includes('timeout') || msg.includes('Timeout')) {
      msg = 'Timeout dépassé. Désactivez les images IA et réessayez.';
    }

    send('error', { message: msg });
    if (!closed) res.end();

  } finally {
    cleanup();
  }
});

export default router;
