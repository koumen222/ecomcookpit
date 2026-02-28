import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, MessageCircle, Minus, Plus, Loader2, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';
import { publicStoreApi } from '../services/storeApi.js';
import { useSubdomain } from '../hooks/useSubdomain.js';

/**
 * StoreProductPage — Public product detail page.
 * Mobile-first layout: image carousel, price, description, add-to-cart / WhatsApp order.
 * Optimized for low bandwidth: lazy images, minimal DOM.
 */
const StoreProductPage = () => {
  const { subdomain: paramSubdomain, slug } = useParams();
  const { subdomain: hostSubdomain, isStoreDomain } = useSubdomain();
  const subdomain = hostSubdomain || paramSubdomain;
  const navigate = useNavigate();

  // Build store-relative paths (subdomain: /path, root: /store/sub/path)
  const storePath = (path) => isStoreDomain ? path : `/store/${subdomain}${path}`;

  const [store, setStore] = useState(null);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [storeRes, productRes] = await Promise.all([
          publicStoreApi.getStore(subdomain),
          publicStoreApi.getProduct(subdomain, slug)
        ]);
        setStore(storeRes.data?.data);
        setProduct(productRes.data?.data);
      } catch {
        setError('Produit introuvable');
      } finally {
        setLoading(false);
      }
    })();
  }, [subdomain, slug]);

  const formatPrice = (price) => new Intl.NumberFormat('fr-FR').format(price);
  const themeColor = store?.themeColor || '#0F6B4F';
  const currency = product?.currency || store?.currency || 'XAF';

  const handleWhatsAppOrder = () => {
    if (!store?.whatsapp) return;
    const phone = store.whatsapp.replace(/\D/g, '');
    const msg = `Bonjour, je souhaite commander:\n\n*${product.name}*\nQuantité: ${quantity}\nPrix: ${formatPrice(product.price * quantity)} ${currency}\n\nMerci !`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleAddToCart = () => {
    // Navigate to checkout with product info in state
    navigate(storePath('/checkout'), {
      state: {
        products: [{
          productId: product._id,
          name: product.name,
          price: product.price,
          quantity,
          image: product.images?.[0]?.url || ''
        }]
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: themeColor }} />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900 mt-4">Produit introuvable</h1>
          <button
            onClick={() => navigate(storePath('/'))}
            className="mt-4 px-4 py-2 text-sm font-medium text-white rounded-lg transition"
            style={{ backgroundColor: themeColor }}
          >
            Retour à la boutique
          </button>
        </div>
      </div>
    );
  }

  const images = product.images || [];
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const discountPercent = hasDiscount ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  const outOfStock = product.stock <= 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(storePath('/'))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{store?.name}</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto">
        {/* Image carousel */}
        <div className="relative aspect-square sm:aspect-[4/3] bg-gray-100 overflow-hidden">
          {images.length > 0 ? (
            <>
              <img
                src={images[activeImage]?.url}
                alt={images[activeImage]?.alt || product.name}
                className="w-full h-full object-contain"
              />
              {/* Image navigation */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImage(i => Math.max(0, i - 1))}
                    disabled={activeImage === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 rounded-full shadow disabled:opacity-30"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    onClick={() => setActiveImage(i => Math.min(images.length - 1, i + 1))}
                    disabled={activeImage === images.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 rounded-full shadow disabled:opacity-30"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </button>
                  {/* Dots */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImage(i)}
                        className={`w-2 h-2 rounded-full transition ${i === activeImage ? 'bg-white scale-110' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
              {/* Discount badge */}
              {hasDiscount && (
                <span className="absolute top-3 left-3 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg">
                  -{discountPercent}%
                </span>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="w-16 h-16 text-gray-300" />
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-2 px-4 py-3 overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden border-2 transition ${
                  i === activeImage ? 'border-current opacity-100' : 'border-transparent opacity-60'
                }`}
                style={i === activeImage ? { borderColor: themeColor } : {}}
              >
                <img src={img.url} alt={img.alt || ''} className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {/* Product details */}
        <div className="px-4 py-4 space-y-4">
          {/* Category */}
          {product.category && (
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: themeColor }}>
              {product.category}
            </span>
          )}

          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{product.name}</h1>

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold" style={{ color: themeColor }}>
              {formatPrice(product.price)} {currency}
            </span>
            {hasDiscount && (
              <span className="text-base text-gray-400 line-through">
                {formatPrice(product.compareAtPrice)} {currency}
              </span>
            )}
          </div>

          {/* Stock status */}
          {outOfStock ? (
            <span className="inline-flex items-center px-3 py-1 bg-red-50 text-red-600 text-sm font-medium rounded-lg">
              Rupture de stock
            </span>
          ) : product.stock <= 5 ? (
            <span className="inline-flex items-center px-3 py-1 bg-amber-50 text-amber-600 text-sm font-medium rounded-lg">
              Plus que {product.stock} en stock
            </span>
          ) : null}

          {/* Description */}
          {product.description && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
            </div>
          )}

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{tag}</span>
              ))}
            </div>
          )}

          {/* Quantity selector + actions */}
          {!outOfStock && (
            <div className="space-y-3 pt-4 border-t border-gray-100">
              {/* Quantity */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Quantité</span>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="p-2 hover:bg-gray-50 transition"
                  >
                    <Minus className="w-4 h-4 text-gray-600" />
                  </button>
                  <span className="px-4 py-2 text-sm font-medium text-gray-900 min-w-[3rem] text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                    className="p-2 hover:bg-gray-50 transition"
                  >
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <span className="text-sm text-gray-400">
                  = {formatPrice(product.price * quantity)} {currency}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleAddToCart}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl font-medium text-sm transition hover:opacity-90"
                  style={{ backgroundColor: themeColor }}
                >
                  <ShoppingCart className="w-4 h-4" />
                  Commander
                </button>

                {store?.whatsapp && (
                  <button
                    onClick={handleWhatsAppOrder}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl font-medium text-sm hover:bg-green-600 transition"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreProductPage;
