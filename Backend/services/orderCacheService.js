import Redis from 'ioredis';
import crypto from 'crypto';

class OrderCacheService {
  constructor() {
    this.redis = null;
    this.enabled = false;
    
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableOfflineQueue: false
      });
      
      this.redis.on('error', (err) => {
        console.log('⚠️ Redis non disponible, cache désactivé');
        this.enabled = false;
      });
      
      this.redis.on('connect', () => {
        console.log('✅ Redis connecté, cache activé');
        this.enabled = true;
      });
      
      this.redis.connect().catch(() => {
        console.log('⚠️ Redis non disponible, fonctionnement sans cache');
        this.enabled = false;
      });
    } catch (error) {
      console.log('⚠️ Redis non disponible, fonctionnement sans cache');
      this.enabled = false;
    }
    
    this.defaultTTL = 300; // 5 minutes
    this.statsTTL = 600;   // 10 minutes
    this.listTTL = 180;    // 3 minutes
  }

  // Générer une clé de cache unique pour les requêtes
  generateCacheKey(params, workspaceId, userId) {
    const keyData = {
      workspaceId,
      userId,
      ...params,
      timestamp: Math.floor(Date.now() / (5 * 60 * 1000)) // Cache par blocs de 5 min
    };
    
    const hash = crypto.createHash('md5').update(JSON.stringify(keyData)).digest('hex');
    return `orders:list:${workspaceId}:${hash}`;
  }

  // Mettre en cache les résultats de commandes
  async cacheOrders(orders, stats, pagination, params, workspaceId, userId) {
    try {
      const key = this.generateCacheKey(params, workspaceId, userId);
      const data = {
        orders,
        stats,
        pagination,
        cachedAt: new Date().toISOString(),
        params
      };
      
      await this.redis.setex(key, this.listTTL, JSON.stringify(data));
      console.log(`📦 Cache mis à jour: ${key}`);
      return true;
    } catch (error) {
      console.error('❌ Erreur cache orders:', error);
      return false;
    }
  }

  // Récupérer depuis le cache
  async getCachedOrders(params, workspaceId, userId) {
    try {
      const key = this.generateCacheKey(params, workspaceId, userId);
      const cached = await this.redis.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`📦 Cache trouvé: ${key} (${data.orders?.length || 0} commandes)`);
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erreur récupération cache:', error);
      return null;
    }
  }

  // Invalider le cache pour un workspace
  async invalidateWorkspaceCache(workspaceId) {
    try {
      const pattern = `orders:list:${workspaceId}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`🗑️ Cache invalidé: ${keys.length} clés supprimées pour ${workspaceId}`);
      }
      
      return keys.length;
    } catch (error) {
      console.error('❌ Erreur invalidation cache:', error);
      return 0;
    }
  }

  // Mettre en cache les statistiques
  async cacheStats(stats, params, workspaceId) {
    try {
      const key = `orders:stats:${workspaceId}:${JSON.stringify(params)}`;
      await this.redis.setex(key, this.statsTTL, JSON.stringify({
        ...stats,
        cachedAt: new Date().toISOString()
      }));
      return true;
    } catch (error) {
      console.error('❌ Erreur cache stats:', error);
      return false;
    }
  }

  // Récupérer les stats depuis le cache
  async getCachedStats(params, workspaceId) {
    try {
      const key = `orders:stats:${workspaceId}:${JSON.stringify(params)}`;
      const cached = await this.redis.get(key);
      
      if (cached) {
        console.log(`📦 Cache stats trouvé: ${key}`);
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erreur récupération cache stats:', error);
      return null;
    }
  }

  // Cache pour les commandes récentes (polling)
  async cacheRecentOrders(orders, workspaceId, sourceId) {
    try {
      const key = `orders:recent:${workspaceId}:${sourceId || 'all'}`;
      await this.redis.setex(key, 60, JSON.stringify({
        orders,
        cachedAt: new Date().toISOString()
      }));
      return true;
    } catch (error) {
      console.error('❌ Erreur cache recent orders:', error);
      return false;
    }
  }

  // Récupérer les commandes récentes depuis le cache
  async getRecentOrders(workspaceId, sourceId) {
    try {
      const key = `orders:recent:${workspaceId}:${sourceId || 'all'}`;
      const cached = await this.redis.get(key);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erreur récupération recent orders:', error);
      return null;
    }
  }

  // Préchauffer le cache pour les requêtes courantes
  async warmupCache(workspaceId, userId) {
    try {
      const commonQueries = [
        { page: 1, limit: 50 },
        { page: 1, limit: 50, status: 'pending' },
        { page: 1, limit: 50, status: 'confirmed' },
        { page: 1, limit: 50, status: 'delivered' },
        { page: 1, limit: 50, period: '7days' }
      ];

      console.log(`🔥 Début warmup cache pour ${workspaceId}`);
      
      // Cette méthode sera appelée depuis le contrôleur pour précharger
      return commonQueries;
    } catch (error) {
      console.error('❌ Erreur warmup cache:', error);
      return [];
    }
  }

  // Obtenir les statistiques du cache
  async getCacheStats(workspaceId) {
    try {
      const pattern = `orders:*:${workspaceId}:*`;
      const keys = await this.redis.keys(pattern);
      
      const stats = {
        totalKeys: keys.length,
        listKeys: keys.filter(k => k.includes(':list:')).length,
        statsKeys: keys.filter(k => k.includes(':stats:')).length,
        recentKeys: keys.filter(k => k.includes(':recent:')).length
      };
      
      return stats;
    } catch (error) {
      console.error('❌ Erreur stats cache:', error);
      return null;
    }
  }

  // Fermer la connexion Redis
  async disconnect() {
    await this.redis.quit();
  }
}

export default new OrderCacheService();
