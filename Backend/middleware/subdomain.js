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
 * - Lightweight and performant (no DB queries)
 * 
 * Routing matrix:
 *   scalor.net          → isRootDomain=true  (redirect to Cloudflare Pages)
 *   api.scalor.net      → isApiDomain=true   (API routes only)
 *   koumen.scalor.net   → isStoreDomain=true (serve React build + API)
 *   *.railway.app       → isRootDomain=true  (health checks, internal)
 */

// System subdomains that are NOT tenant stores
const SYSTEM_SUBDOMAINS = ['api', 'admin', 'mail', 'smtp', 'ftp', 'cdn', 'static'];

export const extractSubdomain = (req, res, next) => {
  try {
    // Get host from headers (works behind Cloudflare / Railway proxy)
    // Priority: X-Forwarded-Host (set by Cloudflare/proxy) > Host > hostname
    const host = req.headers['x-forwarded-host'] || req.headers.host || req.hostname || '';
    
    // Remove port if present (e.g., localhost:8080)
    const hostname = host.split(':')[0].toLowerCase();
    
    // Split by dots
    const parts = hostname.split('.');
    
    // Default flags
    req.subdomain = null;
    req.isRootDomain = false;
    req.isApiDomain = false;
    req.isStoreDomain = false;
    
    // Ignore Railway internal domains (e.g., ecomcookpit-production.up.railway.app)
    if (hostname.endsWith('.railway.app') || hostname.endsWith('.railway.internal')) {
      req.isRootDomain = true;
      return next();
    }
    
    // Root domain patterns to ignore
    const rootDomains = ['scalor.net', 'localhost', '127.0.0.1'];
    const isRootDomain = rootDomains.some(domain => hostname === domain || hostname === `www.${domain}`);
    
    if (isRootDomain) {
      req.isRootDomain = true;
      return next();
    }
    
    // Extract subdomain from *.scalor.net
    // For nike.scalor.net → parts = ['nike', 'scalor', 'net']
    // For www.nike.scalor.net → parts = ['www', 'nike', 'scalor', 'net']
    let subdomain = null;
    
    if (parts.length >= 3) {
      // Get first part, ignore 'www'
      subdomain = parts[0] === 'www' ? parts[1] : parts[0];
    }
    
    // Validate subdomain format (alphanumeric, hyphens, 1-63 chars)
    if (subdomain) {
      const isValid = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain);
      if (!isValid) {
        subdomain = null;
      }
    }
    
    // Detect api.scalor.net → API-only domain (no React build serving)
    if (subdomain === 'api') {
      req.isApiDomain = true;
      req.subdomain = null;
      req.isRootDomain = false;
      return next();
    }
    
    // Detect other system subdomains (admin, cdn, etc.)
    if (subdomain && SYSTEM_SUBDOMAINS.includes(subdomain)) {
      req.subdomain = null;
      req.isRootDomain = true;
      return next();
    }
    
    // Valid tenant subdomain → store domain
    req.subdomain = subdomain || null;
    req.isRootDomain = !subdomain;
    req.isStoreDomain = !!subdomain;
    
    // Debug logging (reduce in production later)
    if (process.env.NODE_ENV !== 'production' || subdomain) {
      console.log(`🌐 [subdomain] Host: ${hostname} → ${subdomain ? `Store: ${subdomain}` : 'root'} | API: ${req.isApiDomain}`);
    }
    
    next();
  } catch (error) {
    console.error('❌ Subdomain extraction error:', error);
    req.subdomain = null;
    req.isRootDomain = true;
    req.isApiDomain = false;
    req.isStoreDomain = false;
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
