import React, { useState, useEffect } from 'react';
import {
  Building2, Users, CheckCircle2, XCircle, Copy, Calendar,
  Mail, Power, PowerOff, AlertCircle, Loader2,
  Shield, Zap, Building, Crown, ChevronDown, Search, Bell, BellOff
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';

const FALLBACK_PLANS = [
  { key: 'free', displayName: 'Gratuit', priceRegular: 0, currency: 'FCFA', order: 0 },
  { key: 'starter', displayName: 'Scalor', priceRegular: 5000, currency: 'FCFA', order: 1 },
  { key: 'pro', displayName: 'Pro', priceRegular: 10000, currency: 'FCFA', order: 2 },
  { key: 'ultra', displayName: 'Ultra', priceRegular: 15000, currency: 'FCFA', order: 3 }
];

const formatMoney = (value) => Number(value || 0).toLocaleString('fr-FR');

const formatPlanOptionLabel = (plan) => {
  if (!plan || plan.key === 'free' || Number(plan.priceRegular || 0) === 0) {
    return plan?.displayName || 'Gratuit';
  }
  return `${plan.displayName} — ${formatMoney(plan.priceRegular)} ${plan.currency || 'FCFA'}/mois`;
};

const getWorkspaceNoticeMeta = (warning) => {
  if (!warning?.active) {
    return {
      buttonLabel: 'Activer alerte renouvellement (24h)',
      buttonClass: 'bg-orange-50 text-orange-700 hover:bg-orange-100 ring-orange-600/20',
      Icon: Bell,
      helperClass: 'text-orange-500',
      helperText: ''
    };
  }

  if (warning.variant === 'downgraded') {
    return {
      buttonLabel: 'Désactiver annonce plan gratuit',
      buttonClass: 'bg-amber-50 text-amber-700 hover:bg-amber-100 ring-amber-600/20',
      Icon: BellOff,
      helperClass: 'text-amber-600',
      helperText: warning.message || 'Annonce plan gratuit active'
    };
  }

  if (warning.variant === 'plan_updated') {
    return {
      buttonLabel: 'Désactiver annonce mise a jour plan',
      buttonClass: 'bg-blue-50 text-blue-700 hover:bg-blue-100 ring-blue-600/20',
      Icon: BellOff,
      helperClass: 'text-blue-600',
      helperText: warning.message || 'Annonce de mise a jour active'
    };
  }

  return {
    buttonLabel: 'Désactiver alerte renouvellement',
    buttonClass: 'bg-red-50 text-red-700 hover:bg-red-100 ring-red-600/20',
    Icon: BellOff,
    helperClass: 'text-red-500',
    helperText: warning.deadline
      ? `Alerte active — expire ${new Date(warning.deadline).toLocaleString('fr-FR')}`
      : (warning.message || 'Alerte active')
  };
};

const SuperAdminWorkspaces = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [availablePlans, setAvailablePlans] = useState(FALLBACK_PLANS);
  const [planDrafts, setPlanDrafts] = useState({});
  const [savingPlans, setSavingPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingGenerations, setEditingGenerations] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const fetchWorkspaces = async () => {
    try {
      const res = await ecomApi.get('/super-admin/workspaces');
      const items = res.data.data.workspaces || [];
      setWorkspaces(items);
      setPlanDrafts(Object.fromEntries(
        items.map(ws => [ws._id, { plan: ws.plan || 'free', durationMonths: 1 }])
      ));
    } catch (err) { setError(getContextualError(err, 'load_dashboard')); }
  };

  const fetchPlans = async () => {
    try {
      const res = await ecomApi.get('/super-admin/plans');
      const plans = (res.data.plans || [])
        .filter(plan => ['free', 'starter', 'pro', 'ultra'].includes(plan.key))
        .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));

      if (plans.length > 0) {
        setAvailablePlans(plans);
      }
    } catch {
      setAvailablePlans(FALLBACK_PLANS);
    }
  };

  useEffect(() => {
    Promise.all([fetchWorkspaces(), fetchPlans()]).finally(() => setLoading(false));
  }, []);

  const handleToggle = async (wsId) => {
    try { const res = await ecomApi.put(`/super-admin/workspaces/${wsId}/toggle`); setSuccess(res.data.message); fetchWorkspaces(); }
    catch (err) { setError(getContextualError(err, 'update_settings')); }
  };

  const handleSubscriptionWarning = async (wsId, currentlyActive) => {
    try {
      const res = await ecomApi.put(`/super-admin/workspaces/${wsId}/subscription-warning`, { active: !currentlyActive });
      setSuccess(res.data.message);
      fetchWorkspaces();
    } catch (err) { setError(getContextualError(err, 'update_settings')); }
  };

  const updatePlanDraft = (wsId, field, value) => {
    setPlanDrafts(prev => {
      const current = prev[wsId] || { plan: 'free', durationMonths: 1 };
      if (field === 'plan' && value === 'free') {
        return { ...prev, [wsId]: { plan: 'free', durationMonths: 1 } };
      }
      return {
        ...prev,
        [wsId]: {
          ...current,
          [field]: value
        }
      };
    });
  };

  const handleSetPlan = async (wsId) => {
    const draft = planDrafts[wsId] || { plan: 'free', durationMonths: 1 };
    const plan = draft.plan || 'free';
    const durationMonths = plan === 'free' ? 1 : Number(draft.durationMonths || 1);
    const selectedPlanConfig = availablePlans.find(item => item.key === plan);
    const selectedPlanLabel = selectedPlanConfig?.displayName || plan;

    try {
      setSavingPlans(prev => ({ ...prev, [wsId]: true }));
      await ecomApi.patch(`/super-admin/workspaces/${wsId}/plan`, { plan, durationMonths });
      setSuccess(plan === 'free'
        ? 'Plan gratuit appliqué'
        : `Plan ${selectedPlanLabel} appliqué pour ${durationMonths} mois`
      );
      await fetchWorkspaces();
    } catch (err) {
      setError(getContextualError(err, 'update_settings'));
    } finally {
      setSavingPlans(prev => ({ ...prev, [wsId]: false }));
    }
  };

  const handleUpdateGenerations = async (wsId, freeGenerations, paidGenerations) => {
    try {
      const res = await ecomApi.patch(`/super-admin/workspaces/${wsId}/generations`, {
        freeGenerations: parseInt(freeGenerations) || 0,
        paidGenerations: parseInt(paidGenerations) || 0
      });
      setSuccess(res.data.message || 'Générations mises à jour');
      setEditingGenerations({ ...editingGenerations, [wsId]: false });
      fetchWorkspaces();
    } catch (err) {
      setError(getContextualError(err, 'update_settings'));
    }
  };

  const copyCode = (code) => { navigator.clipboard.writeText(code); setSuccess('Code copié !'); };

  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 4000); return () => clearTimeout(t); } }, [error]);

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-emerald-700 animate-spin" />
        <p className="text-sm text-slate-600 font-semibold">Chargement des espaces...</p>
      </div>
    </div>
  );

  // Filtrage des workspaces
  const filteredWorkspaces = workspaces.filter(w => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      w.name?.toLowerCase().includes(term) ||
      w.slug?.toLowerCase().includes(term) ||
      w.owner?.email?.toLowerCase().includes(term)
    );
  });

  const active = filteredWorkspaces.filter(w => w.isActive).length;
  const inactive = filteredWorkspaces.length - active;
  const totalMembers = filteredWorkspaces.reduce((sum, w) => sum + (w.memberCount || 0), 0);
  const avgMembers = filteredWorkspaces.length > 0 ? (totalMembers / filteredWorkspaces.length).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        {/* Toasts */}
        {success && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl text-sm text-emerald-800 shadow-lg">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span className="font-semibold">{success}</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl text-sm text-amber-800 shadow-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900">Gestion des espaces</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
                  <Building2 className="w-3.5 h-3.5" />
                  {workspaces.length} total
                </span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {active} actifs
                </span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600">
                  <Users className="w-3.5 h-3.5" />
                  {totalMembers} membres
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher un espace (nom, slug, email propriétaire...)" 
            className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { value: workspaces.length, label: 'Espaces créés', accent: 'text-slate-900', icon: Building2, gradient: 'from-slate-500 to-slate-700' },
            { value: active, label: 'Actifs', accent: 'text-emerald-600', icon: CheckCircle2, gradient: 'from-emerald-500 to-teal-500' },
            { value: inactive, label: 'Inactifs', accent: 'text-amber-600', icon: XCircle, gradient: 'from-amber-500 to-red-500' },
            { value: avgMembers, label: 'Moy. membres/espace', accent: 'text-teal-600', icon: Users, gradient: 'from-teal-500 to-emerald-600' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="group bg-white rounded-2xl border-2 border-slate-200 p-5 transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/5 hover:-translate-y-1">
                <div className="flex items-center justify-between mb-3">
                  <p className={`text-3xl font-black tracking-tight ${s.accent}`}>{s.value}</p>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-md`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* Search results info */}
        {searchTerm && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Search className="w-4 h-4" />
            <span>
              <strong>{filteredWorkspaces.length}</strong> résultat{filteredWorkspaces.length !== 1 ? 's' : ''} pour <strong>"{searchTerm}"</strong>
            </span>
            {filteredWorkspaces.length < workspaces.length && (
              <span className="text-slate-400">sur {workspaces.length} total</span>
            )}
          </div>
        )}

        {/* Workspaces grid */}
        {filteredWorkspaces.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-20 text-center shadow-lg">
            {searchTerm ? (
              <>
                <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-lg font-black text-slate-400">Aucun résultat</p>
                <p className="text-sm text-slate-400 mt-2">Aucun espace ne correspond à "{searchTerm}"</p>
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
                >
                  Réinitialiser la recherche
                </button>
              </>
            ) : (
              <>
                <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-lg font-black text-slate-400">Aucun espace créé</p>
                <p className="text-sm text-slate-400 mt-2">Les workspaces apparaîtront ici</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredWorkspaces.map(ws => {
              const planDraft = planDrafts[ws._id] || { plan: ws.plan || 'free', durationMonths: 1 };
              const selectedPlan = planDraft.plan || 'free';
              const selectedDuration = Number(planDraft.durationMonths || 1);
              const selectedPlanConfig = availablePlans.find(plan => plan.key === selectedPlan) || FALLBACK_PLANS.find(plan => plan.key === selectedPlan);
              const noticeMeta = getWorkspaceNoticeMeta(ws.subscriptionWarning);
              const NoticeIcon = noticeMeta.Icon;

              return (
              <div key={ws._id} className={`group bg-white rounded-2xl border-2 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/5 hover:-translate-y-1 ${ws.isActive ? 'border-slate-200' : 'border-amber-200 opacity-80'}`}>
                {/* Accent bar */}
                <div className={`h-1.5 bg-gradient-to-r ${ws.isActive ? 'from-emerald-500 to-teal-500' : 'from-amber-500 to-red-500'}`} />

                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        <h3 className="font-black text-slate-900 text-lg truncate">{ws.name}</h3>
                      </div>
                      <p className="text-xs text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded inline-block">{ws.slug}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full ring-2 ring-inset flex-shrink-0 ${ws.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'}`}>
                      {ws.isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {ws.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 text-center border border-slate-200">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-slate-500" />
                        <p className="text-2xl font-black text-slate-900">{ws.memberCount || 0}</p>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Membres</p>
                    </div>
                    <button
                      onClick={() => copyCode(ws.inviteCode)}
                      className="bg-gradient-to-br from-emerald-50 to-emerald-50 rounded-xl p-4 text-center border border-emerald-200 hover:from-emerald-100 hover:to-emerald-100 transition-all duration-300 cursor-pointer group/code hover:shadow-md"
                    >
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Copy className="w-3.5 h-3.5 text-emerald-600 group-hover/code:scale-110 transition-transform" />
                        <p className="text-xs font-mono font-bold text-emerald-800 truncate">{ws.inviteCode}</p>
                      </div>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Copier code</p>
                    </button>
                  </div>

                  {/* Info */}
                  <div className="space-y-2.5 text-xs mb-5">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-400 font-medium">Propriétaire:</span>
                      <span className="font-bold text-slate-700 truncate">{ws.owner?.email || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-400 font-medium">Créé le:</span>
                      <span className="font-bold text-slate-700">{new Date(ws.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Plan selector */}
                  <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-xs text-slate-500 font-medium">Définir le plan</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
                      <select
                        value={selectedPlan}
                        onChange={(e) => updatePlanDraft(ws._id, 'plan', e.target.value)}
                        className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-2 bg-white text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {availablePlans.map(plan => (
                          <option key={plan.key} value={plan.key}>{formatPlanOptionLabel(plan)}</option>
                        ))}
                      </select>
                      <select
                        value={String(selectedDuration)}
                        onChange={(e) => updatePlanDraft(ws._id, 'durationMonths', Number(e.target.value))}
                        disabled={selectedPlan === 'free'}
                        className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-2 bg-white text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      >
                        <option value="1">1 mois</option>
                        <option value="3">3 mois</option>
                        <option value="6">6 mois</option>
                        <option value="12">12 mois</option>
                      </select>
                    </div>
                    <button
                      onClick={() => handleSetPlan(ws._id)}
                      disabled={!!savingPlans[ws._id]}
                      className="mt-2 w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {savingPlans[ws._id]
                        ? 'Application...'
                        : selectedPlan === 'free'
                          ? 'Mettre au plan gratuit'
                          : `Appliquer ${selectedPlanConfig?.displayName || selectedPlan} (${selectedDuration} mois)`}
                    </button>
                  </div>
                  {ws.planExpiresAt && (
                    <p className="text-[10px] text-slate-400 mb-3 text-center">
                      Expire le {new Date(ws.planExpiresAt).toLocaleDateString('fr-FR')}
                    </p>
                  )}

                  {/* Générations IA */}
                  <div className="mb-4 p-3 bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-violet-600" />
                      <span className="text-xs font-bold text-violet-900">Générations IA</span>
                    </div>
                    {editingGenerations[ws._id] ? (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[10px] text-violet-700 font-medium block mb-1">Gratuites</label>
                          <input
                            type="number"
                            min="0"
                            defaultValue={ws.freeGenerationsRemaining || 0}
                            id={`free-${ws._id}`}
                            className="w-full text-xs border border-violet-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-violet-700 font-medium block mb-1">Payées</label>
                          <input
                            type="number"
                            min="0"
                            defaultValue={ws.paidGenerationsRemaining || 0}
                            id={`paid-${ws._id}`}
                            className="w-full text-xs border border-violet-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const freeVal = document.getElementById(`free-${ws._id}`).value;
                              const paidVal = document.getElementById(`paid-${ws._id}`).value;
                              handleUpdateGenerations(ws._id, freeVal, paidVal);
                            }}
                            className="flex-1 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700 transition"
                          >
                            Valider
                          </button>
                          <button
                            onClick={() => setEditingGenerations({ ...editingGenerations, [ws._id]: false })}
                            className="flex-1 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300 transition"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-violet-700">Gratuites:</span>
                          <span className="text-xs font-bold text-emerald-600">{ws.freeGenerationsRemaining || 0}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] text-violet-700">Payées:</span>
                          <span className="text-xs font-bold text-violet-600">{ws.paidGenerationsRemaining || 0}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] text-violet-700">Total utilisées:</span>
                          <span className="text-xs font-bold text-gray-600">{ws.totalGenerations || 0}</span>
                        </div>
                        <button
                          onClick={() => setEditingGenerations({ ...editingGenerations, [ws._id]: true })}
                          className="w-full py-1.5 bg-violet-100 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-200 transition"
                        >
                          Modifier
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Subscription Warning toggle */}
                  <button
                    onClick={() => handleSubscriptionWarning(ws._id, ws.subscriptionWarning?.active)}
                    className={`w-full inline-flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ring-2 ring-inset ${noticeMeta.buttonClass}`}
                  >
                    <><NoticeIcon className="w-3.5 h-3.5" /> {noticeMeta.buttonLabel}</>
                  </button>
                  {ws.subscriptionWarning?.active && noticeMeta.helperText && (
                    <p className={`text-[10px] text-center -mt-1 ${noticeMeta.helperClass}`}>
                      {noticeMeta.helperText}
                    </p>
                  )}

                  {/* Action button */}
                  <button
                    onClick={() => handleToggle(ws._id)}
                    className={`w-full inline-flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all duration-300 ring-2 ring-inset ${ws.isActive
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 hover:shadow-md ring-amber-600/20'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:shadow-md ring-emerald-600/20'
                      }`}
                  >
                    {ws.isActive ? (
                      <>
                        <PowerOff className="w-4 h-4" />
                        Désactiver cet espace
                      </>
                    ) : (
                      <>
                        <Power className="w-4 h-4" />
                        Réactiver cet espace
                      </>
                    )}
                  </button>
                </div>
              </div>
            );})}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminWorkspaces;
