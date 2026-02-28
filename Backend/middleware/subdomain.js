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
 * - Lightweight and performant (no DB queries)
 */

export const extractSubdomain = (req, res, next) => {
  try {
    // Get host from headers (works behind Cloudflare / Railway proxy)
    // Priority: X-Forwarded-Host (set by Cloudflare/proxy) > Host > hostname
    const host = req.headers['x-forwarded-host'] || req.headers.host || req.hostname || '';
    
    // Remove port if present (e.g., localhost:8080)
    const hostname = host.split(':')[0].toLowerCase();
    
    // Split by dots
    const parts = hostname.split('.');
    
    // Ignore Railway internal domains (e.g., ecomcookpit-production.up.railway.app)
    if (hostname.endsWith('.railway.app') || hostname.endsWith('.railway.internal')) {
      req.subdomain = null;
      req.isRootDomain = true;
      return next();
    }
    
    // Root domain patterns to ignore
    const rootDomains = ['scalor.net', 'localhost', '127.0.0.1'];
    const isRootDomain = rootDomains.some(domain => hostname === domain || hostname === `www.${domain}`);
    
    if (isRootDomain) {
      // No subdomain - root domain access
      req.subdomain = null;
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
    
    req.subdomain = subdomain || null;
    req.isRootDomain = !subdomain;
    
    // Debug logging (always log for now to diagnose production issues)
    console.log(`🌐 [subdomain] Host: ${hostname} | X-Forwarded-Host: ${req.headers['x-forwarded-host'] || 'none'} → Subdomain: ${subdomain || 'root'}`);
    
    next();
  } catch (error) {
    console.error('❌ Subdomain extraction error:', error);
    req.subdomain = null;
    req.isRootDomain = true;
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
