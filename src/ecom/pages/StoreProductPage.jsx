import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ShoppingCart, MessageCircle, Minus, Plus, Loader2,
  ShoppingBag, ChevronLeft, ChevronRight, Shield, RotateCcw,
  Truck, Share2, ChevronDown, ChevronUp, Check, Star, AlertCircle
} from 'lucide-react';
import { publicStoreApi } from '../services/storeApi.js';
import { useSubdomain } from '../hooks/useSubdomain.js';
import QuickOrderModal from '../components/QuickOrderModal.jsx';

// Theme helpers (same as PublicStorefront)
const FONTS = {
  inter: 'Inter, system-ui, sans-serif',
  poppins: 'Poppins, sans-serif',
  'dm-sans': '"DM Sans", sans-serif',
  montserrat: 'Montserrat, sans-serif',
  playfair: '"Playfair Display", serif',
  'space-grotesk': '"Space Grotesk", sans-serif',
  satoshi: 'Satoshi, Inter, system-ui, sans-serif',
};
const RADII = { none: '0', sm: '0.375rem', md: '0.75rem', lg: '1rem', xl: '1.5rem', full: '9999px' };
const font = (id) => FONTS[id] || FONTS.inter;
const radius = (id) => RADII[id] || RADII.lg;

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
          .product-description h3 {
            font-size: 1.125rem;
            font-weight: 700;
            color: #111827;
            margin-bottom: 0.75rem;
            margin-top: 1.5rem;
          }
          .product-description strong {
            color: #1f2937;
            font-weight: 700;
          }
          .product-description p {
            margin-bottom: 0.75rem;
            line-height: 1.7;
            color: #4b5563;
          }
          .product-description ul, .product-description ol {
            padding-left: 1.5rem;
            margin-bottom: 0.75rem;
          }
        `}</style>
        <div 
          className="product-description text-sm"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </>
    );
  }
  
  // Parse markdown content with images and formatting
  const lines = content.split('\n');
  const parts = [];
  let currentParagraph = [];
  let partIndex = 0;
  
  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join(' ').trim();
      if (text) {
        // Check if it's bold text (should be a heading)
        const boldMatch = text.match(/^\*\*(.+)\*\*$/);
        if (boldMatch) {
          parts.push(
            <h3 key={`h3-${partIndex++}`} className="text-lg font-bold text-gray-900 mb-3 mt-6">
              {boldMatch[1]}
            </h3>
          );
        } else {
          // Regular paragraph - parse inline bold
          const parsedText = text.split(/(\*\*[^*]+\*\*)/).map((segment, i) => {
            const inlineBold = segment.match(/^\*\*(.+)\*\*$/);
            if (inlineBold) {
              return <strong key={i} className="font-bold text-gray-900">{inlineBold[1]}</strong>;
            }
            return segment;
          });
          
          parts.push(
            <p key={`p-${partIndex++}`} className="text-sm text-gray-600 leading-relaxed mb-3">
              {parsedText}
            </p>
          );
        }
      }
      currentParagraph = [];
    }
  };
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check for markdown image: ![alt](url)
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      flushParagraph();
      const [, alt, url] = imageMatch;
      parts.push(
        <div key={`img-${partIndex++}`} className="my-6">
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
      continue;
    }
    
    // Empty line = paragraph break
    if (!trimmed) {
      flushParagraph();
      continue;
    }
    
    // Add line to current paragraph
    currentParagraph.push(trimmed);
  }
  
  // Flush remaining paragraph
  flushParagraph();
  
  return <div className="space-y-1">{parts}</div>;
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
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [descOpen, setDescOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState({});
  const [justAdded, setJustAdded] = useState(false);

  const toggleFaq = (index) => {
    setFaqOpen(prev => ({ ...prev, [index]: !prev[index] }));
  };

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
  
  // Theme configuration (consistent with PublicStorefront)
  const t = {
    cta: store?.storeSettings?.themeColor || store?.themeColor || '#0F6B4F',
    text: store?.storeSettings?.textColor || store?.textColor || '#111827',
    bg: store?.storeSettings?.backgroundColor || store?.backgroundColor || '#FFFFFF',
    font: font(store?.storeSettings?.font || store?.font),
    radius: radius(store?.storeSettings?.borderRadius || store?.borderRadius),
  };
  
  const currency = product?.currency || store?.storeSettings?.storeCurrency || 'XAF';
  const whatsappNum = store?.storeSettings?.whatsapp || store?.whatsapp || '';

  // Parse benefits from description (look for bullet points or numbered lists)
  const extractBenefits = (desc) => {
    if (!desc) return [];
    const lines = desc.split('\n');
    const benefits = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[•✓✔-]\s+/) || trimmed.match(/^\d+\.\s+/)) {
        benefits.push(trimmed.replace(/^[•✓✔-]\s+/, '').replace(/^\d+\.\s+/, ''));
      }
    }
    return benefits.slice(0, 5);
  };

  // Parse FAQ dynamically from description
  // Supports formats: "Q: ..." / "R: ...", "**Question ?**" followed by answer
  const extractFAQ = (desc) => {
    if (!desc) return [];
    const faqs = [];
    const lines = desc.split('\n').map(l => l.trim()).filter(Boolean);
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      // Format: Q: question / R: answer
      if (/^Q\s*:/i.test(line)) {
        const q = line.replace(/^Q\s*:/i, '').trim();
        let a = '';
        if (i + 1 < lines.length && /^R\s*:/i.test(lines[i + 1])) {
          a = lines[i + 1].replace(/^R\s*:/i, '').trim();
          i++;
        }
        if (q) faqs.push({ q, a });
      }
      // Format: **Question ?** on its own line, followed by answer line
      else if (/^\*\*[^*].+\?\*\*$/.test(line)) {
        const q = line.replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
        let a = '';
        if (i + 1 < lines.length && !/^\*\*/.test(lines[i + 1])) {
          a = lines[i + 1].replace(/\*\*/g, '').trim();
          i++;
        }
        faqs.push({ q, a });
      }
      i++;
    }
    return faqs.slice(0, 6);
  };

  const benefits = extractBenefits(product?.description);
  const faqItems = extractFAQ(product?.description);

  const handleWhatsAppOrder = () => {
    if (!whatsappNum) return;
    const phone = whatsappNum.replace(/\D/g, '');
    const msg = `Bonjour ! Je souhaite commander :\n\n*${product.name}*\nQuantité : ${quantity}\nTotal : ${formatPrice(product.price * quantity)} ${currency}\n\nMerci 🙏`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleAddToCart = () => {
    setShowOrderModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: t.cta }} />
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
    <div className="min-h-screen" style={{ backgroundColor: t.bg, fontFamily: t.font }}>

      {/* ── Sticky header ──────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-sm border-b border-gray-100" style={{ backgroundColor: t.bg + 'f0' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate(storePath('/'))}
            className="flex items-center gap-2 text-sm transition font-medium hover:opacity-70"
            style={{ color: t.text }}>
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{store?.name || 'Boutique'}</span>
          </button>
          <p className="text-sm font-semibold truncate max-w-[180px] sm:max-w-xs" style={{ color: t.text, fontFamily: t.font }}>{product.name}</p>
          <button onClick={() => navigator?.share?.({ title: product.name, url: window.location.href })}
            className="p-2 hover:opacity-70 transition" style={{ borderRadius: t.radius }}>
            <Share2 className="w-4 h-4" style={{ color: t.text + '80' }} />
          </button>
        </div>
      </header>

      {/* ── Breadcrumb (desktop only) ───────────────── */}
      <div className="max-w-6xl mx-auto px-4 pt-2 pb-1 hidden sm:flex items-center gap-1.5 text-xs" style={{ color: t.text + '60' }}>
        <button onClick={() => navigate(storePath('/'))} className="hover:opacity-70 transition" style={{ color: t.text + '80' }}>Accueil</button>
        {product.category && <><span>/</span><span>{product.category}</span></>}
        <span>/</span>
        <span className="font-medium truncate max-w-xs" style={{ color: t.text, fontFamily: t.font }}>{product.name}</span>
      </div>

      {/* ── Main 2-column grid ─────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-4 lg:grid lg:grid-cols-[1fr_440px] lg:gap-12 lg:items-start">

        {/* LEFT: image gallery */}
        <div className="space-y-3">
          <div className="relative bg-gray-50 overflow-hidden" style={{ aspectRatio: '1 / 1' }}>
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
                  <div className="absolute top-3 right-3">
                    <div className="relative">
                      <div className="bg-orange-500 text-white px-4 py-2 rounded-full shadow-lg">
                        <div className="text-center">
                          <div className="text-xs font-semibold uppercase">Promo</div>
                          <div className="text-lg font-black leading-none">-{discountPercent}%</div>
                        </div>
                      </div>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-orange-500"></div>
                    </div>
                  </div>
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
                  <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" style={{ borderRadius: 0 }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: product info — sticky on desktop */}
        <div className="mt-6 lg:mt-0 lg:sticky lg:top-20 space-y-5">

          {/* Promo banner rouge */}
          {hasDiscount && (
            <div className="bg-red-600 px-4 py-3" style={{ borderRadius: 0 }}>
              <p className="text-sm font-bold text-white text-center uppercase tracking-wide">
                🔥 PROFITEZ DE LA RÉDUCTION — ÉCONOMISEZ {formatPrice(product.compareAtPrice - product.price)} {currency}
              </p>
            </div>
          )}

          {/* Category badge */}
          {product.category && (
            <span className="inline-block text-xs font-semibold uppercase tracking-widest px-2.5 py-1"
              style={{ color: t.cta, backgroundColor: t.cta + '18', borderRadius: t.radius, fontFamily: t.font }}>
              {product.category}
            </span>
          )}

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight" style={{ color: t.text, fontFamily: t.font }}>{product.name}</h1>

          {/* Subtitle/Hook if available */}
          {product.seoDescription && (
            <p className="text-sm leading-relaxed italic" style={{ color: t.text + 'aa' }}>
              {product.seoDescription}
            </p>
          )}

          {/* Stars + avis */}
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className={`w-4 h-4 ${s <= 4 ? 'text-yellow-400 fill-yellow-400' : 'text-yellow-300 fill-yellow-100'}`} />
              ))}
            </div>
            <span className="text-sm font-semibold" style={{ color: t.text + 'cc', fontFamily: t.font }}>(252 avis positifs)</span>
          </div>

          {/* Price block */}
          <div className="space-y-2">
            <div className="flex items-end gap-3 flex-wrap">
              <span className="text-4xl font-black tracking-tight" style={{ color: t.cta, fontFamily: t.font }}>
                {formatPrice(product.price)}
                <span className="text-xl font-bold ml-1">{currency}</span>
              </span>
              {hasDiscount && (
                <span className="text-xl line-through pb-1" style={{ color: t.text + '60' }}>
                  {formatPrice(product.compareAtPrice)} {currency}
                </span>
              )}
            </div>
            {hasDiscount && (
              <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg">
                <span className="text-sm font-bold">SAVE {discountPercent}%</span>
                <span className="text-xs">Économisez {formatPrice(product.compareAtPrice - product.price)} {currency}</span>
              </div>
            )}
          </div>

          {/* Stock status - only show if out of stock */}
          {outOfStock && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700 font-semibold">Rupture de stock</span>
            </div>
          )}

          {/* Benefits list */}
          {benefits.length > 0 && (
            <div className="border border-green-200 p-4 space-y-2" style={{ backgroundColor: t.cta + '08', borderRadius: t.radius }}>
              {benefits.map((benefit, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm font-medium" style={{ color: t.text + 'dd', fontFamily: t.font }}>{benefit}</span>
                </div>
              ))}
            </div>
          )}

          {/* Quantity + CTA */}
          {!outOfStock && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium" style={{ color: t.text + 'cc', fontFamily: t.font }}>Quantité</span>
                <div className="flex items-center border border-gray-200 overflow-hidden" style={{ borderRadius: t.radius }}>
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="px-3 py-2.5 hover:opacity-70 transition font-bold text-lg" style={{ color: t.text + '80' }}>−</button>
                  <span className="px-5 py-2.5 text-sm font-bold min-w-[3rem] text-center border-x border-gray-200" style={{ color: t.text, fontFamily: t.font }}>
                    {quantity}
                  </span>
                  <button onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                    className="px-3 py-2.5 hover:opacity-70 transition font-bold text-lg" style={{ color: t.text + '80' }}>+</button>
                </div>
                <span className="text-sm font-medium" style={{ color: t.text + '80', fontFamily: t.font }}>
                  = {formatPrice(product.price * quantity)} {currency}
                </span>
              </div>

              {/* Main CTA */}
              <button onClick={handleAddToCart}
                className="w-full flex items-center justify-center gap-2.5 px-6 py-4 text-white font-bold text-base transition hover:opacity-90 active:scale-[.98] shadow-lg relative overflow-hidden group"
                style={{ backgroundColor: t.cta, borderRadius: t.radius, fontFamily: t.font }}>
                <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition"></span>
                {justAdded ? (
                  <><Check className="w-5 h-5" /> Ajouté !</>
                ) : (
                  <><ShoppingCart className="w-5 h-5" /> COMMANDER MAINTENANT</>
                )}
              </button>
              {!outOfStock && lowStock && (
                <p className="text-center text-xs text-amber-600 font-medium -mt-1">
                  ⚡ Plus que {product.stock} pièces disponibles
                </p>
              )}

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
              <div key={label} className="flex flex-col items-center gap-1 p-2 text-center" style={{ backgroundColor: t.text + '08', borderRadius: t.radius }}>
                <span style={{ color: t.cta }}>{icon}</span>
                <span className="text-[10px] font-medium leading-tight" style={{ color: t.text + '80', fontFamily: t.font }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {product.tags.map((tag, i) => (
                <span key={i} className="px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: t.text + '10', color: t.text + 'aa', borderRadius: t.radius, fontFamily: t.font }}>{tag}</span>
              ))}
            </div>
          )}

          {/* FAQ dynamique — extrait de la description */}
          {faqItems.length > 0 && (
            <div className="border border-gray-200 overflow-hidden" style={{ borderRadius: t.radius }}>
              <div className="px-4 py-3 border-b border-gray-200" style={{ backgroundColor: t.text + '06' }}>
                <h3 className="font-bold text-sm" style={{ color: t.text, fontFamily: t.font }}>Vos questions fréquentes</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {faqItems.map((item, i) => (
                  <div key={i}>
                    <button
                      onClick={() => toggleFaq(i)}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:opacity-70 transition text-left"
                    >
                      <span className="font-medium text-sm pr-4" style={{ color: t.text, fontFamily: t.font }}>{item.q}</span>
                      {faqOpen[i] ? (
                        <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: t.text + '80' }} />
                      ) : (
                        <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: t.text + '80' }} />
                      )}
                    </button>
                    {faqOpen[i] && (
                      <div className="px-4 pb-4 pt-1">
                        <p className="text-sm leading-relaxed" style={{ color: t.text + 'bb', fontFamily: t.font }}>{item.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description — affichage direct sans titre */}
          {product.description && (
            <div className="pt-2">
              <MarkdownDescription content={product.description} />
            </div>
          )}

          {/* Details accordion */}
          {(product.category || product.tags?.length > 0) && (
            <div className="border border-gray-200 overflow-hidden" style={{ borderRadius: t.radius }}>
              <button onClick={() => setDetailsOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:opacity-70 transition">
                <span className="font-semibold text-sm" style={{ color: t.text, fontFamily: t.font }}>Détails du produit</span>
                {detailsOpen ? <ChevronUp className="w-4 h-4" style={{ color: t.text + '80' }} /> : <ChevronDown className="w-4 h-4" style={{ color: t.text + '80' }} />}
              </button>
              {detailsOpen && (
                <div className="px-4 pb-4 space-y-2 text-sm" style={{ color: t.text + 'bb', fontFamily: t.font }}>
                  {product.category && <p><span className="font-medium" style={{ color: t.text }}>Catégorie :</span> {product.category}</p>}
                  {product.stock > 0 && <p><span className="font-medium" style={{ color: t.text }}>Stock :</span> {product.stock} unités</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Related products ──────────────────────── */}
      {relatedProducts.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pb-12 mt-10">
          <h2 className="text-lg font-bold mb-4" style={{ color: t.text, fontFamily: t.font }}>Vous aimerez aussi</h2>
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
                  <p className="text-sm font-semibold truncate" style={{ color: t.text, fontFamily: t.font }}>{p.name}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: t.cta, fontFamily: t.font }}>{formatPrice(p.price)} {currency}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal de commande rapide */}
      <QuickOrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        product={product}
        quantity={quantity}
        subdomain={subdomain}
        store={store}
      />
    </div>
  );
};

export default StoreProductPage;
