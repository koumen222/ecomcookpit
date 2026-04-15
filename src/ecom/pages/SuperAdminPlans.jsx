import React, { useState, useEffect } from 'react';
import { Loader2, Save, Plus, Trash2, Clock, Check, X, AlertCircle } from 'lucide-react';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';

const LIMIT_FIELDS = [
  { key: 'maxOrders', label: 'Commandes / mois' },
  { key: 'maxCustomers', label: 'Clients max' },
  { key: 'maxProducts', label: 'Produits max' },
  { key: 'maxStores', label: 'Boutiques max' },
  { key: 'maxUsers', label: 'Utilisateurs' },
  { key: 'maxWhatsappInstances', label: 'Instances WhatsApp' },
  { key: 'maxWhatsappMessagesPerDay', label: 'Messages WA / jour' },
  { key: 'maxWhatsappMessagesPerMonth', label: 'Messages WA / mois' },
  { key: 'maxAiPageCredits', label: 'Crédits page IA / mois' }
];

const FEATURE_FIELDS = [
  { key: 'hasAiAgent', label: 'Agent IA WhatsApp' },
  { key: 'hasAiPageGen', label: 'Génération pages IA' },
  { key: 'hasPrioritySupport', label: 'Support prioritaire' },
  { key: 'hasApiWebhooks', label: 'API & webhooks' },
  { key: 'hasMultiStore', label: 'Multi-boutiques' },
  { key: 'hasAnalyticsDashboard', label: 'Tableau de bord analytique' },
  { key: 'hasCustomStore', label: 'Boutique personnalisée' }
];

const fmtDateTimeLocal = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const SuperAdminPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchPlans = async () => {
    try {
      const res = await ecomApi.get('/super-admin/plans');
      setPlans(res.data.plans || []);
    } catch (err) {
      setError(getContextualError(err, 'load_dashboard'));
    }
  };

  useEffect(() => { fetchPlans().finally(() => setLoading(false)); }, []);

  const update = (key, patch) => {
    setPlans(prev => prev.map(p => p.key === key ? { ...p, ...patch } : p));
  };

  const updateLimits = (key, field, value) => {
    setPlans(prev => prev.map(p => p.key === key ? { ...p, limits: { ...p.limits, [field]: value } } : p));
  };

  const updateFeatures = (key, field, value) => {
    setPlans(prev => prev.map(p => p.key === key ? { ...p, features: { ...p.features, [field]: value } } : p));
  };

  const handleSave = async (plan) => {
    setSaving(s => ({ ...s, [plan.key]: true }));
    setError(''); setSuccess('');
    try {
      const payload = {
        displayName: plan.displayName,
        tagline: plan.tagline,
        priceRegular: Number(plan.priceRegular) || 0,
        pricePromo: plan.pricePromo === '' || plan.pricePromo == null ? null : Number(plan.pricePromo),
        promoActive: !!plan.promoActive,
        promoExpiresAt: plan.promoExpiresAt || null,
        currency: plan.currency || 'FCFA',
        limits: Object.fromEntries(LIMIT_FIELDS.map(f => [f.key, Number(plan.limits?.[f.key] ?? -1)])),
        features: Object.fromEntries(FEATURE_FIELDS.map(f => [f.key, !!plan.features?.[f.key]])),
        featuresList: plan.featuresList || [],
        highlighted: !!plan.highlighted,
        ctaLabel: plan.ctaLabel || 'Commencer',
        order: Number(plan.order) || 0
      };
      await ecomApi.patch(`/super-admin/plans/${plan.key}`, payload);
      setSuccess(`Plan "${plan.displayName}" sauvegardé`);
      fetchPlans();
    } catch (err) {
      setError(getContextualError(err, 'update_settings'));
    } finally {
      setSaving(s => ({ ...s, [plan.key]: false }));
    }
  };

  const addFeatureLine = (key) => {
    update(key, { featuresList: [...(plans.find(p => p.key === key)?.featuresList || []), ''] });
  };
  const updateFeatureLine = (key, idx, value) => {
    const list = [...(plans.find(p => p.key === key)?.featuresList || [])];
    list[idx] = value;
    update(key, { featuresList: list });
  };
  const removeFeatureLine = (key, idx) => {
    const list = [...(plans.find(p => p.key === key)?.featuresList || [])];
    list.splice(idx, 1);
    update(key, { featuresList: list });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#0F6B4F]" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestion des plans</h1>
        <p className="text-sm text-gray-500 mt-1">Configurez les prix, les limites et les fonctionnalités de chaque plan. Les comptes sans abonnement utilisent automatiquement le plan <strong>Gratuit</strong>.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-700">{success}</div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {plans.map(plan => {
          const promoExpired = plan.promoActive && plan.promoExpiresAt && new Date(plan.promoExpiresAt).getTime() < Date.now();
          return (
            <div key={plan.key} className={`bg-white rounded-xl border-2 ${plan.highlighted ? 'border-[#0F6B4F]' : 'border-gray-200'} p-5 shadow-sm`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{plan.key}</span>
                    {plan.highlighted && <span className="text-[10px] font-bold text-[#0F6B4F] bg-[#E6F4EF] px-2 py-0.5 rounded">POPULAIRE</span>}
                  </div>
                  <input
                    value={plan.displayName}
                    onChange={e => update(plan.key, { displayName: e.target.value })}
                    className="text-lg font-bold text-gray-900 mt-2 w-full border-b border-transparent hover:border-gray-300 focus:border-[#0F6B4F] focus:outline-none"
                  />
                  <input
                    value={plan.tagline || ''}
                    onChange={e => update(plan.key, { tagline: e.target.value })}
                    placeholder="Sous-titre"
                    className="text-sm text-gray-500 mt-1 w-full border-b border-transparent hover:border-gray-300 focus:border-[#0F6B4F] focus:outline-none"
                  />
                </div>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <label className="text-xs text-gray-600">
                  Prix normal (FCFA)
                  <input
                    type="number"
                    value={plan.priceRegular ?? 0}
                    onChange={e => update(plan.key, { priceRegular: e.target.value })}
                    className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:border-[#0F6B4F] focus:outline-none text-sm"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Prix promo (FCFA)
                  <input
                    type="number"
                    value={plan.pricePromo ?? ''}
                    onChange={e => update(plan.key, { pricePromo: e.target.value })}
                    placeholder="—"
                    className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:border-[#0F6B4F] focus:outline-none text-sm"
                  />
                </label>
              </div>

              {/* Promo toggle */}
              <div className={`mb-4 p-3 rounded-lg border ${plan.promoActive ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!plan.promoActive}
                    onChange={e => update(plan.key, { promoActive: e.target.checked })}
                    className="w-4 h-4 rounded accent-orange-600"
                  />
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-gray-700">Offre limitée active</span>
                  {promoExpired && <span className="text-xs text-red-600 font-medium">(expirée)</span>}
                </label>
                {plan.promoActive && (
                  <label className="block mt-2 text-xs text-gray-600">
                    Expire le
                    <input
                      type="datetime-local"
                      value={fmtDateTimeLocal(plan.promoExpiresAt)}
                      onChange={e => update(plan.key, { promoExpiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                      className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:border-[#0F6B4F] focus:outline-none text-sm"
                    />
                  </label>
                )}
              </div>

              {/* Limits */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Limites (–1 = illimité)</h3>
                <div className="grid grid-cols-2 gap-2">
                  {LIMIT_FIELDS.map(f => (
                    <label key={f.key} className="text-xs text-gray-600">
                      {f.label}
                      <input
                        type="number"
                        value={plan.limits?.[f.key] ?? -1}
                        onChange={e => updateLimits(plan.key, f.key, e.target.value)}
                        className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:border-[#0F6B4F] focus:outline-none text-sm"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Fonctionnalités</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {FEATURE_FIELDS.map(f => (
                    <label key={f.key} className="flex items-center gap-2 text-xs text-gray-700 py-0.5">
                      <input
                        type="checkbox"
                        checked={!!plan.features?.[f.key]}
                        onChange={e => updateFeatures(plan.key, f.key, e.target.checked)}
                        className="w-4 h-4 rounded accent-[#0F6B4F]"
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Features list (bullets) */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Bullets affichés</h3>
                  <button
                    onClick={() => addFeatureLine(plan.key)}
                    className="text-xs text-[#0F6B4F] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Ajouter
                  </button>
                </div>
                <div className="space-y-1.5">
                  {(plan.featuresList || []).map((line, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        value={line}
                        onChange={e => updateFeatureLine(plan.key, idx, e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded focus:border-[#0F6B4F] focus:outline-none text-sm"
                      />
                      <button onClick={() => removeFeatureLine(plan.key, idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Misc */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <label className="text-xs text-gray-600">
                  Label du bouton
                  <input
                    value={plan.ctaLabel || ''}
                    onChange={e => update(plan.key, { ctaLabel: e.target.value })}
                    className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:border-[#0F6B4F] focus:outline-none text-sm"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Ordre d'affichage
                  <input
                    type="number"
                    value={plan.order ?? 0}
                    onChange={e => update(plan.key, { order: e.target.value })}
                    className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:border-[#0F6B4F] focus:outline-none text-sm"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 mb-4 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={!!plan.highlighted}
                  onChange={e => update(plan.key, { highlighted: e.target.checked })}
                  className="w-4 h-4 rounded accent-[#0F6B4F]"
                />
                Mettre en avant (carte "populaire")
              </label>

              <button
                onClick={() => handleSave(plan)}
                disabled={saving[plan.key]}
                className="w-full bg-[#0F6B4F] hover:bg-[#0C5840] disabled:opacity-50 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition"
              >
                {saving[plan.key] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Sauvegarder
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SuperAdminPlans;
