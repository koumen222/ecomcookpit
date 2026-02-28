import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import StoreProduct from '../models/StoreProduct.js';
import { requireEcomAuth, requireWorkspace } from '../middleware/ecomAuth.js';
import { requireStoreOwner } from '../middleware/storeAuth.js';
import { uploadImage, isConfigured } from '../services/cloudflareImagesService.js';

const router = express.Router();

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

    // Build filter — ALWAYS scoped to workspaceId
    const filter = { workspaceId: req.workspaceId };
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
      workspaceId: req.workspaceId,
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
            filename: file.originalname
          }
        );

        uploadedImages.push({
          id: result.id,
          url: result.url,
          variants: result.variants,
          filename: file.originalname,
          size: file.size
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
 * POST /store-products
 * Create a new store product (dashboard).
 */
router.post('/', requireEcomAuth, requireWorkspace, requireStoreOwner, async (req, res) => {
  try {
    const {
      name, description, price, compareAtPrice, stock,
      images, category, tags, isPublished,
      seoTitle, seoDescription, linkedProductId, currency
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Nom et prix requis'
      });
    }

    const product = new StoreProduct({
      workspaceId: req.workspaceId,
      name,
      description: description || '',
      price: Number(price),
      compareAtPrice: compareAtPrice ? Number(compareAtPrice) : null,
      currency: currency || req.store?.storeSettings?.storeCurrency || 'XAF',
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
      linkedProductId: linkedProductId || null,
      createdBy: req.user.id
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Produit créé avec succès',
      data: product.toObject()
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
      seoTitle, seoDescription, linkedProductId, currency
    } = req.body;

    // Build update object — only include provided fields
    const update = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (price !== undefined) update.price = Number(price);
    if (compareAtPrice !== undefined) update.compareAtPrice = compareAtPrice ? Number(compareAtPrice) : null;
    if (currency !== undefined) update.currency = currency;
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

    // Regenerate slug if name changed
    if (name) {
      update.slug = name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        + '-' + Date.now().toString(36);
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

export default router;
