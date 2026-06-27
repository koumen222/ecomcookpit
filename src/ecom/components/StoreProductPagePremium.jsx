import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import {
  Award,
  BadgeCheck,
  BookOpen,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Shield,
  ShoppingCart,
  Star,
  Truck,
  X,
  Camera,
  Loader2,
  Gift,

} from 'lucide-react';
import QuickOrderModal from './QuickOrderModal.jsx';
import EmbeddedOrderForm from './EmbeddedOrderForm.jsx';
import { StorefrontHeader } from './StorefrontShared.jsx';
import { useStoreCart } from '../hooks/useStoreCart.js';
import { formatMoney } from '../utils/currency.js';
import { storeProductsApi } from '../services/storeApi.js';

// ── Inline Image Editor (admin-only) ─────────────────────────────────────────
const getPremiumMediaType = (url) => {
  if (!url) return 'image';
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.gif')) return 'gif';
  if (clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.mov')) return 'video';
  return 'image';
};

const EditableImage = ({ src, alt, style, className, imageKey, arrayIndex, productId, onImageUpdated, isAdmin }) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const mediaType = getPremiumMediaType(src);

  const MediaEl = () => mediaType === 'video'
    ? <video src={src} autoPlay loop muted playsInline style={style} className={className} />
    : <img src={src} alt={alt} style={style} className={className} />;

  if (!isAdmin) return <MediaEl />;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !productId) return;
    setUploading(true);
    try {
      const res = await storeProductsApi.uploadImages([file]);
      const url = res?.data?.data?.[0]?.url || res?.data?.[0]?.url || '';
      if (url && onImageUpdated) onImageUpdated(imageKey, url, arrayIndex);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: style?.width || '100%', height: style?.height || 'auto' }}>
      <MediaEl />
      <input type="file" ref={inputRef} onChange={handleUpload} accept="image/*,image/gif,video/mp4,video/webm,video/quicktime" style={{ display: 'none' }} />
      <button
        onClick={(ev) => { ev.stopPropagation(); inputRef.current?.click(); }}
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: 10,
          width: 36, height: 36, borderRadius: 10,
          backgroundColor: uploading ? '#111827' : 'rgba(17,24,39,0.75)',
          border: '1.5px solid rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          backdropFilter: 'blur(4px)',
          transition: 'background-color 0.15s',
        }}
        title={mediaType === 'video' ? 'Changer cette vidéo' : 'Changer cette image'}
      >
        {uploading
          ? <Loader2 size={16} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
          : <Camera size={16} color="#fff" />}
      </button>
    </div>
  );
};

const getImageUrl = (image) => (typeof image === 'string' ? image : image?.url) || '';

const textValue = (value, fallback = '') => {
  const text = String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text || fallback;
};

// Devise: on n'affiche JAMAIS le symbole $. On retire $ / USD des libellés générés.
const sanitizeMoney = (value) => String(value || '')
  .replace(/\$/g, '')
  .replace(/\bUSD\b/gi, '')
  .replace(/\s+/g, ' ')
  .trim();

const asArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const normalizeLabel = (value = '') => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const cleanPremiumTags = (tags = []) => asArray(tags)
  .map((tag) => textValue(tag))
  .filter((tag) => {
    const normalized = normalizeLabel(tag);
    return normalized && !['verifie', 'acheteur verifie', 'qualite', 'conforme'].includes(normalized);
  })
  .slice(0, 2);

const dedupeImages = (items = []) => {
  const seen = new Set();
  return items
    .map(getImageUrl)
    .filter((url) => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
};

const buildGallery = (product, productPageConfig = {}) => {
  const pageData = product?._pageData || {};
  const premiumImages = { ...(pageData.premiumImages || product?.premiumImages || {}), ...(productPageConfig?.premiumImages || {}) };
  return dedupeImages([
    premiumImages.hero,
    ...((premiumImages.heroGallery || []).map((entry) => getImageUrl(entry))),
    pageData.heroImage,
    pageData.heroPosterImage,
    ...(pageData.realPhotos || []),
    ...(product?.images || []),
    premiumImages.problem,
    premiumImages.mechanism,
    premiumImages.science,
    premiumImages.ritual,
    premiumImages.closing,
    ...((premiumImages.testimonials || []).map((entry) => getImageUrl(entry))),
    ...(pageData.beforeAfterImages || []),
    pageData.beforeAfterImage,
    ...((pageData.angles || []).map((angle) => angle?.poster_url)),
    ...(pageData.socialProofImages || []),
    pageData.testimonialsSocialProofImage,
    pageData.testimonialsGroupImage,
  ]);
};

const boolIcon = (value, accent) => value ? (
  <span className="premium-bool premium-bool-ok" aria-label="Oui"><Check size={14} /></span>
) : (
  <span className="premium-bool premium-bool-no" aria-label="Non"><X size={14} /></span>
);

const PremiumBonusEbook = ({ ebook, accent, onOrder, ctaLabel = 'Commander', productImage = '' }) => {
  if (!ebook || typeof ebook !== 'object') return null;
  const sales = ebook.sales_section || {};
  const cover = ebook.cover || {};
  const title = textValue(ebook.title || cover.cover_title, 'Guide bonus offert');
  const subtitle = (textValue(ebook.subtitle || ebook.short_description, sales.bonus_text) || '').slice(0, 72);
  const buttonText = textValue(sales.cta_text, ctaLabel);

  // Priority: ebook cover → product image. Both tried before showing placeholder.
  const candidates = [
    ebook.cover?.generatedImageUrl,
    ebook.pdf?.coverImageUrl,
    productImage,
  ].filter(Boolean);

  const [imgIndex, setImgIndex] = useState(0);
  const imgSrc = candidates[imgIndex] || '';

  if (!title) return null;

  return (
    <section className="premium-section premium-bonus">
      <div className="premium-bonus-card" style={{ flexDirection: 'column', maxWidth: 520, margin: '0 auto' }}>

        {/* badge */}
        <div className="premium-bonus-kicker" style={{ marginBottom: 8 }}>
          <Gift size={15} />
          {textValue(cover.badge_text, 'Bonus offert')}
        </div>

        {/* title + subtitle */}
        <h2 className="premium-heading" style={{ marginBottom: subtitle ? 6 : 14 }}>{title}</h2>
        {subtitle && <p className="premium-lead" style={{ marginBottom: 14 }}>{subtitle}</p>}

        {/* cover image — centered book portrait */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <div style={{ width: 160, borderRadius: 12, overflow: 'hidden', boxShadow: '0 14px 36px rgba(15,23,42,0.18)', flexShrink: 0, background: '#f1f5f9' }}>
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={title}
                style={{ width: '100%', display: 'block', objectFit: 'cover', aspectRatio: '2/3' }}
                onError={() => setImgIndex(i => i + 1)}
              />
            ) : (
              <div style={{ width: '100%', aspectRatio: '2/3', background: `linear-gradient(145deg, ${accent}, color-mix(in srgb, ${accent} 55%, #1e293b))`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 }}>
                <BookOpen size={40} color="rgba(255,255,255,.7)" />
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 800, textAlign: 'center', textTransform: 'uppercase', lineHeight: 1.3 }}>{title}</span>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <button type="button" className="premium-cta premium-bonus-cta" onClick={onOrder} style={{ width: '100%' }}>
          <ShoppingCart size={18} />
          {buttonText}
        </button>

      </div>
    </section>
  );
};

const StoreProductPagePremium = ({ product, store, productPageConfig, subdomain, pixels, prefix = '' }) => {
  const formType = productPageConfig?.general?.formType || 'popup';
  const isEmbeddedForm = formType === 'embedded';
  const ctaRef = useRef(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [openHeroAccordion, setOpenHeroAccordion] = useState(null);
  const [activeHeroImage, setActiveHeroImage] = useState(0);
  const heroTouchStartX = useRef(null);
  const reviewsRef = useRef(null);
  const { cartCount } = useStoreCart(subdomain);

  // ── Admin image editing ───────────────────────────────────────────────────
  const [isAdmin, setIsAdmin] = useState(false);
  const [localPremiumImages, setLocalPremiumImages] = useState(null);

  useEffect(() => {
    try {
      const token = localStorage.getItem('ecom_token') || localStorage.getItem('token');
      setIsAdmin(!!token && !!product?._id);
    } catch { setIsAdmin(false); }
  }, [product?._id]);

  // Execute custom JS injected by the AI builder
  useEffect(() => {
    const js = productPageConfig?.customJs;
    if (!js) return;
    try { new Function(js)(); } catch (e) { console.warn('[AI customJs]', e); }
  }, [productPageConfig?.customJs]);

  const handleImageUpdated = useCallback(async (key, newUrl, arrayIndex) => {
    if (!product?._id || !newUrl) return;
    try {
      const currentConfig = productPageConfig || {};
      const currentImages = { ...(currentConfig.premiumImages || {}) };

      if (arrayIndex !== undefined && arrayIndex !== null) {
        const arr = Array.isArray(currentImages[key]) ? [...currentImages[key]] : [];
        arr[arrayIndex] = newUrl;
        currentImages[key] = arr;
      } else {
        currentImages[key] = newUrl;
      }

      await storeProductsApi.updateProduct(product._id, {
        productPageConfig: { ...currentConfig, premiumImages: currentImages },
      });
      setLocalPremiumImages(currentImages);
    } catch (err) {
      console.error('Failed to save image:', err);
    }
  }, [product?._id, productPageConfig]);

  const premium = productPageConfig?.premiumPage || product?._pageData?.premium_page || product?._pageData?.premiumPage || {};
  const design = productPageConfig?.design || {};
  const accent = design.ctaButtonColor || design.buttonColor || '#0F766E';
  const textColor = design.textColor || '#171717';
  const backgroundColor = design.backgroundColor || '#F6FBFA';
  const pageData = product?._pageData || {};
  const premiumImages = { ...(pageData.premiumImages || product?.premiumImages || {}), ...(productPageConfig?.premiumImages || {}), ...(localPremiumImages || {}) };
  const gallery = useMemo(() => buildGallery(product, productPageConfig), [product, productPageConfig]);
  const sectionImage = (key, fallbackIndex = 0) => getImageUrl(premiumImages?.[key]) || gallery[fallbackIndex] || gallery[0] || '';
  const realPhotos = dedupeImages(pageData.realPhotos || product?.realPhotos || []);
  // Témoignages: uniquement les photos UGC générées (cycle si moins de 6), pas d'image produit/section.
  const testimonialUgcImages = dedupeImages(premiumImages?.testimonials || []);
  const testimonialFallback = dedupeImages([...realPhotos, ...gallery]);
  const testimonialImage = (index) => (testimonialUgcImages.length
    ? testimonialUgcImages[index % testimonialUgcImages.length]
    : (testimonialFallback[index] || testimonialFallback[0] || ''));
  const heroImage = sectionImage('hero', 0);
  const productName = textValue(premium.brandName, product?.name || store?.name || 'Produit');
  const rawEbook = pageData.ebook || product?.ebook || productPageConfig?.ebook || null;
  const bonusEbook = rawEbook && rawEbook.addAsOffer !== false ? rawEbook : null;

  // Devise: priorité à la boutique, jamais USD/$. Repli FCFA (XAF).
  const resolveCurrency = (code) => (code && String(code).toUpperCase() !== 'USD' ? code : null);
  const currency = resolveCurrency(store?.currency) || resolveCurrency(product?.currency) || 'XAF';
  const priceLabel = product?.price
    ? formatMoney(product.price, currency)
    : sanitizeMoney(premium.hero?.priceLabel);
  const compareLabel = product?.compareAtPrice && product.compareAtPrice > product.price
    ? formatMoney(product.compareAtPrice, currency)
    : sanitizeMoney(premium.hero?.offerCards?.[0]?.oldPrice);

  // Set d'images HERO dédié (heroGallery) ; sinon packshot + photos produit, jamais les images de section.
  // L'image principale du produit (product.images[0]) est prioritaire si elle existe.
  const heroImages = useMemo(() => {
    const productImages = product?.images || [];
    const dedicated = dedupeImages([
      ...productImages,
      ...((premiumImages.heroGallery || []).map((entry) => getImageUrl(entry))),
      premiumImages.hero,
      pageData.heroImage,
    ]);
    return (dedicated.length ? dedicated : gallery).slice(0, 5);
  }, [premiumImages, pageData, product, gallery]);
  const heroCount = heroImages.length;
  const heroIndex = heroCount ? Math.min(activeHeroImage, heroCount - 1) : 0;
  const goHero = (dir) => setActiveHeroImage((current) => {
    if (!heroCount) return 0;
    return (current + dir + heroCount) % heroCount;
  });
  const onHeroTouchStart = (event) => { heroTouchStartX.current = event.touches?.[0]?.clientX ?? null; };
  const onHeroTouchEnd = (event) => {
    if (heroTouchStartX.current == null) return;
    const delta = (event.changedTouches?.[0]?.clientX ?? 0) - heroTouchStartX.current;
    if (delta > 40) goHero(-1);
    else if (delta < -40) goHero(1);
    heroTouchStartX.current = null;
  };

  const scrollReviews = (dir) => {
    const el = reviewsRef.current;
    if (!el) return;
    const card = el.querySelector('.premium-testimonial-card');
    const amount = card ? card.offsetWidth + 18 : Math.round(el.clientWidth * 0.8);
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };

  const rawHeroBenefits = asArray(premium.hero?.benefits).length
    ? asArray(premium.hero.benefits)
    : asArray(product?._pageData?.benefits_bullets);
  const heroBenefits = rawHeroBenefits.length ? rawHeroBenefits : [
    `Une solution simple pour profiter de ${productName}`,
    'Une utilisation facile au quotidien',
    "Une qualité rassurante avant l'achat",
    "Un accompagnement clair jusqu'à la commande",
  ];
  const authorityStrip = asArray(premium.authorityStrip).length ? premium.authorityStrip : [
    { label: 'Clients vérifiés', quote: heroBenefits[0] || 'Une solution choisie pour sa simplicité au quotidien.' },
    { label: 'Routine populaire', quote: heroBenefits[1] || 'Une expérience claire, pratique et rassurante.' },
    { label: 'Qualité contrôlée', quote: 'Une page pensée pour acheter avec confiance.' },
  ];

  // Avis: on garantit 6 témoignages affichés en carrousel.
  const fallbackReviews = [
    { name: 'Aïcha B.', text: `Très satisfaite de ${productName}. La qualité est au rendez-vous et l'utilisation est simple au quotidien. La livraison a été rapide et le paiement à la livraison m'a mise en confiance dès le départ.`, tags: ['Qualité', 'Vérifié'] },
    { name: 'Yannick O.', text: `Ce ${productName} fait exactement ce qui est promis. Je l'utilise tous les jours et je vois la différence. Le rapport qualité-prix est excellent, je le recommande déjà à tout mon entourage.`, tags: ['Pratique', 'Vérifié'] },
    { name: 'Fatou S.', text: `J'hésitais avant de commander mais je ne regrette pas du tout. Le produit est conforme à la description, bien emballé et vraiment agréable à utiliser. Le service client est très réactif sur WhatsApp.`, tags: ['Conforme', 'Vérifié'] },
    { name: 'Jean-Paul T.', text: `Excellent achat. ${productName} est solide, bien pensé et facile à intégrer dans ma routine. Les premiers résultats sont arrivés vite, je suis bluffé par la simplicité d'utilisation au quotidien.`, tags: ['Résultat', 'Vérifié'] },
    { name: 'Mariam D.', text: `Produit reçu en bon état et parfaitement conforme. Ce ${productName} est vite devenu indispensable pour moi. Je l'utilise depuis deux semaines et je le recommande sans la moindre hésitation.`, tags: ['Fiable', 'Vérifié'] },
    { name: 'Patrick N.', text: `Vraiment content de cet achat. ${productName} est pratique, de très bonne qualité et tient ses promesses. Commande simple, livraison rapide et paiement à la réception : tout était parfait.`, tags: ['Top', 'Vérifié'] },
  ];
  const reviewsBase = asArray(premium.testimonialGallery?.items).length
    ? premium.testimonialGallery.items
    : asArray(product?._pageData?.testimonials || product?.testimonials);
  const reviews = [...reviewsBase, ...fallbackReviews].slice(0, 6);

  const problemBullets = asArray(premium.problemSection?.bullets).length
    ? premium.problemSection.bullets
    : asArray(product?._pageData?.problem_section?.pain_points).slice(0, 4);
  const scienceItems = asArray(premium.scienceSection?.items).length
    ? premium.scienceSection.items
    : asArray(product?._pageData?.raisons_acheter).slice(0, 4).map((item) => ({ name: item, description: item }));
  const ritualSteps = asArray(premium.ritualSection?.steps).length
    ? premium.ritualSection.steps
    : asArray(product?._pageData?.guide_utilisation?.etapes).slice(0, 4).map((step) => ({
      label: `Étape ${step.numero || ''}`.trim(),
      title: step.action,
      description: step.detail,
    }));
  const timeline = asArray(premium.ritualSection?.resultsTimeline);
  const comparison = premium.comparisonSection || {};
  const comparisonColumns = asArray(comparison.columns).length ? comparison.columns : [productName, 'Solution classique', 'Alternative basique'];
  const comparisonRows = asArray(comparison.rows).length
    ? comparison.rows
    : heroBenefits.slice(0, 8).map((benefit) => ({ label: benefit, values: [true, false, false] }));
  const closingBullets = asArray(premium.closingSection?.bullets).length
    ? premium.closingSection.bullets
    : heroBenefits.slice(0, 5);
  const faqItems = asArray(premium.faq?.items).length
    ? premium.faq.items
    : asArray(product?._pageData?.faq || product?.faq).length
    ? (product?._pageData?.faq || product?.faq)
    : [
      { question: 'Comment utiliser ce produit ?', answer: "Suivez les instructions sur l'emballage. En cas de doute, contactez-nous via WhatsApp." },
      { question: 'Quels sont les effets secondaires ?', answer: 'Ce produit est naturel et sans effets secondaires connus. Consultez un professionnel si besoin.' },
      { question: 'Combien de temps pour voir des resultats ?', answer: "Les premiers resultats sont visibles entre 7 et 15 jours d'utilisation reguliere." },
      { question: 'Comment passer commande ?', answer: 'Cliquez sur le bouton Commander et remplissez le formulaire. Paiement a la livraison disponible.' },
      { question: 'La livraison est-elle gratuite ?', answer: 'La livraison est offerte a partir d\'un certain montant. Sinon, les frais sont affiches avant paiement.' },
    ];
  const reassurance = asArray(premium.hero?.reassurance).length
    ? premium.hero.reassurance
    : ['Paiement à la livraison', 'Livraison rapide', 'Support WhatsApp'];
  const heroAccordions = asArray(premium.hero?.accordions).length
    ? premium.hero.accordions
    : asArray(product?._pageData?.hero_accordions).length
    ? product._pageData.hero_accordions
    : [
      { title: "Comment ca marche ?", content: textValue(premium.mechanismSection?.body || product?._pageData?.solution_section?.description, "Les capsules agissent de l'interieur pour neutraliser les odeurs a la source. Une seule gelule par jour suffit.") },
      { title: "Ingredients cles", content: textValue(premium.scienceSection?.items?.[0]?.description, "Formule 100% naturelle a base d'ingredients selectionnes pour leur efficacite prouvee.") },
      { title: "Et si cela ne fonctionne pas ?", content: "Nous offrons une garantie de satisfaction totale. Contactez-nous pour un remboursement integral, sans aucune question." },
    ];

  const openOrder = () => {
    if (isEmbeddedForm) {
      ctaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setShowOrderModal(true);
    }
  };
  const pageVars = {
    '--premium-accent': accent,
    '--premium-text': textColor,
    '--premium-bg': backgroundColor,
    '--s-primary': store?.primaryColor || store?.themeColor || accent,
    '--s-accent': store?.accentColor || accent,
    '--s-bg': store?.backgroundColor || backgroundColor,
    '--s-border': 'rgba(15,23,42,0.10)',
    '--s-text': store?.textColor || textColor,
    '--s-text2': store?.secondaryColor || '#4b5563',
    '--s-font': 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  return (
    <div className="premium-product-page" style={pageVars}>
      <style>{`
        .premium-product-page { min-height: 100vh; background: var(--premium-bg); color: var(--premium-text); font-family: var(--s-font, Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif); }
        .premium-header { position: sticky; top: 0; z-index: 30; height: 60px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 0 clamp(16px, 4vw, 72px); background: rgba(255,255,255,0.96); border-bottom: 1px solid rgba(15,23,42,0.08); backdrop-filter: blur(14px); }
        .premium-brand { margin: 0; font-size: clamp(19px, 2.2vw, 30px); font-weight: 900; line-height: 1; letter-spacing: 0; text-align: center; }
        .premium-contact { font-size: 14px; font-weight: 650; color: #2f363f; }
        .premium-icons { display: flex; justify-content: flex-end; align-items: center; gap: 16px; }
        .premium-cart { position: relative; display: inline-flex; }
        .premium-cart-count { position: absolute; right: -10px; bottom: -8px; min-width: 18px; height: 18px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: var(--premium-accent); color: white; font-size: 10px; font-weight: 900; }
        .premium-section { padding: clamp(30px, 5vw, 64px) clamp(16px, 4vw, 72px); }
        .premium-hero { background: #fff; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr); gap: clamp(24px, 4vw, 56px); align-items: center; padding-top: clamp(26px, 4vw, 56px); }
        .premium-media { position: relative; width: 100%; overflow: hidden; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .premium-carousel { position: relative; width: 100%; aspect-ratio: 1 / 1; overflow: hidden; border-radius: 12px; background: #fff; }
        .premium-carousel-track { display: flex; height: 100%; transition: transform .35s ease; }
        .premium-carousel-slide { min-width: 100%; height: 100%; flex: 0 0 100%; display: flex; align-items: center; justify-content: center; background: #fff; }
        .premium-carousel-slide > div { width: 100%; height: 100%; }
        .premium-carousel-slide img, .premium-carousel-slide video { width: 100%; height: 100%; object-fit: cover; display: block; }
        .premium-carousel-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 38px; height: 38px; border-radius: 999px; border: 0; background: rgba(255,255,255,0.92); box-shadow: 0 4px 14px rgba(0,0,0,0.12); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #1f2933; z-index: 3; }
        .premium-carousel-arrow:hover { background: #fff; }
        .premium-carousel-arrow.prev { left: 10px; }
        .premium-carousel-arrow.next { right: 10px; }
        .premium-carousel-dots { position: absolute; bottom: 10px; left: 0; right: 0; display: flex; justify-content: center; gap: 7px; z-index: 3; }
        .premium-dot { width: 8px; height: 8px; border-radius: 999px; border: 0; background: rgba(15,23,42,0.25); cursor: pointer; padding: 0; transition: width .2s, background .2s; }
        .premium-dot.active { background: var(--premium-accent); width: 20px; }
        .premium-seal { position: absolute; top: 20px; left: 20px; width: 104px; height: 104px; border-radius: 50%; background: #B42318; color: white; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 900; font-size: 14px; line-height: 1.15; transform: rotate(-10deg); padding: 12px; box-shadow: 0 12px 28px rgba(180,35,24,0.22); z-index: 4; }
        .premium-rating { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; margin-bottom: 18px; font-weight: 700; font-size: 14px; color: #34373d; }
        .premium-stars { display: inline-flex; gap: 2px; color: #FACC15; }
        .premium-hero h1 { margin: 0; font-size: clamp(24px, 3.1vw, 38px); line-height: 1.14; font-weight: 900; letter-spacing: 0; color: #05070a; text-transform: uppercase; }
        .premium-subtitle { margin: 16px 0 18px; font-size: clamp(14px, 1.3vw, 18px); line-height: 1.55; color: #42464d; }
        .premium-price { display: flex; align-items: baseline; gap: 10px; margin-bottom: 18px; font-size: clamp(21px, 2.1vw, 29px); font-weight: 900; color: #1f2933; }
        .premium-compare { font-size: 15px; color: #737983; text-decoration: line-through; font-weight: 650; }
        .premium-check-list { display: grid; gap: 10px; margin: 0 0 18px; padding: 0; list-style: none; }
        .premium-check-list li { display: flex; gap: 10px; align-items: flex-start; font-size: clamp(13.5px, 1vw, 16px); line-height: 1.45; font-weight: 600; color: #3d424b; }
        .premium-check-dot { width: 20px; height: 20px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; margin-top: 2px; background: color-mix(in srgb, var(--premium-accent) 72%, white); color: #fff; }
        .premium-offer-title { display: flex; align-items: center; gap: 12px; margin: 18px 0 10px; font-size: 14px; font-weight: 900; text-transform: uppercase; color: #111827; }
        .premium-offer-title:before, .premium-offer-title:after { content: ""; height: 2px; flex: 1; background: color-mix(in srgb, var(--premium-accent) 28%, white); }
        .premium-countdown { border-radius: 14px; background: #D8D8D8; color: #090909; text-align: center; font-size: 14px; font-weight: 800; padding: 10px 16px; margin-bottom: 12px; }
        .premium-offer-card { border: 2px solid color-mix(in srgb, var(--premium-accent) 72%, white); border-radius: 16px; padding: 12px 16px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 14px; background: #fff; }
        .premium-offer-card img { width: 64px; height: 54px; border-radius: 8px; object-fit: cover; background: #f4f6f8; }
        .premium-offer-main { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 16px; font-weight: 800; }
        .premium-chip { border-radius: 999px; background: #D6D6D6; color: #111; padding: 5px 9px; font-size: 12px; font-weight: 800; }
        .premium-offer-price { text-align: right; font-size: 18px; font-weight: 900; color: #05070a; }
        .premium-cta { width: 100%; min-height: 50px; border: 0; border-radius: 12px; background: color-mix(in srgb, var(--premium-accent) 78%, white); color: white; display: inline-flex; align-items: center; justify-content: center; gap: 10px; margin-top: 14px; font-size: 17px; font-weight: 900; cursor: pointer; transition: transform .16s ease, filter .16s ease; }
        .premium-cta:hover { transform: translateY(-1px); filter: brightness(0.97); }
        .premium-reassurance { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 14px; color: #6b7280; font-size: 13px; font-weight: 700; }
        .premium-reassurance span { display: inline-flex; align-items: center; gap: 6px; }
        .premium-authority { overflow: hidden; background: #EFF8F7; border-block: 1px solid rgba(15,23,42,0.05); padding: 22px 0; }
        .premium-authority-track { display: flex; gap: 40px; min-width: max-content; padding-inline: 24px; animation: premium-marquee 28s linear infinite; }
        .premium-authority-item { min-width: 240px; text-align: center; }
        .premium-authority-label { font-size: clamp(17px, 1.7vw, 25px); line-height: 1; font-weight: 900; color: #030712; }
        .premium-authority-quote { margin: 10px 0 0; font-size: 14px; line-height: 1.5; color: #444a52; }
        @keyframes premium-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        /* ── Bonus section ── */
        .premium-bonus { background: linear-gradient(180deg, #f8fafc 0%, #fff 100%); padding-top: clamp(32px, 5vw, 56px); padding-bottom: clamp(32px, 5vw, 56px); }
        .premium-bonus-card { max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: minmax(0,1fr) 280px; gap: clamp(24px, 5vw, 56px); align-items: center; background: #fff; border: 1px solid #e8edf3; border-radius: 24px; padding: clamp(24px, 4vw, 44px); box-shadow: 0 4px 6px -1px rgba(15,23,42,.04), 0 16px 40px -8px rgba(15,23,42,.08); position: relative; overflow: hidden; }
        .premium-bonus-card::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 60% 80% at 100% 50%, color-mix(in srgb, var(--premium-accent) 6%, transparent), transparent); pointer-events: none; }
        .premium-bonus-copy .premium-heading { text-align: left; font-size: clamp(22px, 2.6vw, 32px); }
        .premium-bonus-kicker { display: inline-flex; align-items: center; gap: 7px; margin-bottom: 14px; background: color-mix(in srgb, var(--premium-accent) 10%, transparent); color: var(--premium-accent); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .8px; padding: 5px 12px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--premium-accent) 25%, transparent); }
        .premium-bonus-value { margin: 10px 0 0; color: var(--premium-accent); font-size: 14px; line-height: 1.6; font-weight: 700; }
        .premium-bonus-toc { list-style: none; margin: 20px 0 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
        .premium-bonus-toc li { display: flex; align-items: center; gap: 10px; background: #f8fafc; border: 1px solid #e8edf3; border-radius: 10px; padding: 10px 14px; font-size: 13.5px; font-weight: 600; color: #1e293b; transition: border-color .18s, background .18s; }
        .premium-bonus-toc li:hover { background: color-mix(in srgb, var(--premium-accent) 5%, white); border-color: color-mix(in srgb, var(--premium-accent) 30%, transparent); }
        .premium-bonus-toc-num { width: 22px; height: 22px; border-radius: 50%; background: linear-gradient(135deg, var(--premium-accent), color-mix(in srgb, var(--premium-accent) 70%, #fbbf24)); color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .premium-bonus-toc-check { margin-left: auto; flex-shrink: 0; color: #16a34a; }
        .premium-bonus-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
        .premium-bonus-cta { max-width: 380px; }
        .premium-bonus-pdf-btn { max-width: 380px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 20px; border-radius: 12px; border: 1.5px solid color-mix(in srgb, var(--premium-accent) 35%, transparent); background: #fff; color: var(--premium-accent); font-size: 14px; font-weight: 700; text-decoration: none; transition: background .18s, border-color .18s; cursor: pointer; }
        .premium-bonus-pdf-btn:hover { background: color-mix(in srgb, var(--premium-accent) 6%, white); border-color: var(--premium-accent); }
        /* Book mockup */
        .premium-bonus-visual { display: flex; flex-direction: column; align-items: center; gap: 16px; position: relative; z-index: 1; }
        .premium-bonus-book { position: relative; width: 200px; transform: perspective(640px) rotateY(-16deg) rotateX(3deg); filter: drop-shadow(-10px 18px 28px rgba(15,23,42,.22)); }
        .premium-bonus-book-spine { position: absolute; left: -18px; top: 0; width: 18px; height: 100%; background: color-mix(in srgb, var(--premium-accent) 80%, #000); border-radius: 4px 0 0 4px; }
        .premium-bonus-book-pages { position: absolute; right: -5px; top: 3px; bottom: 3px; width: 6px; background: repeating-linear-gradient(90deg, #f0ede8 0px, #e4e0d8 2px, #f0ede8 4px); border-radius: 0 2px 2px 0; }
        .premium-bonus-book-cover { width: 200px; min-height: 266px; border-radius: 3px 10px 10px 3px; overflow: hidden; position: relative; }
        .premium-bonus-book-cover img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 0 8px 8px 0; }
        .premium-bonus-book-placeholder { width: 100%; min-height: 266px; display: flex; flex-direction: column; justify-content: space-between; padding: 20px 16px; color: #fff; }
        .premium-bonus-book-placeholder span { font-size: 15px; font-weight: 800; line-height: 1.25; text-transform: uppercase; }
        .premium-bonus-book-placeholder small { font-size: 11px; font-weight: 700; opacity: .8; text-transform: uppercase; letter-spacing: .5px; }
        .premium-bonus-book-ribbon { position: absolute; top: 14px; right: -14px; background: linear-gradient(135deg, #16a34a, #22c55e); color: #fff; font-size: 9.5px; font-weight: 800; padding: 4px 22px; letter-spacing: .5px; text-transform: uppercase; transform: rotate(30deg); box-shadow: 0 2px 8px rgba(22,163,74,.35); z-index: 10; }
        .premium-bonus-badge-free { display: flex; flex-direction: column; align-items: center; background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 14px; padding: 10px 20px; color: #15803d; font-size: 12px; font-weight: 700; line-height: 1.3; }
        .premium-bonus-badge-free span { font-size: 22px; font-weight: 900; line-height: 1; }
        .premium-centered { text-align: center; max-width: 980px; margin: 0 auto 32px; }
        .premium-eyebrow { display: inline-flex; align-items: center; gap: 7px; margin-bottom: 12px; font-size: 13px; font-weight: 800; color: #38424c; }
        .premium-heading { margin: 0; font-size: clamp(23px, 3vw, 37px); line-height: 1.16; font-weight: 900; letter-spacing: 0; color: #05070a; text-transform: uppercase; }
        .premium-lead { margin: 14px 0 0; color: #4b5563; font-size: clamp(14px, 1.2vw, 17px); line-height: 1.6; }
        .premium-testimonials { background: #fff; }
        .premium-reviews-wrap { position: relative; }
        .premium-reviews-carousel { display: flex; gap: 18px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 4px 2px 14px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
        .premium-reviews-carousel::-webkit-scrollbar { display: none; }
        .premium-card-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
        .premium-testimonial-card { border-radius: 10px; overflow: hidden; background: #fff; }
        .premium-reviews-carousel .premium-testimonial-card { scroll-snap-align: start; flex: 0 0 clamp(240px, 31%, 340px); border: 1px solid rgba(15,23,42,0.07); padding-bottom: 16px; }
        .premium-reviews-carousel .premium-testimonial-text,
        .premium-reviews-carousel .premium-review-stars,
        .premium-reviews-carousel .premium-verified { padding-inline: 16px; }
        .premium-testimonial-image { position: relative; aspect-ratio: 1.3 / 1; overflow: hidden; background: #eef2f7; }
        .premium-testimonial-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .premium-tags { position: absolute; left: 12px; bottom: 12px; display: flex; flex-wrap: wrap; gap: 7px; }
        .premium-tags span { background: color-mix(in srgb, var(--premium-accent) 80%, #111); color: #fff; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 800; }
        .premium-review-stars { display: flex; gap: 2px; margin: 14px 0 8px; color: #FACC15; }
        .premium-testimonial-text { margin: 0; color: #3f4650; font-size: 14.5px; line-height: 1.6; }
        .premium-verified { margin-top: 14px; display: flex; align-items: center; gap: 7px; font-size: 14px; color: #3f4650; font-weight: 800; }
        .premium-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(22px, 4vw, 52px); align-items: center; }
        .premium-split.reverse .premium-copy { order: 2; }
        .premium-copy .premium-heading { text-align: left; }
        .premium-copy .premium-lead { max-width: 760px; }
        .premium-image-panel { overflow: hidden; border-radius: 10px; background: #fff; min-height: 320px; display: flex; align-items: center; justify-content: center; }
        .premium-image-panel img { width: 100%; height: 100%; max-height: 460px; object-fit: cover; display: block; }
        .premium-soft-band { background: #EFF8F7; }
        .premium-ingredients { display: grid; gap: 16px; margin-top: 24px; }
        .premium-ingredient { display: grid; grid-template-columns: 50px 1fr; gap: 14px; align-items: center; }
        .premium-ingredient-thumb { width: 50px; height: 50px; border-radius: 999px; overflow: hidden; background: color-mix(in srgb, var(--premium-accent) 18%, white); display: flex; align-items: center; justify-content: center; color: var(--premium-accent); }
        .premium-ingredient h3 { margin: 0 0 5px; font-size: clamp(16px, 1.6vw, 21px); line-height: 1.2; font-weight: 900; color: #05070a; }
        .premium-ingredient p { margin: 0; font-size: 14.5px; line-height: 1.55; color: #4b5563; }
        .premium-results-card { min-height: 420px; border-radius: 10px; background: color-mix(in srgb, var(--premium-accent) 20%, white); padding: clamp(22px, 3vw, 40px); display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
        .premium-results-card img { width: 100%; max-height: 230px; object-fit: contain; align-self: center; }
        .premium-timeline { display: grid; gap: 18px; margin-top: 24px; position: relative; }
        .premium-timeline:before { content: ""; position: absolute; top: 10px; bottom: 10px; left: 11px; width: 3px; background: color-mix(in srgb, var(--premium-accent) 72%, white); }
        .premium-step { position: relative; display: grid; grid-template-columns: 70px 1fr; gap: 14px; padding-left: 34px; }
        .premium-step:before { content: ""; position: absolute; left: 2px; top: 8px; width: 20px; height: 20px; border-radius: 999px; background: color-mix(in srgb, var(--premium-accent) 86%, #111); }
        .premium-step-label { display: inline-flex; align-items: center; justify-content: center; height: 30px; border-radius: 6px; background: color-mix(in srgb, var(--premium-accent) 86%, #111); color: #fff; font-weight: 800; font-size: 12px; }
        .premium-step h3 { margin: 0 0 6px; font-size: clamp(17px, 1.7vw, 22px); font-weight: 900; color: #05070a; }
        .premium-step p { margin: 0; font-size: 14.5px; line-height: 1.55; color: #4b5563; }
        .premium-comparison { background: #EFF8F7; }
        .premium-table-wrap { max-width: 1120px; margin: 0 auto; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .premium-table { width: 100%; border-collapse: collapse; font-size: 15px; }
        .premium-table th, .premium-table td { padding: 16px 16px; border-bottom: 1px solid rgba(15,23,42,0.10); text-align: center; }
        .premium-table th:first-child, .premium-table td:first-child { text-align: left; color: #3f4650; font-weight: 700; }
        .premium-table th { font-size: 15.5px; color: #343a42; }
        .premium-table th:nth-child(2), .premium-table td:nth-child(2) { background: rgba(255,255,255,0.72); }
        .premium-bool { width: 25px; height: 25px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; color: white; }
        .premium-bool-ok { background: var(--premium-accent); }
        .premium-bool-no { background: #D84E45; }
        .premium-floating-top { position: fixed; right: 20px; bottom: 20px; width: 48px; height: 48px; border-radius: 999px; background: color-mix(in srgb, var(--premium-accent) 78%, white); color: white; display: inline-flex; align-items: center; justify-content: center; border: 0; box-shadow: 0 14px 34px rgba(15,23,42,0.20); cursor: pointer; z-index: 20; }
        @media (max-width: 980px) {
          .premium-header { grid-template-columns: auto 1fr auto; padding-inline: 14px; height: 56px; }
          .premium-contact { display: none; }
          .premium-brand { font-size: 20px; text-align: left; }
          .premium-hero, .premium-split { grid-template-columns: 1fr; }
          .premium-seal { width: 84px; height: 84px; font-size: 12px; top: 14px; left: 14px; }
          .premium-card-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
          .premium-reviews-carousel .premium-testimonial-card { flex-basis: 80%; }
          .premium-split.reverse .premium-copy { order: initial; }
          .premium-bonus-card { grid-template-columns: 1fr; }
          .premium-bonus-visual { order: -1; }
          .premium-bonus-book { transform: perspective(640px) rotateY(-10deg) rotateX(2deg); }
          .premium-offer-card { grid-template-columns: 56px 1fr; }
          .premium-offer-price { grid-column: 1 / -1; text-align: left; }
          .premium-step { grid-template-columns: 60px 1fr; gap: 10px; }
          .premium-section { padding-inline: 14px; }
          .premium-comparison .premium-table-wrap { overflow-x: visible; }
          .premium-comparison .premium-table { display: none; }
          .premium-comparison .premium-mobile-cards { display: flex; }
        }
        .premium-hero-accordions { margin-top: 18px; display: flex; flex-direction: column; gap: 6px; }
        .premium-hero-acc { border: 1px solid rgba(15,23,42,0.10); border-radius: 12px; overflow: hidden; background: #fff; }
        .premium-hero-acc-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: none; border: none; cursor: pointer; font-size: 13.5px; font-weight: 800; color: #1f2933; text-align: left; transition: background .15s; }
        .premium-hero-acc-btn:hover { background: rgba(15,23,42,0.02); }
        .premium-hero-acc-btn svg { flex-shrink: 0; transition: transform .2s; color: #9ca3af; }
        .premium-hero-acc-btn[aria-expanded="true"] svg { transform: rotate(180deg); color: var(--premium-accent); }
        .premium-hero-acc-body { padding: 0 16px 14px; font-size: 13px; line-height: 1.65; color: #4b5563; }
        .premium-faq { background: #fff; }
        .premium-faq-list { max-width: 780px; margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
        .premium-faq-item { border: 1px solid rgba(15,23,42,0.08); border-radius: 14px; overflow: hidden; background: #fff; }
        .premium-faq-q { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: none; border: none; cursor: pointer; font-size: 15px; font-weight: 800; color: #1f2933; text-align: left; transition: background .15s; }
        .premium-faq-q:hover { background: rgba(15,23,42,0.02); }
        .premium-faq-q svg { flex-shrink: 0; transition: transform .2s; }
        .premium-faq-q[aria-expanded="true"] svg { transform: rotate(180deg); }
        .premium-faq-a { padding: 0 20px 18px; font-size: 14px; line-height: 1.65; color: #4b5563; }
        .premium-mobile-cards { display: none; flex-direction: column; gap: 12px; max-width: 540px; margin: 0 auto; }
        .premium-mobile-card { border-radius: 16px; border: 1px solid rgba(15,23,42,0.08); background: #fff; padding: 16px; }
        .premium-mobile-card-label { font-size: 14px; font-weight: 800; color: #1f2933; margin-bottom: 12px; }
        .premium-mobile-card-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid rgba(15,23,42,0.05); }
        .premium-mobile-card-row:last-child { border-bottom: none; }
        .premium-mobile-card-col { font-size: 13px; font-weight: 700; color: #4b5563; }
        @media (max-width: 540px) {
          .premium-card-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Custom CSS injected by AI */}
      {productPageConfig?.customCss && (
        <style dangerouslySetInnerHTML={{ __html: productPageConfig.customCss }} />
      )}

      <StorefrontHeader store={store} cartCount={cartCount} prefix={prefix} />

      {/* Custom HTML banner injected by AI (before main content) */}
      {productPageConfig?.customHtml && (
        <div dangerouslySetInnerHTML={{ __html: productPageConfig.customHtml }} />
      )}

      <main>
        <section className="premium-section premium-hero">
          <div className="premium-media">
            <div
              className="premium-carousel"
              onTouchStart={onHeroTouchStart}
              onTouchEnd={onHeroTouchEnd}
            >
              <div className="premium-carousel-track" style={{ transform: `translateX(-${heroIndex * 100}%)` }}>
                {(heroImages.length ? heroImages : ['']).map((img, idx) => (
                  <div key={idx} className="premium-carousel-slide">
                    {img && <EditableImage src={img} alt={`${productName} ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} imageKey="heroGallery" arrayIndex={idx} productId={product?._id} onImageUpdated={handleImageUpdated} isAdmin={isAdmin} />}
                  </div>
                ))}
              </div>
              {heroCount > 1 && (
                <>
                  <button type="button" className="premium-carousel-arrow prev" onClick={() => goHero(-1)} aria-label="Image précédente"><ChevronLeft size={20} /></button>
                  <button type="button" className="premium-carousel-arrow next" onClick={() => goHero(1)} aria-label="Image suivante"><ChevronRight size={20} /></button>
                  <div className="premium-carousel-dots">
                    {heroImages.map((_, idx) => (
                      <button
                        type="button"
                        key={idx}
                        className={`premium-dot ${heroIndex === idx ? 'active' : ''}`}
                        onClick={() => setActiveHeroImage(idx)}
                        aria-label={`Image ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <div className="premium-rating">
              <span className="premium-stars">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={18} fill="currentColor" />)}</span>
              <span>{textValue(premium.rating?.score, '4,9/5')} par {textValue(premium.rating?.count, '+1 000')} {textValue(premium.rating?.label, 'clients satisfaits')}</span>
            </div>

            <h1>{textValue(premium.hero?.headline, product?._pageData?.hero_headline || productName)}</h1>
            <p className="premium-subtitle">{textValue(premium.hero?.subheadline, product?._pageData?.hero_slogan)}</p>

            {priceLabel && (
              <div className="premium-price">
                <span>{priceLabel}</span>
                {compareLabel && <span className="premium-compare">{compareLabel}</span>}
              </div>
            )}

            <ul className="premium-check-list">
              {heroBenefits.map((benefit, index) => (
                <li key={index}><span className="premium-check-dot"><Check size={14} /></span><span>{textValue(benefit)}</span></li>
              ))}
            </ul>

            {premium.hero?.showOffer && (
              <>
                <div className="premium-offer-title">{textValue(premium.hero?.offerTitle, 'Offre spéciale')}</div>
                <div className="premium-countdown"><Clock size={15} style={{ display: 'inline', marginRight: 6 }} />{textValue(premium.hero?.countdownLabel, "L'offre expire bientôt")}</div>
                <div className="premium-offer-card">
                  {sectionImage('hero', 1) && <EditableImage src={sectionImage('hero', 1)} alt={`${productName} offre`} style={{ width: '100%', height: 'auto' }} imageKey="hero" productId={product?._id} onImageUpdated={handleImageUpdated} isAdmin={isAdmin} />}
                  <div className="premium-offer-main">
                    <span>{textValue(premium.hero?.offerCards?.[0]?.title, 'Offre du moment')}</span>
                    <span className="premium-chip">{textValue(premium.hero?.offerCards?.[0]?.badge, 'Meilleur choix')}</span>
                  </div>
                  <div className="premium-offer-price">
                    {priceLabel || sanitizeMoney(premium.hero?.offerCards?.[0]?.price)}
                    {compareLabel && <div className="premium-compare">{compareLabel}</div>}
                  </div>
                </div>
              </>
            )}

            {isEmbeddedForm ? (
              <div ref={ctaRef} style={{ marginTop: 14 }}>
                <EmbeddedOrderForm
                  product={product}
                  subdomain={subdomain}
                  store={store}
                  pixels={pixels}
                  productPageConfig={productPageConfig}
                />
              </div>
            ) : (
              <button type="button" className="premium-cta" onClick={openOrder}>
                <ShoppingCart size={19} />
                {textValue(premium.hero?.ctaLabel, productPageConfig?.button?.text || 'Commander')}
              </button>
            )}

            <div className="premium-reassurance">
              {reassurance.slice(0, 3).map((item, index) => (
                <span key={index}>{index === 0 ? <Truck size={14} /> : index === 1 ? <Shield size={14} /> : <BadgeCheck size={14} />}{textValue(item)}</span>
              ))}
            </div>

            <div className="premium-hero-accordions">
              {heroAccordions.map((acc, index) => (
                <div key={index} className="premium-hero-acc">
                  <button
                    type="button"
                    className="premium-hero-acc-btn"
                    aria-expanded={openHeroAccordion === index}
                    onClick={() => setOpenHeroAccordion(openHeroAccordion === index ? null : index)}
                  >
                    <span>{textValue(acc.title)}</span>
                    <ChevronDown size={17} />
                  </button>
                  {openHeroAccordion === index && (
                    <div className="premium-hero-acc-body">{textValue(acc.content)}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {(() => {
          const DEFAULT_ORDER = ['guide', 'testimonials', 'problem', 'mechanism', 'science', 'ritual', 'comparison', 'faq', 'closing'];
          const hidden = productPageConfig?.hiddenSections || [];
          const configuredOrder = Array.isArray(productPageConfig?.sectionOrder)
            ? productPageConfig.sectionOrder.filter((id) => DEFAULT_ORDER.includes(id))
            : DEFAULT_ORDER;
          const orderedSections = configuredOrder.includes('guide')
            ? configuredOrder
            : ['guide', ...configuredOrder];
          const order = [...orderedSections, ...DEFAULT_ORDER.filter((id) => !orderedSections.includes(id))]
            .filter((id) => !hidden.includes(id));

          const sectionMap = {
            guide: bonusEbook ? (
              <PremiumBonusEbook
                key="guide"
                ebook={bonusEbook}
                accent={accent}
                onOrder={openOrder}
                ctaLabel={textValue(premium.hero?.ctaLabel, productPageConfig?.button?.text || 'Commander')}
                productImage={heroImage}
              />
            ) : null,
            testimonials: (
              <section key="testimonials" className="premium-section premium-testimonials">
                <div className="premium-centered">
                  <div className="premium-eyebrow"><span className="premium-stars">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={16} fill="currentColor" />)}</span>{textValue(premium.rating?.score, '4,9/5')} par {textValue(premium.rating?.count, '+1 000')} clients satisfaits</div>
                  <h2 className="premium-heading">{textValue(premium.testimonialGallery?.headline, 'Une vie intime libérée et sereine')}</h2>
                  <p className="premium-lead">{textValue(premium.testimonialGallery?.subheadline, "Des clients d'Afrique francophone et d'ailleurs partagent leur expérience.")}</p>
                </div>
                <div className="premium-reviews-wrap">
                  <button type="button" className="premium-carousel-arrow prev" onClick={() => scrollReviews(-1)} aria-label="Avis précédents"><ChevronLeft size={20} /></button>
                  <div className="premium-reviews-carousel" ref={reviewsRef}>
                    {reviews.map((item, index) => (
                      <article key={index} className="premium-testimonial-card">
                        <div className="premium-testimonial-image">
                          {testimonialImage(index) && <img src={testimonialImage(index)} alt="" style={{ objectFit: 'cover' }} />}
                          <div className="premium-tags">{cleanPremiumTags(item.tags).map((tag, tagIndex) => <span key={tagIndex}>{tag}</span>)}</div>
                        </div>
                        <div className="premium-review-stars">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={17} fill="currentColor" />)}</div>
                        <p className="premium-testimonial-text">{textValue(item.text)}</p>
                        <div className="premium-verified"><strong>{textValue(item.name, 'Client vérifié')}</strong><CheckCircle size={16} color={accent} fill={accent} stroke="white" /> Acheteur Vérifié</div>
                      </article>
                    ))}
                  </div>
                  <button type="button" className="premium-carousel-arrow next" onClick={() => scrollReviews(1)} aria-label="Avis suivants"><ChevronRight size={20} /></button>
                </div>
              </section>
            ),
            problem: (
              <section key="problem" className="premium-section premium-split">
                <div className="premium-copy">
                  <h2 className="premium-heading">{textValue(premium.problemSection?.headline, product?._pageData?.problem_section?.title || 'Ce problème ruine votre quotidien')}</h2>
                  <ul className="premium-check-list" style={{ marginTop: 28 }}>
                    {problemBullets.slice(0, 4).map((item, index) => (
                      <li key={index}><span className="premium-check-dot"><Check size={14} /></span><span>{textValue(item)}</span></li>
                    ))}
                  </ul>
                  <button type="button" className="premium-cta" onClick={openOrder} style={{ marginTop: 22 }}>
                    <ShoppingCart size={18} />
                    {textValue(premium.hero?.ctaLabel, productPageConfig?.button?.text || 'Commander')}
                  </button>
                </div>
                <div className="premium-image-panel">{sectionImage('problem', 5) && <EditableImage src={sectionImage('problem', 5)} alt={`Situation client ${productName}`} style={{ objectFit: 'contain', width: '100%', height: '100%' }} imageKey="problem" productId={product?._id} onImageUpdated={handleImageUpdated} isAdmin={isAdmin} />}</div>
              </section>
            ),
            mechanism: (
              <section key="mechanism" className="premium-section premium-split reverse">
                <div className="premium-image-panel">{sectionImage('mechanism', 6) && <EditableImage src={sectionImage('mechanism', 6)} alt={`Explication ${productName}`} style={{ objectFit: 'contain', width: '100%', height: '100%' }} imageKey="mechanism" productId={product?._id} onImageUpdated={handleImageUpdated} isAdmin={isAdmin} />}</div>
                <div className="premium-copy">
                  <h2 className="premium-heading">{textValue(premium.mechanismSection?.headline, product?._pageData?.solution_section?.title || "Ce n'est pas une question de hasard")}</h2>
                  <p className="premium-lead">{textValue(premium.mechanismSection?.body, product?._pageData?.solution_section?.description)}</p>
                  <button type="button" className="premium-cta" onClick={openOrder} style={{ marginTop: 22 }}>
                    <ShoppingCart size={18} />
                    {textValue(premium.hero?.ctaLabel, productPageConfig?.button?.text || 'Commander')}
                  </button>
                </div>
              </section>
            ),
            science: (
              <section key="science" className="premium-section premium-split premium-soft-band">
                <div className="premium-copy">
                  <h2 className="premium-heading">{textValue(premium.scienceSection?.headline, 'Ce qui rend ce produit efficace')}</h2>
                  <p className="premium-lead">{textValue(premium.scienceSection?.subheadline, 'Des éléments clés pensés pour une utilisation claire et rassurante.')}</p>
                  <div className="premium-ingredients">
                    {scienceItems.slice(0, 4).map((item, index) => (
                      <div key={index} className="premium-ingredient">
                        <div className="premium-ingredient-thumb"><Award size={24} /></div>
                        <div>
                          <h3>{textValue(item.name, `Point clé ${index + 1}`)}</h3>
                          <p>{textValue(item.description, item.name)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="premium-image-panel">{sectionImage('science', 7) && <EditableImage src={sectionImage('science', 7)} alt="Formule et fonctionnement" style={{ width: '100%', height: '100%' }} imageKey="science" productId={product?._id} onImageUpdated={handleImageUpdated} isAdmin={isAdmin} />}</div>
              </section>
            ),
            ritual: (
              <section key="ritual" className="premium-section premium-split">
                <div className="premium-results-card">
                  <div>
                    <h2 className="premium-heading" style={{ fontSize: 'clamp(20px, 2.4vw, 30px)' }}>{timeline[0]?.headline || 'Résultats progressifs'}</h2>
                    {(timeline.length ? timeline : [
                      { label: 'Jour 1', description: 'Vous commencez la routine avec une utilisation simple.' },
                      { label: 'Jour 7', description: 'Les premiers changements deviennent plus visibles.' },
                      { label: 'Jour 15', description: 'La routine se stabilise pour un résultat plus durable.' },
                      { label: 'Jour 30', description: 'Les résultats sont bien installés dans votre quotidien.' },
                    ]).slice(0, 4).map((item, index) => (
                      <p key={index} style={{ margin: '22px 0 0', fontSize: 15, lineHeight: 1.45 }}><strong>{textValue(item.label)}</strong><br />{textValue(item.description)}</p>
                    ))}
                  </div>
                  {sectionImage('ritual', 8) && <EditableImage src={sectionImage('ritual', 8)} alt="Résultats produit" style={{ width: '100%', height: '100%' }} imageKey="ritual" productId={product?._id} onImageUpdated={handleImageUpdated} isAdmin={isAdmin} />}
                </div>
                <div className="premium-copy">
                  <h2 className="premium-heading">{textValue(premium.ritualSection?.headline, 'Votre rituel simple')}</h2>
                  <p className="premium-lead">{textValue(premium.ritualSection?.subheadline, 'Une routine claire, facile à suivre et pensée pour rester régulière.')}</p>
                  <div className="premium-timeline">
                    {(ritualSteps.length ? ritualSteps : [
                      { label: 'Étape 1', title: 'Prenez un comprimé par jour', description: 'Il est recommandé de prendre le produit régulièrement pour obtenir les meilleurs résultats.' },
                      { label: 'Étape 2', title: 'Répétez chaque jour', description: 'La régularité est la clé. Intégrez-le dans votre routine quotidienne.' },
                      { label: 'Étape 3', title: 'Observez les résultats', description: 'Les effets se font sentir progressivement au fil des jours.' },
                      { label: 'Étape 4', title: 'Maintenez la routine', description: 'Continuez pour des résultats durables et un bien-être optimal.' },
                    ]).map((step, index) => (
                      <div key={index} className="premium-step">
                        <span className="premium-step-label">{textValue(step.label, `Étape ${index + 1}`)}</span>
                        <div>
                          <h3>{textValue(step.title, step.action)}</h3>
                          <p>{textValue(step.description, step.detail)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="premium-cta" onClick={openOrder} style={{ marginTop: 26 }}>
                    <ShoppingCart size={18} />
                    {textValue(premium.hero?.ctaLabel, productPageConfig?.button?.text || 'Commander')}
                  </button>
                </div>
              </section>
            ),
            comparison: (
              <section key="comparison" className="premium-section premium-comparison">
                <div className="premium-centered">
                  <h2 className="premium-heading">{textValue(comparison.headline, 'Comparaison')}</h2>
                </div>
                <div className="premium-table-wrap">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th></th>
                        {comparisonColumns.slice(0, 3).map((column, index) => <th key={index}>{textValue(column)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.slice(0, 6).map((row, index) => (
                        <tr key={index}>
                          <td>{textValue(row.label)}</td>
                          {(asArray(row.values).length ? row.values : [true, false, false]).slice(0, 3).map((value, valueIndex) => (
                            <td key={valueIndex}>{boolIcon(Boolean(value), accent)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="premium-mobile-cards">
                  {comparisonRows.slice(0, 6).map((row, index) => (
                    <div key={index} className="premium-mobile-card">
                      <div className="premium-mobile-card-label">{textValue(row.label)}</div>
                      {comparisonColumns.slice(0, 3).map((col, colIndex) => (
                        <div key={colIndex} className="premium-mobile-card-row">
                          <span className="premium-mobile-card-col">{textValue(col)}</span>
                          {boolIcon(Boolean((asArray(row.values).length ? row.values : [true, false, false])[colIndex]), accent)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            ),
            faq: (
              <section key="faq" className="premium-section premium-faq">
                <div className="premium-centered">
                  <h2 className="premium-heading">{textValue(premium.faq?.headline, 'Questions frequentes')}</h2>
                  <p className="premium-lead">{textValue(premium.faq?.subheadline, 'Tout ce que vous devez savoir avant de commander.')}</p>
                </div>
                <div className="premium-faq-list">
                  {faqItems.map((item, index) => (
                    <div key={index} className="premium-faq-item">
                      <button
                        type="button"
                        className="premium-faq-q"
                        aria-expanded={openFaq === index}
                        onClick={() => setOpenFaq(openFaq === index ? null : index)}
                      >
                        <span>{textValue(item.question)}</span>
                        <ChevronDown size={19} />
                      </button>
                      {openFaq === index && (
                        <div className="premium-faq-a">{textValue(item.answer)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ),
            closing: (
              <section key="closing" className="premium-section premium-split premium-soft-band">
                <div className="premium-copy">
                  <h2 className="premium-heading">{textValue(premium.closingSection?.headline, `Pourquoi choisir ${productName}`)}</h2>
                  <p className="premium-lead">{textValue(premium.closingSection?.subheadline, 'Une solution pensée pour acheter simplement et utiliser avec confiance.')}</p>
                  <ul className="premium-check-list" style={{ marginTop: 26 }}>
                    {closingBullets.slice(0, 4).map((item, index) => (
                      <li key={index}><span className="premium-check-dot"><Check size={14} /></span><span>{textValue(item)}</span></li>
                    ))}
                  </ul>
                  <button type="button" className="premium-cta" onClick={openOrder}>
                    <ShoppingCart size={19} />
                    {textValue(premium.hero?.ctaLabel, 'Commander')}
                  </button>
                </div>
                <div className="premium-image-panel">{sectionImage('closing', 9) && <EditableImage src={sectionImage('closing', 9)} alt={productName} style={{ width: '100%', height: '100%' }} imageKey="closing" productId={product?._id} onImageUpdated={handleImageUpdated} isAdmin={isAdmin} />}</div>
              </section>
            ),
          };

          return (
            <>
              <section className="premium-authority" aria-label="Preuves et avis">
                <div className="premium-authority-track">
                  {[...authorityStrip, ...authorityStrip].map((item, index) => (
                    <div key={index} className="premium-authority-item">
                      <div className="premium-authority-label">{textValue(item.label, 'Clients vérifiés')}</div>
                      <p className="premium-authority-quote">{textValue(item.quote)}</p>
                    </div>
                  ))}
                </div>
              </section>

              {order.map(id => sectionMap[id] || null)}
            </>
          );
        })()}
      </main>

      {/* Custom HTML sections added by AI */}
      {productPageConfig?.customSections?.map((sec, i) => (
        <div key={i} dangerouslySetInnerHTML={{ __html: sec.html }} />
      ))}

      {/* Custom JS injected by AI — executed via useEffect so it runs in the React context */}

      <button type="button" className="premium-floating-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Retour en haut">
        <ChevronUp size={22} />
      </button>

      {!isEmbeddedForm && (
        <QuickOrderModal
          isOpen={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          product={product}
          store={store}
          subdomain={subdomain}
          pixels={pixels}
          productPageConfig={productPageConfig}
        />
      )}

      {productPageConfig?.whatsapp?.enabled && (
        <a
          href={`https://wa.me/${(productPageConfig.whatsapp.number || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(productPageConfig.whatsapp.message || '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed z-[9990] flex items-center justify-center w-14 h-14 rounded-full shadow-lg hover:scale-110 transition-transform"
          style={{
            backgroundColor: '#25D366',
            bottom: '24px',
            ...(productPageConfig.whatsapp.position === 'bottom-left' ? { left: '24px' } : { right: '24px' }),
          }}
        >
          <svg viewBox="0 0 24 24" width="28" height="28" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      )}
    </div>
  );
};

export default StoreProductPagePremium;
