import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell, Send, Calendar, Clock, Zap, RefreshCw, X,
  CheckCircle2, AlertCircle, Loader2, ToggleLeft, ToggleRight,
  Globe, Building2,
} from 'lucide-react';
import ecomApi, { superAdminPushApi } from '../services/ecommApi.js';
import SuperAdminShell from '../components/SuperAdminShell';

/* ── tiny helpers ── */
const Inp = ({ value, onChange, placeholder, type = 'text', disabled, className = '' }) => (
  <input
    type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
    className={`w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 placeholder:text-slate-400 bg-white transition-colors disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
  />
);

const Sel = ({ value, onChange, disabled, children }) => (
  <select
    value={value} onChange={onChange} disabled={disabled}
    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 bg-white transition-colors disabled:bg-slate-50 disabled:text-slate-400"
  >
    {children}
  </select>
);

const Label = ({ children }) => (
  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
    {children}
  </label>
);

const Card = ({ children, className = '' }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ title, subtitle, right }) => (
  <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
    <div>
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    {right}
  </div>
);

const STATUS_META = {
  scheduled: { label: 'Programmée', cls: 'bg-blue-100 text-blue-700'   },
  sent:      { label: 'Envoyée',    cls: 'bg-primary-100 text-primary-700' },
  failed:    { label: 'Échouée',    cls: 'bg-red-100 text-red-600'      },
  cancelled: { label: 'Annulée',    cls: 'bg-slate-100 text-slate-500'  },
};

/* ── component ── */
const SuperAdminPushCenter = () => {
  const [loading, setLoading]   = useState(true);
  const [busy,    setBusy]      = useState(false);
  const [tab,     setTab]       = useState('send');
  const [toast,   setToast]     = useState(null); // { type: 'ok'|'err', text }

  const [workspaces,  setWorkspaces]  = useState([]);
  const [scope,       setScope]       = useState('global');
  const [workspaceId, setWorkspaceId] = useState('');
  const [title,       setTitle]       = useState('');
  const [body,        setBody]        = useState('');
  const [url,         setUrl]         = useState('');
  const [sendAt,      setSendAt]      = useState('');

  const [scheduled,   setScheduled]   = useState([]);
  const [automations, setAutomations] = useState([]);
  const [pushStats,   setPushStats]   = useState({
    scheduled: { total: 0, byStatus: {} },
    deliveries: { total: 0, successful: 0, failed: 0 },
    automations: { total: 0, enabled: 0 },
    subscriptions: { total: 0, workspaces: 0 },
  });

  const canSend = title.trim().length > 0 && body.trim().length > 0;
  const successRate = pushStats.deliveries.total > 0
    ? ((pushStats.deliveries.successful / pushStats.deliveries.total) * 100).toFixed(1)
    : '0.0';

  const wsOptions = useMemo(() =>
    (workspaces || []).map(w => ({ id: w._id || w.id, name: w.name || w.slug || 'Workspace' })),
    [workspaces],
  );

  const notify = (text, type = 'ok') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4500);
  };

  const loadAll = async (showRefresh = false) => {
    if (!showRefresh) setLoading(true);
    try {
      const [wsRes, schRes, autoRes, statsRes] = await Promise.all([
        ecomApi.get('/super-admin/workspaces'),
        superAdminPushApi.listScheduled({ limit: 50 }),
        superAdminPushApi.listAutomations().catch(() => ({ data: { data: { automations: [] } } })),
        superAdminPushApi.stats().catch(() => ({ data: { data: null } })),
      ]);
      setWorkspaces(wsRes.data?.data?.workspaces || []);
      setScheduled(schRes.data?.data?.scheduled || []);
      setAutomations(autoRes.data?.data?.automations || []);
      setPushStats(statsRes.data?.data || pushStats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (scope === 'global') setWorkspaceId(''); }, [scope]);

  const sendNow = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      const res = await superAdminPushApi.sendNow({
        scope, workspaceId: scope === 'workspace' ? workspaceId : undefined,
        title: title.trim(), body: body.trim(), url: url.trim(),
      });
      const r = res.data?.data;
      notify(`Envoyé : ${r.successful || 0}/${r.total || 0} destinataires`);
    } catch (e) {
      notify(e?.response?.data?.message || 'Erreur lors de l\'envoi', 'err');
    } finally { setBusy(false); }
  };

  const scheduleOne = async () => {
    if (!canSend || !sendAt) return;
    setBusy(true);
    try {
      await superAdminPushApi.schedule({
        scope, workspaceId: scope === 'workspace' ? workspaceId : undefined,
        title: title.trim(), body: body.trim(), url: url.trim(), sendAt,
      });
      notify('Notification programmée');
      await loadAll();
    } catch (e) {
      notify(e?.response?.data?.message || 'Erreur de programmation', 'err');
    } finally { setBusy(false); }
  };

  const cancelScheduled = async (id) => {
    setBusy(true);
    try { await superAdminPushApi.cancelScheduled(id); await loadAll(); }
    catch { notify('Erreur lors de l\'annulation', 'err'); }
    finally { setBusy(false); }
  };

  const bootstrap = async () => {
    setBusy(true);
    try {
      const res = await superAdminPushApi.bootstrapAutomations();
      setAutomations(res.data?.data?.automations || []);
      notify('Préconfigurations créées');
    } catch { notify('Erreur lors de la création des préconfigurations', 'err'); }
    finally { setBusy(false); }
  };

  const toggleAutomation = async (a) => {
    setBusy(true);
    try {
      const res = await superAdminPushApi.updateAutomation(a._id, { enabled: !a.enabled });
      const updated = res.data?.data?.automation;
      setAutomations(prev => prev.map(x => x._id === updated._id ? updated : x));
    } finally { setBusy(false); }
  };

  const TABS = [
    { k: 'send',        label: 'Envoyer maintenant', icon: Send       },
    { k: 'schedule',    label: 'Programmer',          icon: Calendar   },
    { k: 'scheduled',   label: 'Programmées',         icon: Clock,  count: scheduled.length   },
    { k: 'automations', label: 'Automations',         icon: Zap,    count: automations.length },
  ];

  const subtitle = loading ? undefined
    : `${pushStats.subscriptions.total} abonnements · ${pushStats.deliveries.successful} livrées · ${successRate}% succès`;

  return (
    <SuperAdminShell
      title="Push Center"
      subtitle={subtitle}
      icon={Bell}
      refreshing={loading}
      onRefresh={() => loadAll(true)}
    >
      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold transition-all ${
          toast.type === 'ok'
            ? 'bg-primary-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.text}
          <button onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="space-y-5">

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Abonnements',       value: pushStats.subscriptions.total   || 0, sub: `${pushStats.subscriptions.workspaces || 0} workspace(s)`,                   icon: Bell,         accent: 'text-slate-800'   },
            { label: 'Programmées',       value: pushStats.scheduled.total       || 0, sub: `${pushStats.scheduled.byStatus?.scheduled || 0} en attente`,                 icon: Clock,        accent: 'text-blue-700'    },
            { label: 'Livraisons réuss.', value: pushStats.deliveries.successful || 0, sub: `Taux ${successRate}%`,                                                       icon: CheckCircle2, accent: 'text-primary-700' },
            { label: 'Automations act.', value: pushStats.automations.enabled   || 0, sub: `/ ${pushStats.automations.total || 0} total`,                                icon: Zap,          accent: 'text-amber-700'   },
          ].map(k => (
            <div key={k.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{k.label}</p>
                <k.icon className="w-3.5 h-3.5 text-slate-300" />
              </div>
              <p className={`text-2xl font-extrabold tabular-nums ${k.accent}`}>{k.value.toLocaleString('fr-FR')}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Main card ── */}
        <Card>
          {/* tab bar */}
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-all relative flex-shrink-0 ${
                  tab === t.k ? 'text-primary-700' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.k ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'}`}>
                    {t.count}
                  </span>
                )}
                {tab === t.k && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-t" />}
              </button>
            ))}
          </div>

          {/* ── SEND / SCHEDULE form ── */}
          {(tab === 'send' || tab === 'schedule') && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Ciblage</Label>
                  <Sel value={scope} onChange={e => setScope(e.target.value)}>
                    <option value="global">Tous les utilisateurs</option>
                    <option value="workspace">Une workspace</option>
                  </Sel>
                </div>
                <div>
                  <Label>Workspace</Label>
                  <Sel value={workspaceId} onChange={e => setWorkspaceId(e.target.value)} disabled={scope !== 'workspace'}>
                    <option value="">Sélectionner…</option>
                    {wsOptions.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </Sel>
                </div>

                <div className="sm:col-span-2">
                  <Label>Titre *</Label>
                  <Inp value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex : Mise à jour importante" />
                </div>

                <div className="sm:col-span-2">
                  <Label>Message *</Label>
                  <textarea
                    value={body} onChange={e => setBody(e.target.value)} rows={4}
                    placeholder="Ex : Une nouvelle fonctionnalité est disponible…"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 placeholder:text-slate-400 resize-y transition-colors"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label>URL (optionnel)</Label>
                  <Inp value={url} onChange={e => setUrl(e.target.value)} placeholder="Ex : /ecom/dashboard" />
                </div>

                {tab === 'schedule' && (
                  <div className="sm:col-span-2">
                    <Label>Date & heure d'envoi *</Label>
                    <Inp type="datetime-local" value={sendAt} onChange={e => setSendAt(e.target.value)} />
                  </div>
                )}
              </div>

              {/* Scope preview */}
              <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-semibold ${
                scope === 'global' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-primary-50 border-primary-200 text-primary-700'
              }`}>
                {scope === 'global' ? <Globe className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                {scope === 'global'
                  ? 'Envoi à tous les utilisateurs de toutes les workspaces'
                  : workspaceId
                    ? `Envoi aux utilisateurs de la workspace sélectionnée`
                    : 'Sélectionnez une workspace ci-dessus'}
              </div>

              <div className="flex justify-end">
                {tab === 'send' ? (
                  <button
                    onClick={sendNow}
                    disabled={busy || !canSend || (scope === 'workspace' && !workspaceId)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-500 disabled:opacity-50 transition-all shadow-sm"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Envoyer maintenant
                  </button>
                ) : (
                  <button
                    onClick={scheduleOne}
                    disabled={busy || !canSend || !sendAt || (scope === 'workspace' && !workspaceId)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-all shadow-sm"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                    Programmer
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── SCHEDULED list ── */}
          {tab === 'scheduled' && (
            scheduled.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-400">Aucune notification programmée</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {scheduled.map(s => {
                  const meta = STATUS_META[s.status] || STATUS_META.scheduled;
                  return (
                    <div key={s._id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-bold text-slate-900 truncate">{s.title}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2 mb-1.5">{s.body}</p>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1">
                              {s.scope === 'global' ? <Globe className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                              {s.scope === 'global' ? 'Global' : 'Workspace'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(s.sendAt).toLocaleString('fr-FR')}
                            </span>
                          </div>
                        </div>
                        {s.status === 'scheduled' && (
                          <button
                            onClick={() => cancelScheduled(s._id)}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-red-200 text-red-600 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                            Annuler
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ── AUTOMATIONS list ── */}
          {tab === 'automations' && (
            <div>
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">Préconfigurations à heures fixes — activables / désactivables</p>
                <button
                  onClick={bootstrap}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors flex-shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Créer les préconfigs
                </button>
              </div>
              {automations.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-400">Aucune automation configurée</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {automations.map(a => (
                    <div key={a._id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-bold text-slate-900">{a.name}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.enabled ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'}`}>
                            {a.enabled ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-1">{a.payload?.title} — {a.payload?.body}</p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                          <span>Cron : <span className="font-mono font-semibold text-slate-600">{a.cron}</span></span>
                          <span>TZ : {a.timezone || 'Africa/Abidjan'}</span>
                          {a.lastRunAt && <span>Dernier run : {new Date(a.lastRunAt).toLocaleString('fr-FR')}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleAutomation(a)}
                        disabled={busy}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors disabled:opacity-50 flex-shrink-0 ${
                          a.enabled
                            ? 'border-primary-200 text-primary-700 hover:bg-primary-50'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {a.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        {a.enabled ? 'Désactiver' : 'Activer'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </SuperAdminShell>
  );
};

export default SuperAdminPushCenter;
