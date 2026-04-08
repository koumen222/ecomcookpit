/**
 * Public Store Controller
 * 
 * Handles public-facing store routes (no authentication required).
 * Optimized for high traffic and scalability.
 * 
 * Architecture decisions:
 * - Lean queries for minimal memory usage
 * - Pagination to prevent large result sets
 * - Workspace isolation enforced at query level
 * - Caching-friendly responses (add Cache-Control headers in production)
 */

import StoreProduct from '../models/StoreProduct.js';
import Workspace from '../models/Workspace.js';
import QuantityOffer from '../models/QuantityOffer.js';

/**
 * GET / - Public store homepage
 * Returns store info and products
 */
export const getStoreHomepage = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search, sort = '-createdAt' } = req.query;
    
    // If root domain, return SaaS landing page info
    if (req.isRootDomain) {
      return res.json({
        success: true,
        data: {
          type: 'saas_landing',
          message: 'Welcome to Scalor - Multi-tenant E-commerce Platform',
          features: [
            'Create your online store in minutes',
            'Custom subdomain for your brand',
            'Mobile-optimized storefront',
            'WhatsApp integration'
          ]
        }
      });
    }

    // Subdomain store - return products
    if (!req.workspace) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Build query filter
    const filter = {
      workspaceId: req.workspaceId,
      isPublished: true // Only show published products
    };

    if (category) {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [products, total, categories] = await Promise.all([
      StoreProduct.find(filter)
        .select('name slug price images category tags stock isPublished')
        .sort(sort)
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      
      StoreProduct.countDocuments(filter),
      
      // Get unique categories for filtering
      StoreProduct.distinct('category', { 
        workspaceId: req.workspaceId, 
        isPublished: true,
        category: { $ne: '' }
      })
    ]);

    // Store settings
    const storeSettings = req.workspace.storeSettings || {};

    res.json({
      success: true,
      data: {
        store: {
          name: storeSettings.storeName || req.workspace.name,
          description: storeSettings.storeDescription || '',
          logo: storeSettings.storeLogo || '',
          banner: storeSettings.storeBanner || '',
          themeColor: storeSettings.storeThemeColor || '#0F6B4F',
          phone: storeSettings.storePhone || '',
          whatsapp: storeSettings.storeWhatsApp || '',
          currency: storeSettings.storeCurrency || 'XAF'
        },
        products,
        categories,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('❌ Public store error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading store'
    });
  }
};

/**
 * GET /product/:slug - Product detail page
 */
export const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!req.workspace) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    const product = await StoreProduct.findOne({
      workspaceId: req.workspaceId,
      slug,
      isPublished: true
    })
    .select('-__v')
    .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Fetch active quantity offers for this product
    const quantityOffer = await QuantityOffer.findOne({
      workspaceId: req.workspaceId,
      productId: product._id,
      isActive: true
    }).sort({ createdAt: -1 }).lean();

    if (quantityOffer?.offers?.length > 0) {
      product.quantityOffers = quantityOffer.offers.map((o, i) => ({
        qty: o.quantity,
        price: o.price,
        comparePrice: o.compare_price || 0,
        badge: o.label || '',
        selected: i === (quantityOffer.design?.highlight_offer ?? 0),
      }));
      if (quantityOffer.design) {
        product.quantityOfferDesign = quantityOffer.design;
      }
    }

    res.json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('❌ Product detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading product'
    });
  }
};

/**
 * GET /categories - Get all categories
 */
export const getCategories = async (req, res) => {
  try {
    if (!req.workspace) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    const categories = await StoreProduct.distinct('category', {
      workspaceId: req.workspaceId,
      isPublished: true,
      category: { $ne: '' }
    });

    res.json({
      success: true,
      data: categories.sort()
    });

  } catch (error) {
    console.error('❌ Categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading categories'
    });
  }
};

export default {
  getStoreHomepage,
  getProductBySlug,
  getCategories
};
