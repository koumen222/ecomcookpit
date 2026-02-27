import React, { useEffect, useMemo, useState } from 'react';
import ecomApi, { superAdminPushApi } from '../services/ecommApi.js';

const SuperAdminPushCenter = () => {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('send');

  const [workspaces, setWorkspaces] = useState([]);
  const [scope, setScope] = useState('global');
  const [workspaceId, setWorkspaceId] = useState('');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');

  const [sendAt, setSendAt] = useState('');

  const [scheduled, setScheduled] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [pushStats, setPushStats] = useState({
    scheduled: { total: 0, byStatus: {} },
    deliveries: { total: 0, successful: 0, failed: 0 },
    automations: { total: 0, enabled: 0 },
    subscriptions: { total: 0, workspaces: 0 }
  });

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const canSend = title.trim().length > 0 && body.trim().length > 0;
  const deliverySuccessRate = pushStats.deliveries.total > 0
    ? ((pushStats.deliveries.successful / pushStats.deliveries.total) * 100).toFixed(1)
    : '0.0';

  const wsOptions = useMemo(() => {
    return (workspaces || []).map((w) => ({
      id: w._id || w.id,
      name: w.name || w.slug || 'Workspace'
    }));
  }, [workspaces]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [wsRes, schRes, autoRes, statsRes] = await Promise.all([
        ecomApi.get('/super-admin/workspaces'),
        superAdminPushApi.listScheduled({ limit: 50 }),
        superAdminPushApi.listAutomations().catch(() => ({ data: { data: { automations: [] } } })),
        superAdminPushApi.stats().catch(() => ({ data: { data: null } }))
      ]);

      setWorkspaces(wsRes.data?.data?.workspaces || []);
      setScheduled(schRes.data?.data?.scheduled || []);
      setAutomations(autoRes.data?.data?.automations || []);
      setPushStats(statsRes.data?.data || {
        scheduled: { total: 0, byStatus: {} },
        deliveries: { total: 0, successful: 0, failed: 0 },
        automations: { total: 0, enabled: 0 },
        subscriptions: { total: 0, workspaces: 0 }
      });
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (scope === 'global') setWorkspaceId('');
  }, [scope]);

  const sendNow = async () => {
    if (!canSend) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await superAdminPushApi.sendNow({
        scope,
        workspaceId: scope === 'workspace' ? workspaceId : undefined,
        title: title.trim(),
        body: body.trim(),
        url: url.trim()
      });
      const r = res.data?.data;
      setMsg({ type: 'success', text: `Envoyé: ${r.successful || 0}/${r.total || 0}` });
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.message || 'Erreur envoi' });
    } finally {
      setBusy(false);
    }
  };

  const scheduleOne = async () => {
    if (!canSend || !sendAt) return;
    setBusy(true);
    setMsg(null);
    try {
      await superAdminPushApi.schedule({
        scope,
        workspaceId: scope === 'workspace' ? workspaceId : undefined,
        title: title.trim(),
        body: body.trim(),
        url: url.trim(),
        sendAt
      });
      setMsg({ type: 'success', text: 'Notification programmée' });
      await loadAll();
    } catch (e) {
      setMsg({ type: 'error', text: e?.response?.data?.message || 'Erreur programmation' });
    } finally {
      setBusy(false);
    }
  };

  const cancelScheduled = async (id) => {
    setBusy(true);
    setMsg(null);
    try {
      await superAdminPushApi.cancelScheduled(id);
      await loadAll();
    } catch {
    } finally {
      setBusy(false);
    }
  };

  const bootstrap = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await superAdminPushApi.bootstrapAutomations();
      setAutomations(res.data?.data?.automations || []);
      setMsg({ type: 'success', text: 'Préconfigs créées' });
    } catch {
      setMsg({ type: 'error', text: 'Erreur préconfigs' });
    } finally {
      setBusy(false);
    }
  };

  const toggleAutomation = async (a) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await superAdminPushApi.updateAutomation(a._id, { enabled: !a.enabled });
      const updated = res.data?.data?.automation;
      setAutomations((prev) => prev.map((x) => (x._id === updated._id ? updated : x)));
    } catch {
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-emerald-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Push Center</h1>
          <p className="text-sm text-gray-500 mt-1">Envoyer, programmer et automatiser les notifications push.</p>
        </div>
        <button
          type="button"
          onClick={loadAll}
          disabled={busy}
          className="px-3 py-2 text-sm font-semibold rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Rafraîchir
        </button>
      </div>

      {msg && (
        <div className={`mb-5 px-4 py-3 rounded-xl border text-sm ${msg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Abonnements</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{pushStats.subscriptions.total || 0}</p>
          <p className="text-xs text-gray-500 mt-1">{pushStats.subscriptions.workspaces || 0} workspace(s)</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Programmées</p>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{pushStats.scheduled.total || 0}</p>
          <p className="text-xs text-gray-500 mt-1">En attente: {pushStats.scheduled.byStatus?.scheduled || 0}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Livraisons push</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{pushStats.deliveries.successful || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Succès: {deliverySuccessRate}%</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Automations</p>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{pushStats.automations.enabled || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Actives / {pushStats.automations.total || 0}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5">
        {[
          { k: 'send', label: 'Envoyer' },
          { k: 'schedule', label: 'Programmer' },
          { k: 'scheduled', label: 'Programmées' },
          { k: 'automations', label: 'Auto' }
        ].map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={`px-3 py-2 rounded-xl text-sm font-semibold border transition ${tab === t.k ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'send' || tab === 'schedule') && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Ciblage</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
              >
                <option value="global">Tous les users (toutes workspaces)</option>
                <option value="workspace">Une workspace</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Workspace</label>
              <select
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                disabled={scope !== 'workspace'}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm disabled:bg-gray-50"
              >
                <option value="">Sélectionnerâ€¦</option>
                {wsOptions.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Titre</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                placeholder="Ex: Mise ù  jour importante"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                placeholder="Ex: Une nouvelle fonctionnalité est disponible..."
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">URL (optionnel)</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                placeholder="Ex: /ecom/dashboard"
              />
            </div>

            {tab === 'schedule' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date & heure</label>
                <input
                  type="datetime-local"
                  value={sendAt}
                  onChange={(e) => setSendAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                />
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            {tab === 'send' ? (
              <button
                type="button"
                onClick={sendNow}
                disabled={busy || !canSend || (scope === 'workspace' && !workspaceId)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                Envoyer maintenant
              </button>
            ) : (
              <button
                type="button"
                onClick={scheduleOne}
                disabled={busy || !canSend || !sendAt || (scope === 'workspace' && !workspaceId)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                Programmer
              </button>
            )}
          </div>
        </div>
      )}

      {tab === 'scheduled' && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">Notifications programmées</h2>
            <span className="text-xs text-gray-500">{scheduled.length}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {scheduled.length === 0 ? (
              <div className="px-5 py-10 text-sm text-gray-500">Aucune notification programmée</div>
            ) : scheduled.map((s) => (
              <div key={s._id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.body}</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {s.scope === 'global' ? 'Global' : 'Workspace'} • {new Date(s.sendAt).toLocaleString('fr-FR')}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Status: {s.status}</p>
                  </div>
                  {s.status === 'scheduled' && (
                    <button
                      type="button"
                      onClick={() => cancelScheduled(s._id)}
                      disabled={busy}
                      className="px-3 py-2 rounded-xl text-xs font-semibold border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'automations' && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Automations</h2>
              <p className="text-xs text-gray-500 mt-0.5">Préconfigurations ù  heures fixes (activables/désactivables).</p>
            </div>
            <button
              type="button"
              onClick={bootstrap}
              disabled={busy}
              className="px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Créer les préconfigs
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {automations.length === 0 ? (
              <div className="px-5 py-10 text-sm text-gray-500">Aucune automation</div>
            ) : automations.map((a) => (
              <div key={a._id} className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{a.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{a.payload?.title} — {a.payload?.body}</p>
                  <p className="text-[11px] text-gray-400 mt-1">Cron: {a.cron} • TZ: {a.timezone || 'Africa/Abidjan'}</p>
                  {a.lastRunAt && (
                    <p className="text-[11px] text-gray-400 mt-0.5">Dernier run: {new Date(a.lastRunAt).toLocaleString('fr-FR')}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleAutomation(a)}
                  disabled={busy}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border disabled:opacity-50 ${a.enabled ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  {a.enabled ? 'Activée' : 'Désactivée'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPushCenter;
