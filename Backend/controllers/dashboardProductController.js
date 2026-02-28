/**
 * Dashboard Product Controller
 * 
 * Handles authenticated product management for workspace owners.
 * Enforces strict workspace isolation.
 * 
 * Architecture decisions:
 * - All queries scoped to workspaceId (multi-tenant isolation)
 * - Ownership validation via middleware
 * - Optimized queries with lean() and select()
 * - Proper indexing for performance at scale
 */

import StoreProduct from '../models/StoreProduct.js';

/**
 * GET /dashboard/products - List products for authenticated user's workspace
 */
export const getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 50, category, search, isPublished } = req.query;

    // Build filter - ALWAYS include workspaceId
    const filter = { workspaceId: req.workspaceId };

    if (category) filter.category = category;
    if (isPublished !== undefined) filter.isPublished = isPublished === 'true';
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      StoreProduct.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      
      StoreProduct.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('❌ Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading products'
    });
  }
};

/**
 * GET /dashboard/products/:id - Get single product
 */
export const getProduct = async (req, res) => {
  try {
    const product = await StoreProduct.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId // Workspace isolation
    }).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('❌ Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading product'
    });
  }
};

/**
 * POST /dashboard/products - Create product
 */
export const createProduct = async (req, res) => {
  try {
    const productData = {
      ...req.body,
      workspaceId: req.workspaceId, // Force workspace isolation
      createdBy: req.ecomUser._id
    };

    const product = new StoreProduct(productData);
    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created',
      data: product
    });

  } catch (error) {
    console.error('❌ Create product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating product'
    });
  }
};

/**
 * PUT /dashboard/products/:id - Update product
 */
export const updateProduct = async (req, res) => {
  try {
    const product = await StoreProduct.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId // Workspace isolation
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Update fields
    Object.assign(product, req.body);
    await product.save();

    res.json({
      success: true,
      message: 'Product updated',
      data: product
    });

  } catch (error) {
    console.error('❌ Update product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating product'
    });
  }
};

/**
 * DELETE /dashboard/products/:id - Delete product
 */
export const deleteProduct = async (req, res) => {
  try {
    const product = await StoreProduct.findOneAndDelete({
      _id: req.params.id,
      workspaceId: req.workspaceId // Workspace isolation
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product deleted'
    });

  } catch (error) {
    console.error('❌ Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product'
    });
  }
};

export default {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct
};
