import React, { useState, useRef, useMemo } from 'react';
import { Upload, Loader2, X, Check, GripVertical, Sparkles, ImagePlus, AlertTriangle } from 'lucide-react';

const API_ORIGIN = (() => {
  const raw = String(import.meta.env.VITE_BACKEND_URL || '').trim();
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('scalor.net')) {
    return 'https://api.scalor.net';
  }
  if (raw && /^https?:\/\//i.test(raw)) {
    try { return new URL(raw).origin; } catch { /* fallthrough */ }
  }
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://api.scalor.net';
})();

const SLIDE_CATALOG = [
  { id: 'hook', label: 'Hook / Problème', desc: 'Accroche qui stoppe le scroll en nommant la douleur' },
  { id: 'benefits', label: 'Bénéfices', desc: 'Ce que le produit apporte, en un coup d\'œil' },
  { id: 'avant_apres', label: 'Avant / Après', desc: 'Transformation split-screen' },
  { id: 'testimonials', label: 'Avis clients', desc: 'Cartes d\'avis carrées et témoignages visibles' },
  { id: 'reassurance', label: 'Réassurance / Confiance', desc: 'Preuves, garanties et éléments qui rassurent' },
  { id: 'how_to_use', label: 'Comment utiliser', desc: 'Démonstration simple d\'usage' },
  { id: 'cta_final', label: 'CTA final', desc: 'Slide de clôture qui pousse à commander' },
];

const DEFAULT_FORM = {
  headline: 'Remplissez le formulaire, on vous appelle pour valider votre commande',
  ctaLabel: 'CLIQUE POUR CONFIRMER TA COMMANDE',
  stickyLabel: 'COMMANDEZ',
  reassurance: 'Livraison gratuite et paiement après réception',
  placeholders: {
    fullname: 'Saisir votre nom complet',
    phone: 'Saisir un numero joignable',
    address: 'Saisir votre adresse',
    city: 'Saisir votre ville',
  },
};

const InfographicsGeneratorPanel = ({ onGenerated, onCancel }) => {
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [painPoint, setPainPoint] = useState('');
  const [mainBenefit, setMainBenefit] = useState('');
  const [bodyZone, setBodyZone] = useState('');
  const [selectedSlides, setSelectedSlides] = useState(['hook', 'benefits', 'avant_apres', 'testimonials', 'reassurance', 'how_to_use', 'cta_final']);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef(null);

  const onPickPhoto = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Le fichier doit être une image.');
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError('');
  };

  const toggleSlide = (id) => {
    setSelectedSlides((prev) => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));
  };

  const moveSlide = (index, dir) => {
    setSelectedSlides((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const canGenerate = useMemo(() => photo && productName.trim().length >= 2 && selectedSlides.length > 0 && !loading, [photo, productName, selectedSlides, loading]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setError('');
    setLoading(true);
    setProgress(`Génération de ${selectedSlides.length} infographies 9:16 en cours...`);

    const token = localStorage.getItem('ecomToken');
    const wsId = localStorage.getItem('ecomWorkspaceId') || '';

    const fd = new FormData();
    fd.append('image', photo);
    fd.append('slideTypes', JSON.stringify(selectedSlides));
    fd.append('productName', productName.trim());
    fd.append('productDescription', productDescription.trim());
    fd.append('targetAudience', targetAudience.trim());
    fd.append('painPoint', painPoint.trim());
    fd.append('mainBenefit', mainBenefit.trim());
    fd.append('bodyZone', bodyZone.trim());
    fd.append('formHeadline', form.headline);
    fd.append('formCtaLabel', form.ctaLabel);
    fd.append('formStickyLabel', form.stickyLabel);
    fd.append('formReassurance', form.reassurance);
    fd.append('phFullname', form.placeholders.fullname);
    fd.append('phPhone', form.placeholders.phone);
    fd.append('phAddress', form.placeholders.address);
    fd.append('phCity', form.placeholders.city);

    try {
      const resp = await fetch(`${API_ORIGIN}/api/ai/product-generator/infographics`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(wsId ? { 'X-Workspace-Id': wsId } : {}),
        },
        body: fd,
      });
      if (!resp.ok) {
        let msg = `Erreur HTTP ${resp.status}`;
        try { const j = await resp.json(); msg = j.message || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || 'Génération échouée');
      onGenerated?.({
        layout: 'infographics',
        theme: 'infographics',
        infographics: data.infographics || [],
        form: data.form || form,
        failed: data.failed || [],
        productName: productName.trim(),
        productDescription: productDescription.trim(),
      });
    } catch (err) {
      setError(err.message || 'Erreur pendant la génération');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-blue-900">Mode Infographies 9:16</p>
            <p className="text-xs text-blue-800 mt-1">Génère une suite d'infographies verticales mobile-first. La page produit publique affichera uniquement ces visuels empilés + un formulaire de commande minimal.</p>
          </div>
        </div>
      </div>

      {/* Photo du produit */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <label className="text-sm font-bold text-gray-900 mb-1 block">Photo du produit <span className="text-red-500">*</span></label>
        <p className="text-xs text-gray-500 mb-3">Le même packaging apparaîtra dans chaque infographie (image-to-image).</p>
        {photoPreview ? (
          <div className="relative inline-block">
            <img src={photoPreview} alt="Produit" className="h-40 w-40 object-cover rounded-xl border border-gray-200" />
            <button
              type="button"
              onClick={() => { setPhoto(null); setPhotoPreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white p-1 shadow"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 w-full h-32 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition text-gray-600"
          >
            <ImagePlus className="h-5 w-5" />
            <span className="text-sm font-semibold">Uploader la photo produit</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPickPhoto(e.target.files?.[0])}
        />
      </div>

      {/* Infos produit */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <label className="text-sm font-bold text-gray-900 block">Informations produit</label>
        <div>
          <label className="text-xs font-semibold text-gray-700 mb-1 block">Nom du produit <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="ex: GlucoControl"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700 mb-1 block">Description courte</label>
          <textarea
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            rows={2}
            placeholder="ex: Solution naturelle pour réguler la glycémie."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Cible</label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="ex: femmes africaines 35-55 ans"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Zone corporelle</label>
            <input
              type="text"
              value={bodyZone}
              onChange={(e) => setBodyZone(e.target.value)}
              placeholder="ex: visage, cheveux, ventre"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Problème principal</label>
            <input
              type="text"
              value={painPoint}
              onChange={(e) => setPainPoint(e.target.value)}
              placeholder="ex: pics de sucre, fatigue, fringales"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Bénéfice principal</label>
            <input
              type="text"
              value={mainBenefit}
              onChange={(e) => setMainBenefit(e.target.value)}
              placeholder="ex: Équilibrez votre glycémie, retrouvez votre vitalité"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Types de slides */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <label className="text-sm font-bold text-gray-900 mb-1 block">Types d'infographies ({selectedSlides.length})</label>
        <p className="text-xs text-gray-500 mb-3">Coche/décoche et réordonne. Chaque slide génère une image 9:16 dédiée.</p>

        <div className="space-y-2 mb-3">
          {selectedSlides.map((id, idx) => {
            const slide = SLIDE_CATALOG.find(s => s.id === id);
            if (!slide) return null;
            return (
              <div key={id} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                <GripVertical className="h-4 w-4 text-blue-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-blue-900">{idx + 1}. {slide.label}</p>
                  <p className="text-xs text-blue-700 truncate">{slide.desc}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveSlide(idx, -1)} disabled={idx === 0} className="rounded px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => moveSlide(idx, 1)} disabled={idx === selectedSlides.length - 1} className="rounded px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-30">↓</button>
                  <button type="button" onClick={() => toggleSlide(id)} className="rounded px-2 py-1 text-red-600 hover:bg-red-50"><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>

        {SLIDE_CATALOG.filter(s => !selectedSlides.includes(s.id)).length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Ajouter une slide</p>
            <div className="flex flex-wrap gap-2">
              {SLIDE_CATALOG.filter(s => !selectedSlides.includes(s.id)).map(slide => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => toggleSlide(slide.id)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-blue-400 hover:bg-blue-50"
                >
                  + {slide.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Textes du formulaire */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <label className="text-sm font-bold text-gray-900 block">Textes du formulaire de commande</label>
        <div>
          <label className="text-xs font-semibold text-gray-700 mb-1 block">Accroche</label>
          <textarea
            value={form.headline}
            onChange={(e) => setForm(f => ({ ...f, headline: e.target.value }))}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Bouton principal</label>
            <input
              type="text"
              value={form.ctaLabel}
              onChange={(e) => setForm(f => ({ ...f, ctaLabel: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Bouton sticky</label>
            <input
              type="text"
              value={form.stickyLabel}
              onChange={(e) => setForm(f => ({ ...f, stickyLabel: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700 mb-1 block">Ligne de réassurance</label>
          <input
            type="text"
            value={form.reassurance}
            onChange={(e) => setForm(f => ({ ...f, reassurance: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {['fullname', 'phone', 'address', 'city'].map((key) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-700 mb-1 block capitalize">Placeholder {key}</label>
              <input
                type="text"
                value={form.placeholders[key]}
                onChange={(e) => setForm(f => ({ ...f, placeholders: { ...f.placeholders, [key]: e.target.value } }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            Annuler
          </button>
        )}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> {progress || 'Génération...'}</>) : (<><Sparkles className="h-4 w-4" /> Générer {selectedSlides.length} infographies 9:16</>)}
        </button>
      </div>
    </div>
  );
};

export default InfographicsGeneratorPanel;
