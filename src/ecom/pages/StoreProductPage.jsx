import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ShoppingCart, MessageCircle, Minus, Plus, Loader2,
  ShoppingBag, ChevronLeft, ChevronRight, Shield, RotateCcw,
  Truck, Share2, ChevronDown, ChevronUp, Check
} from 'lucide-react';
import { publicStoreApi } from '../services/storeApi.js';
import { useSubdomain } from '../hooks/useSubdomain.js';

// Markdown/HTML renderer for product description with images
const MarkdownDescription = ({ content }) => {
  if (!content) return null;
  
  // Check if content is HTML (contains HTML tags)
  const isHTML = /<[^>]+>/.test(content);
  
  if (isHTML) {
    // Render HTML content directly with styled images
    return (
      <>
        <style>{`
          .product-description img {
            max-width: 100%;
            height: auto;
            border-radius: 0.75rem;
            margin: 1rem 0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            display: block;
          }
          .product-description strong {
            color: #1f2937;
            font-weight: 700;
          }
          .product-description p {
            margin-bottom: 0.5rem;
            line-height: 1.7;
          }
          .product-description ul, .product-description ol {
            padding-left: 1.5rem;
            margin-bottom: 0.75rem;
          }
        `}</style>
        <div 
          className="product-description text-sm text-gray-600"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </>
    );
  }
  
  // Parse markdown content with images
  // Regex to match markdown images: ![alt](url)
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let partIndex = 0;
  
  while ((match = imageRegex.exec(content)) !== null) {
    // Add text before the image
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index).trim();
      if (textBefore) {
        // Split text into paragraphs
        textBefore.split('\n\n').forEach((paragraph, pIndex) => {
          if (paragraph.trim()) {
            parts.push(
              <p key={`text-${partIndex}-${pIndex}`} className="text-sm text-gray-600 leading-relaxed mb-4">
                {paragraph.trim()}
              </p>
            );
          }
        });
      }
    }
    
    // Add the image
    const [, alt, url] = match;
    parts.push(
      <div key={`img-container-${partIndex}`} className="my-6">
        <img 
          src={url} 
          alt={alt}
          className="w-full max-w-lg mx-auto rounded-xl shadow-lg"
          loading="lazy"
        />
        {alt && alt !== 'Marketing Image' && (
          <p className="text-center text-xs text-gray-500 mt-2 italic">{alt}</p>
        )}
      </div>
    );
    
    lastIndex = match.index + match[0].length;
    partIndex++;
  }
  
  // Add remaining text after last image
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex).trim();
    if (remainingText) {
      remainingText.split('\n\n').forEach((paragraph, pIndex) => {
        if (paragraph.trim()) {
          parts.push(
            <p key={`text-end-${pIndex}`} className="text-sm text-gray-600 leading-relaxed mb-4">
              {paragraph.trim()}
            </p>
          );
        }
      });
    }
  }
  
  // If no images found, just render as paragraphs
  if (parts.length === 0) {
    return (
      <div className="space-y-3">
        {content.split('\n\n').map((paragraph, index) => (
          paragraph.trim() && (
            <p key={index} className="text-sm text-gray-600 leading-relaxed">
              {paragraph.trim()}
            </p>
          )
        ))}
      </div>
    );
  }
  
  return <div className="space-y-2">{parts}</div>;
};

/**
 * StoreProductPage — Shopify-like product detail page.
 * Desktop: 2-column (gallery left, info right with sticky CTA).
 * Mobile: stacked. Trust badges, description accordion, related products.
 */
const StoreProductPage = () => {
  const { subdomain: paramSubdomain, slug } = useParams();
  const { subdomain: hostSubdomain, isStoreDomain } = useSubdomain();
  const subdomain = hostSubdomain || paramSubdomain;
  const navigate = useNavigate();

  const storePath = (path) => isStoreDomain ? path : `/store/${subdomain}${path}`;

  const [store, setStore] = useState(null);
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [descOpen, setDescOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storeRes, productRes] = await Promise.all([
          publicStoreApi.getStore(subdomain),
          publicStoreApi.getProduct(subdomain, slug)
        ]);
        const storeData = storeRes.data?.data;
        const productData = productRes.data?.data;
        setStore(storeData);
        setProduct(productData);
        if (productData?.category) {
          try {
            const relRes = await publicStoreApi.getProducts(subdomain, { category: productData.category, limit: 5 });
            const all = relRes.data?.data?.products || [];
            setRelatedProducts(all.filter(p => p._id !== productData._id).slice(0, 4));
          } catch { /* non-blocking */ }
        }
      } catch {
        setError('Produit introuvable');
      } finally {
        setLoading(false);
      }
    })();
  }, [subdomain, slug]);

  const formatPrice = (price) => new Intl.NumberFormat('fr-FR').format(price);
  const themeColor = store?.storeSettings?.themeColor || store?.themeColor || '#0F6B4F';
  const currency = product?.currency || store?.storeSettings?.storeCurrency || 'XAF';
  const whatsappNum = store?.storeSettings?.whatsapp || store?.whatsapp || '';

  const handleWhatsAppOrder = () => {
    if (!whatsappNum) return;
    const phone = whatsappNum.replace(/\D/g, '');
    const msg = `Bonjour ! Je souhaite commander :\n\n*${product.name}*\nQuantité : ${quantity}\nTotal : ${formatPrice(product.price * quantity)} ${currency}\n\nMerci 🙏`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleAddToCart = () => {
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900 mt-4">Produit introuvable</h1>
          <p className="text-sm text-gray-500 mt-1">Ce produit n'existe pas ou n'est plus disponible.</p>
          <button
            onClick={() => navigate(storePath('/'))}
            className="mt-5 px-5 py-2.5 text-sm font-medium text-white rounded-xl transition hover:opacity-90"
            style={{ backgroundColor: themeColor }}
          >
            Retour à la boutique
          </button>
        </div>
      </div>
    );
  }

  const images = product.images?.length > 0 ? product.images : [];
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const discountPercent = hasDiscount ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;

  return (
    <div className="min-h-screen bg-white">

      {/* ── Sticky header ──────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate(storePath('/'))}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition font-medium">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{store?.name || 'Boutique'}</span>
          </button>
          <p className="text-sm font-semibold text-gray-900 truncate max-w-[180px] sm:max-w-xs">{product.name}</p>
          <button onClick={() => navigator?.share?.({ title: product.name, url: window.location.href })}
            className="p-2 rounded-lg hover:bg-gray-100 transition">
            <Share2 className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </header>

      {/* ── Breadcrumb (desktop only) ───────────────── */}
      <div className="max-w-6xl mx-auto px-4 pt-2 pb-1 hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
        <button onClick={() => navigate(storePath('/'))} className="hover:text-gray-600 transition">Accueil</button>
        {product.category && <><span>/</span><span>{product.category}</span></>}
        <span>/</span>
        <span className="text-gray-700 font-medium truncate max-w-xs">{product.name}</span>
      </div>

      {/* ── Main 2-column grid ─────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-4 lg:grid lg:grid-cols-[1fr_440px] lg:gap-12 lg:items-start">

        {/* LEFT: image gallery */}
        <div className="space-y-3">
          <div className="relative bg-gray-50 rounded-2xl overflow-hidden" style={{ aspectRatio: '1 / 1' }}>
            {images.length > 0 ? (
              <>
                <img src={images[activeImage]?.url} alt={images[activeImage]?.alt || product.name}
                  className="w-full h-full object-contain" />
                {images.length > 1 && (
                  <>
                    <button onClick={() => setActiveImage(i => Math.max(0, i - 1))} disabled={activeImage === 0}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white rounded-full shadow-md disabled:opacity-30 hover:shadow-lg transition">
                      <ChevronLeft className="w-4 h-4 text-gray-700" />
                    </button>
                    <button onClick={() => setActiveImage(i => Math.min(images.length - 1, i + 1))} disabled={activeImage === images.length - 1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white rounded-full shadow-md disabled:opacity-30 hover:shadow-lg transition">
                      <ChevronRight className="w-4 h-4 text-gray-700" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {images.map((_, i) => (
                        <button key={i} onClick={() => setActiveImage(i)}
                          className={`w-2 h-2 rounded-full transition-all ${i === activeImage ? 'scale-125 bg-gray-700' : 'bg-gray-300'}`} />
                      ))}
                    </div>
                  </>
                )}
                {hasDiscount && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-lg shadow">
                    -{discountPercent}%
                  </span>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="w-20 h-20 text-gray-200" />
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button key={i} onClick={() => setActiveImage(i)}
                  className={`w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                    i === activeImage ? 'opacity-100 shadow-md' : 'border-transparent opacity-55 hover:opacity-80'}`}
                  style={i === activeImage ? { borderColor: themeColor } : {}}>
                  <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: product info — sticky on desktop */}
        <div className="mt-6 lg:mt-0 lg:sticky lg:top-20 space-y-5">

          {/* Category badge */}
          {product.category && (
            <span className="inline-block text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ color: themeColor, backgroundColor: themeColor + '18' }}>
              {product.category}
            </span>
          )}

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">{product.name}</h1>

          {/* Price block */}
          <div className="flex items-end gap-3">
            <span className="text-3xl font-extrabold tracking-tight" style={{ color: themeColor }}>
              {formatPrice(product.price)}
              <span className="text-lg font-semibold ml-1 opacity-80">{currency}</span>
            </span>
            {hasDiscount && (
              <span className="text-lg text-gray-400 line-through pb-0.5">
                {formatPrice(product.compareAtPrice)} {currency}
              </span>
            )}
            {hasDiscount && (
              <span className="text-sm font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-lg">
                Économisez {formatPrice(product.compareAtPrice - product.price)} {currency}
              </span>
            )}
          </div>

          {/* Stock status */}
          {outOfStock ? (
            <div className="flex items-center gap-2 text-sm text-red-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              Rupture de stock
            </div>
          ) : lowStock ? (
            <div className="flex items-center gap-2 text-sm text-amber-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse" />
              Plus que {product.stock} en stock — commandez vite !
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
              <Check className="w-4 h-4" />
              En stock
            </div>
          )}

          {/* Quantity + CTA */}
          {!outOfStock && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Quantité</span>
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="px-3 py-2.5 hover:bg-gray-50 transition text-gray-600 font-bold text-lg">−</button>
                  <span className="px-5 py-2.5 text-sm font-bold text-gray-900 min-w-[3rem] text-center border-x border-gray-200">
                    {quantity}
                  </span>
                  <button onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                    className="px-3 py-2.5 hover:bg-gray-50 transition text-gray-600 font-bold text-lg">+</button>
                </div>
                <span className="text-sm text-gray-500 font-medium">
                  = {formatPrice(product.price * quantity)} {currency}
                </span>
              </div>

              {/* Main CTA */}
              <button onClick={handleAddToCart}
                className="w-full flex items-center justify-center gap-2.5 px-6 py-4 text-white rounded-2xl font-bold text-base transition hover:opacity-90 active:scale-[.98] shadow-lg"
                style={{ backgroundColor: themeColor }}>
                {justAdded ? <><Check className="w-5 h-5" /> Ajouté !</> : <><ShoppingCart className="w-5 h-5" /> Commander maintenant</>}
              </button>

              {/* WhatsApp secondary */}
              {whatsappNum && (
                <button onClick={handleWhatsAppOrder}
                  className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-semibold text-sm transition active:scale-[.98]">
                  <MessageCircle className="w-5 h-5" />
                  Commander via WhatsApp
                </button>
              )}
            </div>
          )}

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
            {[
              { icon: <Truck className="w-4 h-4" />, label: 'Livraison rapide' },
              { icon: <RotateCcw className="w-4 h-4" />, label: 'Retour facile' },
              { icon: <Shield className="w-4 h-4" />, label: 'Paiement sécurisé' }
            ].map(({ icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1 p-2 bg-gray-50 rounded-xl text-center">
                <span style={{ color: themeColor }}>{icon}</span>
                <span className="text-[10px] text-gray-500 font-medium leading-tight">{label}</span>
              </div>
            ))}
          </div>

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {product.tags.map((tag, i) => (
                <span key={i} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">{tag}</span>
              ))}
            </div>
          )}

          {/* Description accordion */}
          {product.description && (
            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              <button onClick={() => setDescOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition">
                <span className="font-semibold text-gray-900 text-sm">Description</span>
                {descOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </button>
              {descOpen && (
                <div className="px-4 pb-4">
                  <MarkdownDescription content={product.description} />
                </div>
              )}
            </div>
          )}

          {/* Details accordion */}
          {(product.category || product.tags?.length > 0) && (
            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              <button onClick={() => setDetailsOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition">
                <span className="font-semibold text-gray-900 text-sm">Détails du produit</span>
                {detailsOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </button>
              {detailsOpen && (
                <div className="px-4 pb-4 space-y-2 text-sm text-gray-600">
                  {product.category && <p><span className="font-medium text-gray-800">Catégorie :</span> {product.category}</p>}
                  {product.stock > 0 && <p><span className="font-medium text-gray-800">Stock :</span> {product.stock} unités</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Related products ──────────────────────── */}
      {relatedProducts.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pb-12 mt-10">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Vous aimerez aussi</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {relatedProducts.map(p => (
              <button key={p._id} onClick={() => navigate(storePath(`/products/${p.slug}`))}
                className="text-left group rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-300 hover:shadow-md transition">
                <div className="aspect-square bg-gray-50 overflow-hidden">
                  {p.images?.[0]?.url
                    ? <img src={p.images[0].url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-10 h-10 text-gray-200" /></div>
                  }
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: themeColor }}>{formatPrice(p.price)} {currency}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreProductPage;
