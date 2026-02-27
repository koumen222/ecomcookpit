/**
 * Cache mémoire global — persiste entre les navigations React Router
 * (détruit uniquement si la page est rechargée via F5 / ouverture d'onglet)
 */
const cache = new Map();

const TTL = 2 * 60 * 1000; // 2 minutes par défaut

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

export function invalidateCache(key) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

export function invalidatePrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
