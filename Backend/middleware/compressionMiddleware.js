import compression from 'compression';

/**
 * Advanced compression middleware with optimizations
 */

export function setupAdvancedCompression(app) {
  // Custom compression that handles different content types optimally
  app.use(compression({
    // Compress responses larger than 1KB
    threshold: 1024,
    // Use gzip and brotli if supported (brotli is slower but better compression)
    level: 6, // 6 is good balance between speed and compression
    // Compress these types
    type: [
      'application/json',
      'application/javascript',
      'text/css',
      'text/html',
      'text/plain',
      'text/xml',
      'application/xml',
      'application/xml+rss',
      'text/javascript',
      'application/x-javascript',
      'image/svg+xml'
    ]
  }));

  // Additional performance headers
  app.use((req, res, next) => {
    // Cache headers for static assets
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', `"${Date.now()}"`);
    }
    
    // API responses - no cache
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    next();
  });
}

/**
 * Selective response compression
 */
export function shouldCompress(req, res) {
  // Don't compress already compressed responses
  if (res.getHeader('content-encoding')) {
    return false;
  }

  // Compress large responses
  return compression.filter(req, res);
}
