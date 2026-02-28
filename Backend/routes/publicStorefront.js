/**
 * Public Storefront Routes
 * 
 * Public-facing routes for customer store access via subdomains.
 * No authentication required.
 * 
 * Architecture:
 * - extractSubdomain is applied GLOBALLY in server.js (req.subdomain always available)
 * - resolveWorkspace applied per-route (not blanket) to avoid blocking /api/* routes
 * - If no subdomain → SaaS landing response
 * - If subdomain → load workspace, return store data
 * - Optimized for high traffic with caching + .lean() queries
 */

import express from 'express';
import { resolveWorkspace } from '../middleware/workspaceResolver.js';
import {
  getStoreHomepage,
  getProductBySlug,
  getCategories
} from '../controllers/publicStoreController.js';

const router = express.Router();

/**
 * Skip this router entirely for /api/* paths.
 * API routes have their own mount points and must not be intercepted.
 */
router.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next('router'); // Skip this entire router
  }
  next();
});

/**
 * GET / - Store homepage
 * 
 * Behavior:
 * - If no subdomain (root domain) → return SaaS landing info
 * - If subdomain exists → resolve workspace, return store products
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - category: Filter by category
 * - search: Search in name, description, tags
 * - sort: Sort field (default: -createdAt)
 */
router.get('/', resolveWorkspace, getStoreHomepage);

/**
 * GET /product/:slug - Product detail page
 * 
 * Returns full product details by slug
 * Requires subdomain (store context)
 */
router.get('/product/:slug', resolveWorkspace, getProductBySlug);

/**
 * GET /categories - Get all categories
 * 
 * Returns unique categories for filtering
 * Requires subdomain (store context)
 */
router.get('/categories', resolveWorkspace, getCategories);

export default router;
