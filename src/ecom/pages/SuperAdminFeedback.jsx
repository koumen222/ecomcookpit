import React, { useCallback, useEffect, useState } from 'react';
import {
  MessageSquare, Star, TrendingDown, TrendingUp, Users,
  CheckCircle2, Eye, Inbox, FileText, Zap, Video, Image as ImageIcon,
  Mic, Languages, Copy, Bot, Film,
} from 'lucide-react';
import SuperAdminShell from '../components/SuperAdminShell.jsx';
import ecomApi from '../services/ecommApi.js';

// ─────────────────────────────────────────────────────────────────────────────
// SuperAdminFeedback — avis utilisateurs recueillis après chaque génération
// (page produit, créas, vidéo, image…) via le modal FeatureFeedbackModal.
// Source : GET /api/ecom/super-admin/feedback
// ─────────────────────────────────────────────────────────────────────────────

const FEATURE_LABELS = {
  product_page_generator: { label: 'Page Produit IA', icon: FileText, color: '#6366f1' },
  creative_generator:     { label: 'Créas Pub (images)', icon: Zap, color: '#f59e0b' },
  creative_text:          { label: 'Texte IA', icon: FileText, color: '#0ea5e9' },
  builder_ai_image:       { label: 'Image IA', icon: ImageIcon, color: '#8b5cf6' },
  creative_video:         { label: 'Vidéo IA', icon: Video, color: '#ef4444' },
  creative_voice:         { label: 'Voix off', icon: Mic, color: '#14b8a6' },
  creative_montage:       { label: 'Montage vidéo', icon: Film, color: '#f97316' },
  creative_lipsync:       { label: 'Avatar parlant', icon: Users, color: '#ec4899' },
  creative_translation:   { label: 'Traduction vidéo', icon: Languages, color: '#22c55e' },
  creative_clone:         { label: 'Clone de page', icon: Copy, color: '#64748b' },
  assistant_chat:         { label: 'Assistant IA', icon: Bot, color: '#10b981' },
  other:                  { label: 'Autre', icon: MessageSquare, color: '#94a3b8' },
};

const RATING_EMOJIS = { 1: '😖', 2: '😕', 3: '😐', 4: '🙂', 5: '🤩' };

const RANGES = [
  { value: '7', label: '7 jours' },
  { value: '30', label: '30 jours' },
  { value: '90', label: '90 jours' },
  { value: '365', label: '1 an' },
];

const RATING_FILTERS = [
  { value: '', label: 'Toutes les notes' },
  { value: 'negative', label: '😖😕 Mécontents (1-2)' },
  { value: '3', label: '😐 Neutres (3)' },
  { value: 'positive', label: '🙂🤩 Satisfaits (4-5)' },
];

const STATUS_META = {
  new:      { label: 'Nouveau', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  seen:     { label: 'Vu', bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
  resolved: { label: 'Traité', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const KpiCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
      <Icon className="w-5 h-5" style={{ color }} />
    </div>
    <div className="min-w-0">
      <p className="text-xl font-black text-slate-900 leading-tight">{value}</p>
      <p className="text-xs font-semibold text-slate-500 truncate">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const SuperAdminFeedback = () => {
  const [days, setDays] = useState('30');
  const [feature, setFeature] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ days, page: String(page), limit: '50' });
      if (feature) params.set('feature', feature);
      if (ratingFilter) params.set('rating', ratingFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await ecomApi.get(`/super-admin/feedback?${params.toString()}`);
      setData(res.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [days, feature, ratingFilter, statusFilter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [days, feature, ratingFilter, statusFilter]);

  const setStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      await ecomApi.patch(`/super-admin/feedback/${id}/status`, { status });
      setData((prev) => prev ? {
        ...prev,
        items: prev.items.map((it) => (it._id === id ? { ...it, status } : it)),
      } : prev);
    } catch { /* silencieux */ } finally {
      setUpdatingId(null);
    }
  };

  const stats = data?.stats;
  const dist = stats?.distribution || {};
  const maxDist = Math.max(1, ...Object.values(dist));
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const selectCls = 'px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer';

  return (
    <SuperAdminShell
      title="Feedbacks utilisateurs"
      subtitle="Avis recueillis après chaque génération (pages, créas, vidéos, images…)"
      icon={MessageSquare}
      error={error}
      refreshing={loading}
      onRefresh={fetchData}
    >
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <select value={days} onChange={(e) => setDays(e.target.value)} className={selectCls}>
          {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={feature} onChange={(e) => setFeature(e.target.value)} className={selectCls}>
          <option value="">Toutes les fonctionnalités</option>
          {Object.entries(FEATURE_LABELS).map(([key, f]) => (
            <option key={key} value={key}>{f.label}</option>
          ))}
        </select>
        <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)} className={selectCls}>
          {RATING_FILTERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
          <option value="">Tous les statuts</option>
          <option value="new">Nouveau</option>
          <option value="seen">Vu</option>
          <option value="resolved">Traité</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard icon={Inbox} label="Feedbacks reçus" value={stats?.total ?? '—'} color="#6366f1" />
        <KpiCard
          icon={Star}
          label="Note moyenne"
          value={stats?.avgRating != null ? `${stats.avgRating} / 5` : '—'}
          sub={stats?.avgRating != null ? RATING_EMOJIS[Math.round(stats.avgRating)] : ''}
          color="#f59e0b"
        />
        <KpiCard
          icon={TrendingUp}
          label="Satisfaits (4-5)"
          value={stats?.total ? `${Math.round((stats.positives / stats.total) * 100)}%` : '—'}
          sub={stats?.total ? `${stats.positives} avis` : ''}
          color="#10b981"
        />
        <KpiCard
          icon={TrendingDown}
          label="Mécontents (1-2)"
          value={stats?.total ? `${Math.round((stats.negatives / stats.total) * 100)}%` : '—'}
          sub={stats?.total ? `${stats.negatives} avis` : ''}
          color="#ef4444"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        {/* Répartition des notes */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-sm font-bold text-slate-900 mb-4">Répartition des notes</p>
          <div className="space-y-2.5">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="flex items-center gap-3">
                <span className="text-base w-7 text-center">{RATING_EMOJIS[n]}</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${((dist[n] || 0) / maxDist) * 100}%`,
                      background: n >= 4 ? '#10b981' : n === 3 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-600 w-8 text-right">{dist[n] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Par fonctionnalité */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:col-span-2">
          <p className="text-sm font-bold text-slate-900 mb-4">Par fonctionnalité</p>
          {(data?.perFeature || []).length === 0 ? (
            <p className="text-xs text-slate-400">Aucun feedback sur la période.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {(data?.perFeature || []).map((f) => {
                const metaF = FEATURE_LABELS[f._id] || FEATURE_LABELS.other;
                const FIcon = metaF.icon;
                const avg = f.avgRating != null ? +f.avgRating.toFixed(2) : null;
                return (
                  <button
                    key={f._id}
                    onClick={() => setFeature(feature === f._id ? '' : f._id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                      feature === f._id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${metaF.color}18` }}>
                      <FIcon className="w-4 h-4" style={{ color: metaF.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{metaF.label}</p>
                      <p className="text-[10px] text-slate-500">
                        {f.count} avis · {f.withComment} commentaire{f.withComment > 1 ? 's' : ''}
                        {f.negatives > 0 && <span className="text-red-500 font-semibold"> · {f.negatives} négatif{f.negatives > 1 ? 's' : ''}</span>}
                      </p>
                    </div>
                    {avg != null && (
                      <span className={`text-xs font-black flex-shrink-0 ${avg >= 4 ? 'text-emerald-600' : avg >= 3 ? 'text-amber-500' : 'text-red-500'}`}>
                        {avg} ★
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Liste des feedbacks */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900">
            Derniers feedbacks {data ? `(${data.total})` : ''}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
              >←</button>
              <span>{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
              >→</button>
            </div>
          )}
        </div>

        {loading && !data ? (
          <div className="p-10 text-center text-sm text-slate-400">Chargement…</div>
        ) : (data?.items || []).length === 0 ? (
          <div className="p-10 text-center">
            <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Aucun feedback sur cette période / ces filtres.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {(data?.items || []).map((fb) => {
              const metaF = FEATURE_LABELS[fb.feature] || FEATURE_LABELS.other;
              const st = STATUS_META[fb.status] || STATUS_META.new;
              return (
                <div key={fb._id} className="px-5 py-4 hover:bg-slate-50/60 transition">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none mt-0.5">{RATING_EMOJIS[fb.rating] || '—'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${metaF.color}15`, color: metaF.color }}
                        >
                          {metaF.label}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ background: st.bg, color: st.color, borderColor: st.border }}>
                          {st.label}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatDate(fb.createdAt)}</span>
                      </div>
                      {fb.comment ? (
                        <p className="text-sm text-slate-800 mt-1.5 whitespace-pre-wrap break-words">{fb.comment}</p>
                      ) : (
                        <p className="text-xs text-slate-400 italic mt-1.5">Sans commentaire</p>
                      )}
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        {fb.userId?.name || '—'}
                        {fb.userId?.email ? ` · ${fb.userId.email}` : ''}
                        {fb.workspaceId?.name ? ` · ${fb.workspaceId.name}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {fb.status !== 'seen' && fb.status !== 'resolved' && (
                        <button
                          onClick={() => setStatus(fb._id, 'seen')}
                          disabled={updatingId === fb._id}
                          title="Marquer comme vu"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition disabled:opacity-40"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {fb.status !== 'resolved' && (
                        <button
                          onClick={() => setStatus(fb._id, 'resolved')}
                          disabled={updatingId === fb._id}
                          title="Marquer comme traité"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition disabled:opacity-40"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
};

export default SuperAdminFeedback;
