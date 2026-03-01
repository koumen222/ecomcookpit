/**
 * Alibaba Import Route
 * POST /api/ecom/alibaba-import
 *
 * Streams progress via SSE then returns the AI-generated product.
 * Flow: scrapeAlibaba → analyzeWithGPT → generateMarketingImages → uploadToR2 → done
 */

import express from 'express';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import {
  scrapeAlibaba,
  analyzeWithGPT,
  generateMarketingImages,
  downloadAndUploadImage
} from '../services/alibabaImportService.js';

const router = express.Router();

/**
 * POST /api/ecom/alibaba-import
 * Body: { url: string, withImages?: boolean }
 * Response: SSE stream → progress events → done event with product data
 */
router.post(
  '/',
  requireEcomAuth,
  validateEcomAccess('products', 'write'),
  async (req, res) => {
    console.log('🚀 Alibaba import started:', {
      url: req.body?.url,
      withImages: req.body?.withImages,
      workspaceId: req.body?.workspaceId,
      userId: req.user?.id,
      hasAuth: !!req.user
    });
    
    const { url, withImages = true } = req.body || {};

    if (!url || typeof url !== 'string' || url.trim().length < 10) {
      console.error('❌ Invalid URL provided:', url);
      return res.status(400).json({ success: false, message: 'URL requise' });
    }

    const cleanUrl = url.trim();
    const isAlibaba = cleanUrl.includes('alibaba.com') || cleanUrl.includes('aliexpress.com');
    if (!isAlibaba) {
      console.error('❌ Non-Alibaba URL:', cleanUrl);
      return res.status(400).json({
        success: false,
        message: 'URL Alibaba ou AliExpress requise (ex: https://www.alibaba.com/product-detail/...)'
      });
    }

    // ── SSE headers (use setHeader to preserve CORS headers set by middleware) ──
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.status(200);
    // Flush headers immediately so client knows the stream is open
    res.flushHeaders();

    let closed = false;
    req.on('close', () => {
      console.log('⚠️ SSE connection closed by client (alibaba-import)');
      closed = true;
      clearInterval(heartbeat);
    });

    const send = (type, payload = {}) => {
      if (closed) return;
      try {
        res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
        if (typeof res.flush === 'function') res.flush();
      } catch (_) {}
    };

    // Heartbeat every 5s — keeps Railway/proxy connection alive during long GPT/DALL-E calls
    const heartbeat = setInterval(() => {
      if (closed) return clearInterval(heartbeat);
      try {
        res.write('data: {"type":"ping"}\n\n');
        if (typeof res.flush === 'function') res.flush();
      } catch (_) { clearInterval(heartbeat); }
    }, 5000);

    try {
      // ── Step 1: Scraping ───────────────────────────────────────────────
      console.log('📡 Starting step 1: Scraping');
      send('progress', { step: 1, steps: 4, label: '🔍 Analyse de la page Alibaba...' });
      const scraped = await scrapeAlibaba(cleanUrl);
      console.log('✅ Scraping completed:', { title: scraped.title, imagesCount: scraped.images.length });

      if (closed) return;

      // ── Step 2: GPT Copywriting ────────────────────────────────────────
      console.log('🧠 Starting step 2: GPT Analysis');
      send('progress', { step: 2, steps: 4, label: '🧠 Génération du copywriting IA...' });
      const generated = await analyzeWithGPT(scraped);
      console.log('✅ GPT Analysis completed:', { name: generated.name, price: generated.suggestedPrice });

      if (closed) return;

      // ── Step 3: Images ─────────────────────────────────────────────────
      const uploadedImages = [];

      if (withImages) {
        send('progress', { step: 3, steps: 4, label: '🎨 Création des visuels marketing IA...' });

        const aiUrls = await generateMarketingImages(
          generated.name || '',
          generated.description || ''
        );

        if (closed) return;

        send('progress', { step: 3, steps: 4, label: '☁️ Sauvegarde des images...' });

        for (const imgUrl of aiUrls) {
          if (closed) break;
          const uploaded = await downloadAndUploadImage(imgUrl, req.workspaceId, req.user?.id);
          if (uploaded?.url) {
            uploadedImages.push({
              url: uploaded.url,
              alt: generated.name || 'Product image',
              order: uploadedImages.length
            });
          }
        }
      }

      // Fallback: try scraped Alibaba images if we don't have enough
      if (uploadedImages.length < 2 && scraped.images.length > 0) {
        send('progress', { step: 3, steps: 4, label: '🖼️ Récupération des images source...' });
        for (const imgUrl of scraped.images.slice(0, 3)) {
          if (closed || uploadedImages.length >= 3) break;
          const uploaded = await downloadAndUploadImage(imgUrl, req.workspaceId, req.user?.id);
          if (uploaded?.url) {
            uploadedImages.push({
              url: uploaded.url,
              alt: generated.name || 'Product image',
              order: uploadedImages.length
            });
          }
        }
      }

      if (closed) return;

      // ── Step 4: Done ───────────────────────────────────────────────────
      send('progress', { step: 4, steps: 4, label: '✅ Produit prêt !' });

      clearInterval(heartbeat);
      send('done', {
        product: {
          ...generated,
          images: uploadedImages,
          sourceUrl: cleanUrl,
          createdByAI: true,
          scrapedAt: new Date().toISOString()
        }
      });

      if (!closed) res.end();

    } catch (error) {
      console.error('❌ Alibaba import error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      let errorMessage = error.message || 'Erreur inattendue lors de l\'import';
      
      // Check specific error types
      if (error.message?.includes('OpenAI API key')) {
        errorMessage = 'Clé API OpenAI manquante. Configurez OPENAI_API_KEY dans les variables d\'environnement.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Timeout lors de l\'analyse. Veuillez réessayer avec une URL plus simple.';
      } else if (error.message?.includes('fetch')) {
        errorMessage = 'Impossible d\'accéder à la page Alibaba. Vérifiez l\'URL.';
      }
      
      clearInterval(heartbeat);
      send('error', { message: errorMessage });
      if (!closed) res.end();
    }
  }
);

export default router;
