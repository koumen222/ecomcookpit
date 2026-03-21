/**
 * Dashboard Product Routes
 * 
 * Authenticated routes for workspace owners to manage their products.
 * Requires authentication and workspace ownership.
 * 
 * Architecture:
 * - Protected by authentication middleware
 * - Workspace ownership verified
 * - All queries scoped to user's workspace
 */

import express from 'express';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import { extractSubdomain } from '../middleware/subdomain.js';
import { resolveWorkspace, requireWorkspaceOwner } from '../middleware/workspaceResolver.js';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct
} from '../controllers/dashboardProductController.js';

const router = express.Router();

// Apply middleware chain
router.use(extractSubdomain);
router.use(resolveWorkspace);
router.use(requireEcomAuth); // Must be authenticated
router.use(requireWorkspaceOwner); // Must own the workspace

/**
 * GET /dashboard/products - List all products
 * Query params: page, limit, category, search, isPublished
 */
router.get('/', getProducts);

/**
 * POST /dashboard/products - Create new product
 */
router.post('/', createProduct);

/**
 * GET /dashboard/products/:id - Get single product
 */
router.get('/:id', getProduct);

/**
 * PUT /dashboard/products/:id - Update product
 */
router.put('/:id', updateProduct);

/**
 * DELETE /dashboard/products/:id - Delete product
 */
router.delete('/:id', deleteProduct);

export default router;
