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
import EcomWorkspace from '../models/Workspace.js';
import StoreProduct from '../models/StoreProduct.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ─── React build path ─────────────────────────────────────────────────────────
// In production: /app/client/build (Docker) or ../client/build (relative)
// Vite outputs to /dist, so we also check that
const BUILD_PATHS = [
  path.resolve(__dirname, '../client/build'),    // /app/client/build (Railway root=Backend)
  path.resolve(__dirname, '../client/dist'),     // /app/client/dist
  path.resolve(__dirname, '../../dist'),         // monorepo: frontend dist next to Backend/
  path.resolve(__dirname, '../../client/build'), // monorepo fallback
  path.resolve(__dirname, '../dist'),            // /app/dist (if vite outputs here)
  '/app/dist',                                   // absolute: nixpacks build output
  '/app/Backend/client/build',                   // absolute: nixpacks copy target
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

const DEFAULT_PLATFORM_TITLE = 'Scalor — The Operating System for African Ecommerce';
const DEFAULT_PLATFORM_DESCRIPTION = 'Scalor — Growth. Structure. Intelligence. The Operating System for African Ecommerce.';
const DEFAULT_PLATFORM_IMAGE = 'https://scalor.net/icon.png';

let indexHtmlTemplate = null;

function readIndexTemplate() {
  if (!BUILD_DIR) return '';
  if (!indexHtmlTemplate) {
    indexHtmlTemplate = fs.readFileSync(path.join(BUILD_DIR, 'index.html'), 'utf8');
  }
  return indexHtmlTemplate;
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(value = '') {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value = '', max = 180) {
  if (!value || value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function getRequestOrigin(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || 'scalor.net').split(',')[0].trim();
  return `${forwardedProto || 'https'}://${forwardedHost || 'scalor.net'}`;
}

function toAbsoluteUrl(value, req) {
  if (!value) return '';
  try {
    return new URL(value, getRequestOrigin(req)).toString();
  } catch {
    return String(value);
  }
}

function decodeSegment(value = '') {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function replaceTitleTag(html, title) {
  const safeTitle = escapeHtml(title || DEFAULT_PLATFORM_TITLE);
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
  }
  return html.replace('</head>', `      <title>${safeTitle}</title>\n    </head>`);
}

function upsertMetaTag(html, attrName, attrValue, content) {
  const safeContent = escapeHtml(content || '');
  const matcher = new RegExp(`<meta[^>]+${attrName}=["']${escapeRegExp(attrValue)}["'][^>]*>`, 'i');
  const tag = `      <meta ${attrName}="${attrValue}" content="${safeContent}" />`;
  if (matcher.test(html)) {
    return html.replace(matcher, tag);
  }
  return html.replace('</head>', `${tag}\n    </head>`);
}

function replaceIconTags(html, iconUrl) {
  if (!iconUrl) return html;
  const safeIconUrl = escapeHtml(iconUrl);
  let nextHtml = html.replace(/\s*<link rel="icon"[^>]*>\s*/ig, '\n');
  nextHtml = nextHtml.replace(/\s*<link rel="apple-touch-icon"[^>]*>\s*/ig, '\n');
  return nextHtml.replace(
    '</head>',
    `      <link rel="icon" type="image/png" href="${safeIconUrl}" />\n      <link rel="apple-touch-icon" href="${safeIconUrl}" />\n    </head>`,
  );
}

function injectHeadMeta(html, meta) {
  const resolved = {
    title: meta?.title || DEFAULT_PLATFORM_TITLE,
    description: meta?.description || DEFAULT_PLATFORM_DESCRIPTION,
    image: meta?.image || DEFAULT_PLATFORM_IMAGE,
    logo: meta?.logo || meta?.icon || '',
    icon: meta?.icon || meta?.image || DEFAULT_PLATFORM_IMAGE,
    url: meta?.url || 'https://scalor.net/',
    type: meta?.type || 'website',
    siteName: meta?.siteName || 'Scalor',
    appTitle: meta?.appTitle || meta?.siteName || 'Scalor',
  };

  let nextHtml = replaceTitleTag(html, resolved.title);
  nextHtml = upsertMetaTag(nextHtml, 'name', 'description', resolved.description);
  nextHtml = upsertMetaTag(nextHtml, 'property', 'og:title', resolved.title);
  nextHtml = upsertMetaTag(nextHtml, 'property', 'og:description', resolved.description);
  nextHtml = upsertMetaTag(nextHtml, 'property', 'og:type', resolved.type);
  nextHtml = upsertMetaTag(nextHtml, 'property', 'og:url', resolved.url);
  nextHtml = upsertMetaTag(nextHtml, 'property', 'og:site_name', resolved.siteName);
  nextHtml = upsertMetaTag(nextHtml, 'property', 'og:image', resolved.image);
  if (resolved.logo) {
    nextHtml = upsertMetaTag(nextHtml, 'property', 'og:logo', resolved.logo);
  }
  nextHtml = upsertMetaTag(nextHtml, 'name', 'twitter:card', resolved.image ? 'summary_large_image' : 'summary');
  nextHtml = upsertMetaTag(nextHtml, 'name', 'twitter:title', resolved.title);
  nextHtml = upsertMetaTag(nextHtml, 'name', 'twitter:description', resolved.description);
  nextHtml = upsertMetaTag(nextHtml, 'name', 'twitter:image', resolved.image);
  if (resolved.logo) {
    nextHtml = upsertMetaTag(nextHtml, 'name', 'twitter:site', resolved.siteName);
  }
  nextHtml = upsertMetaTag(nextHtml, 'name', 'apple-mobile-web-app-title', resolved.appTitle);
  return replaceIconTags(nextHtml, resolved.icon);
}

function resolveStoreRouteContext(req) {
  const parts = String(req.path || '/').split('/').filter(Boolean);

  // Both regular subdomains and custom domains are resolved by the subdomain middleware
  // req.subdomain is set for both *.scalor.net and custom domains
  if (req.isStoreDomain && req.subdomain) {
    if (parts[0] === 'product' && parts[1]) {
      return { subdomain: req.subdomain, pageType: 'product', slug: decodeSegment(parts[1]) };
    }
    if (parts[0] === 'products') {
      return { subdomain: req.subdomain, pageType: 'products', slug: null };
    }
    if (parts[0] === 'checkout') {
      return { subdomain: req.subdomain, pageType: 'checkout', slug: null };
    }
    return { subdomain: req.subdomain, pageType: 'home', slug: null };
  }

  if (parts[0] === 'store' && parts[1]) {
    if (parts[2] === 'product' && parts[3]) {
      return { subdomain: parts[1].toLowerCase(), pageType: 'product', slug: decodeSegment(parts[3]) };
    }
    if (parts[2] === 'products') {
      return { subdomain: parts[1].toLowerCase(), pageType: 'products', slug: null };
    }
    if (parts[2] === 'checkout') {
      return { subdomain: parts[1].toLowerCase(), pageType: 'checkout', slug: null };
    }
    return { subdomain: parts[1].toLowerCase(), pageType: 'home', slug: null };
  }

  return null;
}

async function resolveRequestMeta(req) {
  const routeContext = resolveStoreRouteContext(req);
  const baseUrl = `${getRequestOrigin(req)}${String(req.originalUrl || req.url || '/').split('?')[0] || '/'}`;

  if (!routeContext?.subdomain) {
    return {
      title: DEFAULT_PLATFORM_TITLE,
      description: DEFAULT_PLATFORM_DESCRIPTION,
      image: DEFAULT_PLATFORM_IMAGE,
      icon: DEFAULT_PLATFORM_IMAGE,
      type: 'website',
      siteName: 'Scalor',
      appTitle: 'Scalor',
      url: baseUrl,
    };
  }

  const workspace = await EcomWorkspace.findOne({
    subdomain: routeContext.subdomain,
    isActive: true,
    'storeSettings.isStoreEnabled': true,
  }).select('name subdomain storeSettings').lean();

  if (!workspace) {
    return {
      title: DEFAULT_PLATFORM_TITLE,
      description: DEFAULT_PLATFORM_DESCRIPTION,
      image: DEFAULT_PLATFORM_IMAGE,
      icon: DEFAULT_PLATFORM_IMAGE,
      type: 'website',
      siteName: 'Scalor',
      appTitle: 'Scalor',
      url: baseUrl,
    };
  }

  const storeName = normalizeText(workspace.storeSettings?.storeName || workspace.name) || 'Boutique';
  const storeDescription = truncateText(
    normalizeText(workspace.storeSettings?.storeDescription || `Découvrez la boutique ${storeName} en ligne.`),
    180,
  );
  const storeLogo = workspace.storeSettings?.storeLogo || '';
  const storeBanner = workspace.storeSettings?.storeBanner || '';
  const defaultStoreVisual = toAbsoluteUrl(storeLogo || storeBanner || '/icon.png', req) || DEFAULT_PLATFORM_IMAGE;

  const absoluteLogo = toAbsoluteUrl(storeLogo || '', req);
  const meta = {
    title: storeName,
    description: storeDescription,
    image: defaultStoreVisual,
    logo: absoluteLogo || '',
    icon: absoluteLogo || toAbsoluteUrl('/icon.png', req) || defaultStoreVisual,
    type: 'website',
    siteName: storeName,
    appTitle: storeName,
    url: baseUrl,
  };

  if (routeContext.pageType === 'products') {
    meta.title = `Produits — ${storeName}`;
    meta.description = truncateText(normalizeText(`Découvrez tous les produits disponibles chez ${storeName}.`), 180);
    return meta;
  }

  if (routeContext.pageType === 'checkout') {
    meta.title = `Finaliser la commande — ${storeName}`;
    meta.description = truncateText(normalizeText(`Finalisez votre commande sur la boutique ${storeName}.`), 180);
    return meta;
  }

  if (routeContext.pageType === 'product' && routeContext.slug) {
    const product = await StoreProduct.findOne({
      workspaceId: workspace._id,
      slug: routeContext.slug,
      isPublished: true,
    }).select('name seoTitle seoDescription description images').lean();

    if (product) {
      const productImage = product.images?.[0]?.url || '';
      meta.title = normalizeText(product.seoTitle || `${product.name} — ${storeName}`) || `${product.name} — ${storeName}`;
      meta.description = truncateText(
        normalizeText(product.seoDescription || product.description || storeDescription || `Découvrez ${product.name} chez ${storeName}.`),
        180,
      );
      // og:image = image produit (plus engageante) ; logo dans icon/favicon et og:logo
      meta.image = toAbsoluteUrl(productImage || storeLogo || storeBanner || '/icon.png', req) || defaultStoreVisual;
      meta.type = 'product';
    }
  }

  return meta;
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
router.get('*', async (req, res) => {
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

  // Set proper headers for HTML
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  // Security headers for the SPA shell
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  try {
    const html = injectHeadMeta(readIndexTemplate(), await resolveRequestMeta(req));
    res.status(200).send(html);
  } catch (err) {
    console.error('❌ [storefront] Failed to render dynamic index.html:', err.message);
    res.status(500).json({
      success: false,
      message: 'Error loading store',
      code: 'INDEX_SEND_ERROR'
    });
  }
});

export default router;
