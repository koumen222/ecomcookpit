let publicStorefrontPromise;
let storeProductPagePromise;
let storeCheckoutPromise;
let premiumPagePromise;

export function preloadPublicStorefrontRoute() {
  if (!publicStorefrontPromise) {
    publicStorefrontPromise = import('../pages/PublicStorefront.jsx');
  }

  return publicStorefrontPromise;
}

export function preloadStoreAllProductsRoute() {
  return preloadPublicStorefrontRoute();
}

export function preloadStoreProductRoute() {
  if (!storeProductPagePromise) {
    storeProductPagePromise = import('../pages/StoreProductPage.jsx');
  }

  return storeProductPagePromise;
}

export function preloadStoreCheckoutRoute() {
  if (!storeCheckoutPromise) {
    storeCheckoutPromise = import('../pages/StoreCheckout.jsx');
  }

  return storeCheckoutPromise;
}

export function preloadStoreRoutesOnIdle() {
  if (typeof window === 'undefined') return;

  const run = () => {
    preloadStoreProductRoute().catch(() => {});
    preloadStoreCheckoutRoute().catch(() => {});
    // Also preload the premium page chunk so it's ready on first navigation
    if (!premiumPagePromise) {
      premiumPagePromise = import('../components/StoreProductPagePremium.jsx').catch(() => {});
    }
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 1800 });
    return;
  }

  window.setTimeout(run, 500);
}
