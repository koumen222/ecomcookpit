/**
 * Middleware d'optimisation pour Express
 * - Compression gzip
 * - Headers de cache optimisés
 * - Requêtes ultra-rapides (< 300ms)
 */

import compression from 'compression';
import helmet from 'helmet';

/**
 * Configuration de compression optimisée
 */
export const optimizedCompression = compression({
  // Niveau de compression (1-9, 6 = bon équilibre vitesse/taille)
  level: 6,
  
  // Ne compresser que les réponses > 1KB
  threshold: 1024,
  
  // Filtrer les types à compresser
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    
    // Compresser JSON, HTML, CSS, JS
    const contentType = res.getHeader('Content-Type') || '';
    return /json|text|javascript|css|html|svg/.test(contentType);
  }
});

/**
 * Headers de cache optimisés
 */
export const cacheHeaders = (maxAge = 300) => (req, res, next) => {
  // Ne pas mettre en cache les requêtes d'API sensibles
  if (req.method !== 'GET') {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    return next();
  }

  // Ne pas mettre en cache les routes auth
  if (req.path.includes('/auth/') || req.path.includes('/login') || req.path.includes('/register')) {
    res.set({
      'Cache-Control': 'no-store'
    });
    return next();
  }

  // Cache pour les requêtes GET avec données fréquemment accédées
  res.set({
    'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
    'Vary': 'Authorization, X-Workspace-Id'
  });

  next();
};

/**
 * Middleware de performance monitoring
 */
export const performanceMonitor = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log si la requête est lente (> 300ms)
    if (duration > 300) {
      console.warn(`⚠️ Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
    
    // Header de timing pour debug
    if (process.env.NODE_ENV !== 'production') {
      res.setHeader('X-Response-Time', `${duration}ms`);
    }
  });

  next();
};

/**
 * Middleware de rate limiting intelligent
 * Permet plus de requêtes pour les données fréquemment accédées
 */
export const smartRateLimit = () => {
  const requests = new Map();
  const WINDOW_MS = 60000; // 1 minute
  const MAX_REQUESTS = 100; // 100 requêtes par minute par IP
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    // Ne pas limiter en développement
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    
    // Récupérer les requêtes de cette IP
    let userRequests = requests.get(ip) || [];
    
    // Nettoyer les vieilles requêtes
    userRequests = userRequests.filter(time => now - time < WINDOW_MS);
    
    // Vérifier la limite
    if (userRequests.length >= MAX_REQUESTS) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((userRequests[0] + WINDOW_MS - now) / 1000)
      });
    }
    
    // Enregistrer cette requête
    userRequests.push(now);
    requests.set(ip, userRequests);
    
    // Headers de rate limit
    res.set({
      'X-RateLimit-Limit': MAX_REQUESTS,
      'X-RateLimit-Remaining': Math.max(0, MAX_REQUESTS - userRequests.length),
      'X-RateLimit-Reset': new Date(now + WINDOW_MS).toISOString()
    });
    
    next();
  };
};

/**
 * Middleware de CORS optimisé
 */
export const optimizedCors = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      /^https:\/\/.*\.ecomcookpit\.pages\.dev$/,
      /^https:\/\/.*\.scalor\.net$/
    ].filter(Boolean);
    
    if (!origin || allowedOrigins.some(o => {
      if (o instanceof RegExp) return o.test(origin);
      return o === origin;
    })) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id', 'X-Requested-With'],
  exposedHeaders: ['X-Response-Time', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400 // 24 heures
};

/**
 * Middleware de sécurité optimisé (sans casser la perf)
 */
export const optimizedSecurity = helmet({
  contentSecurityPolicy: false, // Désactivé pour éviter conflits avec inline scripts
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Middleware de pagination optimisée
 */
export const pagination = (defaultLimit = 20, maxLimit = 100) => (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit) || defaultLimit));
  
  req.pagination = {
    page,
    limit,
    skip: (page - 1) * limit
  };
  
  // Helper pour formater la réponse paginée
  res.paginatedJson = (data, total) => {
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null
      }
    });
  };
  
  next();
};

/**
 * Middleware de sélection de champs (projection)
 */
export const fieldSelection = (req, res, next) => {
  const fields = req.query.fields;
  
  if (fields) {
    req.projection = fields.split(',').reduce((acc, field) => {
      acc[field.trim()] = 1;
      return acc;
    }, {});
  }
  
  next();
};

/**
 * Middleware de tri
 */
export const sorting = (defaultSort = '-createdAt') => (req, res, next) => {
  const sort = req.query.sort || defaultSort;
  req.sort = sort;
  next();
};

/**
 * Middleware de filtrage
 */
export const filtering = (allowedFilters = []) => (req, res, next) => {
  const filter = {};
  
  allowedFilters.forEach(field => {
    if (req.query[field] !== undefined) {
      // Support pour les opérateurs (gte, lte, ne, etc.)
      if (typeof req.query[field] === 'object') {
        filter[field] = req.query[field];
      } else {
        filter[field] = req.query[field];
      }
    }
  });
  
  // Support pour la recherche texte
  if (req.query.q || req.query.search) {
    filter.$text = { $search: req.query.q || req.query.search };
  }
  
  req.filter = filter;
  next();
};

/**
 * Middleware de cache en mémoire simple (sans Redis)
 */
export const memoryCache = (ttlSeconds = 300) => {
  const cache = new Map();
  
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    
    const key = `${req.originalUrl}:${req.headers.authorization || 'no-auth'}`;
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < ttlSeconds * 1000) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached.data);
    }
    
    // Intercepter la réponse
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      cache.set(key, { data, timestamp: Date.now() });
      res.setHeader('X-Cache', 'MISS');
      return originalJson(data);
    };
    
    next();
  };
};

/**
 * Combiner tous les middlewares d'optimisation
 */
export const applyOptimizations = (app) => {
  // Compression
  app.use(optimizedCompression);
  
  // Headers de cache
  app.use(cacheHeaders());
  
  // Monitoring de performance
  app.use(performanceMonitor);
  
  console.log('✅ Optimizations middlewares applied');
};

export default {
  optimizedCompression,
  cacheHeaders,
  performanceMonitor,
  smartRateLimit,
  optimizedCors,
  optimizedSecurity,
  pagination,
  fieldSelection,
  sorting,
  filtering,
  memoryCache,
  applyOptimizations
};
