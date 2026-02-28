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
    const { url, withImages = true } = req.body || {};

    if (!url || typeof url !== 'string' || url.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'URL requise' });
    }

    const cleanUrl = url.trim();
    const isAlibaba = cleanUrl.includes('alibaba.com') || cleanUrl.includes('aliexpress.com');
    if (!isAlibaba) {
      return res.status(400).json({
        success: false,
        message: 'URL Alibaba ou AliExpress requise (ex: https://www.alibaba.com/product-detail/...)'
      });
    }

    // ── SSE headers ─────────────────────────────────────────────────────────
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': req.headers.origin || '*'
    });

    let closed = false;
    req.on('close', () => { closed = true; });

    const send = (type, payload = {}) => {
      if (closed) return;
      try {
        res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
      } catch (_) {}
    };

    try {
      // ── Step 1: Scraping ───────────────────────────────────────────────
      send('progress', { step: 1, steps: 4, label: '🔍 Analyse de la page Alibaba...' });
      const scraped = await scrapeAlibaba(cleanUrl);

      if (closed) return;

      // ── Step 2: GPT Copywriting ────────────────────────────────────────
      send('progress', { step: 2, steps: 4, label: '🧠 Génération du copywriting IA...' });
      const generated = await analyzeWithGPT(scraped);

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
      console.error('❌ Alibaba import error:', error.message);
      send('error', { message: error.message || 'Erreur inattendue lors de l\'import' });
      if (!closed) res.end();
    }
  }
);

export default router;
