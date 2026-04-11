import React, { useState, useEffect } from 'react';
import {
  Star, ShoppingCart, ChevronDown, ChevronUp, X,
  Truck, Shield, RotateCcw, MessageCircle, ShoppingBag, Check,
  ChevronLeft, ChevronRight, Package, User, Phone, MapPin, FileText,
  AlertTriangle, Lightbulb, Gift, Clock, TrendingUp, Users,
} from 'lucide-react';
import { storeManageApi, storeProductsApi } from '../../services/storeApi';
import { getIconComponent } from './ButtonEditor';

const fmt = (n, cur = 'XAF') => `${new Intl.NumberFormat('fr-FR').format(n)} ${cur}`;

const FIELD_ICONS = { fullname: User, phone: Phone, address: MapPin, note: FileText };

const EditableWrap = ({ sectionId, onSectionClick, activeSectionId, children }) => {
  if (!onSectionClick) return children;
  const isActive = activeSectionId === sectionId;
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSectionClick(sectionId); }}
      style={{
        position: 'relative', cursor: 'pointer', borderRadius: 6,
        outline: isActive ? '2px solid #0F6B4F' : '1.5px dashed transparent',
        outlineOffset: 2, transition: 'outline 0.15s ease',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.outline = '1.5px dashed #0F6B4F80'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.outline = '1.5px dashed transparent'; }}
    >
      {children}
    </div>
  );
};

const LivePreview = ({ config, product: productProp, onSectionClick, activeSectionId }) => {
  const { general, conversion, design, form, automation, button: btnCfg } = config;
  const BtnIcon = getIconComponent(btnCfg?.icon);
  const btnText = btnCfg?.text || 'Commander maintenant';
  const btnSubtext = btnCfg?.subtext || '';
  const btnAnim = btnCfg?.animation || 'none';
  const offersEnabled = conversion?.offersEnabled && conversion?.offers?.length > 0;
  const [selectedOffer, setSelectedOffer] = useState(0);
  const [faqOpen, setFaqOpen] = useState(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [internalProduct, setInternalProduct] = useState(null);
  const [loading, setLoading] = useState(!productProp);

  useEffect(() => {
    if (productProp) return;
    (async () => {
      try {
        const res = await storeProductsApi.getProducts({ limit: 1 });
        const list = res.data?.data?.products || res.data?.data || res.data || [];
        if (list.length > 0) setInternalProduct(list[0]);
      } catch (err) {
        console.error('LivePreview: failed to load product', err);
      }
      setLoading(false);
    })();
  }, [productProp]);

  const product = productProp || internalProduct;

  const pd = product?._pageData || {};
  const images = product?.images || [];
  const mainImage = images[0]?.url || images[0] || null;
  const price = product?.price || 14900;
  const comparePrice = product?.compareAtPrice || 0;
  const pct = comparePrice > price ? Math.round((1 - price / comparePrice) * 100) : 0;
  const stock = product?.stock ?? 4;
  const cur = product?.currency || 'XAF';

  const enabledFields = form.fields.filter(f => f.enabled);
  const btnColor = design.formButtonColor || '#ff6600';
  const radius = design.formInputRadius || design.borderRadius || '8px';
  const radiusNum = parseInt(radius) || 8;
  const hasShadow = design.shadow !== false;
  const sections = general.sections || [];
  const isOn = (id) => sections.find(s => s.id === id)?.enabled ?? true;

  const btnStyle = {
    backgroundColor: btnColor, color: '#fff',
    borderRadius: radiusNum >= 16 ? '999px' : radius,
    boxShadow: hasShadow ? `0 4px 16px ${btnColor}50` : 'none',
    border: 'none', width: '100%', padding: '12px 16px',
    fontWeight: 800, fontSize: 11, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    fontFamily: 'inherit', transition: 'all 0.2s ease',
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
      <button style={{...btnStyle, flexDirection: 'column', gap: 1}}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <BtnIcon size={12} /> {btnText}
        </span>
        {btnSubtext && <span style={{ fontSize: 8, fontWeight: 500, opacity: 0.8 }}>{btnSubtext}</span>}
      </button>
    </div>
  );

  if (loading) {
    return (
      <div style={{ background: '#F1F5F9', borderRadius: 20, border: '1px solid #E2E8F0', padding: '14px 12px', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#94A3B8' }}>
          <Package size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
          <div style={{ fontSize: 11, fontWeight: 600 }}>Chargement du produit…</div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ background: '#F1F5F9', borderRadius: 20, border: '1px solid #E2E8F0', padding: '14px 12px', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#94A3B8' }}>
          <Package size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
          <div style={{ fontSize: 11, fontWeight: 600 }}>Aucun produit trouvé</div>
          <div style={{ fontSize: 9, marginTop: 4 }}>Créez un produit pour voir l'aperçu</div>
        </div>
      </div>
    );
  }

  // Testimonials
  const testimonials = pd.testimonials?.length > 0
    ? pd.testimonials
    : product.testimonials?.length > 0
      ? product.testimonials : [];

  // FAQ
  const faqItems = product.faq?.length > 0
    ? product.faq
    : pd.faq?.length > 0 ? pd.faq : [];

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
        <span style={{ fontSize: 9, color: '#16A34A', backgroundColor: '#F0FDF4', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>
          {onSectionClick ? 'Cliquez pour modifier' : 'Données réelles'}
        </span>
      </div>

      {/* Phone frame */}
      <div style={{
        background: '#fff', borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
        maxHeight: 620, overflowY: 'auto', scrollbarWidth: 'none',
        border: '1px solid #E2E8F0',
      }}>

        {/* Store header */}
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
          <ShoppingCart size={15} color="#6B7280" />
        </div>

        {/* Product Image */}
        <div style={{ position: 'relative' }}>
          <div style={{
            height: 200,
            background: mainImage
              ? `url(${mainImage}) center/cover no-repeat`
              : `linear-gradient(135deg, ${btnColor}18 0%, ${btnColor}08 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {!mainImage && (
              <div style={{ width: 80, height: 80, borderRadius: 16, backgroundColor: `${btnColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={32} color={btnColor} style={{ opacity: 0.4 }} />
              </div>
            )}
            {pct > 0 && (
              <div style={{ position: 'absolute', top: 8, left: 8, backgroundColor: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>-{pct}%</div>
            )}
          </div>
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: 4, padding: '8px 10px', borderBottom: '1px solid #F3F4F6' }}>
              {images.slice(0, 4).map((img, i) => (
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

        {/* Product Info */}
        <div style={{ padding: '12px 12px 0' }}>
          {/* Category */}
          {product.category && (
            <div style={{ fontSize: 8.5, fontWeight: 700, color: btnColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {product.category}
            </div>
          )}

          {/* Name */}
          <div style={{ fontSize: 14, fontWeight: 900, color: '#111827', lineHeight: 1.15, marginBottom: 4, letterSpacing: '-0.02em' }}>
            {product.name}
          </div>

          {/* Price — always shown */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: btnColor, letterSpacing: '-0.02em' }}>
              {fmt(price, cur)}
            </span>
            {pct > 0 && (
              <>
                <span style={{ fontSize: 11, color: '#9CA3AF', textDecoration: 'line-through' }}>{fmt(comparePrice, cur)}</span>
                <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 20, backgroundColor: '#FEE2E2', color: '#EF4444' }}>-{pct}%</span>
              </>
            )}
          </div>

          {/* Sections rendered in config order */}
          {sections.filter(s => s.enabled).map(s => {
            switch (s.id) {
              case 'heroSlogan': {
                const heroSloganText = s.content?.text || pd.hero_slogan;
                return heroSloganText ? (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: '#6B7280', marginBottom: 3, lineHeight: 1.4 }}>
                      {heroSloganText}
                    </div>
                  </EditableWrap>
                ) : null;
              }

              case 'heroBaseline': {
                const heroBaselineText = s.content?.text || pd.hero_baseline;
                return heroBaselineText ? (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: btnColor, marginBottom: 8 }}>
                      ✅ {heroBaselineText}
                    </div>
                  </EditableWrap>
                ) : null;
              }

              case 'reviews':
                return (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 0.5 }}>
                        {[1,2,3,4,5].map(i => <Star key={i} size={10} fill={i <= 4 ? '#FBBF24' : 'none'} color="#FBBF24" />)}
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#111827' }}>{product.rating || 4.8}</span>
                      <span style={{ fontSize: 9, color: '#9CA3AF' }}>({product.reviewCount || testimonials.length || 0} avis)</span>
                    </div>
                  </EditableWrap>
                );

              case 'orderForm':
                return (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{ marginBottom: 10 }}>
                    {/* Offers cards */}
                    {offersEnabled && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                        {conversion.offers.map((offer, i) => {
                          const disc = offer.comparePrice > offer.price && offer.price > 0
                            ? Math.round((1 - offer.price / offer.comparePrice) * 100) : 0;
                          const sel = selectedOffer === i;
                          return (
                            <div key={i} onClick={() => setSelectedOffer(i)} style={{
                              padding: '7px 9px', borderRadius: 10, cursor: 'pointer',
                              border: sel ? `2px solid ${btnColor}` : '1.5px solid #E5E7EB',
                              backgroundColor: sel ? `${btnColor}08` : '#fff',
                              display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s ease',
                            }}>
                              <div style={{ width: 14, height: 14, borderRadius: '50%', border: sel ? `4px solid ${btnColor}` : '2px solid #D1D5DB', flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: '#111827' }}>
                                  {offer.qty} {offer.qty === 1 ? 'unité' : 'unités'}
                                  {offer.badge && <span style={{ marginLeft: 4, fontSize: 7, fontWeight: 700, color: '#fff', backgroundColor: btnColor, padding: '1px 5px', borderRadius: 20 }}>{offer.badge}</span>}
                                </div>
                                {offer.price > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 1 }}>
                                    <span style={{ fontSize: 10, fontWeight: 800, color: btnColor }}>{fmt(offer.price, cur)}</span>
                                    {disc > 0 && (
                                      <>
                                        <span style={{ fontSize: 8, color: '#9CA3AF', textDecoration: 'line-through' }}>{fmt(offer.comparePrice, cur)}</span>
                                        <span style={{ fontSize: 7, fontWeight: 700, color: '#EF4444', backgroundColor: '#FEE2E2', padding: '1px 4px', borderRadius: 10 }}>-{disc}%</span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* CTA button or embedded form */}
                    {general.formType === 'embedded' ? (
                      <div style={{ padding: 10, borderRadius: radiusNum, border: `1px solid ${btnColor}25`, backgroundColor: `${btnColor}06` }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#374151', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <BtnIcon size={11} color={btnColor} /> {btnText}
                        </div>
                        <OrderFormContent />
                      </div>
                    ) : (
                      <>
                        <button style={{...btnStyle, flexDirection: 'column', gap: 1}} onClick={() => setPopupOpen(true)}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <BtnIcon size={13} /> {btnText}
                          </span>
                          {btnSubtext && <span style={{ fontSize: 8, fontWeight: 500, opacity: 0.8 }}>{btnSubtext}</span>}
                        </button>
                        {btnSubtext && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 8.5, color: '#16A34A', padding: '5px 0 4px' }}>
                            <Truck size={9} /> {btnSubtext}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  </EditableWrap>
                );

              case 'statsBar': {
                const customStats = s.content?.stats?.filter(st => st.value && st.label);
                const statsData = customStats?.length > 0 ? customStats : pd.stats_bar;
                return statsData?.length > 0 ? (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                      {statsData.slice(0, 3).map((st, i) => (
                        <div key={i} style={{
                          flex: 1, minWidth: 60, textAlign: 'center', padding: '5px 4px',
                          borderRadius: 8, backgroundColor: '#F0FAF5', border: '1px solid #D1FAE5',
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 900, color: '#065F46' }}>{st.value}</div>
                          <div style={{ fontSize: 7, color: '#6B7280', marginTop: 1 }}>{st.label}</div>
                        </div>
                      ))}
                    </div>
                  </EditableWrap>
                ) : null;
              }

              case 'stockCounter':
                return stock > 0 && stock <= 10 ? (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 8.5, fontWeight: 700, color: '#D97706', backgroundColor: '#FEF3C7', padding: '3px 8px', borderRadius: 20 }}>
                        ⚡ Plus que {stock} en stock
                      </span>
                    </div>
                  </EditableWrap>
                ) : null;

              case 'urgencyBadge': {
                const urgencyText = s.content?.text || pd.urgency_badge;
                return urgencyText ? (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 8.5, fontWeight: 700, color: '#DC2626', backgroundColor: '#FEF2F2', padding: '3px 8px', borderRadius: 20, border: '1px solid #FECACA' }}>
                        {urgencyText}
                      </span>
                    </div>
                  </EditableWrap>
                ) : null;
              }

              case 'urgencyElements':
                return pd.urgency_elements ? (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
                    {pd.urgency_elements.stock_limited && (
                      <div style={{ fontSize: 8, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={9} /> {pd.urgency_elements.stock_limited}
                      </div>
                    )}
                    {pd.urgency_elements.social_proof_count && (
                      <div style={{ fontSize: 8, color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={9} /> {pd.urgency_elements.social_proof_count}
                      </div>
                    )}
                    {pd.urgency_elements.quick_result && (
                      <div style={{ fontSize: 8, color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <TrendingUp size={9} /> {pd.urgency_elements.quick_result}
                      </div>
                    )}
                  </div>
                  </EditableWrap>
                ) : null;

              case 'benefitsBullets': {
                const customBullets = s.content?.items?.filter(Boolean);
                const bulletsData = customBullets?.length > 0 ? customBullets : pd.benefits_bullets;
                return bulletsData?.length > 0 ? (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#374151', marginBottom: 4 }}>💥 Les bénéfices</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {bulletsData.slice(0, 4).map((b, i) => (
                          <div key={i} style={{ fontSize: 8.5, color: '#374151', display: 'flex', alignItems: 'flex-start', gap: 4, lineHeight: 1.4 }}>
                            {b}
                          </div>
                        ))}
                      </div>
                    </div>
                  </EditableWrap>
                ) : null;
              }

              case 'conversionBlocks':
                return pd.conversion_blocks?.length > 0 ? (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
                      {pd.conversion_blocks.slice(0, 4).map((b, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '5px 6px',
                          borderRadius: 8, backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6',
                        }}>
                          <span style={{ fontSize: 12, flexShrink: 0 }}>{b.icon}</span>
                          <span style={{ fontSize: 7.5, color: '#374151', lineHeight: 1.3 }}>{b.text}</span>
                        </div>
                      ))}
                    </div>
                  </EditableWrap>
                ) : null;

              case 'offerBlock': {
                const offerLabel = s.content?.offerLabel || pd.offer_block?.offer_label || 'Offre spéciale';
                const guaranteeText = s.content?.guaranteeText || pd.offer_block?.guarantee_text;
                return (pd.offer_block || s.content?.offerLabel || s.content?.guaranteeText) ? (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{
                      padding: '8px 10px', borderRadius: 10, marginBottom: 10,
                      backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                        <Gift size={10} color="#D97706" />
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#92400E' }}>{offerLabel}</span>
                      </div>
                      {guaranteeText && (
                        <div style={{ fontSize: 8, color: '#78350F', lineHeight: 1.4 }}>{guaranteeText}</div>
                      )}
                    </div>
                  </EditableWrap>
                ) : null;
              }

              case 'description':
                return product.description ? (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{ marginBottom: 8, paddingTop: 10, borderTop: '1px solid #F3F4F6' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Description du produit</div>
                      <p style={{ fontSize: 8, color: '#6B7280', lineHeight: 1.5, margin: '0 0 8px' }}>
                        {product.description.replace(/<[^>]*>/g, '').slice(0, 180)}…
                      </p>
                    </div>
                  </EditableWrap>
                ) : null;

              case 'problemSection': {
                const probTitle = s.content?.title || pd.problem_section?.title || 'Le problème';
                const customPainPoints = s.content?.painPoints?.filter(Boolean);
                const painPoints = customPainPoints?.length > 0 ? customPainPoints : pd.problem_section?.pain_points;
                return (pd.problem_section || s.content?.title || customPainPoints?.length > 0) ? (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{ padding: '8px 10px', borderRadius: 10, marginBottom: 8, backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <AlertTriangle size={10} color="#DC2626" />
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#991B1B' }}>{probTitle}</span>
                      </div>
                      {painPoints?.slice(0, 3).map((p, i) => (
                        <div key={i} style={{ fontSize: 8, color: '#7F1D1D', marginBottom: 2, display: 'flex', gap: 3, alignItems: 'flex-start' }}>
                          <span style={{ color: '#EF4444' }}>•</span> {p}
                        </div>
                      ))}
                    </div>
                  </EditableWrap>
                ) : null;
              }

              case 'solutionSection': {
                const solTitle = s.content?.title || pd.solution_section?.title || 'La solution';
                const solDesc = s.content?.description || pd.solution_section?.description;
                return (pd.solution_section || s.content?.title || s.content?.description) ? (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{ padding: '8px 10px', borderRadius: 10, marginBottom: 8, backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <Lightbulb size={10} color="#16A34A" />
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#14532D' }}>{solTitle}</span>
                      </div>
                      {solDesc && (
                        <div style={{ fontSize: 8, color: '#166534', lineHeight: 1.4 }}>
                          {solDesc.slice(0, 150)}…
                        </div>
                      )}
                    </div>
                  </EditableWrap>
                ) : null;
              }

              case 'faq': {
                const customFaq = s.content?.faqItems?.filter(f => f.question && f.answer);
                const faqData = customFaq?.length > 0 ? customFaq : faqItems;
                return faqData.length > 0 ? (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{ marginBottom: 8, paddingTop: 10, borderTop: '1px solid #F3F4F6' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Questions fréquentes</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {faqData.slice(0, 3).map((item, i) => (
                          <div key={i} style={{ borderRadius: 8, border: '1px solid #F3F4F6', overflow: 'hidden' }}>
                            <button onClick={(e) => { e.stopPropagation(); setFaqOpen(faqOpen === i ? null : i); }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 9px', background: '#FAFAFA', border: 'none', cursor: 'pointer' }}>
                              <span style={{ fontSize: 8.5, fontWeight: 600, color: '#374151', textAlign: 'left' }}>{item.question || item.q}</span>
                              {faqOpen === i ? <ChevronUp size={10} color="#6B7280" /> : <ChevronDown size={10} color="#6B7280" />}
                            </button>
                            {faqOpen === i && (
                              <div style={{ padding: '5px 9px 7px', fontSize: 8, color: '#6B7280', backgroundColor: '#fff', lineHeight: 1.4 }}>
                                {item.answer || item.reponse || item.a || ''}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </EditableWrap>
                ) : null;
              }

              case 'testimonials': {
                const customTestimonials = s.content?.items?.filter(t => t.name && t.text);
                const testimonialsData = customTestimonials?.length > 0 ? customTestimonials : testimonials;
                return testimonialsData.length > 0 ? (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{ padding: '10px', borderRadius: 10, marginBottom: 8, background: 'linear-gradient(135deg, #F0FDF4, #ECFDF5)', border: '1px solid #D1FAE5' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#065F46', marginBottom: 6, textAlign: 'center' }}>
                      Ce que disent nos clients
                    </div>
                    {testimonialsData.slice(0, 2).map((t, i) => (
                      <div key={i} style={{ padding: '6px 8px', borderRadius: 8, backgroundColor: '#fff', border: '1px solid #E5E7EB', marginBottom: i === 0 ? 4 : 0 }}>
                        <div style={{ display: 'flex', gap: 1, marginBottom: 2 }}>
                          {[1,2,3,4,5].map(j => <Star key={j} size={7} fill={j <= (t.rating || 5) ? '#FBBF24' : 'none'} color="#FBBF24" />)}
                        </div>
                        <p style={{ fontSize: 7.5, color: '#6B7280', margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>
                          &ldquo;{(t.text || t.content || '').slice(0, 80)}&rdquo;
                        </p>
                        <div style={{ fontSize: 7, fontWeight: 600, color: '#111827', marginTop: 2 }}>
                          — {t.name}{t.location ? `, ${t.location}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                  </EditableWrap>
                ) : null;
              }

              case 'relatedProducts':
                return (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Vous aimerez aussi</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[1, 2, 3].map(i => (
                        <div key={i} style={{ flex: 1, borderRadius: 8, border: '1px solid #F3F4F6', overflow: 'hidden' }}>
                          <div style={{ height: 40, backgroundColor: '#F3F4F6' }} />
                          <div style={{ padding: '4px 5px' }}>
                            <div style={{ height: 5, width: '80%', backgroundColor: '#E5E7EB', borderRadius: 3, marginBottom: 3 }} />
                            <div style={{ height: 5, width: '50%', backgroundColor: `${btnColor}30`, borderRadius: 3 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  </EditableWrap>
                );

              case 'upsell':
                return (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{
                      padding: '8px 10px', borderRadius: 10, marginBottom: 8,
                      border: '1px solid #DDD6FE', backgroundColor: '#F5F3FF',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Star size={13} color="#7C3AED" />
                    </div>
                    <div>
                      <div style={{ fontSize: 8.5, fontWeight: 800, color: '#5B21B6' }}>Offre Deluxe</div>
                      <div style={{ fontSize: 7.5, color: '#7C3AED', marginTop: 1 }}>Pack complet + livraison offerte</div>
                    </div>
                  </div>
                  </EditableWrap>
                );

              case 'orderBump':
                return (
                  <EditableWrap key={s.id} sectionId={s.id} onSectionClick={onSectionClick} activeSectionId={activeSectionId}>
                    <div style={{
                      padding: '6px 8px', border: '1.5px dashed #F97316', marginBottom: 8,
                      borderRadius: 8, backgroundColor: '#FFF7ED',
                      display: 'flex', alignItems: 'flex-start', gap: 5,
                    }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#F97316', marginTop: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={7} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontSize: 8.5, fontWeight: 700, color: '#C2410C' }}>Ajouter l'accessoire assorti</div>
                      <div style={{ fontSize: 7.5, color: '#EA580C', marginTop: 1 }}>Complément recommandé pour ce produit</div>
                    </div>
                  </div>
                  </EditableWrap>
                );

              default:
                return null;
            }
          })}

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
        {automation?.whatsapp?.enabled && (
          <div style={{ margin: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <MessageCircle size={11} color="#16A34A" />
            <span style={{ fontSize: 8.5, fontWeight: 600, color: '#15803D' }}>Confirmation WhatsApp activée</span>
          </div>
        )}

        {/* Sticky order bar preview */}
        {isOn('stickyOrderBar') && (
          <div style={{
            position: 'sticky', bottom: 0, left: 0, right: 0,
            padding: '6px 10px', backgroundColor: 'rgba(255,255,255,0.96)',
            borderTop: '1px solid #E5E7EB', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', gap: 6, zIndex: 10,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 7.5, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: btnColor }}>{fmt(price, cur)}</div>
            </div>
            <div style={{
              padding: '6px 12px', borderRadius: 999, fontSize: 8, fontWeight: 800,
              backgroundColor: btnColor, color: '#fff', whiteSpace: 'nowrap',
            }}>
              Commander
            </div>
          </div>
        )}
      </div>

      {/* Popup overlay */}
      {popupOpen && general.formType !== 'embedded' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          borderRadius: 20,
        }} onClick={() => setPopupOpen(false)}>
          <div style={{
            backgroundColor: design.formBgColor || '#fff',
            borderRadius: '16px 16px 0 0', padding: '14px 14px 20px',
            width: '100%', maxHeight: '80%', overflowY: 'auto',
            boxShadow: hasShadow ? '0 -8px 32px rgba(0,0,0,0.15)' : 'none',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <BtnIcon size={12} color={btnColor} />
                <span style={{ fontSize: 11, fontWeight: 800, color: design.formTextColor || '#111827' }}>{btnText}</span>
              </div>
              <button onClick={() => setPopupOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <X size={14} color="#9CA3AF" />
              </button>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px',
              backgroundColor: '#F9FAFB', borderRadius: 8, marginBottom: 10,
            }}>
              {mainImage ? (
                <img src={mainImage} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${btnColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Package size={16} color={btnColor} style={{ opacity: 0.5 }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
                <div style={{ fontSize: 9, fontWeight: 800, color: btnColor, marginTop: 1 }}>{fmt(price, cur)}</div>
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
