/**
 * Public Storefront Routes
 * 
 * Public-facing routes for customer store access.
 * No authentication required.
 * 
 * Architecture:
 * - Uses subdomain middleware to extract store
 * - Resolves workspace from subdomain
 * - Returns 404 if store not found
 * - Optimized for high traffic with caching
 */

import express from 'express';
import { extractSubdomain } from '../middleware/subdomain.js';
import { resolveWorkspace } from '../middleware/workspaceResolver.js';
import {
  getStoreHomepage,
  getProductBySlug,
  getCategories
} from '../controllers/publicStoreController.js';

const router = express.Router();

// Apply subdomain extraction to all routes
router.use(extractSubdomain);
router.use(resolveWorkspace);

/**
 * GET / - Store homepage
 * 
 * Behavior:
 * - If subdomain exists → return store products
 * - If root domain → return SaaS landing info
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - category: Filter by category
 * - search: Search in name, description, tags
 * - sort: Sort field (default: -createdAt)
 */
router.get('/', getStoreHomepage);

/**
 * GET /product/:slug - Product detail page
 * 
 * Returns full product details by slug
 */
router.get('/product/:slug', getProductBySlug);

/**
 * GET /categories - Get all categories
 * 
 * Returns unique categories for filtering
 */
router.get('/categories', getCategories);

export default router;
