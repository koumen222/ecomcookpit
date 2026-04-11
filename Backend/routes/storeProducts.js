import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import StoreProduct from '../models/StoreProduct.js';
import Product from '../models/Product.js';
import { requireEcomAuth, requireWorkspace } from '../middleware/ecomAuth.js';
import { requireStoreOwner } from '../middleware/storeAuth.js';
import { uploadImage, isConfigured } from '../services/cloudflareImagesService.js';
import OpenAI from 'openai';

let openai = null;
const getOpenAI = () => {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
};

const router = express.Router();

/**
 * Build a product filter scoped to the active store.
 * Strict: only returns products belonging to the active store.
 */
function buildStoreFilter(req) {
  const base = { workspaceId: req.workspaceId };
  if (req.activeStoreId) {
    return { ...base, storeId: req.activeStoreId };
  }
  return base;
}

// Configure multer for memory storage (files uploaded to Cloudflare, not local disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 5 // Max 5 files per upload
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD ROUTES (authenticated, workspace-scoped)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /store-products
 * List all store products for the current workspace (dashboard).
 * Supports pagination: ?page=1&limit=20&category=&search=
 */
router.get('/', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search, isPublished } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    // Build filter — scoped to active store
    const filter = buildStoreFilter(req);
    if (category) filter.category = category;
    if (isPublished !== undefined) filter.isPublished = isPublished === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    const [products, total] = await Promise.all([
      StoreProduct.findPaginated(filter, { page: pageNum, limit: limitNum }),
      StoreProduct.countForFilter(filter)
    ]);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Erreur GET /store-products:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * GET /store-products/categories/list
 * Get unique categories for current workspace.
 * MUST be defined before /:id to avoid Express matching "categories" as an ID.
 */
router.get('/categories/list', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const categories = await StoreProduct.distinct('category', {
      ...buildStoreFilter(req),
      category: { $ne: '' }
    });

    res.json({ success: true, data: categories.sort() });
  } catch (error) {
    console.error('Erreur GET /store-products/categories:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * POST /store-products/upload
 * Upload product images to Cloudflare Images.
 * Returns array of uploaded image URLs with metadata.
 * Max 5 images, 5MB each.
 */
router.post(
  '/upload',
  requireEcomAuth,
  requireWorkspace,
  requireStoreOwner,
  (req, res, next) => {
    // Accept both "images" and "image" field names from frontend forms
    const uploader = upload.fields([
      { name: 'images', maxCount: 5 },
      { name: 'image', maxCount: 5 }
    ]);

    uploader(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE'
          ? 'Image too large. Max size is 5MB per file.'
          : err.code === 'LIMIT_FILE_COUNT'
            ? 'Too many files. Max 5 images per upload.'
            : err.message;
        return res.status(400).json({ success: false, message, code: err.code });
      }

      return res.status(400).json({ success: false, message: err.message || 'Invalid upload payload' });
    });
  },
  async (req, res) => {
    try {
      if (!isConfigured()) {
        return res.status(503).json({
          success: false,
          message: 'Cloudflare Images not configured',
          code: 'CLOUDFLARE_NOT_CONFIGURED'
        });
      }

      const files = [
        ...(req.files?.images || []),
        ...(req.files?.image || [])
      ];

      if (!files.length) {
        return res.status(400).json({
          success: false,
          message: 'No images provided'
        });
      }

      const uploadedImages = [];

      for (const file of files) {
        const result = await uploadImage(
          file.buffer,
          file.originalname,
          {
            workspaceId: req.workspaceId.toString(),
            uploadedBy: req.user.id,
            filename: file.originalname,
            mimeType: file.mimetype,
            width: 1200,
            height: 1200,
            quality: 82
          }
        );

        uploadedImages.push({
          id: result.id,
          url: result.url,
          key: result.key,
          filename: result.filename,
          size: result.size
        });
      }

      res.json({
        success: true,
        message: `${uploadedImages.length} image(s) uploaded`,
        data: uploadedImages
      });

    } catch (error) {
      console.error('❌ Image upload error:', error.message);
      const status = /configured/i.test(error.message)
        ? 503
        : /Cloudflare upload failed/i.test(error.message)
          ? 502
          : 500;
      res.status(status).json({
        success: false,
        message: error.message || 'Image upload failed'
      });
    }
  }
);

/**
 * POST /store-products/generate
 * Generate product fields using AI from a URL or detailed description.
 * Body: { input: string, inputType: 'url' | 'description' }
 * Returns: { name, description, category, tags, seoTitle, seoDescription, suggestedPrice, features }
 */
router.post('/generate', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const ai = getOpenAI();
    if (!ai) {
      return res.status(503).json({
        success: false,
        message: 'Génération IA non configurée. Veuillez configurer OPENAI_API_KEY.'
      });
    }

    const { input, inputType = 'description' } = req.body;
    if (!input?.trim()) {
      return res.status(400).json({ success: false, message: 'Contenu requis (URL ou description)' });
    }

    let context = input.trim();

    // If URL: fetch and strip HTML to get plain text (max 4000 chars for token budget)
    if (inputType === 'url') {
      try {
        const { default: nodeFetch } = await import('node-fetch');
        const response = await nodeFetch(input.trim(), {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000)
        });
        const html = await response.text();
        // Strip HTML tags and condense whitespace
        context = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .substring(0, 4000);
      } catch {
        return res.status(422).json({ success: false, message: 'Impossible de récupérer la page. Essayez avec une description.' });
      }
    }

    const systemPrompt = `Tu es un expert en e-commerce. À partir du texte fourni, génère les informations d'une page produit en JSON.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication.
Format strict:
{
  "name": "Nom commercial accrocheur (max 80 chars)",
  "description": "Description persuasive pour le client final, 2-4 paragraphes, ton commercial",
  "category": "Catégorie courte (ex: Vêtements, Électronique, Beauté)",
  "tags": ["tag1", "tag2", "tag3"],
  "seoTitle": "Titre SEO optimisé (max 60 chars)",
  "seoDescription": "Méta description SEO (max 155 chars)",
  "features": ["Avantage 1", "Avantage 2", "Avantage 3"],
  "suggestedPrice": 0
}
Si le prix n'est pas mentionné, mettre 0. Répondre en français.`;

    const completion = await ai.chat.completions.create({
      model: process.env.OPENAI_MINI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context }
      ],
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    let generated;
    try {
      generated = JSON.parse(completion.choices[0].message.content);
    } catch {
      return res.status(500).json({ success: false, message: 'Réponse IA invalide, réessayez.' });
    }

    res.json({ success: true, data: generated });

  } catch (error) {
    console.error('❌ POST /store-products/generate error:', error.message);
    if (error?.status === 429) {
      return res.status(429).json({ success: false, message: 'Quota OpenAI dépassé. Réessayez plus tard.' });
    }
    res.status(500).json({ success: false, message: 'Erreur lors de la génération IA' });
  }
});

/**
 * POST /store-products/generate-reviews
 * Generate authentic product reviews (testimonials) using AI.
 * Body: { productDescription, country?, cities?, names?, count? }
 * Returns: { reviews: [{ name, text, rating, location, verified, date, source }] }
 */
router.post('/generate-reviews', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const ai = getOpenAI();
    if (!ai) {
      return res.status(503).json({
        success: false,
        message: 'Génération IA non configurée. Veuillez configurer OPENAI_API_KEY.'
      });
    }

    const { productDescription, country, cities, names, count } = req.body;
    if (!productDescription?.trim()) {
      return res.status(400).json({ success: false, message: 'Description du produit requise' });
    }

    const reviewCount = Math.max(3, Math.min(6, parseInt(count) || 4));
    const cityList = Array.isArray(cities) ? cities.filter(Boolean) : [];
    const nameList = Array.isArray(names) ? names.filter(Boolean) : [];

    const systemPrompt = `Tu es un générateur d'avis clients authentiques pour les marchés africains.
Tu génères des avis en français africain naturel, comme de vrais clients.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication.

RÈGLES STRICTES :
- Ton authentique, UGC naturel (comme un vrai client africain)
- Chaque avis fait 1 à 2 phrases maximum
- Mentionne un bénéfice concret du produit
- INTERDIT : "http", "www", "image", "photo", "lien", emojis excessifs, URLs
- Majorité de notes 4 et 5 étoiles (quelques 4 pour la crédibilité)
- Chaque avis est unique et différent des autres
${nameList.length > 0 ? `- Utilise UNIQUEMENT ces prénoms (choisis-en ${reviewCount}) : ${nameList.join(', ')}` : '- Invente des prénoms africains variés avec initiale du nom (ex: Awa D., Koffi M.)'}
${cityList.length > 0 ? `- Utilise UNIQUEMENT ces villes : ${cityList.join(', ')}` : ''}
${country ? `- Pays : ${country}` : ''}

Format JSON strict :
{
  "reviews": [
    {
      "name": "Prénom N.",
      "text": "Texte de l'avis (1-2 phrases)",
      "rating": 5,
      "location": "Ville, Pays",
      "verified": true,
      "date": "Il y a X jours"
    }
  ]
}`;

    const userPrompt = `Génère exactement ${reviewCount} avis clients authentiques pour ce produit :\n\n${productDescription.trim().slice(0, 2000)}`;

    const completion = await ai.chat.completions.create({
      model: process.env.OPENAI_MINI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    });

    let generated;
    try {
      generated = JSON.parse(completion.choices[0].message.content);
    } catch {
      return res.status(500).json({ success: false, message: 'Réponse IA invalide, réessayez.' });
    }

    // Normalize & sanitize reviews
    const reviews = (generated.reviews || []).map(r => ({
      name: String(r.name || '').slice(0, 100),
      text: String(r.text || '').replace(/https?:\/\/\S+/gi, '').slice(0, 500),
      rating: Math.max(1, Math.min(5, parseInt(r.rating) || 5)),
      location: String(r.location || '').slice(0, 100),
      verified: r.verified !== false,
      date: String(r.date || 'Récemment'),
      source: 'ai'
    }));

    res.json({ success: true, data: { reviews } });

  } catch (error) {
    console.error('❌ POST /store-products/generate-reviews error:', error.message);
    if (error?.status === 429) {
      return res.status(429).json({ success: false, message: 'Quota OpenAI dépassé. Réessayez plus tard.' });
    }
    res.status(500).json({ success: false, message: 'Erreur lors de la génération des avis' });
  }
});

/**
 * GET /store-products/system-products
 * Return main system products for the store product picker.
 * Lets the store owner pick an existing product to pre-fill name + price.
 * Supports ?search= and ?limit=
 * MUST be declared before /:id to avoid Express routing conflict.
 */
router.get('/system-products', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const { search, status, isActive, limit = 50 } = req.query;
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));

    const filter = {
      workspaceId: req.workspaceId
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { status: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length) {
        filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
      }
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const products = await Product.find(filter)
      .select('_id name sellingPrice stock status isActive createdAt')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Erreur GET /store-products/system-products:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * GET /store-products/:id
 * Get single store product (dashboard).
 */
router.get('/:id', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }

    const product = await StoreProduct.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId
    }).lean();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Erreur GET /store-products/:id:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * Normalise les témoignages : date string → Date réelle, supprime les champs invalides.
 */
function normalizeTestimonials(raw) {
  if (!Array.isArray(raw)) return undefined;
  return raw.map(t => ({
    ...t,
    image: t.image && typeof t.image === 'object' ? (t.image.url || '') : (t.image || ''),
    date: t.date ? t.date : undefined,
  }));
}

/**
 * Normalise les FAQ : mappe `reponse` → `answer`, force le champ requis.
 */
function normalizeFaq(raw) {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map(f => ({
      question: f.question || '',
      answer: f.answer || f.reponse || f.response || '',
    }))
    .filter(f => f.question && f.answer);
}

function buildSystemProductPayload({ name, price, stock, workspaceId, userId }) {
  const sellingPrice = Number(price) || 0;
  const inferredCost = sellingPrice > 0 ? Math.max(0, Math.floor(sellingPrice * 0.4)) : 0;

  return {
    workspaceId,
    createdBy: userId,
    name,
    status: 'test',
    sellingPrice,
    productCost: inferredCost,
    deliveryCost: 0,
    avgAdsCost: 0,
    stock: Number(stock) || 0,
    reorderThreshold: 10,
    isActive: true
  };
}

/**
 * POST /store-products
 * Create a new store product (dashboard).
 */
router.post('/', requireEcomAuth, requireWorkspace, requireStoreOwner, async (req, res) => {
  try {
    const {
      name, description, price, compareAtPrice, stock,
      images, category, tags, isPublished,
      seoTitle, seoDescription, linkedProductId, currency,
      targetMarket, country, city, locale,
      testimonials, faq, _pageData
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Nom et prix requis'
      });
    }

    const userId = req.user?._id || req.user?.id;
    let resolvedLinkedProductId = linkedProductId || null;
    let createdSystemProductId = null;

    if (resolvedLinkedProductId) {
      if (!mongoose.Types.ObjectId.isValid(resolvedLinkedProductId)) {
        return res.status(400).json({ success: false, message: 'Produit système lié invalide' });
      }

      const existingLinkedProduct = await Product.findOne({
        _id: resolvedLinkedProductId,
        workspaceId: req.workspaceId
      }).select('_id');

      if (!existingLinkedProduct) {
        return res.status(404).json({ success: false, message: 'Produit système lié introuvable' });
      }
    } else {
      const systemProduct = new Product(buildSystemProductPayload({
        name,
        price,
        stock,
        workspaceId: req.workspaceId,
        userId
      }));

      await systemProduct.save();
      resolvedLinkedProductId = systemProduct._id;
      createdSystemProductId = systemProduct._id;
    }

    let product;
    try {
      product = new StoreProduct({
        workspaceId: req.workspaceId,
        storeId: req.activeStoreId || null,
        name,
        description: description || '',
        price: Number(price),
        compareAtPrice: compareAtPrice ? Number(compareAtPrice) : null,
        currency: typeof currency === 'string' ? currency.trim().toUpperCase() : '',
        targetMarket: targetMarket || '',
        country: country || '',
        city: city || '',
        locale: locale || '',
        stock: Number(stock) || 0,
        images: (images || []).map((img, i) => ({
          url: img.url,
          alt: img.alt || name,
          order: img.order ?? i
        })),
        category: category || '',
        tags: tags || [],
        isPublished: isPublished || false,
        seoTitle: seoTitle || '',
        seoDescription: seoDescription || '',
        linkedProductId: resolvedLinkedProductId,
        createdBy: req.user.id,
        ...(testimonials?.length > 0 && { testimonials: normalizeTestimonials(testimonials) }),
        ...(faq?.length > 0 && { faq: normalizeFaq(faq) }),
        ...(_pageData && { _pageData })
      });

      await product.save();
    } catch (error) {
      if (createdSystemProductId) {
        await Product.deleteOne({ _id: createdSystemProductId, workspaceId: req.workspaceId }).catch(() => {});
      }
      throw error;
    }

    res.status(201).json({
      success: true,
      message: 'Produit créé avec succès',
      data: product.toObject(),
      meta: {
        linkedProductId: resolvedLinkedProductId,
        systemProductCreated: Boolean(createdSystemProductId)
      }
    });
  } catch (error) {
    // Handle duplicate slug
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Un produit avec ce nom existe déjà'
      });
    }
    console.error('Erreur POST /store-products:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * PUT /store-products/:id
 * Update a store product (dashboard).
 */
router.put('/:id', requireEcomAuth, requireWorkspace, requireStoreOwner, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }

    const {
      name, description, price, compareAtPrice, stock,
      images, category, tags, isPublished,
      seoTitle, seoDescription, linkedProductId, currency,
      targetMarket, country, city, locale,
      testimonials, faq, _pageData, pageBuilder, productPageConfig
    } = req.body;

    // Build update object — only include provided fields
    const update = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (price !== undefined) update.price = Number(price);
    if (compareAtPrice !== undefined) update.compareAtPrice = compareAtPrice ? Number(compareAtPrice) : null;
    if (currency !== undefined) update.currency = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
    if (targetMarket !== undefined) update.targetMarket = targetMarket;
    if (country !== undefined) update.country = country;
    if (city !== undefined) update.city = city;
    if (locale !== undefined) update.locale = locale;
    if (stock !== undefined) update.stock = Number(stock);
    if (images !== undefined) {
      update.images = images.map((img, i) => ({
        url: img.url,
        alt: img.alt || '',
        order: img.order ?? i
      }));
    }
    if (category !== undefined) update.category = category;
    if (tags !== undefined) update.tags = tags;
    if (isPublished !== undefined) update.isPublished = isPublished;
    if (seoTitle !== undefined) update.seoTitle = seoTitle;
    if (seoDescription !== undefined) update.seoDescription = seoDescription;
    if (linkedProductId !== undefined) update.linkedProductId = linkedProductId || null;
    if (testimonials !== undefined) update.testimonials = normalizeTestimonials(testimonials);
    if (faq !== undefined) update.faq = normalizeFaq(faq);
    if (_pageData !== undefined) update._pageData = _pageData;
    if (pageBuilder !== undefined) update.pageBuilder = pageBuilder;
    if (productPageConfig !== undefined) update.productPageConfig = productPageConfig;

    // Only regenerate slug if name actually changed
    if (name) {
      const existing = await StoreProduct.findOne({ _id: req.params.id, workspaceId: req.workspaceId }).select('name').lean();
      if (existing && existing.name !== name) {
        update.slug = name
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          + '-' + Date.now().toString(36);
      }
    }

    const product = await StoreProduct.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspaceId },
      { $set: update },
      { new: true, lean: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    res.json({
      success: true,
      message: 'Produit mis à jour',
      data: product
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Un produit avec ce nom existe déjà'
      });
    }
    console.error('Erreur PUT /store-products/:id:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * DELETE /store-products/:id
 * Delete a store product (dashboard).
 */
router.delete('/:id', requireEcomAuth, requireWorkspace, requireStoreOwner, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }

    const result = await StoreProduct.findOneAndDelete({
      _id: req.params.id,
      workspaceId: req.workspaceId
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    res.json({ success: true, message: 'Produit supprimé' });
  } catch (error) {
    console.error('Erreur DELETE /store-products/:id:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * POST /store-products/:id/duplicate
 * Clone a store product (1-click duplication).
 */
router.post('/:id/duplicate', requireEcomAuth, requireWorkspace, requireStoreOwner, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }

    const original = await StoreProduct.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId
    }).lean();

    if (!original) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    const { _id, createdAt, updatedAt, slug, ...rest } = original;
    const clonedName = `${rest.name} (copie)`;

    const cloned = new StoreProduct({
      ...rest,
      name: clonedName,
      isPublished: false,
      storeId: req.activeStoreId || original.storeId || null,
      createdBy: req.user._id,
      workspaceId: req.workspaceId,
    });

    await cloned.save();

    res.status(201).json({
      success: true,
      message: 'Produit dupliqué',
      data: cloned.toObject()
    });
  } catch (error) {
    console.error('Erreur POST /store-products/:id/duplicate:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
