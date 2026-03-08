/**
 * Public Storefront Router — Multi-Tenant SPA Serving
 * 
 * Architecture (Shopify-style):
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Request flow:                                                   │
 * │                                                                 │
 * │ scalor.net        → Cloudflare Pages (redirect from Railway)    │
 * │ api.scalor.net    → Railway API only (skip this router)         │
 * │ koumen.scalor.net → Railway serves React build (this router)    │
 * │                                                                 │
 * │ For store subdomains:                                           │
 * │   /api/*          → Skip (handled by API route mounts)          │
 * │   /static/*       → express.static (JS, CSS, images)            │
 * │   /assets/*       → express.static                              │
 * │   /*              → SPA fallback (index.html)                   │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * The React app (served as SPA) then:
 * 1. Detects subdomain via useSubdomain() hook
 * 2. Calls https://api.scalor.net/api/store/{subdomain} to load store data
 * 3. Renders the storefront dynamically
 * 
 * Performance:
 * - Static files served with 1-year cache (immutable hashed filenames from Vite)
 * - index.html served with no-cache (always fresh for deployments)
 * - Compression handled globally by server.js middleware
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ─── React build path ─────────────────────────────────────────────────────────
// In production: /app/client/build (Docker) or ../client/build (relative)
// Vite outputs to /dist, so we also check that
const BUILD_PATHS = [
  path.resolve(__dirname, '../client/build'),
  path.resolve(__dirname, '../client/dist'),
  path.resolve(__dirname, '../../dist'),        // monorepo: frontend dist next to Backend/
  path.resolve(__dirname, '../../client/build'),
];

let BUILD_DIR = null;
for (const p of BUILD_PATHS) {
  if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
    BUILD_DIR = p;
    break;
  }
}

if (BUILD_DIR) {
  console.log(`📦 [storefront] React build found at: ${BUILD_DIR}`);
} else {
  console.warn('⚠️ [storefront] No React build found. Store subdomains will return 503.');
  console.warn('   Expected locations:', BUILD_PATHS.join(', '));
}

// ─── 1. Skip this router for API paths and API domain ─────────────────────────
router.use((req, res, next) => {
  // Never intercept /api/* — those are handled by API route mounts in server.js
  if (req.path.startsWith('/api')) {
    return next('router');
  }
  
  // api.scalor.net serves API only — skip storefront serving
  if (req.isApiDomain) {
    return next('router');
  }
  
  next();
});

// ─── 2. Redirect /store/{subdomain}/* to {subdomain}.scalor.net ───────────────────
router.use((req, res, next) => {
  // Check if this is a /store/{subdomain}/* path on root domain
  if (req.isRootDomain && req.path.startsWith('/store/')) {
    const parts = req.path.split('/');
    if (parts.length >= 3) {
      const subdomain = parts[2]; // Extract subdomain from /store/{subdomain}
      const remainingPath = parts.slice(3).join('/'); // Get remaining path
      const targetUrl = `https://${subdomain}.scalor.net${remainingPath ? '/' + remainingPath : ''}`;
      console.log(`🔄 [storefront] Redirecting ${req.path} to ${targetUrl}`);
      return res.redirect(301, targetUrl);
    }
  }
  
  // Root domain (scalor.net) should be handled by Cloudflare Pages.
  // If a request somehow reaches Railway on the root domain, redirect.
  if (req.isRootDomain) {
    return res.redirect(301, 'https://scalor.net');
  }
  
  next();
});

// ─── 3. Store subdomain: serve React build static files ───────────────────────
// Only activate if we have a valid build directory and this is a store subdomain
router.use((req, res, next) => {
  if (!req.isStoreDomain) {
    return next('router');
  }
  
  if (!BUILD_DIR) {
    return res.status(503).json({
      success: false,
      message: 'Store is being deployed. Please try again in a few minutes.',
      code: 'BUILD_NOT_READY'
    });
  }
  
  next();
});

// Serve static assets with aggressive caching (Vite uses content-hashed filenames)
if (BUILD_DIR) {
  router.use(express.static(BUILD_DIR, {
    maxAge: '1y',          // 1 year cache for hashed assets (JS, CSS, images)
    immutable: true,       // Assets with hashes never change
    etag: true,
    lastModified: true,
    index: false,          // Don't auto-serve index.html (we handle SPA fallback manually)
    dotfiles: 'ignore',
    // Custom headers per file type
    setHeaders: (res, filePath) => {
      // index.html must never be cached (allows instant deploy updates)
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      // Gzip/Brotli pre-compressed files
      if (filePath.endsWith('.gz')) {
        res.setHeader('Content-Encoding', 'gzip');
      }
      if (filePath.endsWith('.br')) {
        res.setHeader('Content-Encoding', 'br');
      }
    }
  }));
}

// ─── 4. SPA Fallback — serve index.html for all non-static routes ─────────────
// This handles routes like: koumen.scalor.net/product/123, koumen.scalor.net/cart
// React Router takes over client-side routing from index.html
router.get('*', (req, res) => {
  if (!BUILD_DIR) {
    return res.status(503).json({
      success: false,
      message: 'Store is being deployed. Please try again in a few minutes.',
      code: 'BUILD_NOT_READY'
    });
  }
  
  const indexPath = path.join(BUILD_DIR, 'index.html');
  
  // Set proper headers for HTML
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  // Security headers for the SPA shell
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('❌ [storefront] Failed to send index.html:', err.message);
      res.status(500).json({
        success: false,
        message: 'Error loading store',
        code: 'INDEX_SEND_ERROR'
      });
    }
  });
});

export default router;
