/**
 * Helper middleware for easy cache integration in routes
 */

import { redisClient } from '../config/redisOptimized.js';
import { memCache } from './memoryCache.js';

/**
 * Cache decorator for routes
 * Usage: app.get('/api/endpoint', cacheMiddleware(300), handler)
 */
export function cacheMiddleware(ttlSeconds = 300, useRedis = true) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = generateCacheKey(req);

    // Try memory cache first (fast)
    const memCached = memCache.get(cacheKey);
    if (memCached) {
      console.log(`📦 Memory cache hit: ${req.path}`);
      return res.json(memCached);
    }

    // Try Redis (if enabled)
    if (useRedis && redisClient.enabled) {
      try {
        const redisCached = await redisClient.client.get(cacheKey);
        if (redisCached) {
          const data = JSON.parse(redisCached);
          memCache.set(cacheKey, data, 30000); // Cache in memory for 30s
          console.log(`🔴 Redis cache hit: ${req.path}`);
          return res.json(data);
        }
      } catch (error) {
        console.error('Redis cache error:', error);
      }
    }

    // No cache hit, intercept response
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      // Cache successful responses
      if (res.statusCode === 200) {
        memCache.set(cacheKey, data, 30000);
        
        if (useRedis && redisClient.enabled) {
          redisClient.client.setex(
            cacheKey,
            ttlSeconds,
            JSON.stringify(data)
          ).catch(err => console.error('Cache write error:', err));
        }
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Invalidate cache for a pattern
 * Usage: await invalidateCache('/api/orders/*')
 */
export async function invalidateCache(pattern) {
  const prefix = pattern.replace('/*', '').replace('/api', '');
  
  // Clear memory cache
  memCache.delByPrefix(prefix);
  
  // Clear Redis
  if (redisClient.enabled) {
    await redisClient.delByPattern(`*${prefix}*`);
  }
  
  console.log(`🗑️ Cache invalidated for pattern: ${pattern}`);
}

/**
 * Cache control headers
 */
export function setCacheHeaders(req, res, next) {
  // Static assets - long cache
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // API - no cache
  else if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  // HTML - revalidate
  else {
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
  }
  
  next();
}

/**
 * Generate cache key from request
 */
export function generateCacheKey(req) {
  const user = req.user?.id || 'anon';
  const query = Object.entries(req.query)
    .sort()
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  
  return `${req.path}:${query}:${user}`;
}

/**
 * Warming cache - pre-load data
 * Usage: await warmCache('orders', () => getOrders())
 */
export async function warmCache(key, fetcher, ttlSeconds = 300) {
  try {
    const data = await fetcher();
    
    memCache.set(key, data, 30000);
    if (redisClient.enabled) {
      await redisClient.client.setex(key, ttlSeconds, JSON.stringify(data));
    }
    
    console.log(`🔥 Cache warmed: ${key}`);
    return data;
  } catch (error) {
    console.error(`Failed to warm cache for ${key}:`, error);
  }
}

/**
 * Stale-while-revalidate pattern
 * Serve stale data while refreshing in background
 */
export async function staleWhileRevalidate(key, fetcher, maxAge = 300) {
  // Try cache first
  const cached = memCache.get(key);
  if (cached) {
    // Refresh in background (don't await)
    if (redisClient.enabled) {
      fetcher()
        .then(data => {
          memCache.set(key, data, 30000);
          redisClient.client.setex(key, maxAge, JSON.stringify(data));
        })
        .catch(err => console.error('Background refresh failed:', err));
    }
    return cached;
  }

  // Cache miss - fetch immediately
  const data = await fetcher();
  memCache.set(key, data, 30000);
  if (redisClient.enabled) {
    redisClient.client.setex(key, maxAge, JSON.stringify(data));
  }

  return data;
}

/**
 * Cache stats endpoint helper
 */
export async function getCacheStats() {
  const memStats = {
    size: memCache.size(),
    type: 'memory'
  };

  const redisStats = await redisClient.getStats();

  return {
    memory: memStats,
    redis: redisStats
  };
}
