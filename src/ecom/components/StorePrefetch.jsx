import React, { forwardRef, useCallback } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { publicStoreApi } from '../services/storeApi.js';

/**
 * Cache de produits pour le store
 * Persiste entre les navigations
 */
const storeCache = new Map();
const productCache = new Map();

export function getCachedStore(subdomain) {
  return storeCache.get(subdomain);
}

export function setCachedStore(subdomain, data) {
  storeCache.set(subdomain, { data, timestamp: Date.now() });
}

export function getCachedProduct(subdomain, slug) {
  return productCache.get(`${subdomain}:${slug}`);
}

export function setCachedProduct(subdomain, slug, data) {
  productCache.set(`${subdomain}:${slug}`, { data, timestamp: Date.now() });
}

/**
 * Link optimisé pour le Store avec préchargement
 * Précharge les données produit au hover
 */
export const StorePrefetchLink = forwardRef(({
  to,
  children,
  prefetchData = null,
  className = '',
  style = {},
  onClick,
  ...props
}, ref) => {
  const navigate = useNavigate();
  const prefetchTimeout = React.useRef(null);

  // Précharger les données au hover
  const handleMouseEnter = useCallback(() => {
    if (!prefetchData) return;
    
    prefetchTimeout.current = setTimeout(() => {
      prefetchData();
    }, 50);
  }, [prefetchData]);

  const handleMouseLeave = useCallback(() => {
    if (prefetchTimeout.current) {
      clearTimeout(prefetchTimeout.current);
    }
  }, []);

  const handleClick = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) return;
    
    e.preventDefault();
    
    // Précharger immédiatement
    if (prefetchData) prefetchData();
    
    // Navigation fluide
    requestAnimationFrame(() => {
      navigate(to);
    });
    
    if (onClick) onClick(e);
  }, [to, navigate, prefetchData, onClick]);

  // Support tactile
  const handleTouchStart = useCallback(() => {
    if (prefetchData) prefetchData();
  }, [prefetchData]);

  return (
    <RouterLink
      ref={ref}
      to={to}
      className={className}
      style={{
        textDecoration: 'none',
        transition: 'opacity 0.15s, transform 0.15s',
        ...style
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
      {...props}
    >
      {children}
    </RouterLink>
  );
});

StorePrefetchLink.displayName = 'StorePrefetchLink';

/**
 * ProductCard avec préchargement automatique
 */
export const StoreProductCard = forwardRef(({
  product,
  storePrefix,
  onPrefetch,
  ...props
}, ref) => {
  const handleMouseEnter = useCallback(() => {
    // Précharger le produit au hover
    if (onPrefetch) {
      onPrefetch(product.slug);
    }
  }, [product.slug, onPrefetch]);

  return (
    <StorePrefetchLink
      ref={ref}
      to={`${storePrefix}/product/${product.slug}`}
      prefetchData={() => onPrefetch?.(product.slug)}
      style={{
        display: 'block',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      <div style={{ position: 'relative', paddingBottom: '100%' }}>
        <OptimizedStoreImage
          src={product.image || product.images?.[0]}
          alt={product.name}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </div>
      <div style={{ padding: 16 }}>
        <h3 style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--s-text)',
          margin: 0,
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {product.name}
        </h3>
        <p style={{
          fontSize: 17,
          fontWeight: 700,
          color: 'var(--s-primary)',
          margin: '8px 0 0 0',
        }}>
          {new Intl.NumberFormat('fr-FR').format(product.price)} {product.currency || 'XAF'}
        </p>
      </div>
    </StorePrefetchLink>
  );
});

StoreProductCard.displayName = 'StoreProductCard';

/**
 * Image optimisée pour le store avec lazy loading
 */
export const OptimizedStoreImage = forwardRef(({
  src,
  alt,
  className = '',
  style = {},
  priority = false,
  ...props
}, ref) => {
  const [isLoaded, setIsLoaded] = React.useState(true);
  const imgRef = React.useRef(null);

  React.useEffect(() => {
    if (imgRef.current?.complete) {
      setIsLoaded(true);
    }
  }, []);

  // Conversion WebP si possible
  const webpSrc = typeof src === 'string' ? src.replace(/\.(jpg|jpeg|png)$/i, '.webp') : null;

  return (
    <picture
      ref={ref}
      className={className}
      style={{
        display: 'block',
        opacity: isLoaded ? 1 : 1, // Forcer opacity à 1 pour debug
        transition: 'opacity 0.2s ease-out',
        backgroundColor: '#e5e7eb', // Fond gris visible pour debug
        minHeight: 100, // Hauteur min pour debug
        ...style,
      }}
    >
      {webpSrc && webpSrc !== src && (
        <source srcSet={webpSrc} type="image/webp" />
      )}
      <img
        ref={imgRef}
        src={typeof src === 'string' ? src : ''}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(true)}
        {...props}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          border: '2px solid red', // Bordure rouge pour debug
          ...props.style,
        }}
      />
    </picture>
  );
});

OptimizedStoreImage.displayName = 'OptimizedStoreImage';

/**
 * Hook pour prefetch des données store
 */
export function useStorePrefetch(subdomain) {
  const prefetchProduct = React.useCallback(async (slug) => {
    if (!subdomain || !slug) return;
    
    const cacheKey = `${subdomain}:${slug}`;
    if (productCache.has(cacheKey)) return;

    try {
      const res = await publicStoreApi.getProduct(subdomain, slug);
      if (res.data) {
        const productData = res.data?.data || res.data;
        productCache.set(cacheKey, { data: productData, timestamp: Date.now() });
        console.log(`⚡ Prefetched product: ${slug}`);
      }
    } catch (err) {
      // Silently fail
    }
  }, [subdomain]);

  const prefetchStore = React.useCallback(async () => {
    if (!subdomain) return;
    if (storeCache.has(subdomain)) return;

    try {
      const res = await publicStoreApi.getStore(subdomain);
      if (res.data) {
        const storeData = res.data?.data || res.data;
        storeCache.set(subdomain, { data: storeData, timestamp: Date.now() });
        console.log(`⚡ Prefetched store: ${subdomain}`);
      }
    } catch (err) {
      // Silently fail
    }
  }, [subdomain]);

  return {
    prefetchProduct,
    prefetchStore,
    getCachedProduct: (slug) => getCachedProduct(subdomain, slug),
    getCachedStore: () => getCachedStore(subdomain),
  };
}

/**
 * Hook pour utiliser les données en cache
 */
export function useStoreCache(subdomain, slug = null) {
  const [store, setStore] = React.useState(() => getCachedStore(subdomain)?.data);
  const [product, setProduct] = React.useState(() => 
    slug ? getCachedProduct(subdomain, slug)?.data : null
  );
  const [isLoading, setIsLoading] = React.useState(!store);

  React.useEffect(() => {
    const cachedStore = getCachedStore(subdomain);
    if (cachedStore?.data) {
      setStore(cachedStore.data);
      setIsLoading(false);
    }

    if (slug) {
      const cachedProduct = getCachedProduct(subdomain, slug);
      if (cachedProduct?.data) {
        setProduct(cachedProduct.data);
      }
    }
  }, [subdomain, slug]);

  const refresh = React.useCallback(async () => {
    if (!subdomain) return;
    
    setIsLoading(true);
    try {
      const res = await publicStoreApi.getStore(subdomain);
      if (res.data) {
        const storeData = res.data?.data || res.data;
        setCachedStore(subdomain, storeData);
        setStore(storeData);
      }
    } catch (err) {
      console.error('Failed to refresh store:', err);
    } finally {
      setIsLoading(false);
    }
  }, [subdomain]);

  return {
    store,
    product,
    isLoading,
    refresh,
  };
}

export default {
  StorePrefetchLink,
  StoreProductCard,
  OptimizedStoreImage,
  useStorePrefetch,
  useStoreCache,
  getCachedStore,
  setCachedStore,
  getCachedProduct,
  setCachedProduct,
};
