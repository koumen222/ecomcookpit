// Cache mémoire simple avec TTL — pas besoin de Redis
const cache = new Map();

export const memCache = {
  get(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    return entry.value;
  },

  set(key, value, ttlMs = 30000) {
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  },

  del(key) {
    cache.delete(key);
  },

  // Invalider toutes les clés qui commencent par un préfixe (ex: workspace)
  delByPrefix(prefix) {
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) cache.delete(key);
    }
  },

  size() {
    return cache.size;
  }
};
