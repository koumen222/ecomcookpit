import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail, Send, BarChart2, Plus, Search, RefreshCw, Trash2,
  Edit3, Copy, Play, ChevronLeft, ChevronRight, X,
  CheckCircle2, AlertCircle, Clock, Eye, MousePointerClick,
  TrendingUp, Users, Zap, Calendar, ArrowUpRight,
  Filter, MoreHorizontal, ExternalLink, Smartphone,
  MessageSquare, Loader2
} from 'lucide-react';
import { marketingApi } from '../services/marketingApi.js';
import MarketingCompose from './MarketingCompose.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS = {
  draft:     { label: 'Brouillon',  icon: Edit3,        dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600 ring-slate-200'  },
  scheduled: { label: 'Planifiée',  icon: Calendar,     dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 ring-blue-200'      },
  sending:   { label: 'En cours',   icon: Loader2,      dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 ring-amber-200'   },
  sent:      { label: 'Envoyée',    icon: CheckCircle2, dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  failed:    { label: 'Échouée',    icon: AlertCircle,  dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700 ring-red-200'         },
};

const fmt  = n => !n ? '0' : n >= 1_000_000 ? (n/1_000_000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'k' : String(n);
const date = d => d ? new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';
const pct  = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;

// ─── Micro components ─────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.draft;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ring-1 ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === 'sending' ? 'animate-pulse' : ''}`} />
      {s.label}
    </span>
  );
};

const Stat = ({ label, value, sub, icon: Icon, accent = '#059669', light = '#ecfdf5', loading }) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
    {loading ? (
      <div className="space-y-2 animate-pulse">
        <div className="w-8 h-8 rounded-xl bg-slate-100" />
        <div className="h-7 w-16 bg-slate-100 rounded-lg mt-3" />
        <div className="h-3 w-24 bg-slate-50 rounded" />
      </div>
    ) : (
      <>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: light }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
        <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{value}</p>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </>
    )}
  </div>
);

// Toast notification — appears top-right, auto-dismisses
const Toast = ({ toasts, dismiss }) => (
  <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
    {toasts.map(t => (
      <div key={t.id} className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto transition-all duration-300 ${
        t.type === 'ok'
          ? 'bg-emerald-600 text-white'
          : 'bg-red-600 text-white'
      }`}>
        {t.type === 'ok'
          ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
        <span>{t.msg}</span>
        <button onClick={() => dismiss(t.id)} className="ml-1 opacity-70 hover:opacity-100">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    ))}
  </div>
);

// Modal
const Modal = ({ open, onClose, title, children, size = 'max-w-md' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${size} max-h-[88vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

// Skeleton row
const SkeletonRow = () => (
  <tr className="animate-pulse">
    {[140, 80, 60, 60, 60, 90, 100].map((w, i) => (
      <td key={i} className="px-4 py-3.5">
        <div className={`h-3.5 bg-slate-100 rounded`} style={{ width: w }} />
        {i === 0 && <div className="h-3 bg-slate-50 rounded mt-1.5 w-20" />}
      </td>
    ))}
  </tr>
);

// ─── Main component ───────────────────────────────────────────────────────────

export default function Marketing() {
  const [view, setView]           = useState('campaigns'); // 'campaigns' | 'stats' | 'compose'
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [pg, setPg]               = useState({ page: 1, pages: 1, total: 0 });
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch]       = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchTimer               = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [waModal, setWaModal]     = useState(null); // campaign id
  const [waInstances, setWaInstances] = useState([]);
  const [waLoading, setWaLoading] = useState(false);
  const [openMenu, setOpenMenu]   = useState(null); // campaign id with open menu
  const [toasts, setToasts]       = useState([]);

  // ─── Toast helpers ─────────────────────────────────────────────────────────
  const toast = useCallback((msg, type = 'ok') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);
  const dismissToast = id => setToasts(prev => prev.filter(t => t.id !== id));

  // ─── Data loading ──────────────────────────────────────────────────────────
  const filterStatusRef = useRef(filterStatus);
  const searchRef = useRef(search);
  filterStatusRef.current = filterStatus;
  searchRef.current = search;

  const loadCampaigns = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (filterStatusRef.current) params.status = filterStatusRef.current;
      if (searchRef.current) params.search = searchRef.current;
      const r = await marketingApi.getCampaigns(params);
      const d = r.data.data;
      setCampaigns(d.campaigns || []);
      setPg({ page: d.page || 1, pages: d.pages || 1, total: d.total || 0 });
    } catch {
      setToasts(prev => { const id = Date.now(); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500); return [...prev, { id, msg: 'Erreur lors du chargement des campagnes', type: 'err' }]; });
    } finally {
      setLoading(false);
    }
  }, []); // stable — lit filterStatus/search via ref

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const r = await marketingApi.getStats();
      const d = r.data?.data || {};
      const t = d.totals || {};
      setStats({
        total: d.total || 0,
        sent: t.totalSent || 0,
        failed: t.totalFailed || 0,
        targeted: t.totalTargeted || 0,
        opened: t.totalOpened || 0,
        clicked: t.totalClicked || 0,
        openRate: t.openRate || 0,
        clickRate: t.clickRate || 0,
        byStatus: d.byStatus || {},
      });
    } catch {} finally {
      setStatsLoading(false);
    }
  }, []);

  // Au montage uniquement
  useEffect(() => {
    loadCampaigns(1);
    loadStats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  const handleSearchInput = (v) => {
    setSearchInput(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchRef.current = v;
      setSearch(v);
      loadCampaigns(1);
    }, 400);
  };

  // Close menu on outside click
  useEffect(() => {
    const h = () => setOpenMenu(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  // ─── Actions ──────────────────────────────────────────────────────────────
  const sendCampaign = async (id, instanceId = null) => {
    setSendingId(id);
    try {
      const body = instanceId ? { whatsappInstanceId: instanceId } : {};
      const r = await marketingApi.sendCampaign(id, body);
      toast(r.data.message || 'Campagne envoyée');
      await loadCampaigns(pg.page);
      loadStats();
    } catch (e) {
      toast(e.response?.data?.message || "Erreur lors de l'envoi", 'err');
    } finally {
      setSendingId(null);
      setWaModal(null);
    }
  };

  const deleteCampaign = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      await marketingApi.deleteCampaign(id);
      toast('Campagne supprimée');
      loadCampaigns(pg.page);
      loadStats();
    } catch (e) {
      toast(e.response?.data?.message || 'Erreur', 'err');
    }
  };

  const dupCampaign = async (id) => {
    try {
      await marketingApi.duplicateCampaign(id);
      toast('Campagne dupliquée');
      loadCampaigns(1);
    } catch {
      toast('Erreur lors de la duplication', 'err');
    }
  };

  const openWaModal = async (id) => {
    setWaModal(id);
    setWaInstances([]);
    setWaLoading(true);
    try {
      const user = (() => { try { return JSON.parse(localStorage.getItem('ecomUser') || '{}'); } catch { return {}; } })();
      const uId = user._id || user.id;
      const r = await marketingApi.getWhatsAppInstances(uId);
      setWaInstances(r.data.instances || []);
    } catch {
      toast('Impossible de charger les instances WhatsApp', 'err');
    } finally {
      setWaLoading(false);
    }
  };

  const refreshWaStatus = async () => {
    setWaLoading(true);
    try {
      const user = (() => { try { return JSON.parse(localStorage.getItem('ecomUser') || '{}'); } catch { return {}; } })();
      const { default: ecomApi } = await import('../services/ecommApi.js');
      const r = await ecomApi.post('/v1/external/whatsapp/refresh-status', { userId: user._id || user.id });
      setWaInstances(r.data?.instances || []);
    } catch {
      toast("Impossible d'actualiser les statuts", 'err');
    } finally {
      setWaLoading(false);
    }
  };

  const waStatusStyle = (status) => {
    if (status === 'connected' || status === 'active') return { label: 'Connecté', cls: 'bg-emerald-100 text-emerald-700', ready: true };
    if (status === 'configured')   return { label: 'Configuré',   cls: 'bg-blue-100 text-blue-600',   ready: false };
    if (status === 'disconnected') return { label: 'Déconnecté',  cls: 'bg-red-100 text-red-600',     ready: false };
    return { label: 'Inactif', cls: 'bg-slate-100 text-slate-500', ready: false };
  };

  const goCompose = (id = null) => { setEditingId(id); setView('compose'); };
  const backFromCompose = () => { setEditingId(null); setView('campaigns'); loadCampaigns(1); loadStats(); };

  // ─── Compose view ──────────────────────────────────────────────────────────
  if (view === 'compose') {
    return (
      <>
        <Toast toasts={toasts} dismiss={dismissToast} />
        <MarketingCompose editingId={editingId} onSaved={backFromCompose} onCancel={backFromCompose} flash={(m, t) => toast(m, t === 'err' ? 'err' : 'ok')} />
      </>
    );
  }

  // ─── Stats numbers ─────────────────────────────────────────────────────────
  const successRate = stats ? pct(stats.sent, stats.sent + stats.failed) : 0;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <Toast toasts={toasts} dismiss={dismissToast} />

      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 pt-6 pb-5 shadow-xl">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-white tracking-tight">Marketing Email</h1>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {stats ? `${fmt(stats.total)} campagnes · ${fmt(stats.sent)} envois` : 'Chargement…'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/ecom/marketing/analytics"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Analytics
                <ExternalLink className="w-3 h-3 opacity-60" />
              </Link>
              <button
                onClick={() => goCompose()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Nouvelle campagne
              </button>
            </div>
          </div>

          {/* KPI strip in header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Envoyés',      value: fmt(stats?.sent),      icon: Send,              color: '#34d399' },
              { label: 'Ouvertures',   value: `${stats?.openRate || 0}%`, icon: Eye,           color: '#60a5fa' },
              { label: 'Clics',        value: `${stats?.clickRate || 0}%`, icon: MousePointerClick, color: '#a78bfa' },
              { label: 'Taux succès',  value: `${successRate}%`,     icon: TrendingUp,        color: '#fb923c' },
            ].map((k, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <k.icon className="w-4 h-4 flex-shrink-0" style={{ color: k.color }} />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-medium truncate">{k.label}</p>
                  <p className="text-sm font-extrabold text-white">{stats ? k.value : '—'}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tab nav */}
          <nav className="flex gap-1">
            {[
              { k: 'campaigns', label: 'Campagnes', icon: Mail },
              { k: 'stats',     label: 'Statistiques', icon: BarChart2 },
            ].map(({ k, label, icon: Icon }) => (
              <button
                key={k}
                onClick={() => setView(k)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  view === k
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Page body ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ─ CAMPAIGNS VIEW ─────────────────────────────────────────────── */}
        {view === 'campaigns' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher une campagne…"
                  value={searchInput}
                  onChange={e => handleSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 placeholder:text-slate-400"
                />
              </div>

              {/* Status filter pills */}
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { k: '',          label: 'Toutes' },
                  { k: 'draft',     label: 'Brouillon' },
                  { k: 'scheduled', label: 'Planifiées' },
                  { k: 'sending',   label: 'En cours' },
                  { k: 'sent',      label: 'Envoyées' },
                  { k: 'failed',    label: 'Échec' },
                ].map(({ k, label }) => (
                  <button
                    key={k}
                    onClick={() => { filterStatusRef.current = k; setFilterStatus(k); loadCampaigns(1); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-xl border transition-all ${
                      filterStatus === k
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700'
                    }`}
                  >
                    {k && <span className={`w-1.5 h-1.5 rounded-full ${STATUS[k]?.dot || 'bg-slate-400'}`} />}
                    {label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => loadCampaigns(pg.page)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-400 rounded-xl transition-all ml-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
            </div>

            {/* Table card */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {campaigns.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                    <Mail className="w-7 h-7 text-emerald-500" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 mb-1">Aucune campagne</h3>
                  <p className="text-sm text-slate-400 mb-5 max-w-xs">
                    {filterStatus || search
                      ? 'Aucun résultat pour ce filtre.'
                      : 'Créez votre première campagne email et commencez à engager vos clients.'}
                  </p>
                  {!filterStatus && !search && (
                    <button
                      onClick={() => goCompose()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-500 transition-all shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Créer une campagne
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        {['Campagne', 'Statut', 'Ciblés', 'Envoyés', 'Échecs', 'Date', ''].map((h, i) => (
                          <th key={i} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${i >= 2 && i <= 4 ? 'text-right' : i === 5 ? 'text-left' : i === 6 ? 'text-right' : 'text-left'}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {loading
                        ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                        : campaigns.map(c => {
                            const isSending = sendingId === c._id;
                            const canSend   = ['draft', 'scheduled'].includes(c.status);
                            const canEdit   = ['draft', 'scheduled'].includes(c.status);
                            const menuOpen  = openMenu === c._id;

                            return (
                              <tr key={c._id} className="group hover:bg-slate-50/80 transition-colors">
                                {/* Campaign name */}
                                <td className="px-4 py-3.5 min-w-[180px]">
                                  <p className="font-semibold text-slate-800 text-sm truncate max-w-[200px]">{c.name}</p>
                                  <p className="text-[11px] text-slate-400 truncate max-w-[200px] mt-0.5">{c.subject || '—'}</p>
                                </td>

                                {/* Status */}
                                <td className="px-4 py-3.5">
                                  <StatusBadge status={c.status} />
                                </td>

                                {/* Ciblés */}
                                <td className="px-4 py-3.5 text-right text-sm font-medium text-slate-600">
                                  {fmt(c.stats?.targeted)}
                                </td>

                                {/* Envoyés */}
                                <td className="px-4 py-3.5 text-right">
                                  <span className={`text-sm font-semibold ${(c.stats?.sent || 0) > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {fmt(c.stats?.sent)}
                                  </span>
                                </td>

                                {/* Échecs */}
                                <td className="px-4 py-3.5 text-right">
                                  <span className={`text-sm font-semibold ${(c.stats?.failed || 0) > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                                    {fmt(c.stats?.failed)}
                                  </span>
                                </td>

                                {/* Date */}
                                <td className="px-4 py-3.5 text-[11px] text-slate-500 whitespace-nowrap">
                                  {c.sentAt
                                    ? <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" />{date(c.sentAt)}</span>
                                    : c.scheduledAt
                                    ? <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-blue-500" />{date(c.scheduledAt)}</span>
                                    : <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" />{date(c.createdAt)}</span>
                                  }
                                </td>

                                {/* Actions */}
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {/* Envoyer */}
                                    {canSend && (
                                      <button
                                        onClick={() => sendCampaign(c._id)}
                                        disabled={isSending}
                                        title="Envoyer"
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all disabled:opacity-50 shadow-sm"
                                      >
                                        {isSending
                                          ? <Loader2 className="w-3 h-3 animate-spin" />
                                          : <Send className="w-3 h-3" />}
                                        {isSending ? 'Envoi…' : 'Envoyer'}
                                      </button>
                                    )}

                                    {/* Voir résultats */}
                                    {c.status === 'sent' && (
                                      <Link
                                        to={`/ecom/marketing/campaigns/${c._id}/results`}
                                        title="Voir les résultats"
                                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                      >
                                        <BarChart2 className="w-3.5 h-3.5" />
                                      </Link>
                                    )}

                                    {/* Éditer */}
                                    {canEdit && (
                                      <button
                                        onClick={() => goCompose(c._id)}
                                        title="Modifier"
                                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                    {/* Menu ⋯ */}
                                    <div className="relative">
                                      <button
                                        onClick={e => { e.stopPropagation(); setOpenMenu(menuOpen ? null : c._id); }}
                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                      >
                                        <MoreHorizontal className="w-3.5 h-3.5" />
                                      </button>
                                      {menuOpen && (
                                        <div className="absolute right-0 top-8 z-30 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 w-44" onClick={e => e.stopPropagation()}>
                                          <button onClick={() => { dupCampaign(c._id); setOpenMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 text-left">
                                            <Copy className="w-3.5 h-3.5 text-slate-400" /> Dupliquer
                                          </button>
                                          {canSend && (
                                            <button onClick={() => { openWaModal(c._id); setOpenMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 text-left">
                                              <MessageSquare className="w-3.5 h-3.5 text-slate-400" /> Envoyer via WhatsApp
                                            </button>
                                          )}
                                          {c.status !== 'sending' && (
                                            <>
                                              <div className="h-px bg-slate-100 mx-3 my-1" />
                                              <button onClick={() => { setDeleteTarget(c._id); setOpenMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 text-left">
                                                <Trash2 className="w-3.5 h-3.5" /> Supprimer
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                      }
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {pg.pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/40">
                  <p className="text-[11px] text-slate-500 font-medium">
                    Page <span className="font-bold text-slate-700">{pg.page}</span> sur {pg.pages} — <span className="font-bold text-slate-700">{fmt(pg.total)}</span> campagnes
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => loadCampaigns(pg.page - 1)}
                      disabled={pg.page <= 1}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 transition-all"
                    >
                      <ChevronLeft className="w-3 h-3" /> Préc.
                    </button>
                    <button
                      onClick={() => loadCampaigns(pg.page + 1)}
                      disabled={pg.page >= pg.pages}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 transition-all"
                    >
                      Suiv. <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─ STATS VIEW ──────────────────────────────────────────────────── */}
        {view === 'stats' && (
          <div className="space-y-5">
            {/* KPI grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Campagnes" value={statsLoading ? '—' : fmt(stats?.total)} icon={Mail} accent="#059669" light="#ecfdf5" loading={statsLoading} />
              <Stat label="Emails envoyés" value={statsLoading ? '—' : fmt(stats?.sent)} icon={Send} accent="#3b82f6" light="#eff6ff" loading={statsLoading} />
              <Stat label="Ouvertures" value={statsLoading ? '—' : fmt(stats?.opened)} sub={`Taux ${stats?.openRate || 0}%`} icon={Eye} accent="#8b5cf6" light="#f5f3ff" loading={statsLoading} />
              <Stat label="Clics" value={statsLoading ? '—' : fmt(stats?.clicked)} sub={`Taux ${stats?.clickRate || 0}%`} icon={MousePointerClick} accent="#f97316" light="#fff7ed" loading={statsLoading} />
              <Stat label="Ciblés" value={statsLoading ? '—' : fmt(stats?.targeted)} icon={Users} accent="#0891b2" light="#ecfeff" loading={statsLoading} />
              <Stat label="Échecs" value={statsLoading ? '—' : fmt(stats?.failed)} icon={AlertCircle} accent="#ef4444" light="#fef2f2" loading={statsLoading} />
              <Stat label="Taux de succès" value={statsLoading ? '—' : `${successRate}%`} icon={TrendingUp} accent="#10b981" light="#ecfdf5" loading={statsLoading} />
              <Stat label="Campagnes actives" value={statsLoading ? '—' : fmt((stats?.byStatus?.sending || 0) + (stats?.byStatus?.scheduled || 0))} icon={Zap} accent="#d97706" light="#fffbeb" loading={statsLoading} />
            </div>

            {/* Recent sent campaigns */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">Dernières campagnes envoyées</h3>
                <button onClick={() => setView('campaigns')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 flex items-center gap-1">
                  Voir tout <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
              {campaigns.filter(c => c.status === 'sent').length === 0 ? (
                <div className="py-12 text-center">
                  <Send className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Aucune campagne envoyée pour l'instant</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {campaigns.filter(c => c.status === 'sent').slice(0, 8).map(c => {
                    const rate = pct(c.stats?.sent, c.stats?.targeted);
                    return (
                      <div key={c._id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors group">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                          <p className="text-[11px] text-slate-400">{date(c.sentAt)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-slate-800">{fmt(c.stats?.sent)} <span className="text-slate-400 font-normal">envoyés</span></p>
                          <p className="text-[11px] text-slate-400">{rate}% de succès</p>
                        </div>
                        <Link to={`/ecom/marketing/campaigns/${c._id}/results`} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-100 transition-all">
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Delete confirmation modal ── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Supprimer la campagne">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-sm text-slate-600 mb-1">Vous allez supprimer cette campagne.</p>
          <p className="text-xs text-slate-400 mb-6">Cette action est irréversible et supprimera toutes les statistiques associées.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 text-sm font-semibold bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors">
              Annuler
            </button>
            <button onClick={deleteCampaign} className="flex-1 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-500 transition-colors shadow-sm">
              Supprimer
            </button>
          </div>
        </div>
      </Modal>

      {/* ── WhatsApp send modal ── */}
      <Modal open={!!waModal} onClose={() => setWaModal(null)} title="Envoyer via WhatsApp" size="max-w-sm">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Sélectionnez une instance connectée pour lancer l'envoi.</p>
            <button onClick={refreshWaStatus} disabled={waLoading} className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-500 disabled:opacity-40">
              <RefreshCw className={`w-3 h-3 ${waLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>

          {waLoading ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : waInstances.length === 0 ? (
            <div className="py-8 text-center">
              <Smartphone className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Aucune instance WhatsApp active</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {waInstances.map(inst => {
                const s = waStatusStyle(inst.status);
                return (
                  <button
                    key={inst._id}
                    type="button"
                    onClick={() => s.ready && sendCampaign(waModal, inst._id)}
                    disabled={!s.ready || !!sendingId}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                      s.ready
                        ? 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 cursor-pointer'
                        : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <MessageSquare className={`w-4 h-4 ${s.ready ? 'text-emerald-500' : 'text-slate-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{inst.customName || inst.instanceName}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{inst.instanceName}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.cls}`}>
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <button onClick={() => setWaModal(null)} className="w-full py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
            Annuler
          </button>
        </div>
      </Modal>
    </div>
  );
}
