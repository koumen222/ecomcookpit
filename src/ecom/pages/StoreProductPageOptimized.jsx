/**
 * StoreProductPageOptimized.jsx - Page Produit Store avec navigation instantanée
 * 
 * Optimisations:
 * - Chargement immédiat depuis le cache si préchargé
 * - Navigation fluide retour vers le store
 * - Images optimisées avec lazy loading
 * - Pas de loader visible
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, ChevronRight, ShoppingCart, 
  Plus, Minus, ArrowLeft, Share2, Heart 
} from 'lucide-react';
import { useSubdomain } from '../hooks/useSubdomain.js';
import { injectStoreCssVars } from '../hooks/useStoreData.js';
import { useStoreCart } from '../hooks/useStoreCart.js';
import { 
  useStorePrefetch,
  useStoreCache,
  getCachedProduct,
  setCachedProduct,
  OptimizedStoreImage 
} from '../components/StorePrefetch.jsx';

// Header minimaliste
const ProductHeader = ({ store, cartCount, storePrefix, onBack }) => {
  const navigate = useNavigate();
  
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      backgroundColor: 'var(--s-bg, #fff)',
      borderBottom: '1px solid var(--s-border, #e5e7eb)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 16px',
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Retour */}
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px', borderRadius: 8,
            color: 'var(--s-text, #1f2937)',
          }}
        >
          <ArrowLeft size={20} />
        </button>

        {/* Logo */}
        <button 
          onClick={() => navigate(`${storePrefix}/`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          {store?.logo ? (
            <img 
              src={store.logo} 
              alt={store?.name} 
              style={{ height: 28, objectFit: 'contain' }} 
            />
          ) : (
            <span style={{
              fontWeight: 600, fontSize: 16,
              color: 'var(--s-text, #1f2937)',
            }}>
              {store?.name}
            </span>
          )}
        </button>

        {/* Panier */}
        <button
          onClick={() => navigate(`${storePrefix}/checkout`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 20,
            border: '1.5px solid',
            borderColor: cartCount > 0 ? 'var(--s-primary, #10b981)' : 'var(--s-border, #e5e7eb)',
            backgroundColor: cartCount > 0 ? 'var(--s-primary, #10b981)' : 'transparent',
            color: cartCount > 0 ? '#fff' : 'var(--s-text, #1f2937)',
            fontWeight: 500, fontSize: 14,
            cursor: 'pointer',
          }}
        >
          <ShoppingCart size={16} />
          {cartCount > 0 && <span>{cartCount}</span>}
        </button>
      </div>
    </header>
  );
};

// Galerie d'images optimisée
const ImageGallery = ({ images = [], productName }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const touchStart = useRef(null);

  const goTo = useCallback((dir) => {
    setActiveIndex(i => {
      const newIndex = i + dir;
      if (newIndex < 0) return images.length - 1;
      if (newIndex >= images.length) return 0;
      return newIndex;
    });
  }, [images.length]);

  // Swipe support
  const onTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      goTo(diff > 0 ? 1 : -1);
    }
    touchStart.current = null;
  };

  if (!images?.length) {
    return (
      <div style={{
        paddingBottom: '100%',
        position: 'relative',
        backgroundColor: '#f3f4f6',
        borderRadius: 16,
      }}>
        <span style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#9ca3af',
        }}>
          Pas d'image
        </span>
      </div>
    );
  }

  return (
    <div 
      style={{ position: 'relative' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Image principale */}
      <div 
        style={{
          paddingBottom: '100%',
          position: 'relative',
          backgroundColor: '#f9fafb',
          borderRadius: 16,
          overflow: 'hidden',
          cursor: isZoomed ? 'zoom-out' : 'zoom-in',
        }}
        onClick={() => setIsZoomed(!isZoomed)}
      >
        <OptimizedStoreImage
          src={images[activeIndex]}
          alt={`${productName} - ${activeIndex + 1}`}
          priority={activeIndex === 0}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: isZoomed ? 'contain' : 'cover',
            transition: 'transform 0.3s',
            transform: isZoomed ? 'scale(1.5)' : 'scale(1)',
          }}
        />

        {/* Navigation flèches */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goTo(-1); }}
              style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                width: 36, height: 36, borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.9)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goTo(1); }}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                width: 36, height: 36, borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.9)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* Indicateurs */}
        {images.length > 1 && (
          <div style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 6,
          }}>
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setActiveIndex(i); }}
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  backgroundColor: i === activeIndex ? 'var(--s-primary, #10b981)' : 'rgba(255,255,255,0.7)',
                  border: 'none', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Miniatures */}
      {images.length > 1 && (
        <div style={{
          display: 'flex', gap: 8, marginTop: 12,
          overflowX: 'auto', paddingBottom: 4,
        }}>
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              style={{
                flexShrink: 0,
                width: 64, height: 64, borderRadius: 8,
                border: i === activeIndex ? '2px solid var(--s-primary, #10b981)' : '2px solid transparent',
                overflow: 'hidden', cursor: 'pointer',
                padding: 0,
              }}
            >
              <OptimizedStoreImage
                src={img}
                alt={`Miniature ${i + 1}`}
                style={{ width: '100%', height: '100%' }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Page Produit Optimisée
 */
const StoreProductPageOptimized = () => {
  const { subdomain: paramSubdomain, slug } = useParams();
  const { subdomain: hostSubdomain } = useSubdomain();
  const subdomain = hostSubdomain || paramSubdomain;
  const navigate = useNavigate();

  // Hooks de cache
  const { store: cachedStore } = useStoreCache(subdomain);
  const { prefetchStore } = useStorePrefetch(subdomain);
  const { addItem, itemCount: cartCount } = useStoreCart();

  // États
  const [product, setProduct] = useState(() => {
    // Charger immédiatement depuis le cache si disponible
    return getCachedProduct(subdomain, slug)?.data?.product;
  });
  const [store, setStore] = useState(cachedStore?.store);
  const [isLoading, setIsLoading] = useState(!product);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [isAdded, setIsAdded] = useState(false);

  const storePrefix = subdomain ? `https://${subdomain}.scalor.net` : '';

  // Charger les données
  useEffect(() => {
    if (!subdomain || !slug) return;

    const cachedProduct = getCachedProduct(subdomain, slug);
    const cachedStore = getCachedStore(subdomain);

    // Utiliser le cache si disponible
    if (cachedProduct?.data?.product) {
      setProduct(cachedProduct.data.product);
      setIsLoading(false);
      
      // Injecter le thème
      if (cachedStore?.data?.store) {
        setStore(cachedStore.data.store);
        injectStoreCssVars(cachedStore.data.store);
      }
      
      // Rafraîchir en arrière-plan
      refreshProduct();
      return;
    }

    // Sinon charger depuis l'API
    loadProduct();
  }, [subdomain, slug]);

  const loadProduct = async () => {
    if (!subdomain || !slug) return;

    setIsLoading(true);
    setError('');

    try {
      const [productRes, storeRes] = await Promise.all([
        fetch(`/api/store/${subdomain}/product/${slug}`),
        fetch(`/api/store/${subdomain}`)
      ]);

      if (productRes.ok) {
        const productData = await productRes.json();
        const prod = productData.data?.product || productData.data;
        setProduct(prod);
        setCachedProduct(subdomain, slug, { product: prod });
      } else {
        throw new Error('Produit non trouvé');
      }

      if (storeRes.ok) {
        const storeData = await storeRes.json();
        const sto = storeData.data?.store || storeData.data;
        setStore(sto);
        setCachedStore(subdomain, storeData.data || { store: sto });
        injectStoreCssVars(sto);
      }
    } catch (err) {
      console.error('Error loading product:', err);
      setError(err.message || 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProduct = async () => {
    if (!subdomain || !slug) return;
    
    try {
      const res = await fetch(`/api/store/${subdomain}/product/${slug}`);
      if (res.ok) {
        const data = await res.json();
        const prod = data.data?.product || data.data;
        setProduct(prod);
        setCachedProduct(subdomain, slug, { product: prod });
      }
    } catch {
      // Ignorer les erreurs silencieuses
    }
  };

  // Ajouter au panier
  const handleAddToCart = useCallback(() => {
    if (!product) return;

    addItem({
      id: product._id || product.id,
      name: product.name,
      price: product.price,
      quantity: quantity,
      image: product.image || product.images?.[0],
      currency: product.currency || 'XAF'
    });

    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  }, [product, quantity, addItem]);

  // Retour au store (avec prefetch)
  const handleBack = useCallback(() => {
    prefetchStore();
    navigate(`${storePrefix}/`);
  }, [navigate, storePrefix, prefetchStore]);

  // Partager
  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product?.name,
          text: `Découvrez ${product?.name} sur ${store?.name}`,
          url: window.location.href
        });
      } catch {
        // Ignorer les erreurs de partage
      }
    }
  }, [product, store]);

  // Affichage
  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, fontFamily: 'system-ui'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 18, color: '#ef4444' }}>{error}</h1>
          <button
            onClick={handleBack}
            style={{
              marginTop: 16, padding: '10px 20px', borderRadius: 8,
              border: 'none', backgroundColor: 'var(--s-primary, #10b981)',
              color: '#fff', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Retour à la boutique
          </button>
        </div>
      </div>
    );
  }

  const displayProduct = product;

  if (!displayProduct && isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0.5,
      }}>
        <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%' }} />
      </div>
    );
  }

  if (!displayProduct) {
    return (
      <div style={{ 
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20 
      }}>
        Produit non trouvé
      </div>
    );
  }

  const images = displayProduct.images || [displayProduct.image].filter(Boolean);

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: 'var(--s-bg, #fff)',
      opacity: isLoading ? 0.9 : 1,
      transition: 'opacity 0.2s',
    }}>
      <ProductHeader 
        store={store} 
        cartCount={cartCount} 
        storePrefix={storePrefix}
        onBack={handleBack}
      />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '16px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 24,
        }} className="lg-grid-2">
          {/* Galerie d'images */}
          <div>
            <ImageGallery images={images} productName={displayProduct.name} />
          </div>

          {/* Infos produit */}
          <div>
            {/* Nom */}
            <h1 style={{
              fontSize: 24, fontWeight: 700,
              color: 'var(--s-text, #1f2937)',
              margin: '0 0 12px 0', lineHeight: 1.3,
            }}>
              {displayProduct.name}
            </h1>

            {/* Prix */}
            <p style={{
              fontSize: 28, fontWeight: 700,
              color: 'var(--s-primary, #10b981)',
              margin: '0 0 20px 0',
            }}>
              {new Intl.NumberFormat('fr-FR').format(displayProduct.price)} {displayProduct.currency || 'XAF'}
            </p>

            {/* Description */}
            {displayProduct.description && (
              <div 
                style={{
                  fontSize: 15, lineHeight: 1.6,
                  color: 'var(--s-text-secondary, #4b5563)',
                  marginBottom: 24,
                }}
                dangerouslySetInnerHTML={{ __html: displayProduct.description }}
              />
            )}

            {/* Quantité */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ 
                fontSize: 14, fontWeight: 600, 
                color: 'var(--s-text, #1f2937)',
                marginBottom: 8 
              }}>
                Quantité
              </p>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  style={{
                    width: 40, height: 40, borderRadius: 8,
                    border: '1px solid var(--s-border, #e5e7eb)',
                    backgroundColor: 'var(--s-bg, #fff)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Minus size={18} />
                </button>
                <span style={{
                  fontSize: 18, fontWeight: 600, minWidth: 40, textAlign: 'center',
                }}>
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  style={{
                    width: 40, height: 40, borderRadius: 8,
                    border: '1px solid var(--s-border, #e5e7eb)',
                    backgroundColor: 'var(--s-bg, #fff)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {/* Bouton Ajouter */}
            <button
              onClick={handleAddToCart}
              disabled={isAdded}
              style={{
                width: '100%', padding: '16px 24px', borderRadius: 12,
                border: 'none',
                backgroundColor: isAdded ? '#22c55e' : 'var(--s-primary, #10b981)',
                color: '#fff', fontSize: 16, fontWeight: 600,
                cursor: isAdded ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'all 0.2s',
                transform: isAdded ? 'scale(1)' : 'scale(1)',
              }}
            >
              <ShoppingCart size={20} />
              {isAdded ? 'Ajouté !' : 'Ajouter au panier'}
            </button>

            {/* Bouton Partager */}
            <button
              onClick={handleShare}
              style={{
                width: '100%', padding: '14px 24px', borderRadius: 12,
                border: '1px solid var(--s-border, #e5e7eb)',
                backgroundColor: 'transparent',
                color: 'var(--s-text, #1f2937)', fontSize: 15, fontWeight: 500,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                marginTop: 12,
              }}
            >
              <Share2 size={18} />
              Partager
            </button>

            {/* Stock */}
            {displayProduct.stock !== undefined && (
              <p style={{
                marginTop: 20, fontSize: 14,
                color: displayProduct.stock > 5 ? '#22c55e' : '#ef4444',
                fontWeight: 500,
              }}>
                {displayProduct.stock > 0 
                  ? `En stock (${displayProduct.stock} disponible${displayProduct.stock > 1 ? 's' : ''})`
                  : 'Rupture de stock'
                }
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Responsive grid pour desktop */}
      <style>{`
        @media (min-width: 1024px) {
          .lg-grid-2 {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default StoreProductPageOptimized;
