import React, { useState, useEffect } from 'react';
import {
  Building2, Users, CheckCircle2, XCircle, Copy, Calendar,
  Mail, Power, PowerOff, AlertCircle, Loader2,
  Shield, Zap, Building, Crown, ChevronDown
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';

const SuperAdminWorkspaces = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchWorkspaces = async () => {
    try {
      const res = await ecomApi.get('/super-admin/workspaces');
      setWorkspaces(res.data.data.workspaces);
    } catch (err) { setError(getContextualError(err, 'load_dashboard')); }
  };

  useEffect(() => { fetchWorkspaces().finally(() => setLoading(false)); }, []);

  const handleToggle = async (wsId) => {
    try { const res = await ecomApi.put(`/super-admin/workspaces/${wsId}/toggle`); setSuccess(res.data.message); fetchWorkspaces(); }
    catch (err) { setError(getContextualError(err, 'update_settings')); }
  };

  const handleSetPlan = async (wsId, plan) => {
    try {
      await ecomApi.patch(`/super-admin/workspaces/${wsId}/plan`, { plan, durationMonths: 1 });
      setSuccess(`Plan mis à jour : ${plan}`);
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

  const active = workspaces.filter(w => w.isActive).length;
  const inactive = workspaces.length - active;
  const totalMembers = workspaces.reduce((sum, w) => sum + (w.memberCount || 0), 0);
  const avgMembers = workspaces.length > 0 ? (totalMembers / workspaces.length).toFixed(1) : 0;

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

        {/* Workspaces grid */}
        {workspaces.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-20 text-center shadow-lg">
            <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-lg font-black text-slate-400">Aucun espace créé</p>
            <p className="text-sm text-slate-400 mt-2">Les workspaces apparaîtront ici</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map(ws => (
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
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-xs text-slate-500 font-medium">Plan:</span>
                    <select
                      value={ws.plan || 'free'}
                      onChange={(e) => handleSetPlan(ws._id, e.target.value)}
                      className="flex-1 text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="free">Gratuit</option>
                      <option value="pro">Pro — 6 000 FCFA/mois</option>
                      <option value="ultra">Ultra — 15 000 FCFA/mois</option>
                    </select>
                  </div>
                  {ws.planExpiresAt && (
                    <p className="text-[10px] text-slate-400 mb-3 text-center">
                      Expire le {new Date(ws.planExpiresAt).toLocaleDateString('fr-FR')}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminWorkspaces;
