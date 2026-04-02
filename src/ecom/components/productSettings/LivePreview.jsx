import React, { useState, useEffect } from 'react';
import {
  Star, ShoppingCart, ChevronDown, ChevronUp, X,
  Truck, Shield, RotateCcw, MessageCircle, ShoppingBag, Check,
  ChevronLeft, ChevronRight, Package, User, Phone, MapPin, FileText,
} from 'lucide-react';
import { storeManageApi } from '../../services/storeApi';

const fmt = (n, cur = 'XAF') => `${new Intl.NumberFormat('fr-FR').format(n)} ${cur}`;

const MOCK = {
  name: 'Tongkat Ali Premium — Boost Vitalité',
  category: 'Compléments Alimentaires',
  slogan: 'Retrouvez votre énergie et votre libido naturellement',
  baseline: 'Résultats visibles dès la 1ère semaine',
  price: 14900,
  comparePrice: 22000,
  stock: 4,
  rating: 4.8,
  ratingCount: 238,
  image: null,
  benefits: ['Boost énergie & vitalité', 'Améliore la libido naturellement', '100% naturel, sans effets secondaires'],
  faqItems: [
    { q: 'Quel est le délai de livraison ?', a: 'Entre 24h et 72h selon votre localisation.' },
    { q: 'Peut-on payer à la livraison ?', a: 'Oui, le paiement à la livraison est disponible.' },
    { q: 'Est-ce que le produit est naturel ?', a: 'Oui, 100% naturel, sans additifs chimiques.' },
  ],
  reviews: [
    { name: 'Mamadou K.', location: 'Douala', stars: 5, text: 'Résultats visibles dès la 1ère semaine !', verified: true },
    { name: 'Ibrahim S.', location: 'Abidjan', stars: 5, text: 'Livraison rapide et produit de qualité.', verified: true },
    { name: 'Astride N.', location: 'Yaoundé', stars: 4, text: 'Très bon produit, je recommande.', verified: true },
  ],
  description: 'Tongkat Ali Premium est un complément alimentaire 100% naturel formulé pour booster votre énergie, améliorer votre vitalité et soutenir votre libido de manière naturelle.',
};

const FIELD_ICONS = { fullname: User, phone: Phone, address: MapPin, note: FileText };

const LivePreview = ({ config }) => {
  const { general, conversion, design, form, automation } = config;
  const [faqOpen, setFaqOpen] = useState(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [realProduct, setRealProduct] = useState(null);

  // Try to fetch a real product for more realistic preview
  useEffect(() => {
    (async () => {
      try {
        const res = await storeManageApi.getProducts({ limit: 1 });
        const list = res.data?.data || res.data || [];
        if (list.length > 0) setRealProduct(list[0]);
      } catch { /* ignore */ }
    })();
  }, []);

  const product = realProduct ? {
    ...MOCK,
    name: realProduct.name || MOCK.name,
    category: realProduct.category || MOCK.category,
    price: realProduct.price || MOCK.price,
    comparePrice: realProduct.compareAtPrice || MOCK.comparePrice,
    stock: realProduct.stock ?? MOCK.stock,
    image: realProduct.image || realProduct.images?.[0]?.url || realProduct.images?.[0] || null,
    images: realProduct.images || [],
    slogan: realProduct._pageData?.hero_slogan || MOCK.slogan,
    baseline: realProduct._pageData?.hero_baseline || MOCK.baseline,
    description: realProduct.description || MOCK.description,
  } : MOCK;

  const enabledFields = form.fields.filter(f => f.enabled);
  const btnColor = design.buttonColor;
  const radius = typeof design.borderRadius === 'number' ? `${design.borderRadius}px` : design.borderRadius;
  const radiusNum = parseInt(radius) || 8;
  const hasShadow = design.shadow !== false;
  const pct = product.comparePrice > product.price ? Math.round((1 - product.price / product.comparePrice) * 100) : 0;
  const hasImages = product.images?.length > 0;
  const displayImages = hasImages ? product.images.slice(0, 4) : [];

  const enabledSections = (general.sections || []).filter(s => s.enabled);

  const btnStyle = {
    backgroundColor: btnColor,
    color: '#fff',
    borderRadius: radiusNum >= 16 ? '999px' : radius,
    boxShadow: hasShadow ? `0 4px 16px ${btnColor}50` : 'none',
    border: 'none',
    width: '100%',
    padding: '12px 16px',
    fontWeight: 800,
    fontSize: 11,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  };

  const inputRadius = Math.max(6, radiusNum / 1.5);

  const OrderFormContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {enabledFields.map(f => {
        const Icon = FIELD_ICONS[f.name] || User;
        return (
          <div key={f.name}>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#6B7280', marginBottom: 3 }}>{f.label}</div>
            <div style={{
              height: 30, borderRadius: inputRadius, border: `1.5px solid ${btnColor}30`,
              backgroundColor: '#fff', padding: '0 8px', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Icon size={10} color="#9CA3AF" />
              <div style={{ height: 6, width: '55%', borderRadius: 3, backgroundColor: '#E5E7EB' }} />
            </div>
          </div>
        );
      })}
      {conversion.quantities?.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#6B7280', marginBottom: 3 }}>Quantité</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {conversion.quantities.slice(0, 4).map((q, i) => (
              <div key={q} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                backgroundColor: i === 0 ? btnColor : '#F3F4F6',
                color: i === 0 ? '#fff' : '#374151',
                border: `1px solid ${i === 0 ? btnColor : '#E5E7EB'}`,
              }}>{q}</div>
            ))}
          </div>
        </div>
      )}
      <div style={{ height: 2 }} />
      <div style={btnStyle}>
        <ShoppingCart size={12} /> Commander · {fmt(product.price)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 8, color: '#16A34A', padding: '2px 0' }}>
        <Truck size={9} /> Paiement à la livraison
      </div>
    </div>
  );

  return (
    <div style={{
      background: '#F1F5F9', borderRadius: 20, border: '1px solid #E2E8F0',
      padding: '14px 12px', overflow: 'hidden', position: 'relative',
    }}>
      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Aperçu page produit
        </span>
        <span style={{ fontSize: 9, color: '#94A3B8', backgroundColor: '#E2E8F0', padding: '2px 7px', borderRadius: 20 }}>
          Temps réel
        </span>
      </div>

      {/* Phone frame */}
      <div style={{
        background: '#fff', borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
        maxHeight: 620, overflowY: 'auto',
        scrollbarWidth: 'none',
        border: '1px solid #E2E8F0',
      }}>

        {/* ── Store header — like real StorefrontHeader ── */}
        <div style={{
          padding: '8px 10px', borderBottom: '1px solid #F3F4F6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: '#fff', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 20, height: 20, borderRadius: 6,
              backgroundColor: btnColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShoppingBag size={11} color="#fff" />
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#111827' }}>Ma Boutique</span>
          </div>
          <div style={{ position: 'relative' }}>
            <ShoppingCart size={15} color="#6B7280" />
            <div style={{
              position: 'absolute', top: -3, right: -3, width: 8, height: 8,
              borderRadius: '50%', backgroundColor: btnColor, fontSize: 5, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
            }}>2</div>
          </div>
        </div>

        {/* ── Product Image Gallery (realistic) ── */}
        <div style={{ position: 'relative' }}>
          <div style={{
            height: 200, background: product.image
              ? `url(${product.image}) center/cover no-repeat`
              : `linear-gradient(135deg, ${btnColor}18 0%, ${btnColor}08 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            {!product.image && (
              <div style={{
                width: 80, height: 80, borderRadius: 16,
                backgroundColor: `${btnColor}20`, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Package size={32} color={btnColor} style={{ opacity: 0.4 }} />
              </div>
            )}
            {pct > 0 && (
              <div style={{
                position: 'absolute', top: 8, left: 8,
                backgroundColor: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700,
                padding: '3px 8px', borderRadius: 20,
                boxShadow: '0 2px 6px rgba(239,68,68,0.3)',
              }}>-{pct}%</div>
            )}
            {/* Nav arrows */}
            {displayImages.length > 1 && (
              <>
                <button style={{
                  position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
                  width: 22, height: 22, borderRadius: '50%', border: 'none',
                  backgroundColor: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ChevronLeft size={12} color="#374151" />
                </button>
                <button style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  width: 22, height: 22, borderRadius: '50%', border: 'none',
                  backgroundColor: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ChevronRight size={12} color="#374151" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {displayImages.length > 1 && (
            <div style={{
              display: 'flex', gap: 4, padding: '8px 10px',
              borderBottom: '1px solid #F3F4F6',
            }}>
              {displayImages.map((img, i) => (
                <div key={i} style={{
                  width: 36, height: 36, borderRadius: 6, overflow: 'hidden',
                  border: i === 0 ? `2px solid ${btnColor}` : '1.5px solid #E5E7EB',
                  opacity: i === 0 ? 1 : 0.7, flexShrink: 0,
                }}>
                  <img src={img.url || img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Product Info — matching real StoreProductPage layout ── */}
        <div style={{ padding: '12px 12px 0' }}>
          {/* Category */}
          <div style={{
            fontSize: 8.5, fontWeight: 700, color: btnColor,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
          }}>
            {product.category}
          </div>

          {/* Name */}
          <div style={{
            fontSize: 14, fontWeight: 900, color: '#111827',
            lineHeight: 1.15, marginBottom: 4, letterSpacing: '-0.02em',
          }}>
            {product.name}
          </div>

          {/* Slogan */}
          <div style={{ fontSize: 9.5, fontWeight: 600, color: '#6B7280', marginBottom: 3, lineHeight: 1.4 }}>
            {product.slogan}
          </div>

          {/* Baseline */}
          <div style={{ fontSize: 9, fontWeight: 700, color: btnColor, marginBottom: 8 }}>
            ✅ {product.baseline}
          </div>

          {/* Reviews inline */}
          {enabledSections.some(s => s.id === 'reviews') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 0.5 }}>
                {[1,2,3,4,5].map(i => (
                  <Star key={i} size={10} fill={i <= 4 ? '#FBBF24' : 'none'} color="#FBBF24" />
                ))}
              </div>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#111827' }}>{product.rating}</span>
              <span style={{ fontSize: 9, color: '#9CA3AF' }}>({product.ratingCount} avis)</span>
            </div>
          )}

          {/* Price */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: btnColor, letterSpacing: '-0.02em' }}>
              {fmt(product.price)}
            </span>
            {pct > 0 && (
              <>
                <span style={{ fontSize: 11, color: '#9CA3AF', textDecoration: 'line-through' }}>
                  {fmt(product.comparePrice)}
                </span>
                <span style={{
                  fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 20,
                  backgroundColor: '#FEE2E2', color: '#EF4444',
                }}>-{pct}%</span>
              </>
            )}
          </div>

          {/* Stock badge */}
          {enabledSections.some(s => s.id === 'stockCounter') && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              backgroundColor: '#FEF3C7', color: '#D97706',
              fontSize: 8.5, fontWeight: 700, padding: '3px 8px', borderRadius: 20, marginBottom: 8,
            }}>
              <span>⚡</span> Plus que {product.stock} en stock
            </div>
          )}

          {/* Benefits */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            {product.benefits.map((b, i) => (
              <div key={i} style={{
                fontSize: 9, color: '#374151', display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Check size={10} color={btnColor} style={{ flexShrink: 0 }} />
                {b}
              </div>
            ))}
          </div>

          {/* ── CTA — popup or embedded ── */}
          {general.formType === 'embedded' ? (
            <div style={{
              marginBottom: 10, padding: 10, borderRadius: radiusNum,
              border: `1px solid ${btnColor}25`, backgroundColor: `${btnColor}06`,
            }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#374151', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShoppingCart size={11} color={btnColor} /> Commander maintenant
              </div>
              <OrderFormContent />
            </div>
          ) : (
            <>
              <button style={btnStyle} onClick={() => setPopupOpen(true)}>
                <ShoppingCart size={13} /> Commander maintenant
              </button>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 4, fontSize: 8.5, color: '#16A34A', padding: '5px 0 8px',
              }}>
                <Truck size={9} /> Paiement à la livraison
              </div>
            </>
          )}

          {/* Trust badges */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 14, padding: '6px 0 10px',
            borderTop: '1px solid #F3F4F6',
          }}>
            {[[Shield, 'Sécurisé'], [Truck, 'Livraison rapide'], [RotateCcw, 'Retours faciles']].map(([Icon, label]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Icon size={12} color={btnColor} />
                <span style={{ fontSize: 7, color: '#6B7280', textAlign: 'center' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Description ── */}
        <div style={{ margin: '0 12px 2px', paddingTop: 10, borderTop: '1px solid #F3F4F6' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            Description du produit
          </div>
          <p style={{ fontSize: 8, color: '#6B7280', lineHeight: 1.5, margin: '0 0 8px' }}>
            {product.description?.replace(/<[^>]*>/g, '').slice(0, 150)}…
          </p>
        </div>

        {/* ── Ordered sections rendered like the real page ── */}
        {enabledSections.map(section => {
          if (section.id === 'reviews') return (
            <div key="reviews" style={{ margin: '4px 12px 8px', paddingTop: 10, borderTop: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                Avis clients
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {MOCK.reviews.map((r, i) => (
                  <div key={i} style={{
                    padding: '7px 9px', borderRadius: 10, backgroundColor: '#FAFAFA',
                    border: '1px solid #F3F4F6',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%',
                        backgroundColor: `${btnColor}20`, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, fontWeight: 700, color: btnColor,
                      }}>
                        {r.name[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 8, fontWeight: 700, color: '#111827' }}>{r.name}</span>
                          {r.verified && (
                            <span style={{ fontSize: 6.5, color: '#16A34A', backgroundColor: '#F0FDF4', padding: '1px 4px', borderRadius: 8 }}>
                              ✓ Vérifié
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 1, marginTop: 1 }}>
                          {[1,2,3,4,5].map(j => <Star key={j} size={7} fill={j <= r.stars ? '#FBBF24' : 'none'} color="#FBBF24" />)}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 8, color: '#6B7280', lineHeight: 1.4 }}>{r.text}</div>
                  </div>
                ))}
              </div>
            </div>
          );

          if (section.id === 'stockCounter') return null; // Already shown above in product info

          if (section.id === 'faq') return (
            <div key="faq" style={{ margin: '4px 12px 8px', paddingTop: 10, borderTop: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                Questions fréquentes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {MOCK.faqItems.map((item, i) => (
                  <div key={i} style={{ borderRadius: 8, border: '1px solid #F3F4F6', overflow: 'hidden' }}>
                    <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', padding: '7px 9px',
                        background: '#FAFAFA', border: 'none', cursor: 'pointer',
                      }}>
                      <span style={{ fontSize: 8.5, fontWeight: 600, color: '#374151', textAlign: 'left' }}>{item.q}</span>
                      {faqOpen === i ? <ChevronUp size={10} color="#6B7280" /> : <ChevronDown size={10} color="#6B7280" />}
                    </button>
                    {faqOpen === i && (
                      <div style={{ padding: '5px 9px 7px', fontSize: 8, color: '#6B7280', backgroundColor: '#fff', lineHeight: 1.4 }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );

          if (section.id === 'upsell') return (
            <div key="upsell" style={{
              margin: '4px 12px', padding: '8px 10px', borderRadius: 10,
              border: '1px solid #DDD6FE', backgroundColor: '#F5F3FF',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, backgroundColor: '#EDE9FE',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Star size={13} color="#7C3AED" />
              </div>
              <div>
                <div style={{ fontSize: 8.5, fontWeight: 800, color: '#5B21B6' }}>Offre Deluxe — 24 900 FCFA</div>
                <div style={{ fontSize: 7.5, color: '#7C3AED', marginTop: 1 }}>Pack complet + livraison offerte</div>
              </div>
            </div>
          );

          if (section.id === 'orderBump') return (
            <div key="orderBump" style={{
              margin: '4px 12px', padding: '6px 8px', border: '1.5px dashed #F97316',
              borderRadius: 8, backgroundColor: '#FFF7ED',
              display: 'flex', alignItems: 'flex-start', gap: 5,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: 2, backgroundColor: '#F97316',
                marginTop: 1, flexShrink: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={7} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: '#C2410C' }}>Ajouter l'accessoire assorti — 3 500 FCFA</div>
                <div style={{ fontSize: 7.5, color: '#EA580C', marginTop: 1 }}>Complément recommandé pour ce produit</div>
              </div>
            </div>
          );

          return null;
        })}

        {/* WhatsApp badge */}
        {automation?.whatsapp?.enabled && (
          <div style={{
            margin: '8px 12px', display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 8,
            backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0',
          }}>
            <MessageCircle size={11} color="#16A34A" />
            <span style={{ fontSize: 8.5, fontWeight: 600, color: '#15803D' }}>Confirmation WhatsApp activée</span>
          </div>
        )}

        {/* Testimonials section placeholder */}
        <div style={{
          margin: '8px 12px', padding: '10px', borderRadius: 10,
          background: 'linear-gradient(135deg, #F0FDF4, #ECFDF5)',
          border: '1px solid #D1FAE5',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#065F46', marginBottom: 6, textAlign: 'center' }}>
            Ce que disent nos clients
          </div>
          <div style={{
            padding: '8px', borderRadius: 8, backgroundColor: '#fff',
            border: '1px solid #E5E7EB',
          }}>
            <div style={{ display: 'flex', gap: 1, marginBottom: 3 }}>
              {[1,2,3,4,5].map(i => <Star key={i} size={8} fill="#FBBF24" color="#FBBF24" />)}
            </div>
            <p style={{ fontSize: 7.5, color: '#6B7280', margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>
              &ldquo;{MOCK.reviews[0].text}&rdquo;
            </p>
            <div style={{ fontSize: 7, fontWeight: 600, color: '#111827', marginTop: 3 }}>
              — {MOCK.reviews[0].name}, {MOCK.reviews[0].location}
            </div>
          </div>
        </div>

        <div style={{ height: 12 }} />
      </div>

      {/* ── Popup overlay ── */}
      {popupOpen && general.formType !== 'embedded' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          borderRadius: 20,
        }}
          onClick={() => setPopupOpen(false)}
        >
          <div
            style={{
              backgroundColor: design.backgroundColor || '#fff',
              borderRadius: '16px 16px 0 0',
              padding: '14px 14px 20px',
              width: '100%',
              maxHeight: '80%',
              overflowY: 'auto',
              boxShadow: hasShadow ? '0 -8px 32px rgba(0,0,0,0.15)' : 'none',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <ShoppingCart size={12} color={btnColor} />
                <span style={{ fontSize: 11, fontWeight: 800, color: design.textColor || '#111827' }}>Commander</span>
              </div>
              <button onClick={() => setPopupOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <X size={14} color="#9CA3AF" />
              </button>
            </div>
            {/* Product recap */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px',
              backgroundColor: '#F9FAFB', borderRadius: 8, marginBottom: 10,
            }}>
              {product.image ? (
                <img src={product.image} alt="" style={{
                  width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0,
                }} />
              ) : (
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  backgroundColor: `${btnColor}20`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Package size={16} color={btnColor} style={{ opacity: 0.5 }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: '#111827',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{product.name}</div>
                <div style={{ fontSize: 9, fontWeight: 800, color: btnColor, marginTop: 1 }}>
                  {fmt(product.price)}
                </div>
              </div>
            </div>
            <OrderFormContent />
          </div>
        </div>
      )}
    </div>
  );
};

export default LivePreview;
