/**
 * Creative Image Generator — Premium Listing Images
 * POST /api/ecom/ai/creative-generator
 * 
 * Flow: User uploads product image + (URL or description)
 *       → Groq marketing analysis → image-to-image generation (6 slide types)
 */

import express from 'express';
import axios from 'axios';
import multer from 'multer';
import Groq from 'groq-sdk';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import { generateNanoBananaImage, generateNanoBananaImageToImage, getImageGenerationStats } from '../services/nanoBananaService.js';
import { uploadImage } from '../services/cloudflareImagesService.js';
import { extractProductInfo } from '../services/geminiProductExtractor.js';

// Slides qui incluent la photo produit dans le visuel
const SLIDES_WITH_PRODUCT_IMAGE = new Set(['benefits', 'how-to-use', 'trust', 'comparison', 'social-proof']);

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont acceptées'));
  },
});

let _groq = null;
function getGroq() {
  if (!_groq && process.env.GROQ_API_KEY) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

// ── Premium Listing Image Slide Types ─────────────────────────────────────────
const CREATIVE_FORMATS = [
  {
    id: 'hero-benefits',
    label: 'Bénéfices Clés',
    aspectRatio: '1:1',
    slideType: 'benefits',
    description: 'Produit centré + icônes bénéfices autour (style "Potent & Effective")',
  },
  {
    id: 'target-promise',
    label: 'Cible & Promesse',
    aspectRatio: '1:1',
    slideType: 'target',
    description: 'Public cible + produit + promesse de transformation',
  },
  {
    id: 'problem-solution',
    label: 'Problème / Solution',
    aspectRatio: '1:1',
    slideType: 'problem-solution',
    description: 'Le problème du client → le produit comme solution',
  },
  {
    id: 'how-to-use',
    label: 'Comment Utiliser',
    aspectRatio: '1:1',
    slideType: 'how-to-use',
    description: 'Mode d\'emploi étape par étape + lifestyle photo',
  },
  {
    id: 'ingredients-trust',
    label: 'Confiance & Qualité',
    aspectRatio: '1:1',
    slideType: 'trust',
    description: 'Badges certifications (GMO Free, Paraben Free, etc.)',
  },
  {
    id: 'comparison',
    label: 'Comparaison',
    aspectRatio: '1:1',
    slideType: 'comparison',
    description: 'Notre produit vs Autres — tableau ✓ / ✗',
  },
  {
    id: 'social-proof',
    label: 'Preuve Sociale',
    aspectRatio: '1:1',
    slideType: 'social-proof',
    description: 'Plusieurs clients satisfaits avec le produit',
  },
];

/**
 * Marketing analysis via Groq — accepts URL, description, or both
 */
async function analyzeProduct({ url, description }) {
  let productInfo = { title: '', description: description || '' };

  // If URL provided, try to extract info from it
  if (url) {
    try {
      console.log('📊 Extracting product info from URL via Gemini...');
      const extracted = await extractProductInfo(url);
      productInfo.title = extracted?.title || '';
      productInfo.description = (description ? description + '\n\n' : '') + (extracted?.description || '');
      console.log('✅ Gemini extraction:', productInfo.title || 'unknown');
    } catch (err) {
      console.warn('⚠️ Gemini extraction failed:', err.message);
      if (!description) {
        const urlParts = new URL(url);
        productInfo.title = urlParts.pathname.split('/').pop()?.replace(/[-_]/g, ' ') || urlParts.hostname;
        productInfo.description = `Produit trouvé sur: ${url}`;
      }
    }
  }

  if (!productInfo.title && !productInfo.description) {
    throw new Error('Veuillez fournir un lien produit OU une description');
  }

  // Marketing analysis via Groq
  const groq = getGroq();
  if (!groq) throw new Error('Clé GROQ_API_KEY non configurée');

  const contextParts = [];
  if (url) contextParts.push(`- URL: ${url}`);
  if (productInfo.title) contextParts.push(`- Nom: ${productInfo.title}`);
  contextParts.push(`- Description: ${(productInfo.description || '').slice(0, 2000)}`);

  const prompt = `Tu es un expert marketing e-commerce spécialisé dans le marché africain (Afrique francophone et anglophone).

Voici les informations du produit:
${contextParts.join('\n')}

Retourne un JSON avec EXACTEMENT cette structure:
{
  "productName": "Nom du produit ou de la marque",
  "category": "Catégorie (beauté, santé, tech, mode, maison, etc.)",
  "shortDescription": "Description courte percutante (1 phrase)",
  "keyBenefits": ["Bénéfice 1", "Bénéfice 2", "Bénéfice 3", "Bénéfice 4", "Bénéfice 5"],
  "painPoints": ["Situation quotidienne 1 où le client a besoin du produit", "Situation 2", "Situation 3", "Situation 4"],
  "usageSteps": ["Étape 1 d'utilisation CONCRÈTE du produit (ex: 'Ouvrir le sachet')", "Étape 2 (ex: 'Appliquer/Prendre')", "Étape 3 (ex: 'Profiter des résultats')"],
  "targetAudience": "Public cible africain",
  "emotionalHook": "Accroche émotionnelle puissante pour l'Afrique",
  "priceRange": "Gamme de prix si visible (en FCFA de préférence)",
  "brandColors": "Palette de couleurs idéale pour ce produit (ex: 'bleu lavande doux', 'vert menthe', 'orange chaud'). TOUJOURS proposer une palette même si pas visible",
  "promoAngle": "Angle promotionnel recommandé",
  "slogans": [
    "Slogan 1 — percutant",
    "Slogan 2 — avec urgence",
    "Slogan 3 — social proof"
  ]
}

IMPORTANT:
- Les painPoints sont des SITUATIONS QUOTIDIENNES où le client a besoin du produit (ex pour des patchs sommeil: "Après un voyage", "Surcharge d'écrans", "Pensées qui tournent", "Esprit surmené"). Ce sont des MOMENTS DE VIE reconnaissables, pas des symptômes médicaux
- Les usageSteps doivent être 3 étapes SIMPLES et CONCRÈTES propres à CE produit (ex: "Ouvrir", "Appliquer", "Profiter")
- Les keyBenefits doivent être des avantages SPÉCIFIQUES au produit, pas des banalités
- Adapte au contexte culturel africain
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
 * Build image prompt — ULTRA SHORT ≤200 chars
 * Coût ÷4 vs prompts longs. Décrit le VISUEL seulement.
 */
function buildCreativePrompt(analysis, format, hasRefImage) {
  const { productName, keyBenefits, painPoints, usageSteps, targetAudience, brandColors } = analysis;
  const name = productName || 'produit';
  const b = (keyBenefits || []).slice(0, 3).join(', ') || 'efficace, naturel, premium';
  const problems = (painPoints || []).slice(0, 2).join(', ') || 'fatigue, stress';
  const steps = (usageSteps || []).slice(0, 3);
  const accent = brandColors || 'lavande doux';
  const audience = targetAudience || 'personne africaine';

  const needsProduct = SLIDES_WITH_PRODUCT_IMAGE.has(format.slideType);
  const productRef = needsProduct && hasRefImage ? 'Utilise cette photo produit.' : '';

  const slidePrompts = {
    'benefits': `${productRef} Listing carré 1:1. 3 colonnes: GAUCHE ${audience} fatiguée "${problems}" fond sombre, CENTRE produit "${name}" grand sur fond blanc, DROITE ${audience} souriante "${b}" fond lumineux. Flèche problème→produit→solution. Titre bold haut.`,

    'social-proof': `${productRef} Listing carré 1:1. Fond ${accent} pastel. Titre bold noir "ILS NOUS FONT CONFIANCE". Grille 2x2: 4 photos ${audience} souriants tenant le produit "${name}". Chaque photo dans carte blanche arrondie. Étoiles ★★★★★ sous chaque photo.`,

    'target': `Listing carré. Fond blanc. SANS produit. Gauche: titre bold "POURQUOI L'ADORER" + icônes ${b}. Droite: ${audience} épanouie lifestyle. Français.`,

    'problem-solution': `Listing carré. Fond ${accent} pastel. SANS produit. Titre bold. Grille 2x2 photos lifestyle: ${problems}. Cartes label blanc. Français.`,

    'how-to-use': `${productRef} Listing carré. Fond ${accent}. Titre bold blanc "MODE D'EMPLOI". 3 étapes cartes blanches: ${steps.map((s,i) => `${i+1}.${s}`).join(' ')}. Produit petit en bas.`,

    'trust': `${productRef} Listing carré. Fond blanc. Titre bold "FORMULÉ PAR LA NATURE". Produit centré grand. 4 callouts: ${b}. Badges: Sans OGM, Naturel, Premium. Français.`,

    'comparison': `${productRef} Listing carré. Fond blanc. Titre bold "POURQUOI ${name.toUpperCase()} GAGNE". Tableau 6 lignes ✓/✗ notre produit gagne. En-têtes ${accent}. Français.`,
  };

  return (slidePrompts[format.slideType] || slidePrompts['benefits']) + '\nImage carrée 1:1. Texte FRANÇAIS.';
}

/**
 * Scrape product images from URL — aggressive multi-pattern extraction
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

    console.log(`📄 HTML fetched: ${html.length} chars`);

    let imageUrl = null;

    // ── Priority 1: Open Graph / Twitter meta tags ──
    const ogPatterns = [
      /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
      /name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
      /content=["']([^"']+)["'][^>]*name=["']twitter:image/i,
    ];
    for (const p of ogPatterns) {
      const m = html.match(p);
      if (m?.[1] && m[1].length > 10) { imageUrl = m[1]; console.log('📸 Found via OG/meta:', imageUrl.slice(0, 100)); break; }
    }

    // ── Priority 2: JSON-LD structured data (schema.org Product) ──
    if (!imageUrl) {
      const jsonLdBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      for (const block of jsonLdBlocks) {
        try {
          const data = JSON.parse(block[1]);
          const imgField = data?.image || data?.['@graph']?.find(g => g.image)?.image;
          if (imgField) {
            imageUrl = Array.isArray(imgField) ? imgField[0] : (typeof imgField === 'object' ? imgField.url : imgField);
            if (imageUrl) { console.log('📸 Found via JSON-LD:', imageUrl.slice(0, 100)); break; }
          }
        } catch {}
      }
    }

    // ── Priority 3: Inline JSON / __NEXT_DATA__ / window.__DATA__ etc ──
    if (!imageUrl) {
      // Look for image URLs in any embedded JSON/JS data
      const dataPatterns = [
        /"(?:image|img|photo|picture|thumbnail|src|url)":\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi,
        /"(?:image|img|photo|picture|thumbnail|src|url)":\s*"(https?:\/\/[^"]+\/[^"]*(?:product|item|img|image|upload|media)[^"]*)"/gi,
        // Cloudflare Images / R2 / imagedelivery
        /"(https?:\/\/(?:pub-|imagedelivery\.net|[^"]*\.r2\.dev)[^"]+)"/gi,
        // Shopify CDN
        /"(https?:\/\/cdn\.shopify\.com\/[^"]+)"/gi,
      ];
      for (const p of dataPatterns) {
        const matches = [...html.matchAll(p)];
        const candidate = matches.map(m => m[1]).find(u =>
          !/(icon|logo|favicon|sprite|pixel|tracking|badge|flag|avatar|placeholder)/i.test(u) &&
          u.length > 20
        );
        if (candidate) { imageUrl = candidate; console.log('📸 Found via inline data:', imageUrl.slice(0, 100)); break; }
      }
    }

    // ── Priority 4: Alibaba / AliExpress / 1688 specific ──
    if (!imageUrl) {
      const aliPatterns = [
        /(?:data-src|src)=["'](https?:\/\/[^"']*(?:alicdn|cbu01|sc04)\.com[^"']*)["']/i,
        /"(?:imageUrl|mainImage|imgUrl)":\s*"([^"]+)"/i,
      ];
      for (const p of aliPatterns) {
        const m = html.match(p);
        if (m?.[1]) { imageUrl = m[1]; console.log('📸 Found via Alibaba pattern:', imageUrl.slice(0, 100)); break; }
      }
    }

    // ── Priority 5: src/srcset on img tags ──
    if (!imageUrl) {
      // All img src= and srcset= URLs
      const allSrc = [
        ...html.matchAll(/src=["'](https?:\/\/[^"']+)["']/gi),
        ...html.matchAll(/srcset=["']([^"']+)["']/gi),
        ...html.matchAll(/data-src=["'](https?:\/\/[^"']+)["']/gi,),
        ...html.matchAll(/data-lazy-src=["'](https?:\/\/[^"']+)["']/gi),
        ...html.matchAll(/data-original=["'](https?:\/\/[^"']+)["']/gi),
      ];
      
      // From srcset, extract the first URL
      const candidates = allSrc.flatMap(m => {
        const val = m[1];
        if (val.includes(',')) return val.split(',').map(s => s.trim().split(/\s+/)[0]);
        return [val.split(/\s+/)[0]];
      }).filter(u =>
        /^https?:\/\//i.test(u) &&
        !/(icon|logo|favicon|sprite|pixel|tracking|badge|flag|avatar|placeholder|\.svg|\.gif|1x1|data:)/i.test(u) &&
        u.length > 20
      );

      // Prefer URLs that look like product images
      const productCandidate = candidates.find(u =>
        /(product|item|img|image|upload|media|photo|cdn|pub-|r2\.dev|imagedelivery)/i.test(u)
      );
      imageUrl = productCandidate || candidates[0] || null;
      if (imageUrl) console.log('📸 Found via img src/srcset:', imageUrl.slice(0, 100));
    }

    // ── Priority 6: background-image in style attributes ──
    if (!imageUrl) {
      const bgMatch = html.match(/background-image:\s*url\(["']?(https?:\/\/[^"')]+)["']?\)/i);
      if (bgMatch?.[1]) { imageUrl = bgMatch[1]; console.log('📸 Found via background-image:', imageUrl.slice(0, 100)); }
    }

    if (!imageUrl) {
      console.warn('⚠️ No product image found in HTML after all strategies');
      return null;
    }

    // Resolve relative / protocol-relative URLs
    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
    else if (imageUrl.startsWith('/')) {
      const base = new URL(url);
      imageUrl = base.origin + imageUrl;
    }

    console.log('📸 Downloading product image:', imageUrl.slice(0, 120));

    // Download the image as buffer — retry with fallback candidates if too small
    const tryDownload = async (imgUrl) => {
      try {
        let resolvedUrl = imgUrl;
        if (resolvedUrl.startsWith('//')) resolvedUrl = 'https:' + resolvedUrl;
        else if (resolvedUrl.startsWith('/')) resolvedUrl = new URL(url).origin + resolvedUrl;

        const imgResponse = await axios.get(resolvedUrl, {
          responseType: 'arraybuffer',
          timeout: 20000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': url,
            'Accept': 'image/*,*/*',
          },
        });
        const buffer = Buffer.from(imgResponse.data);
        // Check content-type is actually an image
        const ct = imgResponse.headers?.['content-type'] || '';
        if (ct && !ct.startsWith('image/')) {
          console.warn(`⚠️ Not an image (${ct}): ${resolvedUrl.slice(0, 80)}`);
          return null;
        }
        if (buffer.length < 2000) {
          console.warn(`⚠️ Image too small (${buffer.length}B), skipping: ${resolvedUrl.slice(0, 80)}`);
          return null;
        }
        return buffer;
      } catch (e) {
        console.warn(`⚠️ Download failed: ${e.message}`);
        return null;
      }
    };

    // Try main candidate first
    let buffer = await tryDownload(imageUrl);

    // If too small or failed, try all other candidates collected from img src
    if (!buffer) {
      console.log('🔄 Main image failed, trying fallback candidates...');
      const allSrc = [
        ...html.matchAll(/src=["'](https?:\/\/[^"']+)["']/gi),
        ...html.matchAll(/data-src=["'](https?:\/\/[^"']+)["']/gi),
      ];
      const fallbacks = allSrc.map(m => m[1]).filter(u =>
        !/(icon|logo|favicon|sprite|pixel|tracking|badge|flag|avatar|placeholder|\.svg|\.gif|1x1|data:)/i.test(u) &&
        u !== imageUrl && u.length > 20
      );
      // Prefer product-looking URLs
      fallbacks.sort((a, b) => {
        const scoreA = /(product|item|upload|media|photo|cdn|pub-|r2\.dev|imagedelivery)/i.test(a) ? 0 : 1;
        const scoreB = /(product|item|upload|media|photo|cdn|pub-|r2\.dev|imagedelivery)/i.test(b) ? 0 : 1;
        return scoreA - scoreB;
      });
      for (const fb of fallbacks.slice(0, 5)) {
        console.log(`  🔄 Trying fallback: ${fb.slice(0, 80)}`);
        buffer = await tryDownload(fb);
        if (buffer) break;
      }
    }

    if (!buffer) {
      console.warn('⚠️ All image candidates failed or too small');
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
router.post('/', requireEcomAuth, upload.single('productImage'), async (req, res) => {
  try {
    const { url, description, formats: formatsRaw } = req.body;
    const formats = typeof formatsRaw === 'string' ? JSON.parse(formatsRaw) : formatsRaw;
    const productImageBuffer = req.file?.buffer || null;

    // Require at least image OR (url OR description)
    if (!productImageBuffer && !url && !description) {
      return res.status(400).json({ error: 'Veuillez fournir une image produit et/ou un lien ou une description' });
    }

    // Validate URL if provided
    if (url) {
      try { new URL(url); } catch {
        return res.status(400).json({ error: 'URL invalide. Entrez une URL complète (ex: https://alibaba.com/produit)' });
      }
    }

    // Select formats
    const selectedFormats = formats?.length > 0
      ? CREATIVE_FORMATS.filter(f => formats.includes(f.id))
      : CREATIVE_FORMATS;

    console.log(`🎨 Creative Generator: image=${!!productImageBuffer} url=${url || 'none'} desc=${description ? 'yes' : 'no'} → ${selectedFormats.map(f => f.id).join(', ')}`);

    // Step 1: Marketing analysis
    console.log('📊 Step 1: Analyse marketing...');
    const analysis = await analyzeProduct({ url, description });
    console.log('✅ Analysis done:', analysis.productName);

    // Step 2: Generate creatives — smart image usage
    const hasImage = !!productImageBuffer;
    console.log(`🖼️ Step 2: Génération de ${selectedFormats.length} créa(s)${hasImage ? ' avec image produit' : ' (text-to-image)'}...`);
    const creatives = [];
    const statsBefore = getImageGenerationStats();

    for (const format of selectedFormats) {
      try {
        const imagePrompt = buildCreativePrompt(analysis, format, hasImage);
        const useProductImage = hasImage && SLIDES_WITH_PRODUCT_IMAGE.has(format.slideType);
        console.log(`  🎨 Generating ${format.id} (${useProductImage ? 'image-to-image' : 'text-only'})...`);
        
        let imageDataUrl;
        if (useProductImage) {
          imageDataUrl = await generateNanoBananaImageToImage(imagePrompt, productImageBuffer, format.aspectRatio, 1);
        } else {
          imageDataUrl = await generateNanoBananaImage(imagePrompt, format.aspectRatio, 1);
        }
        
        if (imageDataUrl) {
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
            usedProductImage: hasImage,
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

    // Calculate cost for this generation batch
    const statsAfter = getImageGenerationStats();
    const batchCost = {
      images: statsAfter.totalImages - statsBefore.totalImages,
      costUsd: +(statsAfter.totalCostUsd - statsBefore.totalCostUsd).toFixed(3),
      costFcfa: statsAfter.totalCostFcfa - statsBefore.totalCostFcfa,
    };
    console.log(`💰 Batch total: ${batchCost.images} images → ~$${batchCost.costUsd} (~${batchCost.costFcfa} FCFA)`);

    res.json({
      success: true,
      analysis,
      creatives,
      formats: CREATIVE_FORMATS,
      productImageFound: hasImage,
      cost: batchCost,
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
