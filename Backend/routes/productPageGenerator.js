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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Seules les images sont acceptées'), false);
  }
});

router.post('/', requireEcomAuth, upload.array('images', 8), async (req, res) => {
  console.log('🎨 Product Page Generator started:', {
    url: req.body?.url,
    withImages: req.body?.withImages,
    filesCount: req.files?.length || 0,
    workspaceId: req.body?.workspaceId,
    userId: req.user?.id,
    hasAuth: !!req.user
  });
  
  const { url, withImages } = req.body || {};
  const imageFiles = req.files || [];
  const doImages = withImages !== 'false' && withImages !== false;

  if (!url || typeof url !== 'string' || url.trim().length < 10) {
    console.error('❌ Invalid URL provided:', url);
    return res.status(400).json({ success: false, message: 'URL Alibaba requise' });
  }

  const cleanUrl = url.trim();
  if (!cleanUrl.includes('alibaba.com') && !cleanUrl.includes('aliexpress.com')) {
    console.error('❌ Non-Alibaba URL:', cleanUrl);
    return res.status(400).json({ success: false, message: 'URL Alibaba ou AliExpress requise' });
  }

  // ── SSE headers ──────────────────────────────────────────────────────────────
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Transfer-Encoding': 'identity',
    'Access-Control-Allow-Origin': req.headers.origin || '*'
  });
  // Flush headers immediately so client knows the stream is open
  res.flushHeaders();

  let closed = false;
  req.on('close', () => { closed = true; });

  const send = (type, payload = {}) => {
    if (closed) return;
    try {
      res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
      // Force immediate delivery — bypass any remaining buffers
      if (typeof res.flush === 'function') res.flush();
    } catch (_) {}
  };

  try {
    // ── Step 1: Scrape Alibaba ─────────────────────────────────────────────────
    console.log('📡 Starting step 1: Scraping');
    send('progress', { step: 1, total: 5, label: '🔍 Analyse de la page Alibaba...' });
    const scraped = await scrapeAlibaba(cleanUrl);
    console.log('✅ Scraping completed:', { title: scraped.title, imagesCount: scraped.images.length });
    if (closed) return;

    // ── Step 2: GPT-4o Vision analysis ────────────────────────────────────────
    console.log('🧠 Starting step 2: Vision Analysis with', imageFiles.length, 'photos');
    const photoCount = imageFiles.length;
    send('progress', {
      step: 2, total: 5,
      label: `🧠 Analyse IA${photoCount > 0 ? ` avec ${photoCount} photo(s) réelle(s)` : ''}...`
    });
    const imageBuffers = imageFiles.map(f => f.buffer);
    const pageStructure = await analyzeWithVision(scraped, imageBuffers);
    console.log('✅ Vision Analysis completed:', { title: pageStructure.product_title, sectionsCount: pageStructure.sections?.length });
    if (closed) return;

    // ── Upload user real photos to R2 ──────────────────────────────────────────
    const realPhotos = [];
    for (const f of imageFiles.slice(0, 4)) {
      if (closed) break;
      const uploaded = await uploadBufferToR2(f.buffer, f.mimetype, req.workspaceId, req.user?.id);
      if (uploaded?.url) realPhotos.push(uploaded.url);
    }

    // ── Step 3–4: Generate & upload scene images ───────────────────────────────
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

      const total = allPrompts.length;

      for (let i = 0; i < allPrompts.length; i++) {
        if (closed) break;
        const { key, prompt } = allPrompts[i];

        send('progress', {
          step: 3, total: 5,
          label: `🎨 Génération image ${i + 1}/${total}...`
        });

        const generatedUrl = await generateSceneImage(prompt);
        if (!generatedUrl) continue;

        send('progress', {
          step: 4, total: 5,
          label: `☁️ Sauvegarde image ${i + 1}/${total}...`
        });

        const uploaded = await downloadAndUploadToR2(generatedUrl, req.workspaceId, req.user?.id);
        if (uploaded?.url) finalImages[key] = uploaded.url;
      }
    }

    if (closed) return;

    // ── Step 5: Assemble product page ──────────────────────────────────────────
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
    console.error('❌ Product page generator error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    let errorMessage = error.message || 'Erreur inattendue lors de la génération';
    
    // Check specific error types
    if (error.message?.includes('OpenAI API key')) {
      errorMessage = 'Clé API OpenAI manquante. Configurez OPENAI_API_KEY dans les variables d\'environnement.';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Timeout lors de l\'analyse. Veuillez réessayer avec une URL plus simple.';
    } else if (error.message?.includes('fetch')) {
      errorMessage = 'Impossible d\'accéder à la page Alibaba. Vérifiez l\'URL.';
    } else if (error.message?.includes('multer')) {
      errorMessage = 'Erreur upload fichier. Vérifiez le format et la taille des images.';
    }
    
    send('error', { message: errorMessage });
    if (!closed) res.end();
  }
});

export default router;
