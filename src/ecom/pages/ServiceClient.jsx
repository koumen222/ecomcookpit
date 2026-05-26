import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, User, Building2, Crown, Sparkles, MessageSquare,
  CheckCircle, XCircle, Clock, Loader2, ChevronDown, ChevronUp,
  Send, AlertCircle, Calendar, Plus, Minus, Edit3, Save, X,
  Info, Users, Trash2, Eye, EyeOff, RefreshCw, Shield
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';

const PLAN_COLORS = {
  free:    { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Gratuit'  },
  starter: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Starter'  },
  pro:     { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Pro'       },
  ultra:   { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Ultra'     },
};

const fmt  = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDt = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const PlanBadge = ({ plan }) => {
  const c = PLAN_COLORS[plan] || PLAN_COLORS.free;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${c.bg} ${c.text}`}>
      <Crown size={10} />
      {c.label}
    </span>
  );
};

const Section = ({ title, icon: Icon, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2.5">
          <Icon size={16} className="text-primary-600" />
          <span className="font-semibold text-gray-800 text-sm">{title}</span>
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100">{children}</div>}
    </div>
  );
};

const Field = ({ label, value, accent }) => (
  <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
    <span className="text-xs text-gray-500">{label}</span>
    <span className={`text-xs font-semibold ${accent || 'text-gray-800'}`}>{value || '—'}</span>
  </div>
);

// ── Onglet Gestion Agents (super_admin only) ──────────────────────────────────
const AgentsTab = ({ showToast }) => {
  const [agents, setAgents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editAgent, setEditAgent] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [showPwd, setShowPwd]     = useState(false);
  const [form, setForm]           = useState({ name: '', email: '', password: '' });
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ecomApi.get('/super-admin/service-agents');
      setAgents(res.data?.data || []);
    } catch { showToast('Erreur chargement agents', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditAgent(null); setForm({ name: '', email: '', password: '' }); setShowForm(true); };
  const openEdit   = (a) => { setEditAgent(a); setForm({ name: a.name, email: a.email, password: '' }); setShowForm(true); };

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) return showToast('Nom et email requis', 'error');
    if (!editAgent && !form.password.trim()) return showToast('Mot de passe requis', 'error');
    setSaving(true);
    try {
      if (editAgent) {
        const payload = { name: form.name, email: form.email };
        if (form.password.trim()) payload.password = form.password;
        await ecomApi.patch(`/super-admin/service-agents/${editAgent._id}`, payload);
        showToast('Agent modifié');
      } else {
        await ecomApi.post('/super-admin/service-agents', form);
        showToast('Agent créé');
      }
      setShowForm(false);
      load();
    } catch (e) {
      showToast(e.response?.data?.message || 'Erreur', 'error');
    } finally { setSaving(false); }
  };

  const toggleActive = async (a) => {
    try {
      await ecomApi.patch(`/super-admin/service-agents/${a._id}`, { isActive: !a.isActive });
      showToast(a.isActive ? 'Agent désactivé' : 'Agent activé');
      load();
    } catch { showToast('Erreur', 'error'); }
  };

  const deleteAgent = async (id) => {
    setDeletingId(id);
    try {
      await ecomApi.delete(`/super-admin/service-agents/${id}`);
      showToast('Agent supprimé');
      load();
    } catch { showToast('Erreur suppression', 'error'); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{agents.length} agent{agents.length !== 1 ? 's' : ''} enregistré{agents.length !== 1 ? 's' : ''}</p>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition">
          <Plus size={14} /> Créer un agent
        </button>
      </div>

      {/* Formulaire création / édition */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold text-gray-800 text-sm">{editAgent ? 'Modifier l\'agent' : 'Nouvel agent service client'}</p>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 transition"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nom complet *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Jean Dupont"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="agent@scalor.net"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Mot de passe {editAgent ? '(laisser vide pour ne pas changer)' : '*'}
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Minimum 8 caractères"
                className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-white transition">
              Annuler
            </button>
            <button onClick={submit} disabled={saving} className="flex-1 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {editAgent ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </div>
      )}

      {/* Liste agents */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary-500" /></div>
      ) : agents.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl py-10 text-center">
          <Shield size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Aucun agent service client</p>
          <p className="text-xs text-gray-400 mt-1">Créez le premier compte agent ci-dessus.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map(a => (
            <div key={a._id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                {(a.name || a.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{a.name}</p>
                <p className="text-xs text-gray-500 truncate">{a.email}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 flex-shrink-0">
                <Clock size={11} />
                {a.lastLogin ? fmtDt(a.lastLogin) : 'Jamais connecté'}
              </div>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.isActive ? 'bg-primary-400' : 'bg-red-400'}`} />
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition" title="Modifier">
                  <Edit3 size={13} />
                </button>
                <button onClick={() => toggleActive(a)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition" title={a.isActive ? 'Désactiver' : 'Activer'}>
                  {a.isActive ? <XCircle size={13} className="text-red-400" /> : <CheckCircle size={13} className="text-primary-400" />}
                </button>
                <button onClick={() => { if (window.confirm(`Supprimer ${a.name} ?`)) deleteAgent(a._id); }}
                  disabled={deletingId === a._id}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition" title="Supprimer">
                  {deletingId === a._id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Onglet Console (recherche + actions) ──────────────────────────────────────
const ConsoleTab = ({ showToast, isSuperAdmin }) => {
  const [query, setQuery]         = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults]     = useState([]);
  const [selected, setSelected]   = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading]     = useState(false);

  const [planEdit, setPlanEdit]       = useState(false);
  const [newPlan, setNewPlan]         = useState('');
  const [planDuration, setPlanDuration] = useState(1);
  const [planSaving, setPlanSaving]   = useState(false);

  const [creditEdit, setCreditEdit]   = useState(false);
  const [freeCred, setFreeCred]       = useState(0);
  const [paidCred, setPaidCred]       = useState(0);
  const [creditSaving, setCreditSaving] = useState(false);

  const [msgText, setMsgText]         = useState('');
  const [msgSending, setMsgSending]   = useState(false);

  const [toggling, setToggling]       = useState(false);
  const [trialDays, setTrialDays]     = useState(7);
  const [trialSaving, setTrialSaving] = useState(false);

  const searchEndpoint = isSuperAdmin ? '/super-admin/users' : '/super-admin/service-client/search';

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    setSelected(null);
    setWorkspace(null);
    try {
      const res = isSuperAdmin
        ? await ecomApi.get('/super-admin/users', { params: { search: query.trim(), limit: 10 } })
        : await ecomApi.get('/super-admin/service-client/search', { params: { q: query.trim(), limit: 10 } });
      const users = res.data?.data?.users || res.data?.data || [];
      setResults(Array.isArray(users) ? users : []);
    } catch { showToast('Erreur lors de la recherche', 'error'); }
    finally { setSearching(false); }
  }, [query, isSuperAdmin, showToast]);

  const selectUser = useCallback(async (u) => {
    setSelected(u);
    setResults([]);
    setWorkspace(null);
    const wsId = u.workspaceId?._id || u.workspaceId;
    if (!wsId) return;
    setLoading(true);
    try {
      const res = await ecomApi.get('/super-admin/workspaces', { params: { limit: 500 } });
      const ws = (res.data?.data?.workspaces || []).find(w => String(w._id) === String(wsId));
      setWorkspace(ws || null);
      if (ws) { setFreeCred(ws.freeGenerationsRemaining || 0); setPaidCred(ws.paidGenerationsRemaining || 0); setNewPlan(ws.plan || 'free'); }
    } catch { showToast('Impossible de charger le workspace', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  const savePlan = async () => {
    if (!workspace) return;
    setPlanSaving(true);
    try {
      await ecomApi.patch(`/super-admin/workspaces/${workspace._id}/plan`, { plan: newPlan, durationMonths: planDuration });
      setWorkspace(w => ({ ...w, plan: newPlan }));
      setPlanEdit(false);
      showToast(`Plan → ${PLAN_COLORS[newPlan]?.label}`);
    } catch (e) { showToast(e.response?.data?.message || 'Erreur plan', 'error'); }
    finally { setPlanSaving(false); }
  };

  const saveCredits = async () => {
    if (!workspace) return;
    setCreditSaving(true);
    try {
      await ecomApi.patch(`/super-admin/workspaces/${workspace._id}/generations`, {
        freeGenerations: Number(freeCred), paidGenerations: Number(paidCred),
      });
      setWorkspace(w => ({ ...w, freeGenerationsRemaining: Number(freeCred), paidGenerationsRemaining: Number(paidCred) }));
      setCreditEdit(false);
      showToast('Crédits mis à jour');
    } catch (e) { showToast(e.response?.data?.message || 'Erreur crédits', 'error'); }
    finally { setCreditSaving(false); }
  };

  const toggleWorkspace = async () => {
    if (!workspace) return;
    setToggling(true);
    try {
      await ecomApi.put(`/super-admin/workspaces/${workspace._id}/toggle`);
      setWorkspace(w => ({ ...w, isActive: !w.isActive }));
      showToast(workspace.isActive ? 'Workspace désactivé' : 'Workspace activé');
    } catch { showToast('Erreur toggle', 'error'); }
    finally { setToggling(false); }
  };

  const sendMessage = async () => {
    if (!msgText.trim() || !selected) return;
    setMsgSending(true);
    try {
      await ecomApi.post('/super-admin/support/send-to-user', { userId: selected._id, message: msgText.trim() });
      setMsgText('');
      showToast('Message envoyé');
    } catch (e) { showToast(e.response?.data?.message || 'Erreur envoi', 'error'); }
    finally { setMsgSending(false); }
  };

  const extendTrial = async () => {
    if (!workspace) return;
    setTrialSaving(true);
    try {
      const now = new Date();
      const base = workspace.trialEndsAt && new Date(workspace.trialEndsAt) > now ? new Date(workspace.trialEndsAt) : now;
      const newEnd = new Date(base);
      newEnd.setDate(newEnd.getDate() + Number(trialDays));
      await ecomApi.patch(`/super-admin/workspaces/${workspace._id}/plan`, { plan: workspace.plan || 'free', durationMonths: 1, trialEndsAt: newEnd.toISOString() });
      setWorkspace(w => ({ ...w, trialEndsAt: newEnd.toISOString() }));
      showToast(`Trial prolongé de ${trialDays} jours`);
    } catch { showToast('Erreur trial', 'error'); }
    finally { setTrialSaving(false); }
  };

  const planExpired = workspace?.planExpiresAt && new Date(workspace.planExpiresAt) < new Date();

  return (
    <div className="space-y-5">
      {/* Barre de recherche */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Email ou nom du client..." value={query}
              onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" />
          </div>
          <button onClick={search} disabled={searching || !query.trim()}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2">
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Rechercher
          </button>
        </div>
        {results.length > 0 && (
          <div className="mt-3 border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
            {results.map(u => (
              <button key={u._id} onClick={() => selectUser(u)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
                  {(u.name || u.email || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{u.name || '—'}</p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <PlanBadge plan={u.workspaceId?.plan || 'free'} />
                  <span className={`w-2 h-2 rounded-full ${u.isActive !== false ? 'bg-primary-400' : 'bg-red-400'}`} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin text-primary-500" /></div>}

      {selected && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Identité + workspace */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-black text-lg">
                  {(selected.name || selected.email)[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{selected.name || 'Sans nom'}</p>
                  <p className="text-xs text-gray-500 truncate">{selected.email}</p>
                </div>
              </div>
              <div className="space-y-1">
                <Field label="Rôle" value={selected.role} />
                <Field label="Statut" value={
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${selected.isActive !== false ? 'text-primary-600' : 'text-red-500'}`}>
                    {selected.isActive !== false ? <CheckCircle size={11} /> : <XCircle size={11} />}
                    {selected.isActive !== false ? 'Actif' : 'Bloqué'}
                  </span>
                } />
                <Field label="Inscrit le" value={fmt(selected.createdAt)} />
                <Field label="Dernière connexion" value={fmtDt(selected.lastLogin)} />
              </div>
            </div>

            {workspace && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={14} className="text-gray-400" />
                  <span className="font-semibold text-gray-800 text-sm">Workspace</span>
                </div>
                <div className="space-y-1">
                  <Field label="Nom" value={workspace.name} />
                  <Field label="Plan" value={<PlanBadge plan={workspace.plan} />} />
                  <Field label="Expiration" value={fmt(workspace.planExpiresAt)} accent={planExpired ? 'text-red-500' : 'text-gray-800'} />
                  <Field label="Trial" value={workspace.trialUsed ? 'Utilisé' : workspace.trialEndsAt ? `Jusqu'au ${fmt(workspace.trialEndsAt)}` : 'Non démarré'} />
                </div>
                <button onClick={toggleWorkspace} disabled={toggling}
                  className={`mt-4 w-full py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 border
                    ${workspace.isActive !== false ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-primary-200 text-primary-600 hover:bg-primary-50'}`}>
                  {toggling ? <Loader2 size={12} className="animate-spin" /> : workspace.isActive !== false ? <XCircle size={12} /> : <CheckCircle size={12} />}
                  {workspace.isActive !== false ? 'Désactiver le workspace' : 'Réactiver le workspace'}
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="lg:col-span-2 space-y-4">
            {/* Plan */}
            {workspace && (
              <Section title="Changer le plan" icon={Crown}>
                <div className="mt-4">
                  {!planEdit ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <PlanBadge plan={workspace.plan} />
                        {planExpired && <span className="text-xs text-red-500 font-medium flex items-center gap-1"><AlertCircle size={11} /> Expiré</span>}
                        {!planExpired && workspace.planExpiresAt && <span className="text-xs text-gray-400">Expire le {fmt(workspace.planExpiresAt)}</span>}
                      </div>
                      <button onClick={() => setPlanEdit(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition">
                        <Edit3 size={12} /> Modifier
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {['free', 'starter', 'pro', 'ultra'].map(p => (
                          <button key={p} onClick={() => setNewPlan(p)}
                            className={`p-3 rounded-xl border-2 text-left transition ${newPlan === p ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <PlanBadge plan={p} />
                              {newPlan === p && <CheckCircle size={14} className="text-primary-500" />}
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1">{p === 'free' ? 'Gratuit, sans expiration' : 'Durée configurable'}</p>
                          </button>
                        ))}
                      </div>
                      {newPlan !== 'free' && (
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Durée</label>
                          <div className="flex gap-2">
                            {[1, 3, 6, 12].map(d => (
                              <button key={d} onClick={() => setPlanDuration(d)}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition border ${planDuration === d ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}>
                                {d} mois
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setPlanEdit(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Annuler</button>
                        <button onClick={savePlan} disabled={planSaving} className="flex-1 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50">
                          {planSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Confirmer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Crédits */}
            {workspace && (
              <Section title="Crédits de génération IA" icon={Sparkles}>
                <div className="mt-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                      <p className="text-xl font-black text-blue-700">{workspace.freeGenerationsRemaining ?? 0}</p>
                      <p className="text-xs text-blue-500 font-medium mt-0.5">Crédits gratuits</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3 text-center">
                      <p className="text-xl font-black text-amber-700">{workspace.paidGenerationsRemaining ?? 0}</p>
                      <p className="text-xs text-amber-500 font-medium mt-0.5">Crédits payants</p>
                    </div>
                  </div>
                  {!creditEdit ? (
                    <button onClick={() => { setCreditEdit(true); setFreeCred(workspace.freeGenerationsRemaining ?? 0); setPaidCred(workspace.paidGenerationsRemaining ?? 0); }}
                      className="w-full py-2 rounded-xl border border-primary-200 text-primary-700 text-xs font-semibold hover:bg-primary-50 transition flex items-center justify-center gap-1.5">
                      <Edit3 size={12} /> Modifier les crédits
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {[['Gratuits', freeCred, setFreeCred], ['Payants', paidCred, setPaidCred]].map(([lbl, val, setVal]) => (
                          <div key={lbl}>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Crédits {lbl}</label>
                            <div className="flex items-center gap-1">
                              <button onClick={() => setVal(v => Math.max(0, v - 1))} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition"><Minus size={11} /></button>
                              <input type="number" min="0" value={val} onChange={e => setVal(Math.max(0, parseInt(e.target.value) || 0))}
                                className="flex-1 text-center px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary-400" />
                              <button onClick={() => setVal(v => v + 1)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition"><Plus size={11} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[5, 10, 25, 50].map(n => (
                          <button key={n} onClick={() => setFreeCred(v => v + n)} className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition">+{n} gratuits</button>
                        ))}
                        {[5, 10, 25].map(n => (
                          <button key={n} onClick={() => setPaidCred(v => v + n)} className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[11px] font-bold hover:bg-amber-100 transition">+{n} payants</button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setCreditEdit(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Annuler</button>
                        <button onClick={saveCredits} disabled={creditSaving} className="flex-1 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50">
                          {creditSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Enregistrer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Trial */}
            {workspace && (
              <Section title="Période d'essai" icon={Clock} defaultOpen={false}>
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[['Statut', workspace.trialUsed ? 'Utilisé' : 'Disponible', ''], ['Début', fmt(workspace.trialStartedAt), ''], ['Fin', fmt(workspace.trialEndsAt), workspace.trialEndsAt && new Date(workspace.trialEndsAt) < new Date() ? 'text-red-500' : '']].map(([l, v, a]) => (
                      <div key={l} className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-1">{l}</p>
                        <p className={`text-xs font-bold ${a || 'text-gray-800'}`}>{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Prolonger de</label>
                    <input type="number" min="1" max="90" value={trialDays} onChange={e => setTrialDays(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary-400" />
                    <span className="text-xs text-gray-500">jours</span>
                    <button onClick={extendTrial} disabled={trialSaving}
                      className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50">
                      {trialSaving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Prolonger
                    </button>
                  </div>
                </div>
              </Section>
            )}

            {/* Message */}
            <Section title="Envoyer un message" icon={MessageSquare}>
              <div className="mt-4 space-y-3">
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex items-start gap-2">
                  <Info size={13} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-600">Le message apparaîtra dans la messagerie de support de l'utilisateur.</p>
                </div>
                <textarea rows={3} placeholder="Votre message..." value={msgText} onChange={e => setMsgText(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent" />
                <div className="flex gap-2 flex-wrap">
                  {['Votre paiement a bien été reçu.', 'Votre plan a été mis à jour.', 'Votre problème a été résolu.'].map(t => (
                    <button key={t} onClick={() => setMsgText(t)} className="flex-1 px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-[10px] font-medium transition text-center leading-tight">{t}</button>
                  ))}
                </div>
                <button onClick={sendMessage} disabled={msgSending || !msgText.trim()}
                  className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50">
                  {msgSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Envoyer
                </button>
              </div>
            </Section>
          </div>
        </div>
      )}

      {!selected && !loading && results.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center">
          <div className="w-14 h-14 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search size={24} className="text-primary-400" />
          </div>
          <h3 className="font-semibold text-gray-700 mb-1">Recherchez un client</h3>
          <p className="text-sm text-gray-400 max-w-xs mx-auto">Entrez l'email ou le nom pour accéder au compte et gérer plan, crédits et support.</p>
        </div>
      )}
    </div>
  );
};

// ── Page principale ───────────────────────────────────────────────────────────
export default function ServiceClient() {
  const { user } = useEcomAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [tab, setTab] = useState('console');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const tabs = [
    { id: 'console', label: 'Console client', icon: Search },
    ...(isSuperAdmin ? [{ id: 'agents', label: 'Gérer les agents', icon: Shield }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className={`fixed top-4 right-4 z-[500] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-primary-50 border border-primary-200 text-primary-700'}`}>
          {toast.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-7">
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-white" />
            </div>
            Service Client
          </h1>
          <p className="text-gray-500 text-sm mt-1 ml-[52px]">
            Gérez les comptes clients : plan, crédits, support et workspace.
          </p>
        </div>

        {/* Onglets */}
        {tabs.length > 1 && (
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit mb-6">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === t.id ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>
        )}

        {tab === 'console' && <ConsoleTab showToast={showToast} isSuperAdmin={isSuperAdmin} />}
        {tab === 'agents' && isSuperAdmin && <AgentsTab showToast={showToast} />}
      </div>
    </div>
  );
}
