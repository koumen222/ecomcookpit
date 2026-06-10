import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Eye, FileText, Loader2, RefreshCw, Sparkles, X, BookOpen, Pen, Palette, Cpu, Package, ToggleLeft, ToggleRight } from 'lucide-react';

const GOALS = [
  { value: 'guide_utilisation', label: "Guide d'utilisation" },
  { value: 'routine', label: "Routine / plan d'action" },
  { value: 'erreurs', label: "Erreurs à éviter" },
  { value: 'conseils', label: 'Conseils pratiques' },
  { value: 'rassurance', label: 'Rassurer avant achat' },
];

const COLOR_PRESETS = [
  { name: 'Émeraude', value: '#0F766E' },
  { name: 'Violet',   value: '#7C3AED' },
  { name: 'Bleu',     value: '#1D4ED8' },
  { name: 'Orange',   value: '#EA580C' },
  { name: 'Rose',     value: '#DB2777' },
  { name: 'Or',       value: '#B45309' },
  { name: 'Ardoise',  value: '#334155' },
  { name: 'Rouge',    value: '#DC2626' },
];

const COVER_STYLES = [
  { value: 'light',    label: 'Classique',  desc: 'Bande colorée en haut, fond blanc' },
  { value: 'dark',     label: 'Sombre',     desc: 'Fond noir, accents colorés' },
  { value: 'vibrant',  label: 'Coloré',     desc: 'Couverture pleine couleur' },
];

const GENERATION_STEPS = [
  { icon: Cpu,      label: "Analyse du produit par l'IA",  duration: 8000 },
  { icon: Pen,      label: 'Rédaction des chapitres',       duration: 20000 },
  { icon: BookOpen, label: 'Structuration du contenu',      duration: 15000 },
  { icon: Palette,  label: 'Mise en page et design PDF',    duration: 12000 },
  { icon: Package,  label: 'Finalisation et export',        duration: 8000 },
];

const initialForm = {
  theme: '',
  goal: 'guide_utilisation',
  audience: '',
  problem: '',
  offerAngle: '',
  chapterCount: '10',
  accentColor: '#0F766E',
  coverStyle: 'light',
  addAsOffer: true,
};

/* ── Loading screen ──────────────────────────────────────────────────────── */
const GeneratingScreen = ({ productName }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let elapsed = 0;
    const total = GENERATION_STEPS.reduce((s, st) => s + st.duration, 0);
    const id = setInterval(() => {
      elapsed += 200;
      setProgress(Math.min(95, (elapsed / total) * 100));
      let acc = 0;
      for (let i = 0; i < GENERATION_STEPS.length; i++) {
        acc += GENERATION_STEPS[i].duration;
        if (elapsed < acc) { setStepIndex(i); break; }
      }
      if (elapsed >= total) clearInterval(id);
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-6 py-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
            <Sparkles className="h-8 w-8 text-white animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-white">Génération de l'ebook en cours</h2>
          <p className="mt-1 text-sm text-emerald-100 font-medium">{productName}</p>
        </div>
        <div className="px-6 py-6">
          <div className="mb-6">
            <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
              <span>Progression</span><span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="space-y-3">
            {GENERATION_STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isDone = i < stepIndex;
              const isActive = i === stepIndex;
              return (
                <div key={i} className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${isActive ? 'bg-emerald-50 border border-emerald-200' : isDone ? 'bg-slate-50 opacity-60' : 'opacity-30'}`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isDone ? 'bg-emerald-100 text-emerald-600' : isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <StepIcon className="h-4 w-4" />}
                  </div>
                  <span className={`text-sm font-semibold ${isActive ? 'text-emerald-900' : isDone ? 'text-slate-500' : 'text-slate-400'}`}>{step.label}</span>
                  {isActive && <span className="ml-auto text-xs font-bold text-emerald-500 animate-pulse">En cours…</span>}
                  {isDone && <span className="ml-auto text-xs font-bold text-emerald-400">✓</span>}
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-center text-xs text-slate-400 font-medium">La génération peut prendre 1 à 3 minutes. Ne fermez pas cette fenêtre.</p>
        </div>
      </div>
    </div>
  );
};

/* ── Main modal ──────────────────────────────────────────────────────────── */
const DigitalProductEbookModal = ({ open, productName = '', existingEbook = null, loading = false, error = '', generatedResult = null, onClose, onGenerate, onRegenerate }) => {
  const [form, setForm] = useState(initialForm);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!open) { setShowPreview(false); return; }
    const existingColor = existingEbook?.cover?.color_palette?.[0] || '#0F766E';
    setForm({
      ...initialForm,
      theme: existingEbook?.title || '',
      audience: existingEbook?.target_reader || '',
      offerAngle: existingEbook?.main_promise || '',
      accentColor: existingColor,
      coverStyle: existingEbook?.cover?.cover_style || 'light',
    });
  }, [existingEbook, open]);

  useEffect(() => { if (generatedResult) setShowPreview(true); }, [generatedResult]);

  const title = useMemo(() => existingEbook ? 'Régénérer le produit digital' : 'Créer le produit digital', [existingEbook]);

  if (!open) return null;
  if (loading) return <GeneratingScreen productName={productName} />;

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e) => {
    e?.preventDefault();
    onGenerate?.({
      theme: form.theme.trim(),
      goal: form.goal,
      audience: form.audience.trim(),
      problem: form.problem.trim(),
      offerAngle: form.offerAngle.trim(),
      chapterCount: Number(form.chapterCount) || 10,
      accentColor: form.accentColor,
      coverStyle: form.coverStyle,
      addAsOffer: form.addAsOffer !== false,
    });
  };

  /* Preview screen */
  const pdfUrl = generatedResult?.pdf?.url || generatedResult?.ebook?.pdf?.url || null;
  const ebookTitle = String(generatedResult?.ebook?.title || generatedResult?.title || '');
  const ebookChapters = Array.isArray(generatedResult?.ebook?.chapters) ? generatedResult.ebook.chapters : [];

  if (showPreview && generatedResult) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
        <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-950">Ebook généré avec succès</h2>
                <p className="mt-1 text-sm text-slate-500">{ebookTitle || productName}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"><X className="h-4 w-4" /></button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Eye className="h-4 w-4 text-emerald-600" />Aperçu du PDF</h3>
                {pdfUrl ? (
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner">
                    <iframe src={pdfUrl} title="Aperçu ebook PDF" className="h-full w-full" style={{ border: 'none' }} />
                  </div>
                ) : (
                  <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
                    <p className="text-sm text-slate-400">Aperçu non disponible</p>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><FileText className="h-4 w-4 text-emerald-600" />Contenu</h3>
                {ebookTitle && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Titre</p>
                    <p className="mt-1 text-sm font-bold text-emerald-900">{ebookTitle}</p>
                  </div>
                )}
                {ebookChapters.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Chapitres ({ebookChapters.length})</p>
                    <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                      {ebookChapters.map((ch, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{i + 1}</span>
                          <span className="font-medium">{String(ch?.chapter_title || ch?.title || ch || '')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {generatedResult?.digitalProduct?.offer && (
                  <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-violet-600">Offre bonus activée</p>
                    <p className="mt-1 text-sm font-semibold text-violet-800">{generatedResult.digitalProduct.offer.label || 'Ebook offert avec la commande'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-between">
            <button type="button" onClick={() => { setShowPreview(false); onRegenerate?.(); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" />Régénérer
            </button>
            <div className="flex gap-3">
              {pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100">
                  <Download className="h-4 w-4" />Télécharger
                </a>
              )}
              <button type="button" onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800">
                <CheckCircle2 className="h-4 w-4" />Terminé
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* Configuration form */
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-950">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">{productName ? `Produit : ${productName}` : 'Configure ton ebook bonus'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* ── Section 1 : Contenu ── */}
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Contenu</p>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Thème / titre de l'ebook</label>
                <input type="text" value={form.theme} onChange={(e) => update('theme', e.target.value)} placeholder="Ex: Guide complet pour bien utiliser ce produit" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Objectif</label>
                  <select value={form.goal} onChange={(e) => update('goal', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50">
                    {GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Nombre de chapitres</label>
                  <select value={form.chapterCount} onChange={(e) => update('chapterCount', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50">
                    {[5,6,7,8,9,10,11,12].map((n) => <option key={n} value={String(n)}>{n} chapitres</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Audience cible</label>
                <input type="text" value={form.audience} onChange={(e) => update('audience', e.target.value)} placeholder="Ex: femmes actives, sportifs, débutants..." className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Problème principal à résoudre</label>
                <input type="text" value={form.problem} onChange={(e) => update('problem', e.target.value)} placeholder="Ex: ne pas savoir comment utiliser ou entretenir le produit" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50" />
              </div>
            </div>
          </div>

          {/* ── Section 2 : Design ── */}
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Design</p>
            <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
              {/* Color */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Couleur principale</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.name}
                      onClick={() => update('accentColor', c.value)}
                      style={{ background: c.value }}
                      className={`h-8 w-8 rounded-full transition-all ${form.accentColor === c.value ? 'ring-2 ring-offset-2 ring-slate-700 scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'}`}
                    />
                  ))}
                  {/* Custom color */}
                  <label title="Couleur personnalisée" className="relative h-8 w-8 cursor-pointer rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center hover:border-slate-500 transition overflow-hidden">
                    <span className="text-slate-400 text-xs font-bold">+</span>
                    <input type="color" value={form.accentColor} onChange={(e) => update('accentColor', e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  </label>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full border border-slate-200" style={{ background: form.accentColor }} />
                  <span className="text-xs font-mono text-slate-500">{form.accentColor}</span>
                </div>
              </div>

              {/* Cover style */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Style de couverture</label>
                <div className="grid grid-cols-3 gap-2">
                  {COVER_STYLES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => update('coverStyle', s.value)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition ${form.coverStyle === s.value ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      {/* Mini preview */}
                      <div className="h-10 w-full rounded-lg overflow-hidden border border-slate-200"
                        style={
                          s.value === 'dark' ? { background: '#0d1117' } :
                          s.value === 'vibrant' ? { background: form.accentColor } :
                          { background: `linear-gradient(180deg, ${form.accentColor} 35%, #fff 35%)` }
                        }
                      />
                      <span className={`text-xs font-bold ${form.coverStyle === s.value ? 'text-emerald-800' : 'text-slate-600'}`}>{s.label}</span>
                      <span className="text-xs text-slate-400 leading-tight">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3 : Offre ── */}
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Offre commerciale</p>
            <button
              type="button"
              onClick={() => update('addAsOffer', !form.addAsOffer)}
              className={`w-full flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition ${form.addAsOffer ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <div className="text-left">
                <p className={`text-sm font-black ${form.addAsOffer ? 'text-emerald-900' : 'text-slate-700'}`}>Activer l'offre bonus</p>
                <p className={`mt-0.5 text-xs font-semibold ${form.addAsOffer ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {form.addAsOffer ? 'L\'ebook sera affiché comme offre "1 unité + PDF offert" sur la fiche produit' : 'L\'ebook sera généré mais pas proposé comme offre'}
                </p>
              </div>
              {form.addAsOffer
                ? <ToggleRight className="h-7 w-7 shrink-0 text-emerald-600" />
                : <ToggleLeft className="h-7 w-7 shrink-0 text-slate-400" />
              }
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>
          )}
        </form>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            Annuler
          </button>
          <button type="button" onClick={handleSubmit} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800">
            <Sparkles className="h-4 w-4" />
            Générer le PDF ebook
          </button>
        </div>
      </div>
    </div>
  );
};

export default DigitalProductEbookModal;
