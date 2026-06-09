import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Eye, FileText, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';

const GOALS = [
  { value: 'guide_utilisation', label: "Guide d'utilisation" },
  { value: 'routine', label: "Routine / plan d'action" },
  { value: 'erreurs', label: "Erreurs à éviter" },
  { value: 'conseils', label: 'Conseils pratiques' },
  { value: 'rassurance', label: 'Rassurer avant achat' },
];

const initialForm = {
  theme: '',
  goal: 'guide_utilisation',
  audience: '',
  problem: '',
  offerAngle: '',
  chapterCount: '5',
  addAsOffer: true,
};

const DigitalProductEbookModal = ({
  open,
  productName = '',
  existingEbook = null,
  loading = false,
  error = '',
  generatedResult = null,
  onClose,
  onGenerate,
  onRegenerate,
}) => {
  const [form, setForm] = useState(initialForm);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowPreview(false);
      return;
    }
    setForm({
      ...initialForm,
      theme: existingEbook?.title || '',
      audience: existingEbook?.target_reader || '',
      problem: '',
      offerAngle: existingEbook?.main_promise || '',
      addAsOffer: true,
    });
  }, [existingEbook, open]);

  useEffect(() => {
    if (generatedResult) setShowPreview(true);
  }, [generatedResult]);

  const title = useMemo(() => (
    existingEbook ? 'Régénérer le produit digital' : 'Créer le produit digital'
  ), [existingEbook]);

  if (!open) return null;

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onGenerate?.({
      theme: form.theme.trim(),
      goal: form.goal,
      audience: form.audience.trim(),
      problem: form.problem.trim(),
      offerAngle: form.offerAngle.trim(),
      chapterCount: Number(form.chapterCount) || 5,
      addAsOffer: form.addAsOffer !== false,
    });
  };

  const pdfUrl = generatedResult?.pdf?.url || generatedResult?.ebook?.pdf?.url || null;
  const ebookTitle = String(generatedResult?.ebook?.title || generatedResult?.title || '');
  const rawChapters = generatedResult?.ebook?.chapters || generatedResult?.chapters || [];
  const ebookChapters = Array.isArray(rawChapters) ? rawChapters : [];

  if (showPreview && generatedResult) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
        <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-950">Ebook généré avec succès</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {ebookTitle || productName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Preview content */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="grid gap-5 lg:grid-cols-2">
              {/* PDF Viewer */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-emerald-600" />
                  Aperçu du PDF
                </h3>
                {pdfUrl ? (
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner">
                    <iframe
                      src={pdfUrl}
                      title="Aperçu ebook PDF"
                      className="h-full w-full"
                      style={{ border: 'none' }}
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
                    <p className="text-sm text-slate-400">Aperçu non disponible</p>
                  </div>
                )}
              </div>

              {/* Ebook info */}
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  Contenu de l'ebook
                </h3>

                {ebookTitle && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Titre</p>
                    <p className="mt-1 text-sm font-bold text-emerald-900">{ebookTitle}</p>
                  </div>
                )}

                {ebookChapters.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                      Chapitres ({ebookChapters.length})
                    </p>
                    <ul className="space-y-1.5">
                      {ebookChapters.map((chapter, index) => {
                        const label = typeof chapter === 'string'
                          ? chapter
                          : (chapter?.chapter_title || chapter?.title || '');
                        return (
                          <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                              {index + 1}
                            </span>
                            <span className="font-medium">{String(label)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {generatedResult?.digitalProduct?.offer && (
                  <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-violet-600">Offre bonus</p>
                    <p className="mt-1 text-sm font-semibold text-violet-800">
                      {generatedResult.digitalProduct.offer.label || 'Ebook offert avec la commande'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => {
                setShowPreview(false);
                onRegenerate?.();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Régénérer
            </button>
            <div className="flex gap-3">
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <Download className="h-4 w-4" />
                  Télécharger
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800"
              >
                <CheckCircle2 className="h-4 w-4" />
                Terminé
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-950">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {productName ? `Produit : ${productName}` : 'Réponds aux questions pour guider la génération.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Quel thème ou titre veux-tu pour l'ebook ?
              </label>
              <input
                type="text"
                value={form.theme}
                onChange={(event) => update('theme', event.target.value)}
                placeholder="Ex: Guide complet pour bien utiliser ce produit"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Objectif principal
                </label>
                <select
                  value={form.goal}
                  onChange={(event) => update('goal', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                >
                  {GOALS.map((goal) => (
                    <option key={goal.value} value={goal.value}>{goal.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Nombre de chapitres
                </label>
                <select
                  value={form.chapterCount}
                  onChange={(event) => update('chapterCount', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                >
                  <option value="5">5 chapitres</option>
                  <option value="6">6 chapitres</option>
                  <option value="7">7 chapitres</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                À qui s'adresse cet ebook ?
              </label>
              <textarea
                value={form.audience}
                onChange={(event) => update('audience', event.target.value)}
                placeholder="Ex: femmes actives, mamans, sportifs, personnes qui découvrent le produit..."
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Quel problème doit-il résoudre ?
              </label>
              <textarea
                value={form.problem}
                onChange={(event) => update('problem', event.target.value)}
                placeholder="Ex: ne pas savoir comment choisir, utiliser ou entretenir le produit..."
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Quel angle de vente veux-tu mettre en avant ?
              </label>
              <textarea
                value={form.offerAngle}
                onChange={(event) => update('offerAngle', event.target.value)}
                placeholder="Ex: bonus offert avec la commande, valeur ajoutée, accompagnement après achat..."
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <input
                type="checkbox"
                checked={form.addAsOffer}
                onChange={(event) => update('addAsOffer', event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-500"
              />
              <span>
                <span className="block text-sm font-black text-emerald-950">Ajouter comme offre bonus</span>
                <span className="mt-0.5 block text-xs font-semibold leading-5 text-emerald-800">
                  Le PDF sera attaché au produit et affiché comme offre "1 unité + ebook PDF offert".
                </span>
              </span>
            </label>

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}
          </div>
        </form>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Générer le PDF ebook
          </button>
        </div>
      </div>
    </div>
  );
};

export default DigitalProductEbookModal;
