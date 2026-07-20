// ─────────────────────────────────────────────────────────────────────────────
// Parcours « boutique d'abord » — séquence de création de la boutique après
// authentification. Utilisé par le funnel d'inscription (Register.jsx) et la
// page de reprise (/ecom/onboarding/boutique).
// ─────────────────────────────────────────────────────────────────────────────
import { storesApi, storeManageApi, mediaApi } from '../services/storeApi';

export const PENDING_STORE_KEY = 'scalorPendingStoreSetup';

export const readPendingStoreSetup = () => {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_STORE_KEY) || 'null');
  } catch { return null; }
};

export const savePendingStoreSetup = (setup) => {
  try { sessionStorage.setItem(PENDING_STORE_KEY, JSON.stringify(setup)); } catch { /* mode privé */ }
};

export const clearPendingStoreSetup = () => {
  try { sessionStorage.removeItem(PENDING_STORE_KEY); } catch { /* noop */ }
};

// Crée la boutique (Store) puis applique la config (logo, couleur, devise,
// WhatsApp). Lève une erreur seulement si la CRÉATION échoue : la config est
// non bloquante (réglable ensuite dans les paramètres).
// Retourne l'id de la boutique créée.
export async function createStoreFromSetup(setup, logoFile) {
  const createRes = await storesApi.createStore({
    name: setup.storeName.trim(),
    subdomain: setup.subdomain,
    storeCurrency: setup.storeCurrency,
  });
  const newStore = createRes.data?.data;
  const storeId = newStore?._id || null;
  const cfg = storeId ? { headers: { 'X-Store-Id': storeId } } : undefined;

  let storeLogo = '';
  if (logoFile) {
    try {
      const up = await mediaApi.upload(logoFile);
      storeLogo = up.data?.data?.url || '';
    } catch (e) { console.warn('Upload logo onboarding:', e?.message); }
  }

  try {
    await storeManageApi.updateStoreConfig({
      storeName: setup.storeName.trim(),
      ...(storeLogo ? { storeLogo } : {}),
      storeThemeColor: setup.themeColor,
      storeCurrency: setup.storeCurrency,
      storeWhatsApp: setup.storeWhatsApp?.trim() || '',
      isStoreEnabled: true,
    }, cfg);
  } catch (e) { console.warn('Config boutique onboarding:', e?.message); }

  // Session locale : l'onboarding est terminé.
  try {
    const u = JSON.parse(localStorage.getItem('ecomUser') || 'null');
    if (u) {
      u.needsStoreSetup = false;
      if (storeId) u.storeId = storeId;
      localStorage.setItem('ecomUser', JSON.stringify(u));
    }
  } catch { /* localStorage indisponible */ }
  clearPendingStoreSetup();

  return storeId;
}

// Guard « boutique d'abord » : vrai pour un NOUVEL admin dont la boutique
// n'existe pas encore. Les comptes existants (flag absent) et les rôles
// invités ne sont jamais concernés.
export const needsStoreOnboarding = (user) => (
  user?.role === 'ecom_admin'
  && user?.needsStoreSetup === true
  && !user?.storeId
);
