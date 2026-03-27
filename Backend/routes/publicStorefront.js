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
  console.warn('   __dirname:', __dirname);
  console.warn('   Checked paths:');
  for (const p of BUILD_PATHS) {
    const dirExists = fs.existsSync(p);
    const indexExists = dirExists && fs.existsSync(path.join(p, 'index.html'));
    console.warn(`     ${p} → dir=${dirExists}, index.html=${indexExists}`);
  }
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

// ─── 2. Root domain handling ───────────────────────────────────────────────────
// Root domain (scalor.net) requests should be handled by the SPA
// The frontend will handle /store/:subdomain routes via React Router
router.use((req, res, next) => {
  // If on root domain and NOT a /store/* path, let it pass through
  // The SPA will handle routing
  next();
});

// ─── 3. Serve React build static files ───────────────────────────────────────
// Serve for both store subdomains AND root domain (for /store/:subdomain routes)
router.use((req, res, next) => {
  if (!BUILD_DIR) {
    // Serve a user-friendly HTML page instead of raw JSON
    const accepts = req.headers.accept || '';
    if (accepts.includes('text/html')) {
      return res.status(503).send(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Boutique en cours de déploiement</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;color:#111827}
.c{text-align:center;padding:2rem}.icon{font-size:3rem;margin-bottom:1rem}h1{font-size:1.25rem;font-weight:700;margin-bottom:.5rem}p{color:#6b7280;font-size:.875rem;max-width:24rem}
.retry{margin-top:1.5rem;display:inline-block;padding:.625rem 1.5rem;background:#0F6B4F;color:#fff;border-radius:.75rem;text-decoration:none;font-weight:600;font-size:.875rem}</style>
</head><body><div class="c"><div class="icon">🚀</div><h1>Boutique en cours de déploiement</h1><p>La boutique est en cours de mise à jour. Réessayez dans quelques instants.</p>
<a href="." class="retry">Réessayer</a></div></body></html>`);
    }
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
    const accepts = req.headers.accept || '';
    if (accepts.includes('text/html')) {
      return res.status(503).send(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Boutique en cours de déploiement</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;color:#111827}
.c{text-align:center;padding:2rem}.icon{font-size:3rem;margin-bottom:1rem}h1{font-size:1.25rem;font-weight:700;margin-bottom:.5rem}p{color:#6b7280;font-size:.875rem;max-width:24rem}
.retry{margin-top:1.5rem;display:inline-block;padding:.625rem 1.5rem;background:#0F6B4F;color:#fff;border-radius:.75rem;text-decoration:none;font-weight:600;font-size:.875rem}</style>
</head><body><div class="c"><div class="icon">🚀</div><h1>Boutique en cours de déploiement</h1><p>La boutique est en cours de mise à jour. Réessayez dans quelques instants.</p>
<a href="." class="retry">Réessayer</a></div></body></html>`);
    }
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
