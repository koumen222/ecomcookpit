import Redis from 'ioredis';
import { Cluster } from 'ioredis';

class OptimizedRedisClient {
  constructor() {
    this.client = null;
    this.subscriber = null;
    this.enabled = false;
    this.initRedis();
  }

  initRedis() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: 0,
        retryStrategy: (times) => Math.min(times * 50, 2000),
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
        enableOfflineQueue: true,
        lazyConnect: false,
        // Performance optimizations
        connectionPoolSize: 10,
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        }
      };

      // Use cluster if multiple nodes provided
      if (process.env.REDIS_CLUSTER_NODES) {
        const nodes = process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
          const [host, port] = node.trim().split(':');
          return { host, port: parseInt(port) };
        });

        this.client = new Cluster(nodes, {
          ...redisConfig,
          enableReadyCheck: false,
          scaleReads: 'master' // or 'slave', 'all'
        });
      } else {
        this.client = new Redis(redisConfig);
      }

      this.client.on('connect', () => {
        console.log('✅ Redis connected (optimized)');
        this.enabled = true;
      });

      this.client.on('error', (err) => {
        console.warn('⚠️ Redis error:', err.message);
        this.enabled = false;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
      });

      // Test connection
      this.client.ping().catch(() => {
        this.enabled = false;
        console.log('⚠️ Redis unavailable, running without cache');
      });
    } catch (error) {
      console.warn('⚠️ Redis init failed:', error.message);
      this.enabled = false;
    }
  }

  /**
   * Multi-get with pipeline (much faster than individual gets)
   */
  async multiGet(keys) {
    if (!this.enabled || !keys.length) return {};
    
    try {
      const pipeline = this.client.pipeline();
      keys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();
      
      const data = {};
      keys.forEach((key, idx) => {
        if (results[idx][0] === null && results[idx][1]) {
          data[key] = JSON.parse(results[idx][1]);
        }
      });
      return data;
    } catch (error) {
      console.error('❌ MultiGet error:', error);
      return {};
    }
  }

  /**
   * Multi-set with pipeline
   */
  async multiSet(entries, ttlSeconds = 300) {
    if (!this.enabled) return false;
    
    try {
      const pipeline = this.client.pipeline();
      
      for (const [key, value] of Object.entries(entries)) {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        pipeline.setex(key, ttlSeconds, serialized);
      }
      
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('❌ MultiSet error:', error);
      return false;
    }
  }

  /**
   * Get with automatic refresh
   */
  async getWithRefresh(key, fetcher, ttlSeconds = 300) {
    if (!this.enabled) {
      return fetcher();
    }

    try {
      // Try cache first
      const cached = await this.client.get(key);
      if (cached) {
        return JSON.parse(cached);
      }

      // Cache miss - fetch and store
      const data = await fetcher();
      await this.client.setex(key, ttlSeconds, JSON.stringify(data));
      return data;
    } catch (error) {
      console.error('❌ GetWithRefresh error:', error);
      return fetcher();
    }
  }

  /**
   * Increment counter (useful for rate limiting, stats)
   */
  async increment(key, amount = 1, ttlSeconds = 60) {
    if (!this.enabled) return 0;
    
    try {
      const pipeline = this.client.pipeline();
      pipeline.incrby(key, amount);
      pipeline.expire(key, ttlSeconds);
      const results = await pipeline.exec();
      return results[0][1];
    } catch (error) {
      console.error('❌ Increment error:', error);
      return 0;
    }
  }

  /**
   * Delete by prefix pattern (useful for invalidation)
   */
  async delByPattern(pattern) {
    if (!this.enabled) return 0;
    
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      
      const pipeline = this.client.pipeline();
      keys.forEach(key => pipeline.del(key));
      await pipeline.exec();
      
      console.log(`🗑️  Deleted ${keys.length} keys matching ${pattern}`);
      return keys.length;
    } catch (error) {
      console.error('❌ DelByPattern error:', error);
      return 0;
    }
  }

  /**
   * Set with NX (only if not exists) + get previous
   */
  async setIfNotExists(key, value, ttlSeconds = 300) {
    if (!this.enabled) return { set: true, previous: null };
    
    try {
      const previous = await this.client.get(key);
      const result = await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds, 'NX');
      
      return {
        set: result === 'OK',
        previous: previous ? JSON.parse(previous) : null
      };
    } catch (error) {
      console.error('❌ SetIfNotExists error:', error);
      return { set: false, previous: null };
    }
  }

  /**
   * Atomic counter with expiration
   */
  async getOrInit(key, initialValue = 0, ttlSeconds = 300) {
    if (!this.enabled) return initialValue;
    
    try {
      const existing = await this.client.get(key);
      if (existing !== null) {
        return JSON.parse(existing);
      }
      
      await this.client.setex(key, ttlSeconds, JSON.stringify(initialValue));
      return initialValue;
    } catch (error) {
      console.error('❌ GetOrInit error:', error);
      return initialValue;
    }
  }

  /**
   * List operations (push, pop, range)
   */
  async listOps(key, operation, values = [], ttlSeconds = 300) {
    if (!this.enabled) return null;
    
    try {
      let result;
      const pipeline = this.client.pipeline();
      
      switch (operation) {
        case 'push':
          pipeline.rpush(key, ...values);
          break;
        case 'pop':
          result = await this.client.lpop(key, values[0] || 1);
          break;
        case 'range':
          result = await this.client.lrange(key, values[0], values[1]);
          return result;
        case 'len':
          result = await this.client.llen(key);
          return result;
      }
      
      if (operation !== 'pop' && operation !== 'range' && operation !== 'len') {
        pipeline.expire(key, ttlSeconds);
        await pipeline.exec();
      }
      
      return result;
    } catch (error) {
      console.error('❌ ListOps error:', error);
      return null;
    }
  }

  /**
   * Hash operations (set, get, getAll)
   */
  async hashOps(key, operation, field = null, value = null) {
    if (!this.enabled) return null;
    
    try {
      switch (operation) {
        case 'set':
          await this.client.hset(key, field, JSON.stringify(value));
          break;
        case 'get':
          const result = await this.client.hget(key, field);
          return result ? JSON.parse(result) : null;
        case 'getall':
          const all = await this.client.hgetall(key);
          const parsed = {};
          for (const [k, v] of Object.entries(all)) {
            try {
              parsed[k] = JSON.parse(v);
            } catch {
              parsed[k] = v;
            }
          }
          return parsed;
        case 'del':
          await this.client.hdel(key, field);
          break;
      }
    } catch (error) {
      console.error('❌ HashOps error:', error);
      return null;
    }
  }

  /**
   * Get Redis info for monitoring
   */
  async getStats() {
    if (!this.enabled) return null;
    
    try {
      const info = await this.client.info('stats');
      const memory = await this.client.info('memory');
      const clients = await this.client.info('clients');
      
      return {
        stats: info,
        memory: memory,
        clients: clients,
        enabled: this.enabled
      };
    } catch (error) {
      console.error('❌ GetStats error:', error);
      return null;
    }
  }

  /**
   * Clear entire cache (dangerous!)
   */
  async flushAll() {
    if (!this.enabled) return false;
    
    try {
      await this.client.flushall();
      console.log('🔥 Cache cleared');
      return true;
    } catch (error) {
      console.error('❌ FlushAll error:', error);
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.client) {
      await this.client.quit();
      console.log('👋 Redis disconnected');
    }
  }
}

export const redisClient = new OptimizedRedisClient();
