/**
 * Utilitaires pour la validation et normalisation des clés VAPID et Push
 */

/**
 * Convertit une chaîne Base64 standard en Base64URL (sans padding)
 * @param {string} base64 - Chaîne en Base64 standard
 * @returns {string} Chaîne en Base64URL
 */
export const base64ToBase64Url = (base64) => {
  if (!base64) return base64;
  
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, ''); // Supprimer le padding
};

/**
 * Valide qu'une clé est en format Base64URL valide
 * @param {string} key - Clé à valider
 * @returns {boolean} true si valide
 */
export const isValidBase64Url = (key) => {
  if (!key || typeof key !== 'string') return false;
  
  // Base64URL utilise uniquement: A-Z, a-z, 0-9, -, _
  const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
  return base64UrlRegex.test(key);
};

/**
 * Valide et normalise une clé auth (doit faire 16 bytes = 22 caractères en Base64URL)
 * @param {string} auth - Clé auth
 * @returns {string} Clé auth normalisée
 * @throws {Error} Si la clé est invalide
 */
export const validateAndNormalizeAuth = (auth) => {
  if (!auth) {
    throw new Error('Clé auth manquante');
  }
  
  // Normaliser en Base64URL
  const normalized = base64ToBase64Url(auth);
  
  // Vérifier le format
  if (!isValidBase64Url(normalized)) {
    throw new Error('Clé auth invalide: doit être en Base64URL (A-Z, a-z, 0-9, -, _)');
  }
  
  // La clé auth doit faire 16 bytes = 22 caractères en Base64URL (sans padding)
  // Tolérance: entre 21 et 24 caractères
  if (normalized.length < 21 || normalized.length > 24) {
    throw new Error(`Clé auth invalide: longueur ${normalized.length}, attendu ~22 caractères`);
  }
  
  return normalized;
};

/**
 * Valide et normalise une clé p256dh (doit faire 65 bytes = 87 caractères en Base64URL)
 * @param {string} p256dh - Clé p256dh
 * @returns {string} Clé p256dh normalisée
 * @throws {Error} Si la clé est invalide
 */
export const validateAndNormalizeP256dh = (p256dh) => {
  if (!p256dh) {
    throw new Error('Clé p256dh manquante');
  }
  
  // Normaliser en Base64URL
  const normalized = base64ToBase64Url(p256dh);
  
  // Vérifier le format
  if (!isValidBase64Url(normalized)) {
    throw new Error('Clé p256dh invalide: doit être en Base64URL (A-Z, a-z, 0-9, -, _)');
  }
  
  // La clé p256dh doit faire 65 bytes = 87 caractères en Base64URL (sans padding)
  // Tolérance: entre 85 et 90 caractères
  if (normalized.length < 85 || normalized.length > 90) {
    throw new Error(`Clé p256dh invalide: longueur ${normalized.length}, attendu ~87 caractères`);
  }
  
  return normalized;
};

/**
 * Valide et normalise un objet subscription complet
 * @param {Object} subscription - Objet subscription
 * @returns {Object} Subscription normalisé
 * @throws {Error} Si le subscription est invalide
 */
export const validateAndNormalizeSubscription = (subscription) => {
  if (!subscription) {
    throw new Error('Subscription manquant');
  }
  
  if (!subscription.endpoint) {
    throw new Error('Endpoint manquant dans le subscription');
  }
  
  if (!subscription.keys) {
    throw new Error('Keys manquantes dans le subscription');
  }
  
  // Valider et normaliser les clés
  const normalizedAuth = validateAndNormalizeAuth(subscription.keys.auth);
  const normalizedP256dh = validateAndNormalizeP256dh(subscription.keys.p256dh);
  
  return {
    endpoint: subscription.endpoint,
    keys: {
      auth: normalizedAuth,
      p256dh: normalizedP256dh
    }
  };
};

/**
 * Valide une clé VAPID (publique ou privée)
 * @param {string} key - Clé VAPID
 * @param {string} type - Type de clé ('public' ou 'private')
 * @returns {boolean} true si valide
 */
export const validateVapidKey = (key, type = 'public') => {
  if (!key || typeof key !== 'string') {
    console.warn(`⚠️ Clé VAPID ${type} manquante ou invalide`);
    return false;
  }
  
  // Normaliser en Base64URL
  const normalized = base64ToBase64Url(key);
  
  // Vérifier le format Base64URL
  if (!isValidBase64Url(normalized)) {
    console.warn(`⚠️ Clé VAPID ${type} invalide: format Base64URL requis`);
    return false;
  }
  
  // Les clés VAPID font généralement 87-88 caractères
  if (normalized.length < 80 || normalized.length > 95) {
    console.warn(`⚠️ Clé VAPID ${type} invalide: longueur ${normalized.length}, attendu ~87 caractères`);
    return false;
  }
  
  return true;
};

export default {
  base64ToBase64Url,
  isValidBase64Url,
  validateAndNormalizeAuth,
  validateAndNormalizeP256dh,
  validateAndNormalizeSubscription,
  validateVapidKey
};
