import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, ShoppingCart, MessageCircle,
  ShoppingBag, Shield, RotateCcw, Truck, Check,
  ChevronDown, ChevronUp, Star,
} from 'lucide-react';
import { useSubdomain } from '../hooks/useSubdomain';
import { useStoreProduct, injectStoreCssVars, prefetchStoreProduct } from '../hooks/useStoreData';
import { useStoreCart } from '../hooks/useStoreCart';
import QuickOrderModal from '../components/QuickOrderModal';
import EmbeddedOrderForm from '../components/EmbeddedOrderForm';
import ProductBenefits from '../components/ProductBenefits';
import ConversionBlocks, { UrgencyBadge } from '../components/ConversionBlocks';
import ProductTestimonials from '../components/ProductTestimonials';
import { StorefrontHeader, StorefrontFooter } from '../components/StorefrontShared';
import { io } from 'socket.io-client';
import { setDocumentMeta } from '../utils/pageMeta';
import { injectPixelScripts, firePixelEvent } from '../utils/pixelTracking';
import { useStoreAnalytics } from '../hooks/useStoreAnalytics';
import { preloadStoreCheckoutRoute, preloadStoreProductRoute } from '../utils/routePrefetch';
import { getIconComponent } from '../components/productSettings/ButtonEditor';

const fmt = (n, cur = 'XAF') => `${new Intl.NumberFormat('fr-FR').format(n)} ${cur}`;

const COUNTRY_TESTIMONIALS = {
  Cameroun: [
    { name: "Thierry M.", location: "Douala", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine. Je recommande a 100%.", verified: true, date: "Il y a 3 jours" },
    { name: "Astride N.", location: "Yaoundé", rating: 5, text: "Avant j'avais essaye plein de produits sans resultats. Depuis que j'utilise celui-ci, la difference est flagrante !", verified: true, date: "Il y a 5 jours" },
    { name: "Rodrigue K.", location: "Bafoussam", rating: 5, text: "Super qualite, livraison rapide. Le produit depasse mes attentes. Je vais en commander encore.", verified: true, date: "Il y a 1 semaine" },
    { name: "Christelle B.", location: "Douala", rating: 5, text: "J'etais sceptique au depart mais apres 2 semaines je ne peux plus m'en passer. Resultats durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Paul E.", location: "Yaoundé", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant. Je recommande cette boutique.", verified: true, date: "Il y a 3 semaines" },
  ],
  "Cote d'Ivoire": [
    { name: "Fatou K.", location: "Abidjan", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Kouame A.", location: "Bouaké", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Aya D.", location: "Abidjan", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Seydou T.", location: "Yamoussoukro", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Marie L.", location: "Abidjan", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Senegal: [
    { name: "Aminata D.", location: "Dakar", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine. Je recommande.", verified: true, date: "Il y a 3 jours" },
    { name: "Ibrahima S.", location: "Thiès", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Fatou N.", location: "Dakar", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Moussa B.", location: "Mbour", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Aissatou F.", location: "Saint-Louis", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Ghana: [
    { name: "Kwame A.", location: "Accra", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Abena M.", location: "Kumasi", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Kofi D.", location: "Accra", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Ama T.", location: "Takoradi", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Yaw K.", location: "Tamale", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Togo: [
    { name: "Kossi M.", location: "Lomé", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Afi K.", location: "Kara", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Kodjo A.", location: "Lomé", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Akouavi D.", location: "Sokodé", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Yao T.", location: "Atakpamé", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Benin: [
    { name: "Ganiou A.", location: "Cotonou", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Fifame D.", location: "Porto-Novo", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Hospice K.", location: "Cotonou", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Aurore B.", location: "Parakou", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Léonce T.", location: "Abomey-Calavi", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Nigeria: [
    { name: "Chinedu O.", location: "Lagos", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Ngozi A.", location: "Abuja", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Emeka U.", location: "Lagos", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Blessing I.", location: "Port Harcourt", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Tunde B.", location: "Ibadan", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Gabon: [
    { name: "Steeve M.", location: "Libreville", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Ornella N.", location: "Port-Gentil", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Brice A.", location: "Libreville", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Chancelle O.", location: "Franceville", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Davy E.", location: "Oyem", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Mali: [
    { name: "Mamadou C.", location: "Bamako", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Fatoumata T.", location: "Sikasso", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Oumar D.", location: "Bamako", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Aïssata K.", location: "Ségou", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Boubacar S.", location: "Kayes", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  "Burkina Faso": [
    { name: "Wendkouni O.", location: "Ouagadougou", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Mariam Z.", location: "Bobo-Dioulasso", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Abdoulaye K.", location: "Ouagadougou", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Salamata S.", location: "Koudougou", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Hamidou T.", location: "Ouahigouya", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Guinee: [
    { name: "Alpha B.", location: "Conakry", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Mariama D.", location: "Kankan", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Mamadou S.", location: "Conakry", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Fatoumata C.", location: "Kindia", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Ibrahima K.", location: "Labé", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  Congo: [
    { name: "Gloire M.", location: "Brazzaville", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Merveille N.", location: "Pointe-Noire", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Christ B.", location: "Brazzaville", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Grâce O.", location: "Dolisie", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "Parfait K.", location: "Nkayi", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
  RDC: [
    { name: "Patrick M.", location: "Kinshasa", rating: 5, text: "Produit vraiment excellent ! J'ai vu des resultats en moins d'une semaine.", verified: true, date: "Il y a 3 jours" },
    { name: "Carine L.", location: "Lubumbashi", rating: 5, text: "La difference est flagrante. Mes amis m'ont tous demande mon secret !", verified: true, date: "Il y a 5 jours" },
    { name: "Jonathan K.", location: "Kinshasa", rating: 5, text: "Super qualite, livraison rapide. Je vais en commander encore pour ma famille.", verified: true, date: "Il y a 1 semaine" },
    { name: "Esther N.", location: "Goma", rating: 5, text: "Apres 2 semaines je ne peux plus m'en passer. Resultats visibles et durables.", verified: true, date: "Il y a 2 semaines" },
    { name: "David B.", location: "Kisangani", rating: 4, text: "Tres bon produit. Paiement a la livraison, c'etait rassurant.", verified: true, date: "Il y a 3 semaines" },
  ],
};
COUNTRY_TESTIMONIALS.default = COUNTRY_TESTIMONIALS.Cameroun;

const getDefaultTestimonials = (country) => {
  if (!country) return COUNTRY_TESTIMONIALS.default;
  const key = Object.keys(COUNTRY_TESTIMONIALS).find(k => country.toLowerCase().includes(k.toLowerCase()));
  return COUNTRY_TESTIMONIALS[key] || COUNTRY_TESTIMONIALS.default;
};

const normalizeMetaText = (value = '') => String(value || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const truncateMetaText = (value = '', max = 180) => {
  if (!value || value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
};

// ── Image Gallery ────────────────────────────────────────────────────────────
const ImageGallery = ({ images = [] }) => {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [ratios, setRatios] = useState({});

  const go = (dir) => setActive(i => Math.max(0, Math.min(images.length - 1, i + dir)));

  // Touch swipe support
  const touchStart = useRef(null);
  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) go(diff > 0 ? 1 : -1);
    touchStart.current = null;
  };

  if (!images.length) return (
    <div style={{
      paddingBottom: '100%', position: 'relative',
      backgroundColor: '#f4f4f5', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ShoppingBag size={64} style={{ color: '#d1d5db' }} />
      </div>
    </div>
  );

  const activeSrc = images[active]?.url || images[active];
  const activeRatio = ratios[activeSrc] || 1; // width / height
  // Clamp pour éviter des héros trop plats ou trop hauts sur des images extrêmes.
  // On mobile, limit to 85% so CTA remains partly visible
  const heroPaddingBottomPct = `${Math.max(45, Math.min(100, (1 / activeRatio) * 100))}%`;

  return (
    <div>
      {/* Main image */}
      <div
        style={{
          position: 'relative', paddingBottom: heroPaddingBottomPct,
          backgroundColor: '#f4f4f5', overflow: 'hidden', cursor: 'zoom-in',
        }}
        onClick={() => setZoomed(true)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={activeSrc}
          alt={images[active]?.alt || ''}
          loading="eager"
          fetchpriority="high"
          decoding="async"
          sizes="(max-width: 768px) 100vw, 50vw"
          onLoad={(e) => {
            const img = e.currentTarget;
            const w = img.naturalWidth || 0;
            const h = img.naturalHeight || 0;
            if (!activeSrc || !w || !h) return;
            const r = w / h;
            if (!Number.isFinite(r) || r <= 0) return;
            setRatios((prev) => (prev[activeSrc] ? prev : { ...prev, [activeSrc]: r }));
          }}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            // "Hero" doit afficher l'image complète (pas recadrée)
            objectFit: 'contain', objectPosition: 'center',
            transition: 'opacity 0.2s',
          }}
        />
        {/* Arrows */}
        {images.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); go(-1); }} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              backgroundColor: 'rgba(255,255,255,0.9)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)', opacity: active === 0 ? 0.3 : 1,
            }}>
              <ChevronLeft size={18} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); go(1); }} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              backgroundColor: 'rgba(255,255,255,0.9)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)', opacity: active === images.length - 1 ? 0.3 : 1,
            }}>
              <ChevronRight size={18} />
            </button>
          </>
        )}
        {/* Dots */}
        {images.length > 1 && (
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 6,
          }}>
            {images.map((_, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); setActive(i); }} style={{
                width: i === active ? 20 : 7, height: 7, borderRadius: 4,
                border: 'none', backgroundColor: i === active ? 'var(--s-primary)' : 'rgba(255,255,255,0.7)',
                cursor: 'pointer', padding: 0, transition: 'width 0.2s, background 0.2s',
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="thumb-track" style={{ display: 'flex', gap: 8, marginTop: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {images.map((img, i) => (
            <button key={i} onClick={() => setActive(i)} style={{
              flexShrink: 0, width: 68, height: 68, overflow: 'hidden', padding: 0,
              border: '2.5px solid',
              borderColor: i === active ? 'var(--s-primary)' : 'transparent',
              cursor: 'pointer', transition: 'border-color 0.15s',
              backgroundColor: '#f4f4f5',
            }}>
              <img
                src={img?.url || img} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Zoom modal */}
      {zoomed && (
        <div
          onClick={() => setZoomed(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={images[active]?.url || images[active]}
            alt=""
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }}
          />
          <button onClick={() => setZoomed(false)} style={{
            position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)',
            border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer',
            width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>
      )}
    </div>
  );
};

// ── Product Reviews (Stars) ─────────────────────────────────────────────────
const ProductReviews = ({ rating = 4.5, reviewCount = 128 }) => {
  const displayCount = reviewCount > 0 ? reviewCount : 125;
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            size={16}
            fill={i < fullStars ? '#F59E0B' : (i === fullStars && hasHalfStar ? 'url(#halfStar)' : 'transparent')}
            color={i < fullStars || (i === fullStars && hasHalfStar) ? '#F59E0B' : '#D1D5DB'}
            style={{
              clipPath: i === fullStars && hasHalfStar ? 'inset(0 50% 0 0)' : undefined,
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--s-text)' }}>
        {rating.toFixed(1)}
      </span>
      <span style={{ fontSize: 13, color: 'var(--s-text2)' }}>
        ({displayCount} avis)
      </span>
    </div>
  );
};

// ── Scrolling Features Component ─────────────────────────────────────────────
const ProductFeatures = ({ features }) => {
  if (!features || features.length === 0) return null;
  
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };
  
  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
  };
  
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll);
    return () => el.removeEventListener('scroll', checkScroll);
  }, []);
  
  const iconMap = {
    shield: Shield,
    truck: Truck,
    rotate: RotateCcw,
    check: Check,
    star: Star,
    zap: (props) => (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  };
  
  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      {/* Left arrow */}
      {canScrollLeft && (
        <button 
          onClick={() => scroll('left')}
          style={{
            position: 'absolute', left: -10, top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, width: 28, height: 28, borderRadius: '50%', 
            backgroundColor: 'var(--s-bg)', border: '1px solid var(--s-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <ChevronLeft size={16} color="var(--s-text)" />
        </button>
      )}
      
      {/* Scrollable container */}
      <div 
        ref={scrollRef}
        style={{
          display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none',
          msOverflowStyle: 'none', padding: '4px 0',
        }}
      >
        {features.map((feature, idx) => {
          const IconComponent = iconMap[feature.icon] || Check;
          return (
            <div 
              key={idx}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 20,
                backgroundColor: 'var(--s-primary)',
                color: '#fff', fontSize: 12, fontWeight: 600,
                fontFamily: 'var(--s-font)', whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <IconComponent size={14} />
              <span>{feature.text}</span>
            </div>
          );
        })}
      </div>
      
      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
      
      {/* Right arrow */}
      {canScrollRight && (
        <button 
          onClick={() => scroll('right')}
          style={{
            position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, width: 28, height: 28, borderRadius: '50%', 
            backgroundColor: 'var(--s-bg)', border: '1px solid var(--s-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <ChevronRight size={16} color="var(--s-text)" />
        </button>
      )}
    </div>
  );
};

// ── Description ──────────────────────────────────────────────────────────────
const optimizeDescriptionHtml = (html = '') => {
  if (!html || typeof DOMParser === 'undefined') return html;

  try {
    const doc = new DOMParser().parseFromString(`<div id="sf-desc-html">${html}</div>`, 'text/html');
    const root = doc.getElementById('sf-desc-html');
    if (!root) return html;

    root.querySelectorAll('img').forEach((img) => {
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
      img.setAttribute('fetchpriority', 'low');
    });

    return root.innerHTML.trim();
  } catch {
    return html;
  }
};

const ProductDescription = ({ content }) => {
  const rawContent = content?.toString().trim() || '';
  if (!rawContent) return null;

  const isHTML = /<[^>]+>/.test(rawContent);
  if (!isHTML) {
    return (
      <div
        className="ai-desc"
        style={{
          fontSize: 15,
          lineHeight: 1.75,
          color: 'var(--s-text2)',
          fontFamily: 'var(--s-font)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {rawContent}
      </div>
    );
  }

  const cleanContent = optimizeDescriptionHtml(rawContent);
  const htmlToRender = (cleanContent && cleanContent.trim()) ? cleanContent : rawContent;

  return (
    <div>
      <div
        className="ai-desc"
        style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--s-text2)', fontFamily: 'var(--s-font)' }}
        dangerouslySetInnerHTML={{ __html: htmlToRender }}
      />
    </div>
  );
};

// Extraire Q/R depuis le HTML pour les anciens produits
const extractFaqItemsFromHtml = (html = '') => {
  if (!html || typeof DOMParser === 'undefined') return [];
  try {
    const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html');
    const root = doc.getElementById('r');

    // Trouver le conteneur FAQ (div avec heading "Questions fréquentes")
    const faqContainer = Array.from(root.querySelectorAll('*')).find(el => {
      if (!/^(DIV|SECTION|ARTICLE)$/.test(el.tagName)) return false;
      const h = el.querySelector('h1,h2,h3,h4,h5,h6');
      return h && /questions?\s*fréquentes?|faq/i.test(h.textContent || '');
    });

    const source = faqContainer || root;
    const items = [];

    // Pattern A : éléments de question (h4, h3, p>strong, p>b)
    const questionEls = Array.from(source.querySelectorAll('h4,h3')).filter(el =>
      !/questions?\s*fréquentes?|faq/i.test(el.textContent || '')
    );

    if (questionEls.length) {
      questionEls.forEach(qEl => {
        const q = qEl.textContent?.trim();
        if (!q) return;
        let next = qEl.nextElementSibling;
        while (next && !next.textContent?.trim()) next = next.nextElementSibling;
        const a = next?.textContent?.trim();
        if (q && a) items.push({ question: q, reponse: a });
      });
    }

    // Pattern B : <p><strong>Q?</strong></p> suivi de <p>R.</p>
    if (!items.length) {
      const allP = Array.from(source.querySelectorAll('p')).filter(p => p.textContent?.trim());
      allP.forEach((p, i) => {
        const strong = p.querySelector('strong, b');
        if (strong && p.textContent?.includes('?')) {
          const next = allP[i + 1];
          if (next && !next.querySelector('strong, b')) {
            items.push({ question: p.textContent.trim(), reponse: next.textContent.trim() });
          }
        }
      });
    }

    // Pattern C : alternance paragraphes (impairs = questions, pairs = réponses)
    if (!items.length && faqContainer) {
      const paras = Array.from(faqContainer.querySelectorAll('p')).filter(p => p.textContent?.trim());
      for (let i = 0; i + 1 < paras.length; i += 2) {
        items.push({ question: paras[i].textContent.trim(), reponse: paras[i + 1].textContent.trim() });
      }
    }

    return items;
  } catch { return []; }
};

// ── Collapsible Section ──────────────────────────────────────────────────────
const CollapsibleSection = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: '1px solid var(--s-border)', marginTop: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--s-text)', fontFamily: 'var(--s-font)' }}>
          {title}
        </span>
        {open ? <ChevronUp size={18} color="var(--s-text2)" /> : <ChevronDown size={18} color="var(--s-text2)" />}
      </button>
      {open && (
        <div style={{ paddingBottom: 20 }}>
          {children}
        </div>
      )}
    </div>
  );
};

// ── Stats Bar (social proof numbers) ─────────────────────────────────────────
const StatsBar = ({ stats = [] }) => {
  if (!stats || stats.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
      {stats.map((stat, i) => (
        <div key={i} style={{
          flex: '1 1 auto', minWidth: 90,
          padding: '12px 14px', borderRadius: 14,
          backgroundColor: 'var(--s-primary)', color: '#fff',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1, fontFamily: 'var(--s-font)' }}>
            {stat.value}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, marginTop: 3, lineHeight: 1.3, fontFamily: 'var(--s-font)' }}>
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Problem / Solution sections ───────────────────────────────────────────────
const ProblemSection = ({ section }) => {
  if (!section?.title && !section?.pain_points?.length) return null;
  return (
    <div style={{
      margin: '24px 0', padding: '22px 20px', borderRadius: 16,
      backgroundColor: '#FFF7F7', border: '1px solid #FECACA',
    }}>
      {section.title && (
        <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 800, color: '#991B1B', fontFamily: 'var(--s-font)', lineHeight: 1.3 }}>
          {section.title}
        </h3>
      )}
      {section.pain_points?.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {section.pain_points.map((point, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: '#7F1D1D', lineHeight: 1.6, fontFamily: 'var(--s-font)' }}>
              <span style={{ flexShrink: 0, marginTop: 2 }}>😔</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const SolutionSection = ({ section }) => {
  if (!section?.title && !section?.description) return null;
  return (
    <div style={{
      margin: '16px 0 24px', padding: '22px 20px', borderRadius: 16,
      backgroundColor: '#F0FDF4', border: '1px solid #A7F3D0',
    }}>
      {section.title && (
        <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800, color: '#14532D', fontFamily: 'var(--s-font)', lineHeight: 1.3 }}>
          {section.title}
        </h3>
      )}
      {section.description && (
        <p style={{ margin: 0, fontSize: 14.5, color: '#166534', lineHeight: 1.75, fontFamily: 'var(--s-font)' }}>
          {section.description}
        </p>
      )}
    </div>
  );
};

// ── Offer / Guarantee Block ────────────────────────────────────────────────────
const OfferBlock = ({ block }) => {
  const text = block?.guarantee_text || block?.hook;
  if (!text) return null;
  return (
    <div style={{
      margin: '16px 0', padding: '14px 16px', borderRadius: 12,
      backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>🛡️</span>
      <p style={{ margin: 0, fontSize: 13.5, color: '#78350F', lineHeight: 1.65, fontWeight: 600, fontFamily: 'var(--s-font)' }}>
        {text}
      </p>
    </div>
  );
};

const ProductFaqAccordion = ({ items = [] }) => {
  const [openIndex, setOpenIndex] = useState(null);

  if (!items.length) return null;

  return (
    <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--s-border)' }}>
      <h2 style={{ margin: '0 0 18px', fontSize: 20, fontWeight: 800, color: 'var(--s-text)', fontFamily: 'var(--s-font)' }}>
        Questions fréquentes
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, index) => {
          const opened = openIndex === index;
          return (
            <div key={`${item.question}-${index}`} style={{ borderRadius: 14, border: '1px solid', overflow: 'hidden', borderColor: opened ? 'var(--s-primary)' : 'var(--s-border)', backgroundColor: opened ? '#FAFFFE' : '#fff' }}>
              <button
                onClick={() => setOpenIndex(opened ? null : index)}
                style={{ width: '100%', padding: '18px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--s-text)', lineHeight: 1.45, fontFamily: 'var(--s-font)' }}>
                  {item.question}
                </span>
                <span style={{ flexShrink: 0, color: opened ? 'var(--s-primary)' : 'var(--s-text2)' }}>
                  {opened ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>
              </button>
              {opened && (
                <div style={{ padding: '0 18px 18px', fontSize: 14, color: 'var(--s-text2)', lineHeight: 1.7, fontFamily: 'var(--s-font)' }}>
                  {item.answer || item.reponse}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Trust Badges ─────────────────────────────────────────────────────────────
const TrustBadges = ({ compact = false }) => (
  <div className="sf-no-scrollbar" style={{
    display: 'flex', gap: 12,
    marginTop: compact ? 24 : 28,
    padding: compact ? '0 0 4px' : '20px 0 4px',
    borderTop: compact ? 'none' : '1px solid var(--s-border)',
    overflowX: 'auto',
    flexWrap: 'nowrap',
  }}>
    {[
      { icon: <Truck size={16} />, text: 'Livraison rapide' },
      { icon: <Shield size={16} />, text: 'Paiement sécurisé' },
      { icon: <RotateCcw size={16} />, text: 'Retours acceptés' },
    ].map(({ icon, text }) => (
      <div key={text} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 999,
        border: '1px solid var(--s-border)',
        backgroundColor: '#fff',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        <span style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'var(--s-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--s-text2)', fontFamily: 'var(--s-font)' }}>
          {text}
        </span>
      </div>
    ))}
  </div>
);

// ── Related Products ─────────────────────────────────────────────────────────
const RelatedCard = ({ product, prefix, store, subdomain }) => {
  const [hovered, setHovered] = useState(false);
  const handlePrefetch = () => {
    preloadStoreProductRoute();
    if (subdomain && product?.slug) {
      prefetchStoreProduct(subdomain, product.slug);
    }
  };

  return (
    <Link to={`${prefix}/product/${product.slug}`} style={{ textDecoration: 'none' }}
      onMouseEnter={() => { setHovered(true); handlePrefetch(); }} onMouseLeave={() => setHovered(false)} onFocus={handlePrefetch} onTouchStart={handlePrefetch}>
      <div style={{
        borderRadius: 14, overflow: 'hidden', border: '1px solid var(--s-border)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-2px)' : 'none', transition: 'all 0.2s',
      }}>
        <div style={{ paddingBottom: '100%', position: 'relative', backgroundColor: '#f4f4f5', overflow: 'hidden' }}>
          {product.image ? (
            <img src={product.image} alt={product.name} loading="lazy" decoding="async" sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 160px"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                transform: hovered ? 'scale(1.04)' : 'scale(1)', transition: 'transform 0.3s' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={32} style={{ color: '#d1d5db' }} />
            </div>
          )}
        </div>
        <div style={{ padding: '12px 14px' }}>
          <p style={{
            margin: '0 0 6px', fontWeight: 600, fontSize: 13.5, color: 'var(--s-text)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            lineHeight: 1.35, fontFamily: 'var(--s-font)',
          }}>
            {product.name}
          </p>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--s-primary)', fontFamily: 'var(--s-font)' }}>
            {fmt(product.price, product.currency || store?.currency || 'XAF')}
          </span>
        </div>
      </div>
    </Link>
  );
};


// ── Main ─────────────────────────────────────────────────────────────────────
const StoreProductPage = () => {
  const { subdomain: paramSubdomain, slug } = useParams();
  const { subdomain: detectedSubdomain, isStoreDomain } = useSubdomain();
  const subdomain = paramSubdomain || detectedSubdomain;
  const prefix = isStoreDomain ? '' : (subdomain ? `/store/${subdomain}` : '');

  const { store, pixels, product, related, error } = useStoreProduct(subdomain, slug);
  const { cartCount } = useStoreCart(subdomain);
  const { trackPageView, trackProductView, trackAddToCart } = useStoreAnalytics(subdomain);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showStickyOrderBar, setShowStickyOrderBar] = useState(false);
  const ctaButtonsRef = useRef(null);
  const [livePageConfig, setLivePageConfig] = useState(null); // real-time override from page builder

  // Inject pixel scripts and fire ViewContent when product loads
  useEffect(() => {
    if (!product || !pixels) return;
    injectPixelScripts(pixels);
    firePixelEvent('ViewContent', {
      content_ids: [product._id || product.slug || ''],
      content_name: product.name || '',
      value: product.price || 0,
      currency: store?.currency || 'XAF',
    });
    // Track product view in store analytics
    trackProductView(product._id || product.slug, product.name, product.price);
  }, [product, pixels, store?.currency]);

  useEffect(() => {
    if (!store?.name || !product?.name) return;
    const storeVisual = store.logo || store.banner || product.images?.[0]?.url || '/icon.png';
    setDocumentMeta({
      title: product.seoTitle || `${product.name} — ${store.name}`,
      description: truncateMetaText(
        normalizeMetaText(product.seoDescription || product.description || store.description || `Découvrez ${product.name} chez ${store.name}.`),
        180,
      ),
      image: storeVisual,
      icon: store.logo || storeVisual,
      siteName: store.name,
      appTitle: store.name,
      type: 'product',
    });
  }, [product, store]);

  // Écouter les changements de couleurs en temps réel via Socket.io
  useEffect(() => {
    if (!subdomain) return;
    
    const socketUrl = import.meta.env.VITE_BACKEND_URL || 'https://api.scalor.net';
    const socket = io(`${socketUrl}/store-live`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    
    socket.on('connect', () => {
      console.log('[Store] Socket connecté, joining:', subdomain);
      socket.emit('store:join', { subdomain });
    });
    
    socket.on('theme:update', (themeData) => {
      if (themeData) {
        injectStoreCssVars(themeData);
      }
    });

    socket.on('connect_error', (err) => {
      console.log('[Store] Socket error:', err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [subdomain]);

  // Shopify-style postMessage listener — builder parent sends PAGE_PREVIEW_UPDATE
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === 'PAGE_PREVIEW_UPDATE' && event.data.payload) {
        setLivePageConfig(event.data.payload);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);


  const images = product?.images?.length ? product.images : [];
  const hasDiscount = product?.compareAtPrice && product.compareAtPrice > product.price;
  const pct = hasDiscount ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  const inStock = !product || product.stock > 0;
  const lowStock = product && product.stock > 0 && product.stock <= 5;
  const sectionToggles = store?.sectionToggles || {};
  const showWhatsappButton = (sectionToggles.showWhatsappButton ?? false) && !!store?.whatsapp;
  const showTrustBadges = sectionToggles.showTrustBadges ?? true;
  const showRelatedProducts = sectionToggles.showRelatedProducts ?? true;

  // ── productPageConfig — live preview > store global, conversion propre au produit en priorité ──
  const productPageConfig = {
    ...(store?.productPageConfig || {}),
    ...(livePageConfig || {}),
    conversion: {
      ...(store?.productPageConfig?.conversion || {}),
      ...(livePageConfig?.conversion || {}),
      ...(product?.productPageConfig?.conversion || {}),
      // Quantity offers from QuantityOffer model take highest priority
      ...(product?.quantityOffers?.length > 0 ? {
        offersEnabled: true,
        offers: product.quantityOffers,
      } : {}),
    },
  };
  const ppTheme = productPageConfig?.theme || 'classic';
  const ppGeneral = productPageConfig?.general || {};
  const ppDesign = productPageConfig?.design || {};
  const ppButton = productPageConfig?.button || {};
  const ppConversion = productPageConfig?.conversion || {};
  const ppSections = ppGeneral.sections || [];
  const ppSectionOrder = ppSections.length > 0 ? ppSections : null;
  const sectionContentMap = Object.fromEntries(ppSections.map(s => [s.id, s.content || {}]));
  const isSectionEnabled = (id, fallback = true) => {
    if (!ppSections.length) return fallback;
    const s = ppSections.find(s => s.id === id);
    return s ? s.enabled : fallback;
  };

  // Resolve button icon from config
  const CtaIcon = getIconComponent(ppButton.icon);
  const ctaAnimation = ppButton.animation || 'none';
  const ppFormType = ppGeneral.formType || 'popup';

  // Build ordered enabled section IDs for rendering
  const enabledSectionIds = ppSectionOrder
    ? ppSectionOrder.filter(s => s.enabled).map(s => s.id)
    : ['heroSlogan', 'heroBaseline', 'reviews', 'orderForm', 'statsBar', 'stockCounter', 'urgencyBadge',
       'urgencyElements', 'benefitsBullets', 'conversionBlocks', 'offerBlock', 'description',
       'problemSection', 'solutionSection', 'faq', 'testimonials', 'relatedProducts',
       'stickyOrderBar', 'upsell', 'orderBump'];
  const showStickyBar = enabledSectionIds.includes('stickyOrderBar');
  const showRelatedProductsSetting = enabledSectionIds.includes('relatedProducts');
  const showTestimonials = enabledSectionIds.includes('testimonials');
  const ctaBtnColor = ppDesign.buttonColor || 'var(--s-primary)';
  const ctaBorderRadius = ppDesign.borderRadius || '14px';
  const ctaShadow = ppDesign.shadow !== false ? '0 4px 16px rgba(0,0,0,0.12)' : 'none';
  const ctaAnimClass = ctaAnimation === 'pulse' ? 'pp-pulse' : ctaAnimation === 'bounce' ? 'pp-bounce' : ctaAnimation === 'shake' ? 'pp-shake' : ctaAnimation === 'glow' ? 'pp-glow' : '';

  useEffect(() => {
    if (!product || !inStock) {
      setShowStickyOrderBar(false);
      return;
    }

    const checkStickyVisibility = () => {
      const ctaBox = ctaButtonsRef.current;
      if (!ctaBox) { setShowStickyOrderBar(false); return; }
      const rect = ctaBox.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
      setShowStickyOrderBar(!isVisible);
    };

    checkStickyVisibility();
    window.addEventListener('scroll', checkStickyVisibility, { passive: true });
    window.addEventListener('resize', checkStickyVisibility);

    return () => {
      window.removeEventListener('scroll', checkStickyVisibility);
      window.removeEventListener('resize', checkStickyVisibility);
    };
  }, [product, inStock]);

  const openOrderModal = () => {
    if (!inStock) return;
    setShowOrderModal(true);
    trackAddToCart(product?._id || product?.slug, product?.name, product?.price);
    firePixelEvent('AddToCart', {
      content_ids: [product?._id || product?.slug || ''],
      content_name: product?.name || '',
      value: product?.price || 0,
      currency: store?.currency || 'XAF',
    });
  };

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ fontSize: 48, margin: '0 0 16px' }}>😕</p>
        <h2 style={{ color: '#111', fontWeight: 700, margin: '0 0 8px' }}>Produit introuvable</h2>
        <p style={{ color: '#6B7280', fontSize: 15 }}>{error}</p>
        <Link to={`${prefix}/`} style={{ marginTop: 20, display: 'inline-block', color: 'var(--s-primary)', fontWeight: 600, fontSize: 14 }}>← Accueil</Link>
      </div>
    </div>
  );

  return (
    <div className={ppTheme === 'landing' ? 'theme-landing-active' : ''} style={{ minHeight: '100vh', backgroundColor: 'var(--s-bg)', fontFamily: 'var(--s-font)', color: 'var(--s-text)' }}>
      <style>{`
        *{box-sizing:border-box} body{margin:0;padding:0}
        .sf-no-scrollbar { scrollbar-width:none; -ms-overflow-style:none; }
        .sf-no-scrollbar::-webkit-scrollbar { display:none; }
        @keyframes slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        /* Button animations from product page config */
        .pp-pulse { animation: pp-pulse-kf 2s ease-in-out infinite; }
        .pp-bounce { animation: pp-bounce-kf 1s ease infinite; }
        .pp-shake { animation: pp-shake-kf 0.6s ease-in-out infinite; }
        .pp-glow { animation: pp-glow-kf 2s ease-in-out infinite; }
        @keyframes pp-pulse-kf { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
        @keyframes pp-bounce-kf { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes pp-shake-kf { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }
        @keyframes pp-glow-kf { 0%,100%{box-shadow:0 0 5px rgba(255,255,255,0.2)} 50%{box-shadow:0 0 20px rgba(255,255,255,0.5)} }

        /* ═══ THEME: CLASSIC ═══ */
        .product-grid.theme-classic { display:grid; grid-template-columns:1fr; gap:0; align-items:start; }
        .theme-classic .product-gallery { position:relative; }
        .theme-classic .product-info { padding:16px 16px 48px; }
        @media(min-width:769px){
          .product-grid.theme-classic { grid-template-columns:1fr 1fr; gap:40px; }
          .theme-classic .product-gallery { position:sticky; top:72px; }
          .theme-classic .product-info { padding:0 24px 48px 0; }
        }

        /* ═══ THEME: LANDING PAGE ═══ */
        .product-grid.theme-landing { display:flex; flex-direction:column; gap:0; background:#fff; }
        .theme-landing .product-gallery { position:relative; width:100%; height:75vh; min-height:500px; overflow:hidden; }
        .theme-landing .product-gallery img { width:100%; height:100%; object-fit:cover; object-position:center; }
        .theme-landing .product-gallery .thumb-track, .theme-landing .product-gallery .dots-track { display:none !important; }
        .theme-landing .product-gallery button { display:none !important; } /* Hide gallery arrows on landing */
        .theme-landing .product-gallery::after {
          content:''; position:absolute; bottom:0; left:0; right:0; height:35vh;
          background:linear-gradient(to top, #fff 0%, rgba(255,255,255,0.8) 40%, transparent 100%); pointer-events:none; z-index:5;
        }
        .theme-landing .product-info {
          padding:0 24px 80px; max-width:850px; margin:0 auto; width:100%; position:relative; z-index:10; margin-top:-15vh;
        }
        /* Top-level header elements centered */
        .theme-landing h1, .theme-landing .price-wrapper, .theme-landing .hero-slogan, .theme-landing .hero-baseline { text-align:center !important; justify-content:center !important; }
        .theme-landing h1 { font-size:clamp(38px, 6vw, 64px) !important; margin-bottom:20px !important; line-height:1.05 !important; letter-spacing:-0.04em !important; }
        .theme-landing .price-wrapper span:first-child { font-size:42px !important; }
        /* Blocks */
        .theme-landing .ai-desc { text-align:left; margin-top:40px; background:#fff; padding:0; }
        .theme-landing .ai-desc h3 { text-align:center; font-size:28px !important; margin:40px 0 24px !important; }
        .theme-landing .ai-desc p { font-size:17px !important; line-height:1.8 !important; }
        .theme-landing .ai-desc img { border-radius:16px; margin:32px 0 !important; box-shadow:0 12px 32px rgba(0,0,0,0.08); }
        .theme-landing .order-btn-wrapper button { min-height:72px !important; font-size:20px !important; border-radius:100px !important; }
        @media(min-width:769px){
          .theme-landing .product-gallery { height:85vh; }
          .theme-landing .product-info { padding:0 32px 100px; margin-top:-20vh; }
        }
        /* Hide navbar completely for landing pages to remove distractions */
        .theme-landing-active .sf-header { display:none !important; }

        /* ═══ THEME: MAGAZINE ═══ */
        .product-grid.theme-magazine { display:flex; flex-direction:column; gap:0; position:relative; }
        .theme-magazine .product-gallery { position:relative; max-height:75vh; overflow:hidden; }
        .theme-magazine .product-gallery::after {
          content:''; position:absolute; bottom:0; left:0; right:0; height:40%;
          background:linear-gradient(transparent, var(--s-bg)); pointer-events:none;
        }
        .theme-magazine .product-info {
          position:relative; z-index:2; margin:-60px 16px 0; padding:28px 24px 48px;
          background:var(--s-bg); border-radius:24px 24px 0 0;
          box-shadow:0 -8px 40px rgba(0,0,0,0.08);
        }
        @media(min-width:769px){
          .theme-magazine .product-gallery { max-height:80vh; }
          .theme-magazine .product-info {
            margin:-100px auto 0; max-width:720px; padding:40px 40px 60px;
            border-radius:28px 28px 0 0; box-shadow:0 -12px 60px rgba(0,0,0,0.1);
          }
        }

        .ai-desc h3 { font-size:18px; font-weight:800; color:var(--s-text); margin:0 0 10px; line-height:1.3; }
        .ai-desc h3 strong { font-weight:800; }
        .ai-desc p { font-size:14px; line-height:1.75; color:var(--s-text2); margin:0 0 12px; }
        .ai-desc img { width:auto !important; max-width:100% !important; height:auto !important; aspect-ratio:auto !important; object-fit:contain !important; display:block; margin:0; }
        .ai-desc ul { margin:0; padding:0; list-style:none; }
        .ai-desc ul li { display:flex; align-items:flex-start; gap:8px; margin-bottom:8px; font-size:13px; }
        @media(min-width:769px){
          .ai-desc h3 { font-size:20px; }
          .ai-desc p { font-size:15px; }
          .ai-desc ul li { font-size:14px; }
        }
        /* Hide nav links on very small screens */
        @media(max-width:480px){ .sf-nav-link { display:none !important; } }
      `}</style>

      {/* Barre d'annonce défilante */}
      {store?.announcementEnabled && store?.announcement && (
        <div style={{
          backgroundColor: 'var(--s-primary)',
          color: '#fff',
          padding: '10px 0',
          overflow: 'hidden',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'var(--s-font)',
          whiteSpace: 'nowrap',
        }}>
          <div style={{
            display: 'inline-block',
            animation: 'sp-marquee 18s linear infinite',
          }}>
            <span>{store.announcement}</span>
            <span style={{ padding: '0 60px' }}>✦</span>
            <span>{store.announcement}</span>
            <span style={{ padding: '0 60px' }}>✦</span>
          </div>
          <style>{`@keyframes sp-marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }`}</style>
        </div>
      )}

      <div className="sf-header">
        <StorefrontHeader store={store} cartCount={cartCount} prefix={prefix} />
      </div>

      {/* Product Detail */}
      <div style={{ maxWidth: ppTheme === 'landing' || ppTheme === 'magazine' ? '100%' : 1200, margin: '0 auto', padding: '0' }}>
        <div className={`product-grid theme-${ppTheme}`}>
          {/* ── Gallery ────────────────────────────────────────────────────── */}
          <div className="product-gallery">
            <ImageGallery images={images} />
          </div>

          {/* ── Right: Info ───────────────────────────────────────────────── */}
          <div className="product-info">
            {product ? (
              <>
                {/* Category badge */}
                {product.category && (() => {
                  const cat = product.category.toLowerCase();
                  let icon = '🛍️';
                  if (/tech|electron|phone|mobile|laptop|gadget|accessoire|câble|cable|casque|earphone|smartwatch/.test(cat)) icon = '⚡';
                  else if (/mode|vêtement|vetement|robe|wax|tissu|fashion|clothing|bijou|sac|chaussure|shoe|bag|jewel/.test(cat)) icon = '👑';
                  else if (/beaut|cosmét|soin|skin|crème|creme|sérum|serum|makeup|maquillage|parfum|cheveux|hair/.test(cat)) icon = '🌿';
                  else if (/aliment|food|nutri|santé|sante|supplement|complément|protéine|protein|minceur|régime|diet|bio|organic/.test(cat)) icon = '💪';
                  else if (/maison|home|deco|décor|cuisine|kitchen|ménage|menage|électroménager|electromenager/.test(cat)) icon = '🏠';
                  else if (/bébé|bebe|enfant|child|kids|maternité|maternite|jouet|toy/.test(cat)) icon = '👶';
                  return (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11, fontWeight: 700, color: 'var(--s-primary)',
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      backgroundColor: 'color-mix(in srgb, var(--s-primary) 12%, transparent)',
                      padding: '3px 10px', borderRadius: 20, marginBottom: 4,
                    }}>
                      {icon} {product.category}
                    </span>
                  );
                })()}

                {/* Name */}
                <h1 style={{
                  fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900,
                  color: 'var(--s-text)', margin: '8px 0 8px',
                  lineHeight: 1.1, letterSpacing: '-0.03em', fontFamily: 'var(--s-font)',
                }}>
                  {product.name}
                </h1>

                {/* Hero slogan / baseline from AI or config content */}
                {enabledSectionIds.includes('heroSlogan') && (sectionContentMap.heroSlogan?.text || product._pageData?.hero_slogan) && (
                  <p className="hero-slogan" style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: 'var(--s-text2)', fontFamily: 'var(--s-font)', lineHeight: 1.5 }}>
                    {sectionContentMap.heroSlogan?.text || product._pageData.hero_slogan}
                  </p>
                )}
                {enabledSectionIds.includes('heroBaseline') && (sectionContentMap.heroBaseline?.text || product._pageData?.hero_baseline) && (
                  <p className="hero-baseline" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--s-primary)', fontWeight: 700, fontFamily: 'var(--s-font)' }}>
                    ✅ {sectionContentMap.heroBaseline?.text || product._pageData.hero_baseline}
                  </p>
                )}

                {/* Price — always shown */}
                <div className="price-wrapper" style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: 'var(--s-primary)', fontFamily: 'var(--s-font)', letterSpacing: '-0.02em' }}>
                    {fmt(product.price, product.currency || store?.currency || 'XAF')}
                  </span>
                  {hasDiscount && (
                    <>
                      <span style={{ fontSize: 17, color: 'var(--s-text2)', textDecoration: 'line-through', fontFamily: 'var(--s-font)' }}>
                        {fmt(product.compareAtPrice, product.currency || store?.currency || 'XAF')}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 20, backgroundColor: '#FEE2E2', color: '#EF4444' }}>
                        -{pct}%
                      </span>
                    </>
                  )}
                </div>

                {/* Sections rendered in config order */}
                {enabledSectionIds.map(sectionId => {
                  switch (sectionId) {
                    case 'reviews':
                      return <ProductReviews key={sectionId} rating={product.rating || 4.5} reviewCount={product.reviewCount || 0} />;

                    case 'orderForm':
                      return (
                        <div className="order-btn-wrapper" key={sectionId} ref={ctaButtonsRef} style={{ marginBottom: 20 }}>
                          {ppFormType === 'embedded' && inStock ? (
                            <EmbeddedOrderForm
                              product={product}
                              subdomain={subdomain}
                              store={store}
                              productPageConfig={productPageConfig}
                            />
                          ) : (
                            <button
                              onClick={openOrderModal}
                              disabled={!inStock}
                              className={ctaAnimClass}
                              onMouseEnter={(e) => {
                                if (inStock) { e.target.style.transform = 'scale(1.02)'; e.target.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; }
                              }}
                              onMouseLeave={(e) => {
                                if (inStock) { e.target.style.transform = 'scale(1)'; e.target.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; }
                              }}
                              style={{
                                width: '100%', padding: '18px 24px', borderRadius: ctaBorderRadius, border: 'none',
                                backgroundColor: inStock ? ctaBtnColor : '#d1d5db',
                                color: '#fff', fontWeight: 700, fontSize: 17, cursor: inStock ? 'pointer' : 'not-allowed',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', fontFamily: 'var(--s-font)',
                                boxShadow: inStock ? ctaShadow : 'none',
                                minHeight: 56, position: 'relative', overflow: 'hidden'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                <CtaIcon size={18} /> {ppButton.text || 'Commander maintenant'}
                              </div>
                              <span style={{ fontSize: '12px', opacity: 0.9, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Truck size={10} /> {ppButton.subtext || 'Paiement à la livraison'}
                              </span>
                            </button>
                          )}
                        </div>
                      );

                    case 'statsBar': {
                      const customStats = sectionContentMap.statsBar?.stats?.filter(st => st.value && st.label);
                      const statsData = customStats?.length > 0 ? customStats : product._pageData?.stats_bar;
                      return statsData?.length > 0
                        ? <StatsBar key={sectionId} stats={statsData} />
                        : null;
                    }

                    case 'stockCounter':
                      return (
                        <div key={sectionId} style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                          {!inStock ? (
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#EF4444', padding: '4px 12px', borderRadius: 20, backgroundColor: '#FEE2E2' }}>
                              Rupture de stock
                            </span>
                          ) : lowStock ? (
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#F59E0B', padding: '4px 12px', borderRadius: 20, backgroundColor: '#FEF3C7' }}>
                              ⚡ Plus que {product.stock} en stock
                            </span>
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#10B981', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Check size={14} /> En stock
                            </span>
                          )}
                        </div>
                      );

                    case 'urgencyBadge': {
                      const urgencyText = sectionContentMap.urgencyBadge?.text || product._pageData?.urgency_badge;
                      return urgencyText && inStock ? (
                        <div key={sectionId} style={{ marginBottom: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', padding: '4px 12px', borderRadius: 20, backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                            {urgencyText}
                          </span>
                        </div>
                      ) : null;
                    }

                    case 'urgencyElements':
                      return product._pageData?.urgency_elements ? (
                        <UrgencyBadge key={sectionId}
                          stockLimited={product._pageData.urgency_elements.stock_limited}
                          socialProofCount={product._pageData.urgency_elements.social_proof_count}
                          quickResult={product._pageData.urgency_elements.quick_result}
                        />
                      ) : null;

                    case 'benefitsBullets': {
                      const customBullets = sectionContentMap.benefitsBullets?.items?.filter(Boolean);
                      const bulletsData = customBullets?.length > 0 ? customBullets : product._pageData?.benefits_bullets;
                      return bulletsData?.length > 0 ? (
                        <ProductBenefits key={sectionId} benefits={bulletsData} title="💥 Les bénéfices" />
                      ) : null;
                    }

                    case 'conversionBlocks':
                      return product._pageData?.conversion_blocks?.length > 0 ? (
                        <ConversionBlocks key={sectionId} blocks={product._pageData.conversion_blocks} />
                      ) : null;

                    case 'offerBlock': {
                      const sc = sectionContentMap.offerBlock || {};
                      const aiBlock = product._pageData?.offer_block;
                      const mergedBlock = (aiBlock || sc.offerLabel || sc.guaranteeText) ? {
                        offer_label: sc.offerLabel || aiBlock?.offer_label || 'Offre spéciale',
                        guarantee_text: sc.guaranteeText || aiBlock?.guarantee_text,
                      } : null;
                      return mergedBlock ? <OfferBlock key={sectionId} block={mergedBlock} /> : null;
                    }

                    case 'description': {
                      const raw = product.description?.toString().trim() || '';
                      return raw ? (
                        <div key={sectionId} style={{ borderTop: '1px solid var(--s-border)', marginTop: 8, paddingTop: 16, paddingBottom: 8 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--s-text)', fontFamily: 'var(--s-font)', marginBottom: 12 }}>
                            Description du produit
                          </div>
                          <ProductDescription content={raw} />
                        </div>
                      ) : null;
                    }

                    case 'problemSection': {
                      const sc = sectionContentMap.problemSection || {};
                      const aiSection = product._pageData?.problem_section;
                      const customPainPoints = sc.painPoints?.filter(Boolean);
                      const mergedSection = (aiSection || sc.title || customPainPoints?.length > 0) ? {
                        title: sc.title || aiSection?.title || 'Le problème',
                        pain_points: customPainPoints?.length > 0 ? customPainPoints : aiSection?.pain_points,
                      } : null;
                      return mergedSection ? <ProblemSection key={sectionId} section={mergedSection} /> : null;
                    }

                    case 'solutionSection': {
                      const sc = sectionContentMap.solutionSection || {};
                      const aiSection = product._pageData?.solution_section;
                      const mergedSection = (aiSection || sc.title || sc.description) ? {
                        title: sc.title || aiSection?.title || 'La solution',
                        description: sc.description || aiSection?.description,
                      } : null;
                      return mergedSection ? <SolutionSection key={sectionId} section={mergedSection} /> : null;
                    }

                    case 'faq': {
                      const raw2 = product.description?.toString().trim() || '';
                      const hasHtml2 = raw2 && /<[^>]+>/.test(raw2);
                      const customFaq = sectionContentMap.faq?.faqItems?.filter(f => f.question && f.answer);
                      const faqItems = customFaq?.length > 0
                        ? customFaq
                        : product.faq?.length > 0
                          ? product.faq
                          : (hasHtml2 ? extractFaqItemsFromHtml(raw2) : []);
                      return faqItems.length > 0
                        ? <ProductFaqAccordion key={sectionId} items={faqItems} />
                        : null;
                    }

                    case 'upsell':
                    case 'orderBump':
                      // These are rendered inline (not standalone components yet)
                      return null;

                    // heroSlogan, heroBaseline, testimonials, relatedProducts, stickyOrderBar
                    // are rendered separately (outside this loop)
                    default:
                      return null;
                  }
                })}

              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Témoignages clients ── full-width ──────────────── */}
      {showTestimonials && (() => {
        // Priority: custom testimonials from builder > AI-generated > product > country defaults
        const testimonialsSection = productPageConfig?.general?.sections?.find(s => s.id === 'testimonials');
        const customT = testimonialsSection?.content?.items;
        const t = (customT?.length > 0)
          ? customT
          : product?._pageData?.testimonials?.length > 0
            ? product._pageData.testimonials
            : product?.testimonials?.length > 0
              ? product.testimonials
              : getDefaultTestimonials(store?.country);
        const prodImg = product?._pageData?.heroImage || product?.images?.[0]?.url || product?.images?.[0] || null;
        const groupImg = product?._pageData?.testimonialsGroupImage || null;
        const socialImg = product?._pageData?.testimonialsSocialProofImage || null;
        return (
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
            <ProductTestimonials testimonials={t} productImage={prodImg} groupImage={groupImg} socialProofImage={socialImg} />
          </div>
        );
      })()}

      {/* ── Related Products ───────────────────────────────────────────────── */}
      {showRelatedProductsSetting && related.length > 0 && (
        <section style={{ maxWidth: 1200, margin: '48px auto 0', padding: '0 16px' }}>
          <h2 style={{
            fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: 800, color: 'var(--s-text)',
            margin: '0 0 20px', letterSpacing: '-0.02em', fontFamily: 'var(--s-font)',
          }}>
            Vous aimerez aussi
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {related.map(p => <RelatedCard key={p._id} product={p} prefix={prefix} store={store} subdomain={store?.subdomain} />)}
          </div>
        </section>
      )}

      {showStickyBar && showStickyOrderBar && product && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 70,
          padding: '10px 16px calc(env(safe-area-inset-bottom, 0px) + 10px)',
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderTop: '1px solid var(--s-border)',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          animation: 'slide-up 0.2s ease-out',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--s-text2)', fontFamily: 'var(--s-font)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 800, color: 'var(--s-primary)', fontFamily: 'var(--s-font)' }}>
                {fmt(product.price, product.currency || store?.currency || 'XAF')}
              </p>
            </div>
            <button
              onClick={() => {
                if (ppFormType === 'embedded') {
                  ctaButtonsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                  openOrderModal();
                }
              }}
              disabled={!inStock}
              style={{
                border: 'none', borderRadius: 999, padding: '16px 24px',
                backgroundColor: inStock ? 'var(--s-primary)' : '#d1d5db', color: '#fff',
                fontSize: 15, fontWeight: 800, fontFamily: 'var(--s-font)',
                cursor: inStock ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
                minHeight: 48,
              }}
            >
              {ppButton.text || 'Commander'}
            </button>
          </div>
        </div>
      )}

      <StorefrontFooter store={store} prefix={prefix} />

      {/* Quick Order Modal */}
      {product && (
        <QuickOrderModal
          isOpen={showOrderModal}
          product={product}
          store={store}
          subdomain={subdomain}
          onClose={() => setShowOrderModal(false)}
          productPageConfig={productPageConfig}
        />
      )}
    </div>
  );
};

export default StoreProductPage;
