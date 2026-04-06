import React, { useState } from 'react';
import { Sparkles, Loader2, Star, Trash2, Plus, RefreshCw, Save, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { storeProductsApi } from '../services/storeApi.js';

/**
 * ReviewGenerator — Génère des avis clients authentiques via IA.
 * Les avis générés sont injectés dans les testimonials du StoreProduct.
 *
 * Props:
 *  - productDescription: string (description du produit)
 *  - existingTestimonials: array (témoignages existants)
 *  - onSave: (testimonials) => void (callback pour sauvegarder)
 */
const ReviewGenerator = ({ productDescription = '', existingTestimonials = [], onSave }) => {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [generatedReviews, setGeneratedReviews] = useState([]);
  const [selectedReviews, setSelectedReviews] = useState(new Set());

  // Config form
  const [country, setCountry] = useState('');
  const [citiesInput, setCitiesInput] = useState('');
  const [namesInput, setNamesInput] = useState('');
  const [count, setCount] = useState(4);

  const handleGenerate = async () => {
    if (!productDescription.trim()) {
      setError('Ajoutez une description au produit avant de générer des avis.');
      return;
    }

    setGenerating(true);
    setError('');
    setGeneratedReviews([]);
    setSelectedReviews(new Set());

    try {
      const cities = citiesInput.split(',').map(c => c.trim()).filter(Boolean);
      const names = namesInput.split(',').map(n => n.trim()).filter(Boolean);

      const res = await storeProductsApi.generateReviews({
        productDescription,
        country: country.trim() || undefined,
        cities: cities.length > 0 ? cities : undefined,
        names: names.length > 0 ? names : undefined,
        count
      });

      const reviews = res.data?.data?.reviews || [];
      setGeneratedReviews(reviews);
      // Select all by default
      setSelectedReviews(new Set(reviews.map((_, i) => i)));
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  const toggleReview = (index) => {
    setSelectedReviews(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleSaveSelected = () => {
    const selected = generatedReviews.filter((_, i) => selectedReviews.has(i));
    if (selected.length === 0) return;

    const merged = [
      ...existingTestimonials,
      ...selected.map(r => ({
        name: r.name,
        text: r.text,
        rating: r.rating,
        location: r.location,
        verified: r.verified,
        date: r.date,
        source: 'ai'
      }))
    ];

    onSave(merged);
    setGeneratedReviews([]);
    setSelectedReviews(new Set());
  };

  const handleRemoveExisting = (index) => {
    const updated = existingTestimonials.filter((_, i) => i !== index);
    onSave(updated);
  };

  const renderStars = (rating) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}`}
        />
      ))}
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-semibold text-gray-900">Avis clients</h3>
          {existingTestimonials.length > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {existingTestimonials.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
          {/* Existing testimonials */}
          {existingTestimonials.length > 0 && (
            <div className="space-y-2 pt-4">
              <div className="text-sm font-medium text-gray-700">Avis existants</div>
              {existingTestimonials.map((t, i) => (
                <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{t.name}</span>
                      {renderStars(t.rating)}
                      {t.verified && (
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">Vérifié</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{t.text}</p>
                    {t.location && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                        <MapPin className="w-3 h-3" />
                        {t.location}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveExisting(i)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Generation config */}
          <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-4 space-y-3 mt-2">
            <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Générer des avis IA
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Pays</label>
                <input
                  type="text"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  placeholder="Ex: Cameroun"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre d'avis</label>
                <select
                  value={count}
                  onChange={e => setCount(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  <option value={3}>3 avis</option>
                  <option value={4}>4 avis</option>
                  <option value={5}>5 avis</option>
                  <option value={6}>6 avis</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Villes (séparées par des virgules)</label>
              <input
                type="text"
                value={citiesInput}
                onChange={e => setCitiesInput(e.target.value)}
                placeholder="Ex: Douala, Yaoundé, Bafoussam"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Prénoms (séparés par des virgules)</label>
              <input
                type="text"
                value={namesInput}
                onChange={e => setNamesInput(e.target.value)}
                placeholder="Ex: Awa, Koffi, Mireille, Armand"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Génération en cours…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Générer les avis
                </>
              )}
            </button>
          </div>

          {/* Generated reviews preview */}
          {generatedReviews.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">
                  Avis générés — sélectionnez ceux à garder
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                  Régénérer
                </button>
              </div>

              {generatedReviews.map((review, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-3 rounded-lg p-3 cursor-pointer border transition-colors ${
                    selectedReviews.has(i)
                      ? 'bg-amber-50 border-amber-300'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedReviews.has(i)}
                    onChange={() => toggleReview(i)}
                    className="mt-1 rounded text-amber-500 focus:ring-amber-400"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{review.name}</span>
                      {renderStars(review.rating)}
                      {review.verified && (
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">Vérifié</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{review.text}</p>
                    {review.location && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                        <MapPin className="w-3 h-3" />
                        {review.location}
                      </div>
                    )}
                  </div>
                </label>
              ))}

              <button
                onClick={handleSaveSelected}
                disabled={selectedReviews.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Ajouter {selectedReviews.size} avis sélectionné{selectedReviews.size > 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewGenerator;
