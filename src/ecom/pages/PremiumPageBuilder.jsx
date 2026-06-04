import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, Check, Plus, Trash2, ChevronDown, ChevronUp,
  Star, Type, Zap, Shield, HelpCircle, Eye, Palette, Image as ImageIcon,
  MessageSquare, BarChart3, Layers, Award, Clock, ShoppingBag, Monitor,
  Smartphone, ExternalLink, Pencil,
} from 'lucide-react';
import { storeProductsApi } from '../services/storeApi.js';
import { useStore } from '../contexts/StoreContext.jsx';

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder-gray-400';
const textareaCls = `${inputCls} resize-none`;

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function RepeatableItems({ items, onChange, fields, addLabel }) {
  const update = (i, key, val) => { const copy = [...items]; copy[i] = { ...copy[i], [key]: val }; onChange(copy); };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, fields.reduce((a, f) => ({ ...a, [f.key]: f.default || '' }), {})]);

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          {fields.map((f) => (
            <div key={f.key}>
              {f.type === 'textarea' ? (
                <textarea value={item[f.key] || ''} onChange={(e) => update(i, f.key, e.target.value)} rows={f.rows || 2} placeholder={f.placeholder || f.label} className={textareaCls} />
              ) : (
                <input type="text" value={item[f.key] || ''} onChange={(e) => update(i, f.key, e.target.value)} placeholder={f.placeholder || f.label} className={inputCls} />
              )}
            </div>
          ))}
        </div>
      ))}
      <button type="button" onClick={add} className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-xs font-semibold text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition flex items-center justify-center gap-1.5">
        <Plus className="w-3.5 h-3.5" />{addLabel}
      </button>
    </div>
  );
}

const SECTIONS = [
  { id: 'design', label: 'Design & Couleurs', icon: <Palette className="w-3.5 h-3.5" />, color: '#6366f1' },
  { id: 'hero', label: 'Hero', icon: <Zap className="w-3.5 h-3.5" />, color: '#0F766E' },
  { id: 'accordions', label: 'Barres depliables', icon: <ChevronDown className="w-3.5 h-3.5" />, color: '#0891b2' },
  { id: 'testimonials', label: 'Temoignages', icon: <MessageSquare className="w-3.5 h-3.5" />, color: '#ec4899' },
  { id: 'problem', label: 'Probleme', icon: <Type className="w-3.5 h-3.5" />, color: '#ef4444' },
  { id: 'mechanism', label: 'Mecanisme', icon: <Layers className="w-3.5 h-3.5" />, color: '#8b5cf6' },
  { id: 'science', label: 'Science / Ingredients', icon: <Award className="w-3.5 h-3.5" />, color: '#10b981' },
  { id: 'ritual', label: 'Rituel', icon: <Clock className="w-3.5 h-3.5" />, color: '#f59e0b' },
  { id: 'comparison', label: 'Comparaison', icon: <BarChart3 className="w-3.5 h-3.5" />, color: '#3b82f6' },
  { id: 'faq', label: 'FAQ', icon: <HelpCircle className="w-3.5 h-3.5" />, color: '#f97316' },
  { id: 'closing', label: 'Closing', icon: <ShoppingBag className="w-3.5 h-3.5" />, color: '#1f2937' },
];

const PremiumPageBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { activeStore } = useStore();
  const iframeRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [product, setProduct] = useState(null);
  const [config, setConfig] = useState(null);
  const [activeSection, setActiveSection] = useState('hero');
  const [device, setDevice] = useState('desktop');

  useEffect(() => {
    (async () => {
      try {
        const res = await storeProductsApi.getProduct(id);
        const p = res.data?.data;
        if (p) {
          setProduct(p);
          setConfig(p.productPageConfig || {});
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const safeConfig = config || {};
  const premium = safeConfig.premiumPage || product?._pageData?.premium_page || product?._pageData?.premiumPage || {};
  const design = safeConfig.design || {};
  const accent = design.ctaButtonColor || design.buttonColor || '#0F766E';

  const setPremiumNested = useCallback((section, key, value) => {
    setConfig((prev) => {
      const p = prev || {};
      return {
        ...p,
        premiumPage: {
          ...(p.premiumPage || {}),
          [section]: { ...(p.premiumPage?.[section] || {}), [key]: value },
        },
      };
    });
  }, []);

  const setDesign = useCallback((key, value) => {
    setConfig((prev) => {
      const p = prev || {};
      return { ...p, design: { ...(p.design || {}), [key]: value } };
    });
  }, []);

  const setPremiumDirect = useCallback((key, value) => {
    setConfig((prev) => {
      const p = prev || {};
      return { ...p, premiumPage: { ...(p.premiumPage || {}), [key]: value } };
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await storeProductsApi.updateProduct(id, { productPageConfig: config });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
    } catch {
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Produit introuvable</p>
      </div>
    );
  }

  const subdomain = activeStore?.subdomain || '';
  const previewUrl = subdomain ? `/store/${subdomain}/product/${product.slug || id}` : null;

  const iframeContainerCls = device === 'mobile' ? 'w-[390px] mx-auto' : 'w-full';

  const renderEditor = () => {
    switch (activeSection) {
      case 'design':
        return (
          <div className="space-y-4">
            <Field label="Nom de marque (header)">
              <input type="text" value={premium.brandName || ''} onChange={(e) => setPremiumDirect('brandName', e.target.value)} className={inputCls} placeholder="Ma Marque" />
            </Field>
            <Field label="Couleur accent (boutons, checks)">
              <div className="flex items-center gap-2">
                <input type="color" value={accent} onChange={(e) => { setDesign('ctaButtonColor', e.target.value); setDesign('buttonColor', e.target.value); }} className="w-10 h-10 rounded-lg border border-gray-200 p-0.5 cursor-pointer" />
                <input type="text" value={accent} onChange={(e) => { setDesign('ctaButtonColor', e.target.value); setDesign('buttonColor', e.target.value); }} className={inputCls} />
              </div>
            </Field>
            <Field label="Couleur de fond">
              <div className="flex items-center gap-2">
                <input type="color" value={design.backgroundColor || '#F6FBFA'} onChange={(e) => setDesign('backgroundColor', e.target.value)} className="w-10 h-10 rounded-lg border border-gray-200 p-0.5 cursor-pointer" />
                <input type="text" value={design.backgroundColor || '#F6FBFA'} onChange={(e) => setDesign('backgroundColor', e.target.value)} className={inputCls} />
              </div>
            </Field>
            <Field label="Couleur du texte">
              <div className="flex items-center gap-2">
                <input type="color" value={design.textColor || '#171717'} onChange={(e) => setDesign('textColor', e.target.value)} className="w-10 h-10 rounded-lg border border-gray-200 p-0.5 cursor-pointer" />
                <input type="text" value={design.textColor || '#171717'} onChange={(e) => setDesign('textColor', e.target.value)} className={inputCls} />
              </div>
            </Field>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-2">Note / Avis</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Score"><input type="text" value={premium.rating?.score || ''} onChange={(e) => setPremiumNested('rating', 'score', e.target.value)} className={inputCls} placeholder="4,9/5" /></Field>
              <Field label="Nombre"><input type="text" value={premium.rating?.count || ''} onChange={(e) => setPremiumNested('rating', 'count', e.target.value)} className={inputCls} placeholder="+1 000" /></Field>
            </div>
            <Field label="Label avis"><input type="text" value={premium.rating?.label || ''} onChange={(e) => setPremiumNested('rating', 'label', e.target.value)} className={inputCls} placeholder="clients satisfaits" /></Field>
          </div>
        );
      case 'hero':
        return (
          <div className="space-y-4">
            <Field label="Badge (seal)"><input type="text" value={premium.hero?.eyebrow || ''} onChange={(e) => setPremiumNested('hero', 'eyebrow', e.target.value)} className={inputCls} placeholder="Offre limitee" /></Field>
            <Field label="Titre principal"><input type="text" value={premium.hero?.headline || ''} onChange={(e) => setPremiumNested('hero', 'headline', e.target.value)} className={inputCls} /></Field>
            <Field label="Sous-titre"><textarea value={premium.hero?.subheadline || ''} onChange={(e) => setPremiumNested('hero', 'subheadline', e.target.value)} rows={2} className={textareaCls} /></Field>
            <Field label="Prix affiche"><input type="text" value={premium.hero?.priceLabel || ''} onChange={(e) => setPremiumNested('hero', 'priceLabel', e.target.value)} className={inputCls} placeholder="15 000 FCFA" /></Field>
            <Field label="Texte bouton CTA"><input type="text" value={premium.hero?.ctaLabel || ''} onChange={(e) => setPremiumNested('hero', 'ctaLabel', e.target.value)} className={inputCls} placeholder="Commander" /></Field>
            <Field label="Benefices (un par ligne)"><textarea value={(premium.hero?.benefits || []).join('\n')} onChange={(e) => setPremiumNested('hero', 'benefits', e.target.value.split('\n').filter(l => l.trim()))} rows={4} className={textareaCls} /></Field>
            <Field label="Reassurance (un par ligne)"><textarea value={(premium.hero?.reassurance || []).join('\n')} onChange={(e) => setPremiumNested('hero', 'reassurance', e.target.value.split('\n').filter(l => l.trim()))} rows={3} className={textareaCls} /></Field>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-2">Offre speciale</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!premium.hero?.showOffer} onChange={(e) => setPremiumNested('hero', 'showOffer', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
              <span className="text-sm text-gray-700 font-medium">Afficher la section offre</span>
            </label>
            {premium.hero?.showOffer && (
              <div className="space-y-3 pl-3 border-l-2 border-indigo-200">
                <Field label="Titre offre"><input type="text" value={premium.hero?.offerTitle || ''} onChange={(e) => setPremiumNested('hero', 'offerTitle', e.target.value)} className={inputCls} placeholder="OFFRE SPECIALE" /></Field>
                <Field label="Label countdown"><input type="text" value={premium.hero?.countdownLabel || ''} onChange={(e) => setPremiumNested('hero', 'countdownLabel', e.target.value)} className={inputCls} placeholder="L'offre expire bientot" /></Field>
                <Field label="Titre carte offre"><input type="text" value={premium.hero?.offerCards?.[0]?.title || ''} onChange={(e) => setPremiumNested('hero', 'offerCards', [{ ...(premium.hero?.offerCards?.[0] || {}), title: e.target.value }])} className={inputCls} placeholder="1 + 1 OFFERT" /></Field>
                <Field label="Badge carte"><input type="text" value={premium.hero?.offerCards?.[0]?.badge || ''} onChange={(e) => setPremiumNested('hero', 'offerCards', [{ ...(premium.hero?.offerCards?.[0] || {}), badge: e.target.value }])} className={inputCls} placeholder="Economisez" /></Field>
                <Field label="Ancien prix"><input type="text" value={premium.hero?.offerCards?.[0]?.oldPrice || ''} onChange={(e) => setPremiumNested('hero', 'offerCards', [{ ...(premium.hero?.offerCards?.[0] || {}), oldPrice: e.target.value }])} className={inputCls} placeholder="220 000 FCFA" /></Field>
              </div>
            )}
          </div>
        );
      case 'accordions':
        return (
          <RepeatableItems
            items={premium.hero?.accordions || []}
            onChange={(items) => setPremiumNested('hero', 'accordions', items)}
            addLabel="Ajouter une barre"
            fields={[
              { key: 'title', label: 'Titre', placeholder: 'Comment ca marche ?' },
              { key: 'content', label: 'Contenu', type: 'textarea', rows: 3, placeholder: 'Explication...' },
            ]}
          />
        );
      case 'testimonials':
        return (
          <div className="space-y-4">
            <Field label="Titre"><input type="text" value={premium.testimonialGallery?.headline || ''} onChange={(e) => setPremiumNested('testimonialGallery', 'headline', e.target.value)} className={inputCls} /></Field>
            <Field label="Sous-titre"><input type="text" value={premium.testimonialGallery?.subheadline || ''} onChange={(e) => setPremiumNested('testimonialGallery', 'subheadline', e.target.value)} className={inputCls} /></Field>
            <RepeatableItems
              items={premium.testimonialGallery?.items || []}
              onChange={(items) => setPremiumNested('testimonialGallery', 'items', items)}
              addLabel="Ajouter un temoignage"
              fields={[
                { key: 'name', label: 'Nom', placeholder: 'Marie K.' },
                { key: 'text', label: 'Avis', type: 'textarea', rows: 2 },
                { key: 'tags', label: 'Tags (virgule)', placeholder: 'Resultat rapide, Verifie' },
              ]}
            />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-2">Bande de preuves (authority strip)</p>
            <RepeatableItems
              items={premium.authorityStrip || []}
              onChange={(items) => setPremiumDirect('authorityStrip', items)}
              addLabel="Ajouter"
              fields={[
                { key: 'label', label: 'Chiffre/Label', placeholder: 'Clients verifies' },
                { key: 'quote', label: 'Citation', placeholder: 'Une solution efficace...' },
              ]}
            />
          </div>
        );
      case 'problem':
        return (
          <div className="space-y-4">
            <Field label="Titre"><input type="text" value={premium.problemSection?.headline || ''} onChange={(e) => setPremiumNested('problemSection', 'headline', e.target.value)} className={inputCls} /></Field>
            <Field label="Points de douleur (un par ligne)"><textarea value={(premium.problemSection?.bullets || []).join('\n')} onChange={(e) => setPremiumNested('problemSection', 'bullets', e.target.value.split('\n').filter(l => l.trim()))} rows={5} className={textareaCls} /></Field>
          </div>
        );
      case 'mechanism':
        return (
          <div className="space-y-4">
            <Field label="Titre"><input type="text" value={premium.mechanismSection?.headline || ''} onChange={(e) => setPremiumNested('mechanismSection', 'headline', e.target.value)} className={inputCls} /></Field>
            <Field label="Texte explicatif"><textarea value={premium.mechanismSection?.body || ''} onChange={(e) => setPremiumNested('mechanismSection', 'body', e.target.value)} rows={6} className={textareaCls} /></Field>
          </div>
        );
      case 'science':
        return (
          <div className="space-y-4">
            <Field label="Titre"><input type="text" value={premium.scienceSection?.headline || ''} onChange={(e) => setPremiumNested('scienceSection', 'headline', e.target.value)} className={inputCls} /></Field>
            <Field label="Sous-titre"><input type="text" value={premium.scienceSection?.subheadline || ''} onChange={(e) => setPremiumNested('scienceSection', 'subheadline', e.target.value)} className={inputCls} /></Field>
            <RepeatableItems
              items={premium.scienceSection?.items || []}
              onChange={(items) => setPremiumNested('scienceSection', 'items', items)}
              addLabel="Ajouter un ingredient / point cle"
              fields={[
                { key: 'name', label: 'Nom', placeholder: 'Chlorophylle' },
                { key: 'description', label: 'Role / Description', type: 'textarea', rows: 2 },
              ]}
            />
          </div>
        );
      case 'ritual':
        return (
          <div className="space-y-4">
            <Field label="Titre"><input type="text" value={premium.ritualSection?.headline || ''} onChange={(e) => setPremiumNested('ritualSection', 'headline', e.target.value)} className={inputCls} /></Field>
            <Field label="Sous-titre"><input type="text" value={premium.ritualSection?.subheadline || ''} onChange={(e) => setPremiumNested('ritualSection', 'subheadline', e.target.value)} className={inputCls} /></Field>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Etapes du rituel</p>
            <RepeatableItems
              items={premium.ritualSection?.steps || []}
              onChange={(items) => setPremiumNested('ritualSection', 'steps', items)}
              addLabel="Ajouter une etape"
              fields={[
                { key: 'label', label: 'Label', placeholder: 'Etape 1' },
                { key: 'title', label: 'Titre', placeholder: 'Prenez un comprime' },
                { key: 'description', label: 'Detail', type: 'textarea', rows: 2 },
              ]}
            />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-2">Timeline des resultats</p>
            <RepeatableItems
              items={premium.ritualSection?.resultsTimeline || []}
              onChange={(items) => setPremiumNested('ritualSection', 'resultsTimeline', items)}
              addLabel="Ajouter un point"
              fields={[
                { key: 'label', label: 'Periode', placeholder: 'Jour 7' },
                { key: 'description', label: 'Resultat observe', type: 'textarea', rows: 2 },
              ]}
            />
          </div>
        );
      case 'comparison':
        return (
          <div className="space-y-4">
            <Field label="Titre section"><input type="text" value={premium.comparisonSection?.headline || ''} onChange={(e) => setPremiumNested('comparisonSection', 'headline', e.target.value)} className={inputCls} placeholder="Comparaison" /></Field>
            <Field label="Colonnes (separees par virgule)"><input type="text" value={(premium.comparisonSection?.columns || []).join(', ')} onChange={(e) => setPremiumNested('comparisonSection', 'columns', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className={inputCls} placeholder="Mon produit, Alternative 1, Alternative 2" /></Field>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Criteres</p>
            {(premium.comparisonSection?.rows || []).map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" value={row.label || ''} onChange={(e) => {
                  const rows = [...(premium.comparisonSection?.rows || [])];
                  rows[i] = { ...rows[i], label: e.target.value };
                  setPremiumNested('comparisonSection', 'rows', rows);
                }} className={`flex-1 ${inputCls}`} />
                <button type="button" onClick={() => setPremiumNested('comparisonSection', 'rows', (premium.comparisonSection?.rows || []).filter((_, idx) => idx !== i))} className="p-1.5 text-red-400 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button type="button" onClick={() => setPremiumNested('comparisonSection', 'rows', [...(premium.comparisonSection?.rows || []), { label: '', values: [true, false, false] }])} className="text-sm text-indigo-600 font-medium flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Ajouter un critere</button>
          </div>
        );
      case 'faq':
        return (
          <div className="space-y-4">
            <Field label="Titre"><input type="text" value={premium.faq?.headline || ''} onChange={(e) => setPremiumNested('faq', 'headline', e.target.value)} className={inputCls} placeholder="Questions frequentes" /></Field>
            <Field label="Sous-titre"><input type="text" value={premium.faq?.subheadline || ''} onChange={(e) => setPremiumNested('faq', 'subheadline', e.target.value)} className={inputCls} /></Field>
            <RepeatableItems
              items={premium.faq?.items || []}
              onChange={(items) => setPremiumNested('faq', 'items', items)}
              addLabel="Ajouter une question"
              fields={[
                { key: 'question', label: 'Question', placeholder: 'Comment utiliser le produit ?' },
                { key: 'answer', label: 'Reponse', type: 'textarea', rows: 3 },
              ]}
            />
          </div>
        );
      case 'closing':
        return (
          <div className="space-y-4">
            <Field label="Titre"><input type="text" value={premium.closingSection?.headline || ''} onChange={(e) => setPremiumNested('closingSection', 'headline', e.target.value)} className={inputCls} /></Field>
            <Field label="Sous-titre"><input type="text" value={premium.closingSection?.subheadline || ''} onChange={(e) => setPremiumNested('closingSection', 'subheadline', e.target.value)} className={inputCls} /></Field>
            <Field label="Points cles (un par ligne)"><textarea value={(premium.closingSection?.bullets || []).join('\n')} onChange={(e) => setPremiumNested('closingSection', 'bullets', e.target.value.split('\n').filter(l => l.trim()))} rows={4} className={textareaCls} /></Field>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">

      {/* Top bar */}
      <header className="flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200 flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition font-semibold">
            <ArrowLeft className="w-4 h-4" />Retour
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Star className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-sm font-bold text-gray-900">Premium Builder</h1>
          </div>
          <span className="text-xs text-gray-500 truncate max-w-[180px] hidden sm:inline">{product.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {[
              { id: 'desktop', icon: <Monitor className="w-3.5 h-3.5" /> },
              { id: 'mobile', icon: <Smartphone className="w-3.5 h-3.5" /> },
            ].map(({ id: did, icon }) => (
              <button key={did} onClick={() => setDevice(did)} className={`p-2 rounded-md transition ${device === did ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{icon}</button>
            ))}
          </div>
          <div className="w-px h-5 bg-gray-200" />
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition" title="Ouvrir">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button onClick={handleSave} disabled={saving} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg transition shadow-sm ${saved ? 'bg-green-500' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-50`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Publie !' : 'Publier'}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: vertical section list with inline editors */}
        <div className="w-80 xl:w-[420px] bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">Sections</p>
            <span className="text-[11px] text-gray-400">{SECTIONS.length} sections</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {SECTIONS.map((s) => (
              <div key={s.id}>
                <button
                  onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${activeSection === s.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50 border border-transparent'}`}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ background: s.color }}>
                    {s.icon}
                  </div>
                  <span className="text-sm font-semibold text-gray-900 flex-1">{s.label}</span>
                  {activeSection === s.id ? <ChevronUp className="w-4 h-4 text-indigo-500" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
                </button>
                {activeSection === s.id && (
                  <div className="mt-2 mb-3 ml-3 pl-4 border-l-2 border-indigo-200 space-y-3">
                    {renderEditor()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: live iframe preview */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <div className={`${iframeContainerCls} h-full flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300`}>
            {/* Browser chrome */}
            <div className="h-9 bg-gray-50 border-b border-gray-200 flex items-center px-3 gap-2 flex-shrink-0">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white border border-gray-100 rounded px-2 py-0.5 text-[11px] text-gray-400 font-mono truncate">
                {previewUrl || 'Apercu'}
              </div>
              <span className="text-[10px] text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">Premium</span>
            </div>

            {previewUrl ? (
              <iframe
                ref={iframeRef}
                src={previewUrl}
                className="w-full border-0 flex-1"
                title="Apercu premium"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Aucun apercu disponible
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PremiumPageBuilder;
