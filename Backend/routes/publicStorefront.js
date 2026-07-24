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
import Store from '../models/Store.js';
import StoreProduct from '../models/StoreProduct.js';
import QuantityOffer from '../models/QuantityOffer.js';

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

const PLATFORM_ROUTE_META = [
  { pattern: /^\/ecom\/landing\/?$/, title: 'Scalor — La plateforme e-commerce africaine', description: 'Gérez votre boutique, vos commandes, vos campagnes et votre équipe depuis une seule plateforme.' },
  { pattern: /^\/ecom\/why-scalor\/?$/, title: 'Pourquoi Scalor ?', description: 'Découvrez pourquoi des centaines d\'entrepreneurs africains ont choisi Scalor pour faire croître leur business.' },
  { pattern: /^\/ecom\/tarifs\/?$/, title: 'Tarifs Scalor', description: 'Des plans adaptés à chaque étape de votre croissance. Commencez gratuitement, montez en puissance quand vous êtes prêt.' },
  { pattern: /^\/ecom\/privacy\/?$/, title: 'Politique de confidentialité — Scalor', description: 'Comment Scalor collecte, utilise et protège vos données personnelles.' },
  { pattern: /^\/ecom\/terms\/?$/, title: 'Conditions d\'utilisation — Scalor', description: 'Les conditions générales d\'utilisation de la plateforme Scalor.' },
  { pattern: /^\/ecom\/login\/?$/, title: 'Connexion — Scalor', description: 'Connectez-vous à votre espace Scalor.' },
  { pattern: /^\/ecom\/register\/?$/, title: 'Créer un compte — Scalor', description: 'Rejoignez Scalor et lancez votre boutique en ligne dès aujourd\'hui.' },
  { pattern: /^\/ecom\/forgot-password\/?$/, title: 'Mot de passe oublié — Scalor', description: 'Réinitialisez votre mot de passe Scalor.' },
  { pattern: /^\/ecom\/billing\/?$/, title: 'Facturation — Scalor', description: 'Gérez votre abonnement et vos paiements Scalor.' },
  { pattern: /^\/ecom\/billing\/success\/?$/, title: 'Paiement réussi — Scalor', description: 'Votre paiement a bien été pris en compte.' },
  { pattern: /^\/ecom\/whatsapp\/service\/?$/, title: 'Service WhatsApp — Scalor', description: 'Automatisez votre service client avec Rita, l\'agent IA WhatsApp de Scalor.' },
  { pattern: /^\/ecom\/whatsapp-postulation\/?$/, title: 'Rejoindre le réseau WhatsApp — Scalor', description: 'Postulez pour intégrer le réseau d\'agents WhatsApp Scalor.' },
  { pattern: /^\/affiliate\/login\/?$/, title: 'Connexion affilié — Scalor', description: 'Accédez à votre espace affilié Scalor.' },
  { pattern: /^\/affiliate\/register\/?$/, title: 'Devenir affilié — Scalor', description: 'Rejoignez le programme d\'affiliation Scalor et gagnez des commissions.' },
  { pattern: /^\/affiliate\/dashboard\/?$/, title: 'Dashboard affilié — Scalor', description: 'Suivez vos performances et commissions en temps réel.' },
];

function getPlatformRouteMeta(pathname) {
  const path = (pathname || '/').split('?')[0].replace(/\/$/, '') || '/';
  for (const rule of PLATFORM_ROUTE_META) {
    if (rule.pattern.test(path) || rule.pattern.test(path + '/')) {
      return { title: rule.title, description: rule.description };
    }
  }
  return null;
}

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

const MAX_PUBLIC_INLINE_MEDIA_LENGTH = 120_000; // ~90 KB binary once base64-decoded.

function publicMediaUrl(value = '') {
  const mediaUrl = String(value || '');
  if (/^data:(image|video|audio|application)\//i.test(mediaUrl) && mediaUrl.length > MAX_PUBLIC_INLINE_MEDIA_LENGTH) {
    return '';
  }
  return mediaUrl;
}

function stripLargeInlineMedia(value) {
  if (typeof value === 'string') return publicMediaUrl(value);
  if (Array.isArray(value)) return value.map(stripLargeInlineMedia);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, stripLargeInlineMedia(child)])
    );
  }
  return value;
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

function optimizeImageUrl(url, { width = 900, quality = 82 } = {}) {
  if (!url || typeof url !== 'string') return url;
  try {
    if (url.includes('res.cloudinary.com')) {
      return url.replace(/\/upload\//, `/upload/w_${width},q_${quality},f_auto,c_limit/`);
    }
    if (url.includes('.imgix.net') || url.includes('imgix.')) {
      const u = new URL(url);
      if (!u.searchParams.has('w')) u.searchParams.set('w', width);
      if (!u.searchParams.has('q')) u.searchParams.set('q', quality);
      u.searchParams.set('auto', 'format,compress');
      return u.toString();
    }
    if (url.includes('.b-cdn.net') || url.includes('bunnycdn')) {
      const u = new URL(url);
      if (!u.searchParams.has('width')) u.searchParams.set('width', width);
      if (!u.searchParams.has('quality')) u.searchParams.set('quality', quality);
      return u.toString();
    }
    if (url.includes('supabase.co/storage')) {
      const u = new URL(url);
      if (!u.searchParams.has('width')) u.searchParams.set('width', width);
      if (!u.searchParams.has('quality')) u.searchParams.set('quality', quality);
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

function buildPreconnectTag(url) {
  try {
    const origin = new URL(url).origin;
    return `<link rel="preconnect" href="${escapeHtml(origin)}" crossorigin />`;
  } catch {
    return '';
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

function buildFallbackMeta(req) {
  const routeMeta = getPlatformRouteMeta(req.path);
  const baseUrl = `${getRequestOrigin(req)}${String(req.originalUrl || req.url || '/').split('?')[0] || '/'}`;
  return {
    title: routeMeta?.title || DEFAULT_PLATFORM_TITLE,
    description: routeMeta?.description || DEFAULT_PLATFORM_DESCRIPTION,
    image: DEFAULT_PLATFORM_IMAGE,
    icon: DEFAULT_PLATFORM_IMAGE,
    type: 'website',
    siteName: 'Scalor',
    appTitle: 'Scalor',
    url: baseUrl,
  };
}

function withTimeout(promise, timeoutMs, fallback, label) {
  let timer = null;
  return new Promise((resolve) => {
    let settled = false;
    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn(`[storefront] ${label} timed out after ${timeoutMs}ms, serving fallback HTML`);
      resolve(fallback);
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        console.warn(`[storefront] ${label} failed: ${error.message}`);
        resolve(fallback);
      });
  });
}

function resolveStoreRouteContext(req) {
  const parts = String(req.path || '/').split('/').filter(Boolean);

  // Both regular subdomains and custom domains are resolved by the subdomain middleware
  // req.subdomain is set for both *.scalor.net and custom domains
  if (req.isStoreDomain && req.subdomain) {
    // /products/:slug — Shopify-style URL (primary)
    if (parts[0] === 'products' && parts[1]) {
      return { subdomain: req.subdomain, pageType: 'product', slug: decodeSegment(parts[1]) };
    }
    // /product/:slug — legacy URL (still supported)
    if (parts[0] === 'product' && parts[1]) {
      return { subdomain: req.subdomain, pageType: 'product', slug: decodeSegment(parts[1]) };
    }
    // /produit/:slug — French alias used by theme previews/older public links
    if (parts[0] === 'produit' && parts[1]) {
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
    if (parts[2] === 'products' && parts[3]) {
      return { subdomain: parts[1].toLowerCase(), pageType: 'product', slug: decodeSegment(parts[3]) };
    }
    if (parts[2] === 'product' && parts[3]) {
      return { subdomain: parts[1].toLowerCase(), pageType: 'product', slug: decodeSegment(parts[3]) };
    }
    if (parts[2] === 'produit' && parts[3]) {
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

async function resolveRequestMeta(req, routeContext = resolveStoreRouteContext(req), initialData = null) {
  const baseUrl = `${getRequestOrigin(req)}${String(req.originalUrl || req.url || '/').split('?')[0] || '/'}`;

  if (!routeContext?.subdomain) {
    return buildFallbackMeta(req);
  }

  if (initialData?.store) {
    const store = initialData.store;
    const storeName = normalizeText(store.name) || 'Boutique';
    const storeDescription = truncateText(
      normalizeText(store.description || `Découvrez la boutique ${storeName} en ligne.`),
      180,
    );
    const storeLogo = publicMediaUrl(store.logo || '');
    const storeBanner = publicMediaUrl(store.banner || '');
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

    const product = routeContext.pageType === 'product' ? initialData.product : null;
    if (product) {
      const productImage = publicMediaUrl(product.images?.[0]?.url || product.image || '');
      meta.title = normalizeText(product.seoTitle || `${product.name} — ${storeName}`) || `${product.name} — ${storeName}`;
      meta.description = truncateText(
        normalizeText(product.seoDescription || product.description || storeDescription || `Découvrez ${product.name} chez ${storeName}.`),
        180,
      );
      meta.image = toAbsoluteUrl(productImage || storeLogo || storeBanner || '/icon.png', req) || defaultStoreVisual;
      meta.type = 'product';
    }

    return meta;
  }

  const workspace = await _resolveStoreFast(routeContext.subdomain);

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

  const storeName = normalizeText(workspace.storeSettings?.name || workspace.storeSettings?.storeName || workspace.name) || 'Boutique';
  const storeDescription = truncateText(
    normalizeText(workspace.storeSettings?.description || workspace.storeSettings?.storeDescription || `Découvrez la boutique ${storeName} en ligne.`),
    180,
  );
  const storeLogo = publicMediaUrl(workspace.storeSettings?.logo || workspace.storeSettings?.storeLogo || '');
  const storeBanner = publicMediaUrl(workspace.storeSettings?.banner || workspace.storeSettings?.storeBanner || '');
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
    const productFilter = workspace._storeId
      ? { workspaceId: workspace._workspaceId, storeId: workspace._storeId }
      : { workspaceId: workspace._workspaceId };
    const product = await StoreProduct.findOne({
      ...productFilter,
      slug: routeContext.slug,
      isPublished: true,
    }).select('name seoTitle seoDescription description images').lean().maxTimeMS(800);

    if (product) {
      const productImage = publicMediaUrl(product.images?.[0]?.url || '');
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

// In-process store resolver cache: 2min TTL.
// Admin saves call invalidateStorefrontCache() which clears it instantly.
const _sfCache = new Map();
const _SF_TTL = 120_000;
function _sfGet(subdomain) {
  const e = _sfCache.get(subdomain);
  if (!e) return null;
  if (Date.now() > e.exp) { _sfCache.delete(subdomain); return null; }
  return e.data;
}
function _sfSet(subdomain, data) {
  _sfCache.set(subdomain, { data, exp: Date.now() + _SF_TTL });
}

async function _resolveStoreFast(subdomain) {
  if (!subdomain) return null;
  const clean = subdomain.toLowerCase().trim();
  const cached = _sfGet(clean);
  if (cached) return cached;

  // ── Resilient lookup ───────────────────────────────────────────────────────
  // Anti-flicker : un timeout MongoDB transitoire faisait disparaître la
  // boutique. Maintenant on retry 1 fois avec backoff 300ms. Si ça échoue
  // toujours, on relance l'erreur (le caller la traite comme "indisponible
  // temporairement" et ne renvoie PAS 404 — voir fetchInitialData).
  const queryWithRetry = async (model, filter, projection) => {
    try {
      return await model.findOne(filter).select(projection).lean().maxTimeMS(1500);
    } catch (err) {
      console.warn(`[resolver] ${model.modelName} query failed (${err.message}), retrying once...`);
      await new Promise(r => setTimeout(r, 300));
      return await model.findOne(filter).select(projection).lean().maxTimeMS(3000);
    }
  };

  const store = await queryWithRetry(
    Store,
    { subdomain: clean, isActive: { $ne: false }, 'storeSettings.isStoreEnabled': { $ne: false } },
    '_id workspaceId name subdomain storeSettings storeTheme storePixels storeFooter storeLegalPages storeDeliveryZones storePages'
  );

  if (store) {
    const result = { ...store, _storeId: store._id, _workspaceId: store.workspaceId };
    _sfSet(clean, result);
    return result;
  }

  const ws = await queryWithRetry(
    EcomWorkspace,
    { subdomain: clean, isActive: { $ne: false }, 'storeSettings.isStoreEnabled': { $ne: false } },
    '_id name subdomain storeSettings storeTheme storePixels storeFooter storeLegalPages storeDeliveryZones storePages'
  );

  if (ws) {
    const result = { ...ws, _workspaceId: ws._id, _storeId: null };
    _sfSet(clean, result);
    return result;
  }
  return null;
}

function _buildStorePayload(workspace) {
  const settings = workspace.storeSettings || {};
  const theme = workspace.storeTheme || {};
  const pixels = workspace.storePixels || {};
  const sectionColors = {
    socialProof: theme.sectionColors?.socialProof || '#7C3AED',
    benefits: theme.sectionColors?.benefits || theme.primaryColor || '#0F6B4F',
    trust: theme.sectionColors?.trust || '#2563EB',
    problem: theme.sectionColors?.problem || '#DC2626',
    solution: theme.sectionColors?.solution || '#059669',
    faq: theme.sectionColors?.faq || '#7C3AED',
  };
  return {
    _id: workspace._id,
    name: settings.name || settings.storeName || workspace.name,
    description: settings.description || settings.storeDescription || '',
    logo: publicMediaUrl(settings.logo || settings.storeLogo || ''),
    banner: publicMediaUrl(settings.banner || settings.storeBanner || ''),
    phone: settings.phone || settings.storePhone || '',
    whatsapp: settings.whatsapp || settings.storeWhatsApp || '',
    themeColor: settings.themeColor || settings.storeThemeColor || '#0F6B4F',
    currency: settings.storeCurrency || settings.currency || 'XAF',
    country: settings.country || settings.storeCountry || '',
    subdomain: workspace.subdomain,
    template: theme.template || 'classic',
    templateExplicit: Boolean(theme.template),
    primaryColor: settings.primaryColor || settings.storeThemeColor || theme.primaryColor || '#0F6B4F',
    accentColor: settings.accentColor || theme.accentColor || '#059669',
    backgroundColor: settings.backgroundColor || theme.backgroundColor || '#FFFFFF',
    textColor: settings.textColor || theme.textColor || '#111827',
    font: settings.font || theme.font || 'inter',
    sectionColors,
    sectionToggles: theme.sections || {},
    email: settings.email || '',
    facebook: settings.facebook || '',
    instagram: settings.instagram || '',
    tiktok: settings.tiktok || '',
    productPageConfig: settings.productPageConfig || theme.productPageConfig || null,
    pixels: {
      metaPixelId: pixels.metaPixelId || '',
      tiktokPixelId: pixels.tiktokPixelId || '',
      googleTagId: pixels.googleTagId || '',
      googleAdsId: pixels.googleAdsId || '',
      snapchatPixelId: pixels.snapchatPixelId || pixels.snapPixelId || '',
    },
  };
}

async function fetchInitialData(routeContext) {
  if (!routeContext?.subdomain) return null;
  try {
    const workspace = await _resolveStoreFast(routeContext.subdomain);
    if (!workspace) {
      // Vraiment introuvable — on retourne null, le caller affiche le HTML
      // par défaut sans __SCALOR_INITIAL__ (le SPA gérera l'erreur côté client).
      return null;
    }

    const storePayload = _buildStorePayload(workspace);
    const productFilter = workspace._storeId
      ? { workspaceId: workspace._workspaceId, storeId: workspace._storeId }
      : { workspaceId: workspace._workspaceId };

    // Champs envoyés pour les "aperçus produit" du __SCALOR_INITIAL__ —
    // assez complets pour que useStoreProduct rende quasi toute la page produit
    // instantanément lors d'une navigation SPA (toProductPreview lit ces champs).
    const PREVIEW_FIELDS = 'name slug description price compareAtPrice currency country targetMarket city locale stock images category tags seoTitle seoDescription features faq productPageConfig _pageData.pageStyle _pageData.layout _pageData.theme';
    const previewMap = (p) => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      description: p.description || '',
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      currency: p.currency || storePayload.currency,
      country: p.country || '',
      targetMarket: p.targetMarket || '',
      city: p.city || '',
      locale: p.locale || '',
      stock: p.stock,
      image: p.images?.[0]?.url || '',
      images: p.images || [],
      category: p.category,
      tags: p.tags || [],
      seoTitle: p.seoTitle || '',
      seoDescription: p.seoDescription || '',
      features: p.features || [],
      faq: p.faq || [],
      productPageConfig: p.productPageConfig || null,
      _pageData: p._pageData || null,
    });

    if (routeContext.pageType === 'product' && routeContext.slug) {
      const product = await StoreProduct.findOne({ ...productFilter, slug: routeContext.slug, isPublished: true })
        .select('name slug description price compareAtPrice currency country targetMarket city locale stock images category tags seoTitle seoDescription features faq testimonials _pageData productPageConfig')
        .lean()
        .maxTimeMS(1200);

      let quantityOfferData = null;
      if (product?._id) {
        // Lancer en parallèle sans attendre — non-bloquant pour le rendu initial
        const qo = await QuantityOffer.findOne({
          workspaceId: workspace._workspaceId,
          productId: product._id,
          isActive: true,
        }).select('offers design productId').sort({ createdAt: -1 }).lean().maxTimeMS(600);
        if (qo?.offers?.length > 0) {
          quantityOfferData = {
            offers: qo.offers.map((o, i) => ({
              qty: o.quantity,
              price: o.price,
              comparePrice: o.compare_price || 0,
              badge: o.label || '',
              selected: i === (qo.design?.highlight_offer ?? 0),
            })),
            design: qo.design || null,
          };
        }
      }

      const productWithOffers = product
        ? {
            ...product,
            ...(quantityOfferData ? {
              quantityOffers: quantityOfferData.offers,
              ...(quantityOfferData.design ? { quantityOfferDesign: quantityOfferData.design } : {}),
            } : {}),
          }
        : null;

      return {
        generatedAt: Date.now(),
        pageType: 'product',
        store: storePayload,
        product: productWithOffers,
        products: [],
      };
    }

    // home / products listing — limite 20 → 50, avec champs élargis
    const products = await StoreProduct.find({ ...productFilter, isPublished: true })
      .select(PREVIEW_FIELDS)
      .sort('-createdAt').limit(50).lean().maxTimeMS(1500);

    return {
      generatedAt: Date.now(),
      pageType: routeContext.pageType || 'home',
      store: storePayload,
      product: null,
      products: products.map(previewMap),
      footer: workspace.storeFooter || null,
      legalPages: workspace.storeLegalPages || null,
      sections: workspace.storePages?.sections ?? null,
    };
  } catch {
    return null;
  }
}

function injectInitialData(html, initialData) {
  if (!initialData) return html;
  const safeJson = JSON.stringify(stripLargeInlineMedia(initialData)).replace(/<\/script>/gi, '<\\/script>');
  const scriptTag = `<script>window.__SCALOR_INITIAL__=${safeJson};</script>`;

  // Préchargement de l'image hero — en priorité BASSE volontairement.
  // L'image se télécharge en parallèle (connexion réchauffée) MAIS sans voler la
  // bande passante au JS critique : le contenu / squelette s'affiche donc AVANT
  // les images, surtout sur mobile / connexions lentes (marché cible).
  // (fetchpriority="high" forçait l'image à concurrencer le bundle JS → écran vide plus long.)
  let preloadTag = '';
  const heroImg = optimizeImageUrl(initialData.product?.images?.[0]?.url || initialData.product?.image, { width: 900, quality: 82 });
  if (heroImg && heroImg.startsWith('http')) {
    preloadTag = `${buildPreconnectTag(heroImg)}<link rel="preload" as="image" href="${escapeHtml(heroImg)}" fetchpriority="high" imagesizes="(max-width: 768px) 100vw, 50vw" />`;
  }

  const inject = preloadTag + scriptTag;
  // Insert just before </head>
  return html.replace('</head>', `${inject}\n</head>`);
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

router.use((req, res, next) => {
  if (/\.(?:js|css|png|jpe?g|gif|svg|webp|ico|json|map|txt|woff2?|ttf|otf)$/i.test(req.path || '')) {
    return res.status(404).end();
  }
  next();
});

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
    const routeContext = resolveStoreRouteContext(req);
    const fallbackMeta = buildFallbackMeta(req);
    const initialData = await withTimeout(fetchInitialData(routeContext), 2500, null, 'initial storefront data');
    const meta = routeContext?.subdomain && !initialData
      ? fallbackMeta
      : await withTimeout(resolveRequestMeta(req, routeContext, initialData), 1000, fallbackMeta, 'storefront meta');
    const html = injectInitialData(injectHeadMeta(readIndexTemplate(), meta), initialData);
    res.status(200).send(html);
  } catch (err) {
    console.error('❌ [storefront] Failed to render dynamic index.html:', err.message);
    const html = injectHeadMeta(readIndexTemplate(), buildFallbackMeta(req));
    res.status(200).send(html);
  }
});

// No-op : le cache SSR a été supprimé. La fonction reste exportée pour ne pas
// casser les imports existants dans storeAdmin.js / storeManagement.js / stores.js.
export function invalidateStorefrontCache(subdomain) {
  if (subdomain) _sfCache.delete(subdomain.toLowerCase().trim());
}

export default router;
