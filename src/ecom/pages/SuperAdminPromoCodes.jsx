import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, Tag, Search, X, Check } from 'lucide-react';
import {
  listPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode
} from '../services/billingApi.js';
import { getContextualError } from '../utils/errorMessages';

const PLAN_OPTIONS = [
  { key: 'starter', label: 'Scalor (starter)' },
  { key: 'pro', label: 'Scalor + IA (pro)' },
  { key: 'ultra', label: 'Scalor IA Pro (ultra)' }
];

const DURATION_OPTIONS = [1, 3, 6, 12];

const emptyForm = () => ({
  code: '',
  description: '',
  discountType: 'percentage',
  discountValue: 10,
  applicablePlans: [],
  applicableDurations: [],
  maxUses: '',
  maxUsesPerWorkspace: '',
  minAmount: '',
  validFrom: '',
  validUntil: '',
  isActive: true
});

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

const SuperAdminPromoCodes = () => {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all|active|inactive
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetchCodes = async () => {
    setError('');
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (activeFilter === 'active') params.isActive = 'true';
      if (activeFilter === 'inactive') params.isActive = 'false';
      const res = await listPromoCodes(params);
      setCodes(res.codes || []);
    } catch (err) {
      setError(getContextualError(err, 'load_dashboard'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCodes(); }, [activeFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCodes();
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (code) => {
    setEditingId(code._id);
    setForm({
      code: code.code,
      description: code.description || '',
      discountType: code.discountType,
      discountValue: code.discountValue,
      applicablePlans: code.applicablePlans || [],
      applicableDurations: code.applicableDurations || [],
      maxUses: code.maxUses ?? '',
      maxUsesPerWorkspace: code.maxUsesPerWorkspace ?? '',
      minAmount: code.minAmount ?? '',
      validFrom: code.validFrom ? code.validFrom.slice(0, 10) : '',
      validUntil: code.validUntil ? code.validUntil.slice(0, 10) : '',
      isActive: code.isActive
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const togglePlan = (plan) => {
    setForm(f => ({
      ...f,
      applicablePlans: f.applicablePlans.includes(plan)
        ? f.applicablePlans.filter(p => p !== plan)
        : [...f.applicablePlans, plan]
    }));
  };

  const toggleDuration = (months) => {
    setForm(f => ({
      ...f,
      applicableDurations: f.applicableDurations.includes(months)
        ? f.applicableDurations.filter(d => d !== months)
        : [...f.applicableDurations, months]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(''); setSuccess('');
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        applicablePlans: form.applicablePlans,
        applicableDurations: form.applicableDurations,
        maxUses: form.maxUses === '' ? null : Number(form.maxUses),
        maxUsesPerWorkspace: form.maxUsesPerWorkspace === '' ? null : Number(form.maxUsesPerWorkspace),
        minAmount: form.minAmount === '' ? 0 : Number(form.minAmount),
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        isActive: form.isActive
      };

      if (editingId) {
        await updatePromoCode(editingId, payload);
        setSuccess('Code mis à jour');
      } else {
        await createPromoCode(payload);
        setSuccess('Code créé');
      }
      closeForm();
      fetchCodes();
    } catch (err) {
      setError(err?.response?.data?.message || getContextualError(err, 'update_settings'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, code) => {
    if (!confirm(`Supprimer le code "${code}" ?`)) return;
    try {
      await deletePromoCode(id);
      setSuccess('Code supprimé');
      fetchCodes();
    } catch (err) {
      setError(getContextualError(err, 'update_settings'));
    }
  };

  const handleToggleActive = async (code) => {
    try {
      await updatePromoCode(code._id, { isActive: !code.isActive });
      fetchCodes();
    } catch (err) {
      setError(getContextualError(err, 'update_settings'));
    }
  };

  const stats = useMemo(() => ({
    total: codes.length,
    active: codes.filter(c => c.isActive).length,
    used: codes.reduce((s, c) => s + (c.usedCount || 0), 0)
  }), [codes]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="text-purple-600" /> Codes promo
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Créez et gérez les codes promo applicables aux abonnements.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow"
        >
          <Plus size={18} /> Nouveau code
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 uppercase">Codes</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 uppercase">Actifs</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 uppercase">Utilisations totales</p>
          <p className="text-2xl font-bold text-purple-600">{stats.used}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un code…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
            Rechercher
          </button>
        </form>
        <select
          value={activeFilter}
          onChange={e => setActiveFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">Tous</option>
          <option value="active">Actifs</option>
          <option value="inactive">Désactivés</option>
        </select>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-purple-600" size={28} />
          </div>
        ) : codes.length === 0 ? (
          <div className="p-12 text-center text-gray-500">Aucun code promo</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Réduction</th>
                  <th className="px-4 py-3 text-left">Plans</th>
                  <th className="px-4 py-3 text-left">Durées</th>
                  <th className="px-4 py-3 text-left">Utilisations</th>
                  <th className="px-4 py-3 text-left">Validité</th>
                  <th className="px-4 py-3 text-left">Actif</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {codes.map(c => (
                  <tr key={c._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-mono font-bold text-purple-700">{c.code}</p>
                      {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {c.discountType === 'percentage'
                        ? <span>-{c.discountValue}%</span>
                        : <span>-{c.discountValue.toLocaleString('fr-FR')} FCFA</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.applicablePlans?.length ? c.applicablePlans.join(', ') : 'Tous'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.applicableDurations?.length ? c.applicableDurations.map(d => `${d}m`).join(', ') : 'Toutes'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.usedCount || 0}{c.maxUses ? ` / ${c.maxUses}` : ' / ∞'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.validFrom || c.validUntil ? (
                        <>
                          <div>du {fmtDate(c.validFrom)}</div>
                          <div>au {fmtDate(c.validUntil)}</div>
                        </>
                      ) : 'Sans limite'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(c)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          c.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {c.isActive ? 'Actif' : 'Désactivé'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(c._id, c.code)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal create/edit */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold">
                {editingId ? 'Modifier le code' : 'Nouveau code promo'}
              </h2>
              <button onClick={closeForm} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingId}
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono uppercase disabled:bg-gray-50"
                    placeholder="WELCOME10"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Promo de bienvenue 10%"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type de réduction <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.discountType}
                    onChange={e => setForm({ ...form, discountType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="percentage">Pourcentage (%)</option>
                    <option value="fixed">Montant fixe (FCFA)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valeur <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={form.discountType === 'percentage' ? 100 : undefined}
                    value={form.discountValue}
                    onChange={e => setForm({ ...form, discountValue: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Plans applicables */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plans applicables (vide = tous)
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLAN_OPTIONS.map(p => (
                    <button
                      type="button"
                      key={p.key}
                      onClick={() => togglePlan(p.key)}
                      className={`px-3 py-1.5 rounded-lg text-sm border ${
                        form.applicablePlans.includes(p.key)
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Durées applicables */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Durées applicables en mois (vide = toutes)
                </label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map(d => (
                    <button
                      type="button"
                      key={d}
                      onClick={() => toggleDuration(d)}
                      className={`px-3 py-1.5 rounded-lg text-sm border ${
                        form.applicableDurations.includes(d)
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {d} mois
                    </button>
                  ))}
                </div>
              </div>

              {/* Limites */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Utilisations max <span className="text-xs text-gray-400">(global)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.maxUses}
                    onChange={e => setForm({ ...form, maxUses: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="∞"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max / workspace
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.maxUsesPerWorkspace}
                    onChange={e => setForm({ ...form, maxUsesPerWorkspace: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="∞"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Montant min FCFA
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.minAmount}
                    onChange={e => setForm({ ...form, minAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Validité */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valide à partir du</label>
                  <input
                    type="date"
                    value={form.validFrom}
                    onChange={e => setForm({ ...form, validFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valide jusqu'au</label>
                  <input
                    type="date"
                    value={form.validUntil}
                    onChange={e => setForm({ ...form, validUntil: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Code actif</span>
              </label>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  {editingId ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPromoCodes;
