import React, { useState, useEffect, useCallback } from 'react';
import { marketingApi } from '../services/marketingApi.js';
import MarketingCompose from './MarketingCompose.jsx';

const STATUS_LABELS = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-600' },
  scheduled: { label: 'Planifiée', color: 'bg-emerald-100 text-emerald-700' },
  sending: { label: 'En cours', color: 'bg-yellow-100 text-yellow-700' },
  sent: { label: 'Envoyée', color: 'bg-green-100 text-green-700' },
  failed: { label: 'Échec', color: 'bg-red-100 text-red-700' },
};

const fmtDate = d => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtN = n => !n ? '0' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);

const Badge = ({ status }) => {
  const s = STATUS_LABELS[status] || STATUS_LABELS.draft;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.color}`}>{s.label}</span>;
};

const Spin = () => (
  <div className="space-y-2">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
      </div>
    ))}
  </div>
);

const Dlg = ({ open, onClose, title, children, w = 'max-w-xl' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${w} max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b"><h2 className="text-base font-semibold">{title}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button></div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

export default function Marketing() {
  const [tab, setTab] = useState('campaigns');
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pg, setPg] = useState({ page: 1, pages: 1, total: 0 });
  const [fStatus, setFStatus] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [sendId, setSendId] = useState(null);
  const [resId, setResId] = useState(null);
  const [resData, setResData] = useState(null);
  const [delId, setDelId] = useState(null);
  const [sendConf, setSendConf] = useState(null);
  const [waInstances, setWaInstances] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const flash = (m, t = 'ok') => {
    if (t === 'ok') { setOk(m); setTimeout(() => setOk(''), 4000); }
    else { setErr(m); setTimeout(() => setErr(''), 5000); }
  };

  const loadC = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const r = await marketingApi.getCampaigns({ page: p, limit: 15, ...(fStatus ? { status: fStatus } : {}) });
      setCampaigns(r.data.data.campaigns);
      setPg({ page: r.data.data.page, pages: r.data.data.pages, total: r.data.data.total });
    } catch { flash('Erreur chargement', 'err'); }
    finally { setLoading(false); }
  }, [fStatus]);

  const loadStats = useCallback(async () => {
    try { const r = await marketingApi.getStats(); setStats(r.data.data); } catch {}
  }, []);

  useEffect(() => {
    if (tab === 'campaigns') loadC(1);
    if (tab === 'stats') { loadC(1); loadStats(); }
  }, [tab, fStatus]);

  const waStatusLabel = (status) => {
    if (status === 'connected') return { label: 'Connecté', cls: 'bg-green-100 text-green-700' };
    if (status === 'active') return { label: 'Actif', cls: 'bg-green-100 text-green-700' };
    if (status === 'configured') return { label: 'Configuré', cls: 'bg-blue-100 text-blue-700' };
    if (status === 'disconnected') return { label: 'Déconnecté', cls: 'bg-red-100 text-red-600' };
    return { label: 'Non vérifié', cls: 'bg-gray-100 text-gray-500' };
  };

  const loadWaInstances = async () => {
    setLoadingInstances(true);
    setWaInstances([]);
    try {
      const user = JSON.parse(localStorage.getItem('ecomUser') || '{}');
      const uId = user._id || user.id;
      if (!uId) throw new Error("Utilisateur non identifié");
      
      const res = await marketingApi.getWhatsAppInstances(uId);
      setWaInstances(res.data.instances || []);
    } catch (e) {
      console.error('Erreur chargement instances WA:', e);
      flash("Impossible de charger les instances WhatsApp", "err");
    } finally {
      setLoadingInstances(false);
    }
  };

  const refreshWaStatus = async () => {
    setLoadingInstances(true);
    try {
      const user = JSON.parse(localStorage.getItem('ecomUser') || '{}');
      const uId = user._id || user.id;
      const { default: ecomApi } = await import('../services/ecommApi.js');
      const res = await ecomApi.post('/v1/external/whatsapp/refresh-status', { userId: uId });
      setWaInstances(res.data?.instances || []);
    } catch {
      flash("Impossible d'actualiser les statuts", "err");
    } finally {
      setLoadingInstances(false);
    }
  };

  const send = (id) => {
    setSendConf(id);
    loadWaInstances();
  };

  const sendWithInstance = async (instanceId) => {
    const campaignId = sendConf;
    const inst = waInstances.find(i => i._id === instanceId);

    if (inst && inst.status !== 'connected' && inst.status !== 'active') {
      flash(`L'instance "${inst.customName || inst.instanceName}" n'est pas connectée. Actualisez son statut.`, 'err');
      return;
    }

    setSelectedInstanceId(instanceId);
    setSendConf(null);
    setSendId(campaignId);
    try {
      const r = await marketingApi.sendCampaign(campaignId, { whatsappInstanceId: instanceId });
      flash(`✅ ${r.data.message}`);
      loadC(pg.page);
      loadStats();
    } catch (e) {
      flash(e.response?.data?.message || "Erreur d'envoi", 'err');
    } finally {
      setSendId(null);
      setSelectedInstanceId(null);
    }
  };

  const del = async (id) => {
    setDelId(null);
    try { await marketingApi.deleteCampaign(id); flash('Supprimée'); loadC(pg.page); loadStats(); }
    catch (e) { flash(e.response?.data?.message || 'Erreur', 'err'); }
  };

  const dup = async (id) => {
    try { await marketingApi.duplicateCampaign(id); flash('Dupliquée ✅'); loadC(1); }
    catch { flash('Erreur', 'err'); }
  };

  const openRes = async (id) => {
    setResId(id); setResData(null);
    try { const r = await marketingApi.getCampaignResults(id); setResData(r.data.data); }
    catch { setResData({ error: true }); }
  };

  const goCompose = (id = null) => { setEditingId(id); setTab('compose'); };
  const backToCampaigns = () => { setEditingId(null); setTab('campaigns'); loadC(1); };

  // ─── CAMPAIGNS TAB ─────────────────────────────────────────────────────────
  const tabCampaigns = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          {['', 'draft', 'scheduled', 'sending', 'sent', 'failed'].map(s => (
            <button key={s} onClick={() => setFStatus(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${fStatus === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
              {s === '' ? 'Toutes' : STATUS_LABELS[s]?.label}
            </button>
          ))}
        </div>
        <button onClick={() => goCompose()} className="sm:ml-auto flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
          + Nouvelle campagne
        </button>
      </div>
      {loading ? <Spin /> : campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">📧</div>
          <p className="text-gray-500 font-medium">Aucune campagne email</p>
          <button onClick={() => goCompose()} className="mt-4 px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">Créer une campagne</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-100">
                <th className="px-4 py-3 text-left font-medium">Campagne</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Ciblés</th>
                <th className="px-4 py-3 text-right font-medium">Envoyés</th>
                <th className="px-4 py-3 text-right font-medium">Échecs</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {campaigns.map(c => (
                  <tr key={c._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><p className="font-medium text-gray-900 truncate max-w-[160px]">{c.name}</p><p className="text-xs text-gray-400 truncate max-w-[160px]">{c.subject}</p></td>
                    <td className="px-4 py-3"><Badge status={c.status} /></td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtN(c.stats?.targeted)}</td>
                    <td className="px-4 py-3 text-right"><span className={c.stats?.sent > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>{fmtN(c.stats?.sent)}</span></td>
                    <td className="px-4 py-3 text-right"><span className={c.stats?.failed > 0 ? 'text-red-500' : 'text-gray-400'}>{fmtN(c.stats?.failed)}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{c.sentAt ? fmtDate(c.sentAt) : c.scheduledAt ? `📅 ${fmtDate(c.scheduledAt)}` : fmtDate(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {['draft', 'scheduled'].includes(c.status) && <button onClick={() => send(c._id)} disabled={sendId === c._id} className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">{sendId === c._id ? '...' : '▶ Envoyer'}</button>}
                        {c.status === 'sent' && <button onClick={() => openRes(c._id)} className="px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">📊</button>}
                        {['draft', 'scheduled'].includes(c.status) && <button onClick={() => goCompose(c._id)} className="px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">✏️</button>}
                        <button onClick={() => dup(c._id)} className="px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">⧉</button>
                        {c.status !== 'sending' && <button onClick={() => setDelId(c._id)} className="px-2.5 py-1 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100">🗑</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pg.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Page {pg.page}/{pg.pages} ({pg.total})</p>
              <div className="flex gap-2">
                <button onClick={() => loadC(pg.page - 1)} disabled={pg.page <= 1} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Préc.</button>
                <button onClick={() => loadC(pg.page + 1)} disabled={pg.page >= pg.pages} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50">Suiv. →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ─── STATS TAB ─────────────────────────────────────────────────────────────
  const tabStats = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total campagnes', value: stats?.totalCampaigns ?? '—', icon: '📧' },
          { label: 'Emails envoyés', value: fmtN(stats?.totalSent), icon: '✅' },
          { label: 'Échecs', value: fmtN(stats?.totalFailed), icon: '❌' },
          { label: 'Taux de succès', value: stats?.totalSent ? `${Math.round((stats.totalSent / (stats.totalSent + stats.totalFailed)) * 100)}%` : '—', icon: '📈' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Dernières campagnes envoyées</h3>
        {campaigns.filter(c => c.status === 'sent').length === 0 ? (
          <p className="text-sm text-gray-400">Aucune campagne envoyée</p>
        ) : (
          <div className="space-y-3">
            {campaigns.filter(c => c.status === 'sent').slice(0, 5).map(c => (
              <div key={c._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-500">{fmtDate(c.sentAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm"><span className="text-green-600 font-medium">{c.stats?.sent || 0}</span> envoyés</p>
                  {c.stats?.failed > 0 && <p className="text-xs text-red-500">{c.stats.failed} échecs</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Marketing Email</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez vos campagnes email et suivez leurs performances</p>
        </div>

        {/* Alerts */}
        {ok && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">{ok}</div>}
        {err && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{err}</div>}

        {/* Tabs */}
        {tab !== 'compose' && (
          <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
            {[{ k: 'campaigns', l: '📋 Campagnes' }, { k: 'stats', l: '📊 Statistiques' }].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t.k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                {t.l}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {tab === 'campaigns' && tabCampaigns()}
        {tab === 'compose' && <MarketingCompose editingId={editingId} onSaved={backToCampaigns} onCancel={backToCampaigns} flash={flash} />}
        {tab === 'stats' && tabStats()}

        {/* Send confirmation modal */}
        <Dlg open={!!sendConf} onClose={() => { setSendConf(null); setSelectedInstanceId(null); }} title="Envoyer via WhatsApp">
          <p className="text-sm text-gray-600 mb-4">Cliquez sur une instance connectée pour lancer l'envoi.</p>
          
          {/* Sélection des instances WhatsApp */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                📱 Choisir l'instance
              </h4>
              <button
                onClick={refreshWaStatus}
                disabled={loadingInstances}
                className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 disabled:opacity-40"
              >
                <svg className={`w-3 h-3 ${loadingInstances ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Actualiser
              </button>
            </div>
            {loadingInstances ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                Chargement des instances...
              </div>
            ) : waInstances.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">Aucune instance WhatsApp active trouvée.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {waInstances.map(inst => {
                  const isReady = inst.status === 'connected' || inst.status === 'active';
                  return (
                    <button
                      key={inst._id}
                      type="button"
                      onClick={() => sendWithInstance(inst._id)}
                      disabled={!isReady}
                      className={`w-full flex items-center p-3 rounded-lg border text-left transition-all ${
                        isReady
                          ? 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 cursor-pointer'
                          : 'border-gray-100 opacity-60 cursor-not-allowed'
                      }`}
                      title={isReady ? `Envoyer via ${inst.customName || inst.instanceName}` : 'Instance non connectée'}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700">{inst.customName || inst.instanceName}</p>
                        <p className="text-[10px] text-gray-400 font-mono uppercase">{inst.instanceName}</p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${waStatusLabel(inst.status).cls}`}>
                        {waStatusLabel(inst.status).label}
                      </span>
                      {!isReady && <span className="ml-2 text-[10px] text-amber-500">⚠</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-gray-50">
            <button 
              onClick={() => { setSendConf(null); setSelectedInstanceId(null); }} 
              className="w-full py-2.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
            >
              Annuler
            </button>
          </div>
        </Dlg>

        {/* Delete confirmation modal */}
        <Dlg open={!!delId} onClose={() => setDelId(null)} title="Supprimer la campagne">
          <p className="text-sm text-gray-600 mb-4">Cette action est irréversible. Continuer ?</p>
          <div className="flex gap-3">
            <button onClick={() => setDelId(null)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Annuler</button>
            <button onClick={() => del(delId)} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">🗑 Supprimer</button>
          </div>
        </Dlg>

        {/* Results modal */}
        <Dlg open={!!resId} onClose={() => setResId(null)} title="Résultats de la campagne" w="max-w-2xl">
          {!resData ? <Spin /> : resData.error ? <p className="text-red-500">Erreur de chargement</p> : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg text-center"><p className="text-2xl font-bold text-gray-900">{resData.stats?.targeted || 0}</p><p className="text-xs text-gray-500">Ciblés</p></div>
                <div className="bg-green-50 p-4 rounded-lg text-center"><p className="text-2xl font-bold text-green-600">{resData.stats?.sent || 0}</p><p className="text-xs text-gray-500">Envoyés</p></div>
                <div className="bg-red-50 p-4 rounded-lg text-center"><p className="text-2xl font-bold text-red-600">{resData.stats?.failed || 0}</p><p className="text-xs text-gray-500">Échecs</p></div>
              </div>
              {resData.results?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Détails ({resData.results.length})</h4>
                  <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-gray-50 border-b"><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-left">Statut</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {resData.results.slice(0, 100).map((r, i) => (
                          <tr key={i}><td className="px-3 py-2 text-gray-700">{r.email}</td><td className="px-3 py-2"><span className={r.status === 'sent' ? 'text-green-600' : 'text-red-500'}>{r.status === 'sent' ? '✅' : '❌'} {r.status}</span></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </Dlg>
      </div>
    </div>
  );
}
