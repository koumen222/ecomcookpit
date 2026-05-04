import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMoney } from '../hooks/useMoney';
import ecomApi from '../services/ecommApi.js';

const STATUSES = [
  { value: 'test',   label: 'Test',   color: 'text-amber-600'   },
  { value: 'scale',  label: 'Scale',  color: 'text-orange-600'  },
  { value: 'stable', label: 'Stable', color: 'text-emerald-700' },
  { value: 'winner', label: 'Winner', color: 'text-emerald-700' },
  { value: 'pause',  label: 'Pause',  color: 'text-gray-500'    },
  { value: 'stop',   label: 'Stop',   color: 'text-red-600'     },
];

const Field = ({ label, hint, required, children }) => (
  <div>
    <div className="flex items-baseline justify-between mb-1.5">
      <label className="text-[13px] font-semibold text-gray-700">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </div>
    {children}
  </div>
);

const inputCls = 'w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 focus:bg-white transition placeholder:text-gray-400';

const Skeleton = () => (
  <div className="flex flex-col min-h-full bg-[#f8f9fb] animate-pulse">
    <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
      <div className="h-4 w-4 bg-gray-200 rounded" />
      <div className="h-5 w-48 bg-gray-200 rounded" />
    </div>
    <div className="flex-1 flex items-start justify-center px-6 py-8">
      <div className="w-full max-w-xl space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i}>
            <div className="h-3 w-28 bg-gray-200 rounded mb-2" />
            <div className="h-10 bg-gray-100 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default function ProductForm() {
  const navigate = useNavigate();
  const { id }   = useParams();
  const { fmt, symbol } = useMoney();

  const [loading, setLoading]         = useState(false);
  const [initialLoading, setInit]     = useState(false);
  const [error, setError]             = useState('');
  const [isEditing, setIsEditing]     = useState(false);

  const [form, setForm] = useState({
    name: '', status: 'test',
    sellingPrice: '', productCost: '',
    stock: '', reorderThreshold: '',
    isActive: true,
  });

  useEffect(() => {
    if (id) { setIsEditing(true); loadProduct(); }
  }, [id]);

  const loadProduct = async () => {
    try {
      setInit(true);
      const { data } = await ecomApi.get(`/products/${id}`);
      const p = data.data;
      setForm({
        name:              p.name             || '',
        status:            p.status           || 'test',
        sellingPrice:      p.sellingPrice     ?? '',
        productCost:       p.productCost      ?? '',
        stock:             p.stock            ?? '',
        reorderThreshold:  p.reorderThreshold ?? '',
        isActive:          p.isActive         ?? true,
      });
    } catch { setError('Impossible de charger le produit.'); }
    finally   { setInit(false); }
  };

  const handleChange = ({ target: { name, value, type, checked } }) =>
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));

  const cost       = parseFloat(form.productCost)  || 0;
  const price      = parseFloat(form.sellingPrice) || 0;
  const benefit    = price > 0 ? price - cost : null;
  const margin     = price > 0 && benefit !== null ? Math.round((benefit / price) * 100) : null;
  const suggested  = cost > 0 ? Math.ceil(Math.max(cost * (cost < 10000 ? 3 : 2.25), 10000) / 50) * 50 : null;

  const applySuggested = () => suggested && setForm(prev => ({ ...prev, sellingPrice: suggested }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        sellingPrice:     parseFloat(form.sellingPrice),
        productCost:      parseFloat(form.productCost),
        stock:            parseInt(form.stock, 10),
        reorderThreshold: parseInt(form.reorderThreshold, 10),
      };
      if (isEditing) await ecomApi.put(`/products/${id}`, payload);
      else           await ecomApi.post('/products', payload);
      navigate('/ecom/products');
    } catch (err) {
      setError(err.response?.data?.message || `Erreur lors de ${isEditing ? 'la modification' : 'la création'}.`);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) return <Skeleton />;

  return (
    <div className="flex flex-col min-h-full bg-[#f8f9fb]">

      {/* ── Topbar ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <Link
          to="/ecom/products"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-[17px] font-bold text-gray-900 tracking-tight leading-none">
            {isEditing ? 'Modifier le produit' : 'Nouveau produit'}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5 leading-none">
            {isEditing ? 'Mettre à jour les informations' : 'Remplissez les champs ci-dessous'}
          </p>
        </div>
      </div>

      {/* ── Contenu centré ─────────────────────────────────────── */}
      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-xl">

          {error && (
            <div className="flex gap-2.5 items-start bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-5">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-4.25a.75.75 0 001.5 0v-4.5a.75.75 0 00-1.5 0v4.5zm.75-7a1 1 0 110-2 1 1 0 010 2z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* ── Bloc Informations ─────────────────────────── */}
            <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="text-[13px] font-bold text-gray-700 uppercase tracking-wide">Informations</h2>
              </div>
              <div className="px-5 py-4 space-y-4">
                <Field label="Nom du produit" required>
                  <input
                    type="text"
                    name="name"
                    required
                    value={form.name}
                    onChange={handleChange}
                    placeholder="ex : Montre connectée XS3"
                    className={inputCls}
                  />
                </Field>

                <Field label="Statut">
                  <div className="grid grid-cols-3 gap-2">
                    {STATUSES.map(s => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, status: s.value }))}
                        className={`py-2 rounded-lg text-[12px] font-semibold border transition-all ${
                          form.status === s.value
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200'
                            : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.isActive}
                    onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                  </button>
                  <span className="text-sm text-gray-700 font-medium">
                    {form.isActive ? 'Produit actif' : 'Produit inactif'}
                  </span>
                </div>
              </div>
            </section>

            {/* ── Bloc Finances ─────────────────────────────── */}
            <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="text-[13px] font-bold text-gray-700 uppercase tracking-wide">Finance</h2>
              </div>
              <div className="px-5 py-4 space-y-4">
                <Field label="Coût du produit" required hint={`en ${symbol}`}>
                  <input
                    type="number"
                    name="productCost"
                    required
                    min="0"
                    step="1"
                    value={form.productCost}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls}
                  />
                </Field>

                <Field label="Prix de vente" required hint={`en ${symbol}`}>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      name="sellingPrice"
                      required
                      min="0"
                      step="1"
                      value={form.sellingPrice}
                      onChange={handleChange}
                      placeholder="0"
                      className={inputCls}
                    />
                    {suggested && (
                      <button
                        type="button"
                        onClick={applySuggested}
                        className="shrink-0 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                        title="Appliquer le prix suggéré"
                      >
                        {fmt(suggested)} →
                      </button>
                    )}
                  </div>
                  {suggested && (
                    <p className="mt-1.5 text-[11px] text-gray-400">
                      Prix conseillé basé sur le coût × {cost < 10000 ? '3' : '2,25'}
                    </p>
                  )}
                </Field>

                {/* Aperçu financier */}
                {price > 0 && cost > 0 && (
                  <div className={`rounded-xl px-4 py-3.5 mt-1 flex items-center gap-4 ${
                    (benefit ?? 0) > 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'
                  }`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-semibold uppercase tracking-wide ${(benefit ?? 0) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        Bénéfice estimé
                      </p>
                      <p className={`text-2xl font-bold tabular-nums leading-tight ${(benefit ?? 0) > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {benefit !== null ? `${(benefit > 0 ? '+' : '')}${fmt(benefit)}` : '—'}
                      </p>
                    </div>
                    {margin !== null && (
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Marge</p>
                        <p className={`text-2xl font-bold tabular-nums ${(benefit ?? 0) > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {margin}%
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* ── Bloc Stock ────────────────────────────────── */}
            <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="text-[13px] font-bold text-gray-700 uppercase tracking-wide">Stock</h2>
              </div>
              <div className="px-5 py-4 grid grid-cols-2 gap-4">
                <Field label="Quantité en stock" required>
                  <input
                    type="number"
                    name="stock"
                    required
                    min="0"
                    value={form.stock}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls}
                  />
                </Field>
                <Field label="Seuil réappro" required>
                  <input
                    type="number"
                    name="reorderThreshold"
                    required
                    min="0"
                    value={form.reorderThreshold}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls}
                  />
                </Field>
              </div>
            </section>

            {/* ── Actions ───────────────────────────────────── */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => navigate('/ecom/products')}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm shadow-emerald-200 transition-all active:scale-95"
              >
                {loading
                  ? (isEditing ? 'Enregistrement…' : 'Création…')
                  : (isEditing ? 'Enregistrer' : 'Créer le produit')}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
