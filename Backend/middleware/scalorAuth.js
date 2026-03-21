import ScalorApiKey from '../models/ScalorApiKey.js';
import ScalorUser from '../models/ScalorUser.js';

// In-memory cache for API key lookups (TTL: 60s)
const keyCache = new Map();
const CACHE_TTL = 60_000;

/**
 * Scalor API Key Authentication Middleware
 * 
 * Authenticates requests using API keys in the Authorization header.
 * Format: Authorization: Bearer sk_live_xxxxx
 * 
 * Sets req.scalorUser and req.scalorApiKey on success.
 */
export async function scalorAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'API key missing. Use Authorization: Bearer sk_live_xxx'
      });
    }

    const rawKey = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : authHeader.trim();

    if (!rawKey || !rawKey.startsWith('sk_')) {
      return res.status(401).json({
        error: 'invalid_key_format',
        message: 'Invalid API key format. Keys start with sk_live_ or sk_test_'
      });
    }

    // Check cache first
    const cached = keyCache.get(rawKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      req.scalorUser = cached.user;
      req.scalorApiKey = cached.apiKey;
      // Update last used (fire-and-forget)
      ScalorApiKey.updateOne({ _id: cached.apiKey._id }, { lastUsedAt: new Date() }).catch(() => {});
      return next();
    }

    // Look up API key
    const apiKey = await ScalorApiKey.findByRawKey(rawKey);

    if (!apiKey) {
      return res.status(403).json({
        error: 'invalid_api_key',
        message: 'API key is invalid or has been revoked'
      });
    }

    // Check expiration
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return res.status(403).json({
        error: 'api_key_expired',
        message: 'API key has expired. Generate a new one from your dashboard.'
      });
    }

    // Load user
    const user = await ScalorUser.findById(apiKey.userId);

    if (!user || !user.isActive) {
      return res.status(403).json({
        error: 'account_inactive',
        message: 'Your account is inactive or suspended'
      });
    }

    // Reset daily/monthly counters if needed
    user.checkAndResetCounters();

    // Cache result
    keyCache.set(rawKey, { user, apiKey, ts: Date.now() });

    // Update last used
    apiKey.lastUsedAt = new Date();
    apiKey.save().catch(() => {});

    req.scalorUser = user;
    req.scalorApiKey = apiKey;
    next();
  } catch (error) {
    console.error('❌ [Scalor Auth] Error:', error.message);
    return res.status(500).json({
      error: 'auth_error',
      message: 'Authentication service error'
    });
  }
}

/**
 * Check if user has a specific permission on their API key
 */
export function scalorRequirePermission(permission) {
  return (req, res, next) => {
    // Dashboard JWT flow has a scoped user session but no API key object.
    if (req.scalorUser && !req.scalorApiKey) {
      return next();
    }

    if (!req.scalorApiKey) {
      return res.status(401).json({ error: 'not_authenticated' });
    }

    if (!req.scalorApiKey.permissions.includes(permission)) {
      return res.status(403).json({
        error: 'insufficient_permissions',
        message: `This API key does not have the '${permission}' permission`
      });
    }

    next();
  };
}

/**
 * Rate limiter per API key (sliding window)
 */
const rateLimitWindows = new Map();

export function scalorRateLimit(req, res, next) {
  const keyId = req.scalorApiKey?._id?.toString();
  if (!keyId) return next();

  const maxRequests = req.scalorApiKey.rateLimit || 60;
  const windowMs = 60_000; // 1 minute
  const now = Date.now();

  let window = rateLimitWindows.get(keyId);
  if (!window) {
    window = { requests: [], resetAt: now + windowMs };
    rateLimitWindows.set(keyId, window);
  }

  // Clean expired entries
  window.requests = window.requests.filter(ts => ts > now - windowMs);

  if (window.requests.length >= maxRequests) {
    const retryAfter = Math.ceil((window.requests[0] + windowMs - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', '0');
    return res.status(429).json({
      error: 'rate_limit_exceeded',
      message: `Too many requests. Limit: ${maxRequests}/min`,
      retryAfter
    });
  }

  window.requests.push(now);
  res.set('X-RateLimit-Limit', String(maxRequests));
  res.set('X-RateLimit-Remaining', String(maxRequests - window.requests.length));
  next();
}

// Cleanup expired rate limit windows periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of rateLimitWindows) {
    if (window.requests.every(ts => ts < now - 120_000)) {
      rateLimitWindows.delete(key);
    }
  }
}, 300_000); // Every 5 minutes
