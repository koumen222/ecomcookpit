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
import { analyzeWithVision } from '../services/productPageGeneratorService.js';
import { uploadImage } from '../services/cloudflareImagesService.js';
import { scrapeAlibaba } from '../services/alibabaScraper.js';
import OpenAI from 'openai';

const router = express.Router();

// ── OpenAI instance for gpt-image-1 ───────────────────────────────────────
let _openai = null;
function getOpenAI() {
  if (!_openai && process.env.OPENAI_API_KEY) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

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
    console.log('🧠 Step 2: Vision analysis, photos:', imageFiles?.length || 'undefined');
    console.log('🐛 imageFiles type:', typeof imageFiles, 'isArray:', Array.isArray(imageFiles));
    
    if (!imageFiles || !Array.isArray(imageFiles)) {
      throw new Error('imageFiles is not a valid array');
    }
    
    const imageBuffers = imageFiles.map(f => f.buffer);
    let pageStructure;
    
    try {
      pageStructure = await analyzeWithVision(scraped, imageBuffers);
      console.log('✅ Vision done:', { title: pageStructure.title, benefits: pageStructure.benefits?.length });
    } catch (visionError) {
      console.error('❌ Vision analysis failed:', visionError.message);
      throw new Error(`Vision analysis failed: ${visionError.message}`);
    }

    // Safety check before accessing pageStructure properties
    if (!pageStructure) {
      throw new Error('Failed to generate valid page structure from vision analysis');
    }

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

    // ── Step 3.5: Generate marketing images with gpt-image-1 ─────────────────────
    console.log('🎨 Step 3.5: Generating marketing images...');
    
    // Safety check for benefits array
    if (!pageStructure.benefits || !Array.isArray(pageStructure.benefits)) {
      throw new Error('Invalid page structure: benefits array is missing or not an array');
    }
    
    console.log('🐛 pageStructure.benefits length:', pageStructure.benefits?.length);
    console.log('🐛 imageFiles length:', imageFiles?.length);
    
    const marketingImages = [];
    const maxImages = Math.min(pageStructure.benefits?.length || 0, imageFiles?.length || 0);
    console.log('🐛 maxImages:', maxImages);
    
    for (let i = 0; i < maxImages; i++) {
      // Safety check for benefit existence
      const benefit = pageStructure.benefits[i];
      if (!benefit) {
        console.warn(`⚠️ Benefit ${i} is undefined, skipping`);
        continue;
      }
      
      const baseImage = imageFiles[i];
      
      console.log(`🐛 Processing benefit ${i}:`, {
        hasBenefit: !!benefit,
        hasImagePrompt: !!benefit?.image_prompt,
        hasBaseImage: !!baseImage
      });
      
      if (benefit.image_prompt && baseImage) {
        try {
          console.log(`🎨 Generating marketing image ${i + 1} for: "${benefit.benefit_title}"`);
          
          // Generate image using the prompt from GPT-5.2
          const openai = getOpenAI();
          let generatedImage;
          
          try {
            const response = await openai.images.generate({
              model: 'gpt-image-1',
              prompt: benefit.image_prompt,
              n: 1,
              size: '1024x1024',
              quality: 'hd'
            });
            
            generatedImage = response.data[0];
            
            if (!generatedImage || !generatedImage.url) {
              throw new Error('No image generated from OpenAI');
            }
          } catch (imageError) {
            console.warn(`⚠️ Failed to generate image for benefit ${i + 1}:`, imageError.message);
            throw imageError;
          }
          
          // Upload generated image to R2
          const imageUrl = await uploadImage(
            Buffer.from(generatedImage.url.split(',')[1], 'base64'),
            `marketing-${i + 1}-${Date.now()}.png`,
            {
              workspaceId: req.workspaceId,
              uploadedBy: userId,
              mimeType: 'image/png'
            }
          );
          
          if (imageUrl?.url) {
            marketingImages.push({
              ...benefit,
              generated_image_url: imageUrl.url,
              original_image_url: realPhotos[i] || null
            });
            console.log(`✅ Marketing image ${i + 1} uploaded successfully`);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to generate marketing image ${i + 1}:`, error.message);
          // Fallback: use original image
          marketingImages.push({
            ...benefit,
            generated_image_url: realPhotos[i] || null,
            original_image_url: realPhotos[i] || null
          });
        }
      } else {
        // Fallback: use original image
        marketingImages.push({
          ...benefit,
          generated_image_url: realPhotos[i] || null,
          original_image_url: realPhotos[i] || null
        });
      }
    }

    // ── Step 4: Assemble final product with new structure ─────────────────────
    console.log('✅ Step 4: Assembling product page');

    // Safety check before accessing pageStructure properties
    if (!pageStructure || typeof pageStructure !== 'object') {
      throw new Error('Invalid page structure: not an object');
    }

    const productPage = {
      title: pageStructure?.title || scraped?.title || '',
      hook: pageStructure?.hook || '',
      benefits: marketingImages || [],
      heroImage: realPhotos[0] || null,
      realPhotos,
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
    console.error('❌ Stack trace:', error.stack);
    
    // Debug variables with safety checks
    console.error('🐛 Debug info:', {
      imageFilesLength: imageFiles?.length,
      pageStructureBenefitsLength: pageStructure?.benefits?.length,
      scrapedTitle: !!scraped?.title,
      realPhotosLength: realPhotos?.length,
      marketingImagesLength: marketingImages?.length,
      pageStructureExists: !!pageStructure,
      pageStructureType: typeof pageStructure
    });
    
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
