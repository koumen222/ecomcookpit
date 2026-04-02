/**
 * Subdomain Extraction Middleware
 * 
 * Extracts subdomain from request headers.
 * Works behind Cloudflare proxy.
 * 
 * Architecture decision:
 * - Uses req.headers.host (works with Cloudflare proxy)
 * - Ignores "www" and root domain
 * - Attaches req.subdomain for downstream use
 * - Detects api.scalor.net → req.isApiDomain = true (API-only, no React build)
 * - Detects *.scalor.net → req.isStoreDomain = true (serve React build)
 * - Detects custom domains → resolves workspace from DB (async, cached)
 * - Lightweight and performant (no DB queries for known domains, cached for custom)
 * 
 * Routing matrix:
 *   scalor.net          → isRootDomain=true  (redirect to Cloudflare Pages)
 *   api.scalor.net      → isApiDomain=true   (API routes only)
 *   koumen.scalor.net   → isStoreDomain=true (serve React build + API)
 *   maboutique.com      → isStoreDomain=true, isCustomDomain=true (resolve via DB)
 *   *.railway.app       → isRootDomain=true  (health checks, API, storefront fallback)
 */

import Workspace from '../models/Workspace.js';
import mongoose from 'mongoose';

// System subdomains that are NOT tenant stores
const SYSTEM_SUBDOMAINS = ['api', 'admin', 'mail', 'smtp', 'ftp', 'cdn', 'static'];

// Known platform domains — NOT custom domains
const PLATFORM_SUFFIXES = ['.scalor.net', '.scalor.site', '.ecomcookpit.pages.dev', '.railway.app', '.railway.internal'];
const PLATFORM_ROOTS = ['scalor.net', 'scalor.site', 'ecomcookpit.pages.dev', 'localhost', '127.0.0.1'];

// Simple cache for custom domain → subdomain lookups (TTL: 5min)
const customDomainCache = new Map();
const CUSTOM_DOMAIN_TTL = 5 * 60 * 1000;

function getCachedCustomDomain(hostname) {
  const entry = customDomainCache.get(hostname);
  if (!entry) return undefined; // undefined = not cached
  if (Date.now() > entry.expires) {
    customDomainCache.delete(hostname);
    return undefined;
  }
  return entry.subdomain; // null = cached "not found"
}

function setCachedCustomDomain(hostname, subdomain) {
  customDomainCache.set(hostname, { subdomain, expires: Date.now() + CUSTOM_DOMAIN_TTL });
}

// Cleanup every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of customDomainCache.entries()) {
    if (now > v.expires) customDomainCache.delete(k);
  }
}, 10 * 60 * 1000);

function isPlatformHost(hostname) {
  if (PLATFORM_ROOTS.includes(hostname)) return true;
  for (const suffix of PLATFORM_SUFFIXES) {
    if (hostname.endsWith(suffix)) return true;
  }
  for (const root of PLATFORM_ROOTS) {
    if (hostname === `www.${root}`) return true;
  }
  return hostname.startsWith('192.168.') || hostname.startsWith('10.');
}

export const extractSubdomain = (req, res, next) => {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host || req.hostname || '';
    const hostname = host.split(':')[0].toLowerCase();
    
    // Default flags
    req.subdomain = null;
    req.isRootDomain = false;
    req.isApiDomain = false;
    req.isStoreDomain = false;
    req.isCustomDomain = false;
    
    console.log(`🌐 [subdomain] Incoming: ${hostname} | path: ${req.path}`);
    
    // ── Railway internal domains ──
    if (hostname.endsWith('.railway.app') || hostname.endsWith('.railway.internal')) {
      req.isRootDomain = true;
      console.log(`🌐 [subdomain] ${hostname} → Railway root (isRootDomain=true)`);
      return next();
    }
    
    // ── Root domain patterns ──
    const isRoot = PLATFORM_ROOTS.some(d => hostname === d || hostname === `www.${d}`);
    if (isRoot) {
      req.isRootDomain = true;
      console.log(`🌐 [subdomain] ${hostname} → Platform root`);
      return next();
    }
    
    // ── Platform subdomain (*.scalor.net) ──
    if (isPlatformHost(hostname)) {
      const parts = hostname.split('.');
      let subdomain = null;
      
      if (parts.length >= 3) {
        subdomain = parts[0] === 'www' ? parts[1] : parts[0];
      }
      
      if (subdomain && !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
        subdomain = null;
      }
      
      if (subdomain === 'api') {
        req.isApiDomain = true;
        console.log(`🌐 [subdomain] ${hostname} → API domain`);
        return next();
      }
      
      if (subdomain && SYSTEM_SUBDOMAINS.includes(subdomain)) {
        req.isRootDomain = true;
        return next();
      }
      
      req.subdomain = subdomain || null;
      req.isRootDomain = !subdomain;
      req.isStoreDomain = !!subdomain;
      
      if (subdomain) {
        console.log(`🌐 [subdomain] ${hostname} → Store: ${subdomain}`);
      }
      return next();
    }
    
    // ── Custom domain (maboutique.com) ──
    // Not a platform host → try to resolve as custom domain
    // Check cache first (sync)
    const cached = getCachedCustomDomain(hostname);
    
    if (cached !== undefined) {
      if (cached) {
        req.subdomain = cached;
        req.isStoreDomain = true;
        req.isCustomDomain = true;
        console.log(`🌐 [custom-domain] ${hostname} → Store: ${cached} (cached)`);
      } else {
        req.isRootDomain = true;
        console.log(`🌐 [custom-domain] ${hostname} → not found (cached miss)`);
      }
      return next();
    }
    
    // Cache miss → async DB lookup
    // Check if MongoDB is connected before querying
    if (mongoose.connection.readyState !== 1) {
      console.warn(`🌐 [custom-domain] ${hostname} → MongoDB not ready (state=${mongoose.connection.readyState}), treating as root`);
      req.isRootDomain = true;
      return next();
    }
    
    Workspace.findOne({
      'storeDomains.customDomain': hostname,
      isActive: true,
      'storeSettings.isStoreEnabled': true
    }).select('subdomain').lean()
      .then(workspace => {
        if (workspace?.subdomain) {
          setCachedCustomDomain(hostname, workspace.subdomain);
          req.subdomain = workspace.subdomain;
          req.isStoreDomain = true;
          req.isCustomDomain = true;
          console.log(`🌐 [custom-domain] ${hostname} → Store: ${workspace.subdomain} (DB)`);
        } else {
          setCachedCustomDomain(hostname, null);
          req.isRootDomain = true;
          console.log(`🌐 [custom-domain] ${hostname} → not found (DB)`);
        }
        next();
      })
      .catch(err => {
        console.error('❌ Custom domain lookup error:', err.message);
        req.isRootDomain = true;
        next();
      });
    
    // Don't call next() here — it's called in the .then()/.catch() above
    return;
    
  } catch (error) {
    console.error('❌ Subdomain extraction error:', error);
    req.subdomain = null;
    req.isRootDomain = true;
    req.isApiDomain = false;
    req.isStoreDomain = false;
    req.isCustomDomain = false;
    next();
  }
};

/**
 * Middleware to require subdomain
 * Use this for routes that MUST have a subdomain
 */
export const requireSubdomain = (req, res, next) => {
  if (!req.subdomain) {
    return res.status(400).json({
      success: false,
      message: 'Subdomain required. Access via {store}.scalor.net'
    });
  }
  next();
};

/**
 * Middleware to require root domain
 * Use this for main SaaS routes
 */
export const requireRootDomain = (req, res, next) => {
  if (!req.isRootDomain) {
    return res.status(400).json({
      success: false,
      message: 'This endpoint is only available on the root domain'
    });
  }
  next();
};
