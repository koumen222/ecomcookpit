/**
 * Cache mémoire global — persiste entre les navigations React Router
 * (détruit uniquement si la page est rechargée via F5 / ouverture d'onglet)
 */
const cache = new Map();

const TTL = 2 * 60 * 1000; // 2 minutes par défaut

export function getCached(key) {
  // ❌ CACHE DÉSACTIVÉ - Retourne toujours null
  return null;
}

export function setCached(key, data) {
  // ❌ CACHE DÉSACTIVÉ - Ne stocke rien
  return;
}

export function invalidateCache(key) {
  // ❌ CACHE DÉSACTIVÉ - Ne fait rien
  return;
}

export function invalidatePrefix(prefix) {
  // ❌ CACHE DÉSACTIVÉ - Ne fait rien
  return;
}
