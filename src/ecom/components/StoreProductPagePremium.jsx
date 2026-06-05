import React, { useMemo, useState } from 'react';
import {
  Award,
  BadgeCheck,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Shield,
  ShoppingCart,
  Star,
  Truck,
  X,
} from 'lucide-react';
import QuickOrderModal from './QuickOrderModal.jsx';
import { StorefrontHeader } from './StorefrontShared.jsx';
import { useStoreCart } from '../hooks/useStoreCart.js';
import { formatMoney } from '../utils/currency.js';

const getImageUrl = (image) => (typeof image === 'string' ? image : image?.url) || '';

const textValue = (value, fallback = '') => {
  const text = String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text || fallback;
};

const asArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

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
  const premiumImages = pageData.premiumImages || product?.premiumImages || productPageConfig?.premiumImages || {};
  return dedupeImages([
    premiumImages.hero,
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
  <span className="premium-bool premium-bool-ok" aria-label="Oui"><Check size={15} /></span>
) : (
  <span className="premium-bool premium-bool-no" aria-label="Non"><X size={15} /></span>
);

const StoreProductPagePremium = ({ product, store, productPageConfig, subdomain, pixels, prefix = '' }) => {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [openHeroAccordion, setOpenHeroAccordion] = useState(null);
  const [activeHeroImage, setActiveHeroImage] = useState(0);
  const { cartCount } = useStoreCart(subdomain);
  const premium = productPageConfig?.premiumPage || product?._pageData?.premium_page || product?._pageData?.premiumPage || {};
  const design = productPageConfig?.design || {};
  const accent = design.ctaButtonColor || design.buttonColor || '#0F766E';
  const textColor = design.textColor || '#171717';
  const backgroundColor = design.backgroundColor || '#F6FBFA';
  const pageData = product?._pageData || {};
  const premiumImages = pageData.premiumImages || product?.premiumImages || productPageConfig?.premiumImages || {};
  const gallery = useMemo(() => buildGallery(product, productPageConfig), [product, productPageConfig]);
  const sectionImage = (key, fallbackIndex = 0) => getImageUrl(premiumImages?.[key]) || gallery[fallbackIndex] || gallery[0] || '';
  const realPhotos = dedupeImages(pageData.realPhotos || product?.realPhotos || []);
  const testimonialImage = (index) => getImageUrl(premiumImages?.testimonials?.[index]) || realPhotos[index] || gallery[index + 2] || gallery[0] || '';
  const heroImage = sectionImage('hero', 0);
  const productName = textValue(premium.brandName, product?.name || store?.name || 'Produit');
  const currency = product?.currency || store?.currency || 'XAF';
  const priceLabel = premium.hero?.priceLabel || (product?.price ? formatMoney(product.price, currency) : '');
  const compareLabel = product?.compareAtPrice && product.compareAtPrice > product.price
    ? formatMoney(product.compareAtPrice, currency)
    : premium.hero?.offerCards?.[0]?.oldPrice || '';
  const rawHeroBenefits = asArray(premium.hero?.benefits).length
    ? asArray(premium.hero.benefits)
    : asArray(product?._pageData?.benefits_bullets).slice(0, 4);
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
  const testimonials = asArray(premium.testimonialGallery?.items).length
    ? premium.testimonialGallery.items
    : asArray(product?._pageData?.testimonials || product?.testimonials).slice(0, 4);
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
    : heroBenefits.slice(0, 5).map((benefit) => ({ label: benefit, values: [true, false, false] }));
  const closingBullets = asArray(premium.closingSection?.bullets).length
    ? premium.closingSection.bullets
    : heroBenefits.slice(0, 3);
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

  const openOrder = () => setShowOrderModal(true);
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
        .premium-header { position: sticky; top: 0; z-index: 30; height: 70px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 0 clamp(18px, 4vw, 86px); background: rgba(255,255,255,0.96); border-bottom: 1px solid rgba(15,23,42,0.08); backdrop-filter: blur(14px); }
        .premium-brand { margin: 0; font-size: clamp(25px, 3vw, 44px); font-weight: 950; line-height: 1; letter-spacing: 0; text-align: center; }
        .premium-contact { font-size: 15px; font-weight: 650; color: #2f363f; }
        .premium-icons { display: flex; justify-content: flex-end; align-items: center; gap: 18px; }
        .premium-cart { position: relative; display: inline-flex; }
        .premium-cart-count { position: absolute; right: -10px; bottom: -8px; min-width: 20px; height: 20px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: var(--premium-accent); color: white; font-size: 11px; font-weight: 900; }
        .premium-section { padding: clamp(42px, 7vw, 96px) clamp(18px, 4vw, 86px); }
        .premium-hero { background: #fff; display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(360px, 0.88fr); gap: clamp(28px, 5vw, 80px); align-items: center; padding-top: clamp(34px, 6vw, 86px); }
        .premium-media { position: relative; overflow: hidden; min-height: 520px; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .premium-media-main { width: 100%; flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .premium-media-main img { width: 100%; height: 100%; max-height: 620px; object-fit: contain; display: block; }
        .premium-media-thumbs { display: flex; gap: 8px; padding: 12px 16px; overflow-x: auto; width: 100%; justify-content: center; }
        .premium-media-thumb { width: 64px; height: 64px; border-radius: 10px; overflow: hidden; border: 2px solid transparent; cursor: pointer; flex-shrink: 0; opacity: 0.6; transition: all .15s; }
        .premium-media-thumb.active { border-color: var(--premium-accent); opacity: 1; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .premium-media-thumb:hover { opacity: 1; }
        .premium-media-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .premium-seal { position: absolute; top: 28px; left: 28px; width: 148px; height: 148px; border-radius: 50%; background: #B42318; color: white; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 950; font-size: 18px; line-height: 1.15; transform: rotate(-10deg); padding: 16px; box-shadow: 0 16px 36px rgba(180,35,24,0.22); }
        .premium-rating { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 28px; font-weight: 750; color: #34373d; }
        .premium-stars { display: inline-flex; gap: 2px; color: #FACC15; }
        .premium-hero h1 { margin: 0; font-size: clamp(32px, 4.2vw, 56px); line-height: 1.12; font-weight: 950; letter-spacing: 0; color: #05070a; text-transform: uppercase; }
        .premium-subtitle { margin: 22px 0 26px; font-size: clamp(17px, 1.6vw, 23px); line-height: 1.5; color: #42464d; }
        .premium-price { display: flex; align-items: baseline; gap: 12px; margin-bottom: 26px; font-size: clamp(27px, 2.7vw, 38px); font-weight: 950; color: #1f2933; }
        .premium-compare { font-size: 18px; color: #737983; text-decoration: line-through; font-weight: 650; }
        .premium-check-list { display: grid; gap: 14px; margin: 0 0 24px; padding: 0; list-style: none; }
        .premium-check-list li { display: flex; gap: 12px; align-items: flex-start; font-size: clamp(15px, 1.25vw, 20px); line-height: 1.42; font-weight: 650; color: #3d424b; }
        .premium-check-dot { width: 24px; height: 24px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; margin-top: 2px; background: color-mix(in srgb, var(--premium-accent) 72%, white); color: #fff; }
        .premium-offer-title { display: flex; align-items: center; gap: 14px; margin: 24px 0 12px; font-weight: 950; text-transform: uppercase; color: #111827; }
        .premium-offer-title:before, .premium-offer-title:after { content: ""; height: 2px; flex: 1; background: color-mix(in srgb, var(--premium-accent) 28%, white); }
        .premium-countdown { border-radius: 18px; background: #D8D8D8; color: #090909; text-align: center; font-weight: 900; padding: 13px 18px; margin-bottom: 14px; }
        .premium-offer-card { border: 2px solid color-mix(in srgb, var(--premium-accent) 72%, white); border-radius: 20px; padding: 14px 18px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 16px; background: #fff; }
        .premium-offer-card img { width: 76px; height: 64px; border-radius: 10px; object-fit: cover; background: #f4f6f8; }
        .premium-offer-main { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 19px; font-weight: 900; }
        .premium-chip { border-radius: 999px; background: #D6D6D6; color: #111; padding: 6px 10px; font-size: 13px; font-weight: 850; }
        .premium-offer-price { text-align: right; font-size: 22px; font-weight: 950; color: #05070a; }
        .premium-cta { width: 100%; min-height: 60px; border: 0; border-radius: 12px; background: color-mix(in srgb, var(--premium-accent) 78%, white); color: white; display: inline-flex; align-items: center; justify-content: center; gap: 12px; margin-top: 18px; font-size: 22px; font-weight: 950; cursor: pointer; transition: transform .16s ease, filter .16s ease; }
        .premium-cta:hover { transform: translateY(-1px); filter: brightness(0.97); }
        .premium-reassurance { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; color: #6b7280; font-size: 14px; font-weight: 700; }
        .premium-reassurance span { display: inline-flex; align-items: center; gap: 7px; }
        .premium-authority { overflow: hidden; background: #EFF8F7; border-block: 1px solid rgba(15,23,42,0.05); padding: 30px 0; }
        .premium-authority-track { display: flex; gap: 46px; min-width: max-content; padding-inline: 28px; animation: premium-marquee 28s linear infinite; }
        .premium-authority-item { min-width: 290px; text-align: center; }
        .premium-authority-label { font-size: clamp(22px, 2.2vw, 36px); line-height: 1; font-weight: 950; color: #030712; }
        .premium-authority-quote { margin: 12px 0 0; font-size: 16px; line-height: 1.45; color: #444a52; }
        @keyframes premium-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .premium-centered { text-align: center; max-width: 980px; margin: 0 auto 44px; }
        .premium-eyebrow { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 14px; font-size: 15px; font-weight: 850; color: #38424c; }
        .premium-heading { margin: 0; font-size: clamp(31px, 4vw, 54px); line-height: 1.14; font-weight: 950; letter-spacing: 0; color: #05070a; text-transform: uppercase; }
        .premium-lead { margin: 18px 0 0; color: #4b5563; font-size: clamp(16px, 1.5vw, 23px); line-height: 1.55; }
        .premium-testimonials { background: #fff; }
        .premium-card-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 22px; }
        .premium-testimonial-card { border-radius: 8px; overflow: hidden; background: #fff; }
        .premium-testimonial-image { position: relative; aspect-ratio: 1.24 / 1; overflow: hidden; background: #eef2f7; }
        .premium-testimonial-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .premium-tags { position: absolute; left: 14px; bottom: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
        .premium-tags span { background: color-mix(in srgb, var(--premium-accent) 80%, #111); color: #fff; border-radius: 6px; padding: 7px 12px; font-size: 13px; font-weight: 850; }
        .premium-review-stars { display: flex; gap: 2px; margin: 18px 0 10px; color: #FACC15; }
        .premium-testimonial-text { margin: 0; color: #3f4650; font-size: 16px; line-height: 1.55; }
        .premium-verified { margin-top: 16px; display: flex; align-items: center; gap: 8px; color: #3f4650; font-weight: 800; }
        .premium-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(28px, 5vw, 70px); align-items: center; }
        .premium-split.reverse .premium-copy { order: 2; }
        .premium-copy .premium-heading { text-align: left; }
        .premium-copy .premium-lead { max-width: 760px; }
        .premium-image-panel { overflow: hidden; border-radius: 8px; background: #fff; min-height: 420px; display: flex; align-items: center; justify-content: center; }
        .premium-image-panel img { width: 100%; height: 100%; max-height: 680px; object-fit: cover; display: block; }
        .premium-soft-band { background: #EFF8F7; }
        .premium-ingredients { display: grid; gap: 22px; margin-top: 34px; }
        .premium-ingredient { display: grid; grid-template-columns: 62px 1fr; gap: 18px; align-items: center; }
        .premium-ingredient-thumb { width: 62px; height: 62px; border-radius: 999px; overflow: hidden; background: color-mix(in srgb, var(--premium-accent) 18%, white); display: flex; align-items: center; justify-content: center; color: var(--premium-accent); }
        .premium-ingredient h3 { margin: 0 0 6px; font-size: clamp(19px, 2vw, 28px); line-height: 1.15; font-weight: 950; color: #05070a; }
        .premium-ingredient p { margin: 0; font-size: 16px; line-height: 1.5; color: #4b5563; }
        .premium-results-card { min-height: 560px; border-radius: 8px; background: color-mix(in srgb, var(--premium-accent) 20%, white); padding: clamp(28px, 4vw, 58px); display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
        .premium-results-card img { width: 100%; max-height: 300px; object-fit: contain; align-self: center; }
        .premium-timeline { display: grid; gap: 24px; margin-top: 34px; position: relative; }
        .premium-timeline:before { content: ""; position: absolute; top: 12px; bottom: 12px; left: 12px; width: 3px; background: color-mix(in srgb, var(--premium-accent) 72%, white); }
        .premium-step { position: relative; display: grid; grid-template-columns: 82px 1fr; gap: 18px; padding-left: 38px; }
        .premium-step:before { content: ""; position: absolute; left: 2px; top: 9px; width: 23px; height: 23px; border-radius: 999px; background: color-mix(in srgb, var(--premium-accent) 86%, #111); }
        .premium-step-label { display: inline-flex; align-items: center; justify-content: center; height: 34px; border-radius: 6px; background: color-mix(in srgb, var(--premium-accent) 86%, #111); color: #fff; font-weight: 900; font-size: 13px; }
        .premium-step h3 { margin: 0 0 8px; font-size: clamp(22px, 2.2vw, 30px); font-weight: 950; color: #05070a; }
        .premium-step p { margin: 0; font-size: 16px; line-height: 1.5; color: #4b5563; }
        .premium-comparison { background: #EFF8F7; }
        .premium-table-wrap { max-width: 1120px; margin: 0 auto; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .premium-table { width: 100%; border-collapse: collapse; font-size: 17px; }
        .premium-table th, .premium-table td { padding: 24px 22px; border-bottom: 1px solid rgba(15,23,42,0.10); text-align: center; }
        .premium-table th:first-child, .premium-table td:first-child { text-align: left; color: #3f4650; font-weight: 750; }
        .premium-table th { font-size: 18px; color: #343a42; }
        .premium-table th:nth-child(2), .premium-table td:nth-child(2) { background: rgba(255,255,255,0.72); }
        .premium-bool { width: 28px; height: 28px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; color: white; }
        .premium-bool-ok { background: var(--premium-accent); }
        .premium-bool-no { background: #D84E45; }
        .premium-floating-top { position: fixed; right: 22px; bottom: 22px; width: 56px; height: 56px; border-radius: 999px; background: color-mix(in srgb, var(--premium-accent) 78%, white); color: white; display: inline-flex; align-items: center; justify-content: center; border: 0; box-shadow: 0 18px 42px rgba(15,23,42,0.20); cursor: pointer; z-index: 20; }
        @media (max-width: 980px) {
          .premium-header { grid-template-columns: auto 1fr auto; padding-inline: 16px; height: 62px; }
          .premium-contact { display: none; }
          .premium-brand { font-size: 24px; text-align: left; }
          .premium-hero, .premium-split { grid-template-columns: 1fr; }
          .premium-media { min-height: 320px; }
          .premium-media-thumb { width: 52px; height: 52px; }
          .premium-media-thumbs { padding: 8px 12px; gap: 6px; }
          .premium-seal { width: 112px; height: 112px; font-size: 14px; top: 18px; left: 18px; }
          .premium-card-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
          .premium-split.reverse .premium-copy { order: initial; }
          .premium-offer-card { grid-template-columns: 64px 1fr; }
          .premium-offer-price { grid-column: 1 / -1; text-align: left; }
          .premium-step { grid-template-columns: 72px 1fr; gap: 12px; }
          .premium-section { padding-inline: 16px; }
          .premium-comparison .premium-table-wrap { overflow-x: visible; }
          .premium-comparison .premium-table { display: none; }
          .premium-comparison .premium-mobile-cards { display: flex; }
        }
        .premium-hero-accordions { margin-top: 22px; display: flex; flex-direction: column; gap: 6px; }
        .premium-hero-acc { border: 1px solid rgba(15,23,42,0.10); border-radius: 12px; overflow: hidden; background: #fff; }
        .premium-hero-acc-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: none; border: none; cursor: pointer; font-size: 14px; font-weight: 800; color: #1f2933; text-align: left; transition: background .15s; }
        .premium-hero-acc-btn:hover { background: rgba(15,23,42,0.02); }
        .premium-hero-acc-btn svg { flex-shrink: 0; transition: transform .2s; color: #9ca3af; }
        .premium-hero-acc-btn[aria-expanded="true"] svg { transform: rotate(180deg); color: var(--premium-accent); }
        .premium-hero-acc-body { padding: 0 18px 16px; font-size: 13px; line-height: 1.65; color: #4b5563; }
        .premium-faq { background: #fff; }
        .premium-faq-list { max-width: 780px; margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
        .premium-faq-item { border: 1px solid rgba(15,23,42,0.08); border-radius: 14px; overflow: hidden; background: #fff; }
        .premium-faq-q { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; background: none; border: none; cursor: pointer; font-size: 16px; font-weight: 800; color: #1f2933; text-align: left; transition: background .15s; }
        .premium-faq-q:hover { background: rgba(15,23,42,0.02); }
        .premium-faq-q svg { flex-shrink: 0; transition: transform .2s; }
        .premium-faq-q[aria-expanded="true"] svg { transform: rotate(180deg); }
        .premium-faq-a { padding: 0 24px 20px; font-size: 15px; line-height: 1.6; color: #4b5563; }
        .premium-mobile-cards { display: none; flex-direction: column; gap: 12px; max-width: 540px; margin: 0 auto; }
        .premium-mobile-card { border-radius: 16px; border: 1px solid rgba(15,23,42,0.08); background: #fff; padding: 18px; }
        .premium-mobile-card-label { font-size: 15px; font-weight: 800; color: #1f2933; margin-bottom: 14px; }
        .premium-mobile-card-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(15,23,42,0.05); }
        .premium-mobile-card-row:last-child { border-bottom: none; }
        .premium-mobile-card-col { font-size: 13px; font-weight: 700; color: #4b5563; }
        @media (max-width: 540px) {
          .premium-card-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <StorefrontHeader store={store} cartCount={cartCount} prefix={prefix} />

      <main>
        <section className="premium-section premium-hero">
          <div className="premium-media">
            <div className="premium-media-main">
              {gallery[activeHeroImage] && <img src={gallery[activeHeroImage]} alt={productName} />}
            </div>
            {gallery.length > 1 && (
              <div className="premium-media-thumbs">
                {gallery.slice(0, 6).map((img, idx) => (
                  <div key={idx} className={`premium-media-thumb ${activeHeroImage === idx ? 'active' : ''}`} onClick={() => setActiveHeroImage(idx)}>
                    <img src={img} alt={`${productName} ${idx + 1}`} />
                  </div>
                ))}
              </div>
            )}
            {textValue(product?._pageData?.urgency_badge || premium.hero?.eyebrow) && (
              <div className="premium-seal">{textValue(product?._pageData?.urgency_badge || premium.hero?.eyebrow, 'Offre limitée')}</div>
            )}
          </div>

          <div>
            <div className="premium-rating">
              <span className="premium-stars">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={25} fill="currentColor" />)}</span>
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
              {heroBenefits.slice(0, 4).map((benefit, index) => (
                <li key={index}><span className="premium-check-dot"><Check size={15} /></span><span>{textValue(benefit)}</span></li>
              ))}
            </ul>

            {premium.hero?.showOffer && (
              <>
                <div className="premium-offer-title">{textValue(premium.hero?.offerTitle, 'Offre spéciale')}</div>
                <div className="premium-countdown"><Clock size={16} style={{ display: 'inline', marginRight: 6 }} />{textValue(premium.hero?.countdownLabel, "L'offre expire bientôt")}</div>
                <div className="premium-offer-card">
                  {sectionImage('hero', 1) && <img src={sectionImage('hero', 1)} alt={`${productName} offre`} />}
                  <div className="premium-offer-main">
                    <span>{textValue(premium.hero?.offerCards?.[0]?.title, 'Offre du moment')}</span>
                    <span className="premium-chip">{textValue(premium.hero?.offerCards?.[0]?.badge, 'Meilleur choix')}</span>
                  </div>
                  <div className="premium-offer-price">
                    {priceLabel || textValue(premium.hero?.offerCards?.[0]?.price)}
                    {compareLabel && <div className="premium-compare">{compareLabel}</div>}
                  </div>
                </div>
              </>
            )}

            <button type="button" className="premium-cta" onClick={openOrder}>
              <ShoppingCart size={25} />
              {textValue(premium.hero?.ctaLabel, productPageConfig?.button?.text || 'Commander')}
            </button>

            <div className="premium-reassurance">
              {reassurance.slice(0, 3).map((item, index) => (
                <span key={index}>{index === 0 ? <Truck size={15} /> : index === 1 ? <Shield size={15} /> : <BadgeCheck size={15} />}{textValue(item)}</span>
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
                    <ChevronDown size={18} />
                  </button>
                  {openHeroAccordion === index && (
                    <div className="premium-hero-acc-body">{textValue(acc.content)}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

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

        <section className="premium-section premium-testimonials">
          <div className="premium-centered">
            <div className="premium-eyebrow"><span className="premium-stars">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={21} fill="currentColor" />)}</span>{textValue(premium.rating?.score, '4,9/5')} par {textValue(premium.rating?.count, '+1 000')} clients satisfaits</div>
            <h2 className="premium-heading">{textValue(premium.testimonialGallery?.headline, 'Une vie intime libérée et sereine')}</h2>
            <p className="premium-lead">{textValue(premium.testimonialGallery?.subheadline, "Des clients d'Afrique francophone et d'ailleurs partagent leur expérience.")}</p>
          </div>
          <div className="premium-card-grid">
            {testimonials.slice(0, 4).map((item, index) => (
              <article key={index} className="premium-testimonial-card">
                <div className="premium-testimonial-image">
                  {testimonialImage(index) && <img src={testimonialImage(index)} alt={textValue(item.name, `Client ${index + 1}`)} style={{ objectFit: 'cover' }} />}
                  <div className="premium-tags">{asArray(item.tags).slice(0, 2).map((tag, tagIndex) => <span key={tagIndex}>{textValue(tag)}</span>)}</div>
                </div>
                <div className="premium-review-stars">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={22} fill="currentColor" />)}</div>
                <p className="premium-testimonial-text">{textValue(item.text)}</p>
                <div className="premium-verified"><strong>{textValue(item.name, 'Client vérifié')}</strong><CheckCircle size={18} color={accent} fill={accent} stroke="white" /> Acheteur Vérifié</div>
              </article>
            ))}
          </div>
        </section>

        <section className="premium-section premium-split">
          <div className="premium-copy">
            <h2 className="premium-heading">{textValue(premium.problemSection?.headline, product?._pageData?.problem_section?.title || 'Ce problème ruine votre quotidien')}</h2>
            <ul className="premium-check-list" style={{ marginTop: 36 }}>
              {problemBullets.slice(0, 4).map((item, index) => (
                <li key={index}><span className="premium-check-dot"><Check size={15} /></span><span>{textValue(item)}</span></li>
              ))}
            </ul>
            <button type="button" className="premium-cta" onClick={openOrder} style={{ marginTop: 28 }}>
              <ShoppingCart size={22} />
              {textValue(premium.hero?.ctaLabel, productPageConfig?.button?.text || 'Commander')}
            </button>
          </div>
          <div className="premium-image-panel">{sectionImage('problem', 5) && <img src={sectionImage('problem', 5)} alt="Illustration" style={{ objectFit: 'contain' }} />}</div>
        </section>

        <section className="premium-section premium-split reverse">
          <div className="premium-image-panel">{sectionImage('mechanism', 6) && <img src={sectionImage('mechanism', 6)} alt="Illustration" style={{ objectFit: 'contain' }} />}</div>
          <div className="premium-copy">
            <h2 className="premium-heading">{textValue(premium.mechanismSection?.headline, product?._pageData?.solution_section?.title || "Ce n'est pas une question de hasard")}</h2>
            <p className="premium-lead">{textValue(premium.mechanismSection?.body, product?._pageData?.solution_section?.description)}</p>
            <button type="button" className="premium-cta" onClick={openOrder} style={{ marginTop: 28 }}>
              <ShoppingCart size={22} />
              {textValue(premium.hero?.ctaLabel, productPageConfig?.button?.text || 'Commander')}
            </button>
          </div>
        </section>

        <section className="premium-section premium-split premium-soft-band">
          <div className="premium-copy">
            <h2 className="premium-heading">{textValue(premium.scienceSection?.headline, 'Ce qui rend ce produit efficace')}</h2>
            <p className="premium-lead">{textValue(premium.scienceSection?.subheadline, 'Des éléments clés pensés pour une utilisation claire et rassurante.')}</p>
            <div className="premium-ingredients">
              {scienceItems.slice(0, 4).map((item, index) => (
                <div key={index} className="premium-ingredient">
                  <div className="premium-ingredient-thumb"><Award size={28} /></div>
                  <div>
                    <h3>{textValue(item.name, `Point clé ${index + 1}`)}</h3>
                    <p>{textValue(item.description, item.name)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="premium-image-panel">{sectionImage('science', 7) && <img src={sectionImage('science', 7)} alt="Formule et fonctionnement" />}</div>
        </section>

        <section className="premium-section premium-split">
          <div className="premium-results-card">
            <div>
              <h2 className="premium-heading" style={{ fontSize: 'clamp(25px, 3vw, 40px)' }}>{timeline[0]?.headline || 'Résultats progressifs'}</h2>
              {(timeline.length ? timeline : [
                { label: 'Jour 1', description: 'Vous commencez la routine avec une utilisation simple.' },
                { label: 'Jour 7', description: 'Les premiers changements deviennent plus visibles.' },
                { label: 'Jour 15', description: 'La routine se stabilise pour un résultat plus durable.' },
                { label: 'Jour 30', description: 'Les résultats sont bien installés dans votre quotidien.' },
              ]).slice(0, 4).map((item, index) => (
                <p key={index} style={{ margin: '28px 0 0', fontSize: 18, lineHeight: 1.35 }}><strong>{textValue(item.label)}</strong><br />{textValue(item.description)}</p>
              ))}
            </div>
            {sectionImage('ritual', 8) && <img src={sectionImage('ritual', 8)} alt="Résultats produit" />}
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
            <button type="button" className="premium-cta" onClick={openOrder} style={{ marginTop: 32 }}>
              <ShoppingCart size={22} />
              {textValue(premium.hero?.ctaLabel, productPageConfig?.button?.text || 'Commander')}
            </button>
          </div>
        </section>

        <section className="premium-section premium-comparison">
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
          {/* Mobile: stacked cards */}
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

        <section className="premium-section premium-faq">
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
                  <ChevronDown size={20} />
                </button>
                {openFaq === index && (
                  <div className="premium-faq-a">{textValue(item.answer)}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="premium-section premium-split premium-soft-band">
          <div className="premium-copy">
            <h2 className="premium-heading">{textValue(premium.closingSection?.headline, `Pourquoi choisir ${productName}`)}</h2>
            <p className="premium-lead">{textValue(premium.closingSection?.subheadline, 'Une solution pensée pour acheter simplement et utiliser avec confiance.')}</p>
            <ul className="premium-check-list" style={{ marginTop: 32 }}>
              {closingBullets.slice(0, 4).map((item, index) => (
                <li key={index}><span className="premium-check-dot"><Check size={15} /></span><span>{textValue(item)}</span></li>
              ))}
            </ul>
            <button type="button" className="premium-cta" onClick={openOrder}>
              <ShoppingCart size={25} />
              {textValue(premium.hero?.ctaLabel, 'Commander')}
            </button>
          </div>
          <div className="premium-image-panel">{sectionImage('closing', 9) && <img src={sectionImage('closing', 9)} alt={productName} />}</div>
        </section>
      </main>

      <button type="button" className="premium-floating-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Retour en haut">
        <ChevronUp size={32} />
      </button>

      <QuickOrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        product={product}
        store={store}
        subdomain={subdomain}
        pixels={pixels}
        productPageConfig={productPageConfig}
      />
    </div>
  );
};

export default StoreProductPagePremium;
