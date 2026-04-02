/**
 * Creative Image Generator for African Market
 * POST /api/ecom/ai/creative-generator
 * 
 * Flow: URL → scrape page images + Gemini extract → Groq marketing analysis
 *       → image-to-image generation (product photo as reference)
 */

import express from 'express';
import axios from 'axios';
import Groq from 'groq-sdk';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import { generateNanoBananaImage, generateNanoBananaImageToImage } from '../services/nanoBananaService.js';
import { uploadImage } from '../services/cloudflareImagesService.js';
import { extractProductInfo } from '../services/geminiProductExtractor.js';

const router = express.Router();

let _groq = null;
function getGroq() {
  if (!_groq && process.env.GROQ_API_KEY) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

// ── African market creative styles ────────────────────────────────────────────
const CREATIVE_FORMATS = [
  {
    id: 'promo-story',
    label: 'Story Promo (9:16)',
    aspectRatio: '9:16',
    description: 'Story Instagram/WhatsApp promotionnelle pour le marché africain',
  },
  {
    id: 'post-carre',
    label: 'Post Carré (1:1)',
    aspectRatio: '1:1',
    description: 'Post carré Facebook/Instagram pour le marché africain',
  },
  {
    id: 'banniere-fb',
    label: 'Bannière FB (16:9)',
    aspectRatio: '16:9',
    description: 'Bannière Facebook cover ou publicité horizontale',
  },
  {
    id: 'whatsapp-status',
    label: 'WhatsApp Status (9:16)',
    aspectRatio: '9:16',
    description: 'Visuel percutant pour statut WhatsApp, style africain',
  },
];

/**
 * Scrape site via Gemini + marketing analysis via Groq
 */
async function analyzeWebsite(url) {
  // Step 1: Extract product info from URL (uses Gemini with model fallback)
  console.log('📊 Extracting product info from URL via Gemini...');
  let productInfo;
  try {
    productInfo = await extractProductInfo(url);
    console.log('✅ Gemini extraction:', productInfo?.title || 'unknown');
  } catch (err) {
    console.warn('⚠️ Gemini extraction failed, using URL context:', err.message);
    // Fallback: extract from URL 
    const urlParts = new URL(url);
    productInfo = {
      title: urlParts.hostname.replace(/^www\./, '').split('.')[0],
      description: `Site web: ${url}`,
    };
  }

  // Step 2: Marketing analysis via Groq
  const groq = getGroq();
  if (!groq) throw new Error('Clé GROQ_API_KEY non configurée');

  const prompt = `Tu es un expert marketing e-commerce spécialisé dans le marché africain (Afrique francophone et anglophone).

Voici les informations extraites d'un site/produit:
- URL: ${url}
- Nom: ${productInfo.title || 'Inconnu'}
- Description: ${(productInfo.description || '').slice(0, 1500)}

Retourne un JSON avec EXACTEMENT cette structure:
{
  "productName": "Nom du produit ou de la marque",
  "category": "Catégorie (beauté, santé, tech, mode, maison, etc.)",
  "shortDescription": "Description courte percutante (1 phrase)",
  "keyBenefits": ["Bénéfice 1", "Bénéfice 2", "Bénéfice 3"],
  "targetAudience": "Public cible africain",
  "emotionalHook": "Accroche émotionnelle puissante pour l'Afrique",
  "priceRange": "Gamme de prix si visible (en FCFA de préférence)",
  "brandColors": "Couleurs dominantes du site si visibles",
  "promoAngle": "Angle promotionnel recommandé (ex: livraison gratuite, offre limitée, résultats garantis)",
  "slogans": [
    "Slogan 1 — percutant et africain",
    "Slogan 2 — avec urgence",
    "Slogan 3 — social proof"
  ]
}

IMPORTANT:
- Adapte les slogans au contexte culturel africain (références locales, paiement à la livraison, WhatsApp, etc.)
- Utilise un ton direct, émotionnel et persuasif
- Retourne UNIQUEMENT le JSON`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'Tu es un expert copywriting e-commerce Afrique. Retourne uniquement du JSON valide.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 2000,
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '{}';
  let cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Réponse Groq invalide');
  cleaned = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(cleaned);
  }
}

/**
 * Build image prompt — focused on product benefits illustration, minimal text
 */
function buildCreativePrompt(analysis, format, hasRefImage) {
  const { productName, category, keyBenefits, brandColors } = analysis;
  const benefitsText = (keyBenefits || []).slice(0, 3).join(', ');

  const layoutMap = {
    'promo-story': 'vertical mobile story layout (9:16), product centered, benefits icons around it, subtle gradient background',
    'post-carre': 'square social media ad (1:1), product hero shot centered, clean modern layout, lifestyle context',
    'banniere-fb': 'wide horizontal banner ad (16:9), product on the right, benefits visuals on the left, professional layout',
    'whatsapp-status': 'vertical mobile format (9:16), bold product showcase, vibrant eye-catching design, maximum visual impact',
  };

  const basePrompt = hasRefImage
    ? `Transform this product photo into a professional e-commerce advertising creative for the African market.

Use the provided product image as the MAIN visual element. Enhance it for advertising:
- Place the product prominently in the composition
- Add a premium, clean background (gradient or lifestyle setting)
- Show the product benefits visually: ${benefitsText}
- Add subtle visual cues (icons, arrows, glow effects) to highlight quality`
    : `Create a professional e-commerce advertising creative for the African market.

PRODUCT: ${productName} (${category || 'e-commerce'})
- Illustrate the product and its benefits visually: ${benefitsText}
- Create a realistic product visualization based on the category`;

  return `${basePrompt}

LAYOUT: ${layoutMap[format.id] || layoutMap['post-carre']}

CRITICAL DESIGN RULES:
- MINIMAL TEXT on the image — only the product name "${productName}" in small elegant typography if needed
- NO large text blocks, NO paragraphs, NO long slogans overlaid
- Focus on VISUAL storytelling — show benefits through imagery, not words
- Premium advertising aesthetic — think Apple/Samsung ad quality
- Vibrant but tasteful color palette (${brandColors || 'modern African-inspired: gold, emerald, warm tones'})
- Clean composition with breathing space
- Product must be the hero — 60-70% of the visual focus
- Lifestyle context that resonates with African consumers
- Professional lighting and shadows for depth
- NO cluttered design, NO text-heavy layouts
- The image should work as a Facebook/Instagram ad or WhatsApp status

FORMAT: ${format.description}`;
}

/**
 * Scrape product images from URL
 */
async function scrapeProductImage(url) {
  try {
    console.log('🔍 Scraping product image from:', url);
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      maxRedirects: 5,
    });
    const html = response.data;
    if (typeof html !== 'string') return null;

    // Extract image URLs from common e-commerce patterns
    const imagePatterns = [
      // Open Graph image (most reliable for product pages)
      /property="og:image"\s+content="([^"]+)"/i,
      /content="([^"]+)"\s+property="og:image"/i,
      // Twitter card
      /name="twitter:image"\s+content="([^"]+)"/i,
      // Alibaba / AliExpress specific
      /data-src="(https:\/\/[^"]*alicdn\.com[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
      /src="(https:\/\/[^"]*alicdn\.com[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
      // Generic product image patterns
      /class="[^"]*product[^"]*image[^"]*"[^>]*src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
      /src="([^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"[^>]*class="[^"]*product/i,
      /id="[^"]*product[^"]*"[^>]*src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
      // JSON-LD structured data
      /"image"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
      /"image"\s*:\s*\[\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
      // Large images likely to be product images
      /src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"[^>]*(?:width|height)="[3-9]\d{2,}/i,
    ];

    let imageUrl = null;
    for (const pattern of imagePatterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        imageUrl = match[1];
        break;
      }
    }

    if (!imageUrl) {
      // Last resort: find any large image
      const allImages = [...html.matchAll(/src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"/gi)];
      // Filter out icons, logos, tiny images
      const candidates = allImages
        .map(m => m[1])
        .filter(u => !/(icon|logo|favicon|sprite|pixel|tracking|badge|flag)/i.test(u))
        .filter(u => !/(1x1|2x2|10x10|\.gif)/i.test(u));
      if (candidates.length > 0) imageUrl = candidates[0];
    }

    if (!imageUrl) {
      console.warn('⚠️ No product image found in HTML');
      return null;
    }

    // Resolve relative URLs
    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
    else if (imageUrl.startsWith('/')) {
      const base = new URL(url);
      imageUrl = base.origin + imageUrl;
    }

    console.log('📸 Found product image:', imageUrl.slice(0, 120));

    // Download the image as buffer
    const imgResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': url,
      },
    });

    const buffer = Buffer.from(imgResponse.data);
    if (buffer.length < 1000) {
      console.warn('⚠️ Image too small, likely not a product image');
      return null;
    }

    console.log(`✅ Product image downloaded: ${Math.round(buffer.length / 1024)}KB`);
    return buffer;
  } catch (err) {
    console.warn('⚠️ Failed to scrape product image:', err.message);
    return null;
  }
}

// ── POST /api/ecom/ai/creative-generator ──────────────────────────────────────
router.post('/', requireEcomAuth, async (req, res) => {
  try {
    const { url, formats } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL requise' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'URL invalide. Entrez une URL complète (ex: https://monsite.com)' });
    }

    // Select formats
    const selectedFormats = formats?.length > 0
      ? CREATIVE_FORMATS.filter(f => formats.includes(f.id))
      : CREATIVE_FORMATS.slice(0, 2); // Default: story + carré

    console.log(`🎨 Creative Generator: ${url} → ${selectedFormats.map(f => f.id).join(', ')}`);

    // Step 1: Scrape product image + extract info in parallel
    console.log('📊 Step 1: Scraping image + analyzing website...');
    const [productImageBuffer, analysis] = await Promise.all([
      scrapeProductImage(url),
      analyzeWebsite(url),
    ]);
    console.log('✅ Analysis done:', analysis.productName, productImageBuffer ? `(image: ${Math.round(productImageBuffer.length / 1024)}KB)` : '(no image)');

    // Step 2: Generate creatives using image-to-image if we have a product image
    console.log(`🖼️ Step 2: Generating ${selectedFormats.length} creative(s)${productImageBuffer ? ' with product image reference' : ' (text-to-image)'}...`);
    const creatives = [];

    for (const format of selectedFormats) {
      try {
        const imagePrompt = buildCreativePrompt(analysis, format, !!productImageBuffer);
        console.log(`  🎨 Generating ${format.id} (${format.aspectRatio})...`);
        
        let imageDataUrl;
        if (productImageBuffer) {
          // Image-to-image: use the scraped product photo as reference
          imageDataUrl = await generateNanoBananaImageToImage(imagePrompt, productImageBuffer, format.aspectRatio, 1);
        } else {
          // Fallback: text-to-image only
          imageDataUrl = await generateNanoBananaImage(imagePrompt, format.aspectRatio, 1);
        }
        
        if (imageDataUrl) {
          // Upload to Cloudflare R2
          let finalUrl = imageDataUrl;
          try {
            const uploaded = await uploadImage(imageDataUrl);
            if (uploaded?.url) finalUrl = uploaded.url;
          } catch (uploadErr) {
            console.warn('⚠️ Upload R2 failed, returning base64:', uploadErr.message);
          }

          creatives.push({
            id: format.id,
            label: format.label,
            aspectRatio: format.aspectRatio,
            imageUrl: finalUrl,
            usedProductImage: !!productImageBuffer,
          });
          console.log(`  ✅ ${format.id} generated`);
        } else {
          creatives.push({
            id: format.id, label: format.label, aspectRatio: format.aspectRatio,
            imageUrl: null, error: 'Génération échouée',
          });
          console.warn(`  ❌ ${format.id} failed`);
        }
      } catch (imgErr) {
        console.error(`  ❌ ${format.id} error:`, imgErr.message);
        creatives.push({
          id: format.id, label: format.label, aspectRatio: format.aspectRatio,
          imageUrl: null, error: imgErr.message,
        });
      }
    }

    res.json({
      success: true,
      analysis,
      creatives,
      formats: CREATIVE_FORMATS,
      productImageFound: !!productImageBuffer,
    });
  } catch (err) {
    console.error('❌ Creative Generator error:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la génération' });
  }
});

// ── GET /api/ai/creative-generator/formats ────────────────────────────────────
router.get('/formats', requireEcomAuth, async (_req, res) => {
  res.json({ formats: CREATIVE_FORMATS });
});

export default router;
