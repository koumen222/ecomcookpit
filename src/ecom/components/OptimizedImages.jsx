import React, { useEffect, useRef, useState, forwardRef } from 'react';

/**
 * Composants d'optimisation d'images pour une navigation ultra-rapide
 * 
 * Features:
 * - Lazy loading natif avec intersection observer
 * - Format WebP automatique avec fallback
 * - Priorité de chargement pour les images visibles
 * - Préchargement des images importantes
 * - Placeholder invisible (pas de squelette visible)
 */

// Cache des images déjà chargées
const imageCache = new Map();

/**
 * Image optimisée avec lazy loading et WebP
 */
export const OptimizedImage = forwardRef(({
  src,
  alt,
  className = '',
  width,
  height,
  priority = false,
  placeholder = 'transparent',
  onLoad,
  onError,
  ...props
}, ref) => {
  const [isLoaded, setIsLoaded] = useState(imageCache.has(src));
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (priority || imageCache.has(src)) {
      setIsLoaded(true);
    }
  }, [src, priority]);

  const handleLoad = () => {
    imageCache.set(src, true);
    setIsLoaded(true);
    if (onLoad) onLoad();
  };

  const handleError = () => {
    setError(true);
    if (onError) onError();
  };

  // Générer les URLs WebP si possible
  const webpSrc = src?.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  
  return (
    <picture
      ref={ref}
      className={className}
      style={{
        display: 'block',
        opacity: isLoaded ? 1 : 0,
        transition: 'opacity 200ms ease-out',
        backgroundColor: placeholder === 'transparent' ? 'transparent' : '#f3f4f6',
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : 'auto'
      }}
    >
      {/* Source WebP si disponible */}
      {webpSrc && webpSrc !== src && (
        <source srcSet={webpSrc} type="image/webp" />
      )}
      
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        width={width}
        height={height}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          ...props.style
        }}
      />
    </picture>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

/**
 * Image avec blur-up effect (chargement progressif)
 * Sans squelette visible
 */
export const ProgressiveImage = forwardRef(({
  src,
  alt,
  thumbnailSrc,
  className = '',
  width,
  height,
  ...props
}, ref) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const fullImageRef = useRef(null);

  useEffect(() => {
    if (fullImageRef.current && fullImageRef.current.complete) {
      setIsLoaded(true);
    }
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: 'relative',
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : '100%',
        overflow: 'hidden',
        backgroundColor: '#f3f4f6'
      }}
    >
      {/* Thumbnail flou en arrière-plan */}
      {thumbnailSrc && (
        <img
          src={thumbnailSrc}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
            opacity: isLoaded ? 0 : 1,
            transition: 'opacity 300ms ease-out'
          }}
        />
      )}
      
      {/* Image complète */}
      <OptimizedImage
        ref={fullImageRef}
        src={src}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
        {...props}
      />
    </div>
  );
});

ProgressiveImage.displayName = 'ProgressiveImage';

/**
 * Précharge une image en arrière-plan
 */
export function preloadImage(src) {
  if (imageCache.has(src)) return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, true);
      resolve();
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Précharge plusieurs images
 */
export function preloadImages(srcs) {
  return Promise.allSettled(srcs.map(preloadImage));
}

/**
 * Hook pour le lazy loading d'images
 */
export function useLazyImage(src, options = {}) {
  const { threshold = 0, rootMargin = '50px' } = options;
  const [shouldLoad, setShouldLoad] = useState(imageCache.has(src));
  const [isLoaded, setIsLoaded] = useState(imageCache.has(src));
  const imgRef = useRef(null);

  useEffect(() => {
    if (imageCache.has(src) || shouldLoad) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        });
      },
      { threshold, rootMargin }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src, threshold, rootMargin, shouldLoad]);

  const handleLoad = () => {
    imageCache.set(src, true);
    setIsLoaded(true);
  };

  return { imgRef, shouldLoad, isLoaded, handleLoad };
}

/**
 * Avatar optimisé avec lazy loading
 */
export const OptimizedAvatar = forwardRef(({
  src,
  alt = '',
  size = 40,
  className = '',
  fallback = null,
  ...props
}, ref) => {
  const [error, setError] = useState(false);

  if (error || !src) {
    return fallback || (
      <div
        ref={ref}
        className={`bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center text-emerald-700 font-bold ${className}`}
        style={{ width: size, height: size, borderRadius: '50%' }}
      >
        {alt?.charAt(0).toUpperCase() || '?'}
      </div>
    );
  }

  return (
    <OptimizedImage
      ref={ref}
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      onError={() => setError(true)}
      {...props}
      style={{
        borderRadius: '50%',
        ...props.style
      }}
    />
  );
});

OptimizedAvatar.displayName = 'OptimizedAvatar';

/**
 * Image responsive avec srcset
 */
export const ResponsiveImage = forwardRef(({
  src,
  alt,
  sizes = '100vw',
  widths = [320, 640, 960, 1280, 1920],
  className = '',
  ...props
}, ref) => {
  // Générer le srcset
  const srcSet = widths
    .map(w => {
      const url = src.replace(/\.(jpg|jpeg|png|webp)$/i, `-${w}.$1`);
      return `${url} ${w}w`;
    })
    .join(', ');

  return (
    <OptimizedImage
      ref={ref}
      src={src}
      alt={alt}
      srcSet={srcSet}
      sizes={sizes}
      className={className}
      {...props}
    />
  );
});

ResponsiveImage.displayName = 'ResponsiveImage';

/**
 * Composant pour précharger les images critiques au démarrage
 */
export function ImagePreloader({ images, children }) {
  useEffect(() => {
    if (!images?.length) return;
    
    // Précharger en arrière-plan sans bloquer
    requestIdleCallback?.(() => {
      preloadImages(images);
    }) || setTimeout(() => preloadImages(images), 1000);
  }, [images]);

  return children;
}

/**
 * Grille d'images avec lazy loading optimisé
 */
export function ImageGrid({ items, renderItem, gap = 16, ...props }) {
  const gridRef = useRef(null);
  const [visibleItems, setVisibleItems] = useState(new Set());

  useEffect(() => {
    if (!gridRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const index = parseInt(entry.target.dataset.index);
          if (entry.isIntersecting) {
            setVisibleItems(prev => new Set([...prev, index]));
          }
        });
      },
      { rootMargin: '100px' }
    );

    const items = gridRef.current.querySelectorAll('[data-index]');
    items.forEach(item => observer.observe(item));

    return () => observer.disconnect();
  }, [items.length]);

  return (
    <div
      ref={gridRef}
      style={{
        display: 'grid',
        gap: `${gap}px`,
        ...props.style
      }}
    >
      {items.map((item, index) => (
        <div key={index} data-index={index}>
          {renderItem(item, index, visibleItems.has(index))}
        </div>
      ))}
    </div>
  );
}

export default OptimizedImage;
