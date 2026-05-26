import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, Building2, FileText, Search, Filter, CreditCard,
  CheckCircle2, AlertTriangle, Sparkles, RefreshCw
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';
import SuperAdminShell from '../components/SuperAdminShell';

const RANGES = [
  { value: '7', label: '7 jours' },
  { value: '30', label: '30 jours' },
  { value: '90', label: '90 jours' },
];

const CONTENT_TYPE_LABELS = {
  page_copy: 'Page copy',
  marketing_angles: 'Angles marketing',
  faq: 'FAQ',
  testimonials: 'Temoignages',
  benefits: 'Benefices',
  conversion_blocks: 'Blocs conversion',
  visual_assets_requested: 'Visuels demandes',
  generated_images: 'Images generees',
  animated_gifs: 'GIFs',
};

const STATUS_META = {
  started: { label: 'Demarree', bg: '#e0f2fe', color: '#0369a1' },
  processing_images: { label: 'Images en cours', bg: '#ede9fe', color: '#6d28d9' },
  completed: { label: 'Terminee', bg: '#dcfce7', color: '#15803d' },
  partial_failure: { label: 'Partielle', bg: '#fef3c7', color: '#b45309' },
  failed: { label: 'Echouee', bg: '#fee2e2', color: '#b91c1c' },
};

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Badge({ bg, color, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 999,
      background: bg, color, fontSize: 11, fontWeight: 600,
    }}>
      {children}
    </span>
  );
}

function KpiCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: color + '18' }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-xs text-slate-500 mt-0.5 font-medium">{label}</div>
      </div>
    </div>
  );
}

function StatusMiniCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <Icon size={15} style={{ color }} />
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

const SuperAdminProductPageHistory = () => {
  const [days, setDays] = useState('30');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generationSearch, setGenerationSearch] = useState('');
  const [selectedGenerationUser, setSelectedGenerationUser] = useState('all');
  const [selectedGenerationStatus, setSelectedGenerationStatus] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ecomApi.get(`/super-admin/feature-analytics?days=${days}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [days]);

  const generationOverview = data?.generationOverview || {};
  const generationUsers = data?.generationUsers || [];
  const generationHistory = data?.generationHistory || [];
  const generationContentTypes = data?.generationContentTypes || [];

  const filteredGenerationHistory = useMemo(() => generationHistory.filter((item) => {
    if (selectedGenerationUser !== 'all' && String(item.userId?._id || item.userId || '') !== selectedGenerationUser) return false;
    if (selectedGenerationStatus !== 'all' && item.status !== selectedGenerationStatus) return false;

    const term = generationSearch.trim().toLowerCase();
    if (!term) return true;

    const haystack = [
      item.productName,
      item.productUrl,
      item.userId?.email,
      item.userId?.name,
      item.userSnapshot?.email,
      item.userSnapshot?.name,
      item.workspaceId?.name,
      item.workspaceSnapshot?.name,
      ...(item.generatedContentTypes || []),
    ].join(' ').toLowerCase();

    return haystack.includes(term);
  }), [generationHistory, generationSearch, selectedGenerationStatus, selectedGenerationUser]);

  const generationStatusRows = [
    { key: 'completed', label: 'Terminees', value: generationOverview.completedCount || 0, icon: CheckCircle2, color: '#16a34a' },
    { key: 'processing_images', label: 'Images en cours', value: generationOverview.processingCount || 0, icon: Sparkles, color: '#7c3aed' },
    { key: 'partial_failure', label: 'Partielles', value: generationOverview.partialFailureCount || 0, icon: AlertTriangle, color: '#d97706' },
    { key: 'failed', label: 'Echouees', value: generationOverview.failedCount || 0, icon: AlertTriangle, color: '#dc2626' },
  ];

  const rangeActions = (
    <div className="flex gap-1 bg-white/10 rounded-xl p-1">
      {RANGES.map((range) => (
        <button
          key={range.value}
          onClick={() => setDays(range.value)}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
            days === range.value
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );

  return (
    <SuperAdminShell
      title="Historique pages produit IA"
      subtitle="Suivi detaille par utilisateur, credits utilises et contenu genere."
      icon={FileText}
      error={error}
      refreshing={loading}
      onRefresh={fetchData}
      actions={rangeActions}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <RefreshCw size={28} className="animate-spin mb-3" />
          <span className="text-sm font-medium">Chargement...</span>
        </div>
      ) : (
        <>
          {/* Primary KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard label="Generations totales" value={(generationOverview.totalGenerations || 0).toLocaleString()} icon={FileText} color="#0f766e" />
            <KpiCard label="Credits utilises" value={(generationOverview.totalCreditsUsed || 0).toLocaleString()} icon={CreditCard} color="#1d4ed8" />
            <KpiCard label="Users generateurs" value={(generationOverview.uniqueUsers || 0).toLocaleString()} icon={Users} color="#7c3aed" />
            <KpiCard label="Workspaces touchees" value={(generationOverview.uniqueWorkspaces || 0).toLocaleString()} icon={Building2} color="#ea580c" />
          </div>

          {/* Status mini-cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {generationStatusRows.map(({ key, label, value, icon, color }) => (
              <StatusMiniCard key={key} label={label} value={value} icon={icon} color={color} />
            ))}
          </div>

          {/* Users + Content type panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
            {/* Top users */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-900 mb-4">Top utilisateurs generateurs</h2>
              {generationUsers.length === 0 ? (
                <p className="text-sm text-slate-400">Aucune donnee</p>
              ) : (
                generationUsers.slice(0, 10).map((user, index) => (
                  <button
                    key={String(user._id || index)}
                    type="button"
                    onClick={() => setSelectedGenerationUser((prev) => prev === String(user._id) ? 'all' : String(user._id))}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer mb-1.5 transition-all border ${
                      selectedGenerationUser === String(user._id)
                        ? 'border-primary-200 bg-primary-50'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{user.name || user.email || 'Utilisateur'}</div>
                      <div className="text-xs text-slate-400">{user.email || 'Email inconnu'} · {user.workspaceCount || 0} workspace{(user.workspaceCount || 0) > 1 ? 's' : ''}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-primary-700">{user.generationCount || 0}</div>
                      <div className="text-xs text-slate-400">{user.creditsUsed || 0} credit{(user.creditsUsed || 0) > 1 ? 's' : ''}</div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Content types */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-900 mb-4">Types de contenu</h2>
              {generationContentTypes.length === 0 ? (
                <p className="text-sm text-slate-400">Aucune donnee</p>
              ) : (
                <div className="space-y-2.5">
                  {generationContentTypes.map((row) => (
                    <div key={row._id} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-600">{CONTENT_TYPE_LABELS[row._id] || row._id}</span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">{row.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative sm:col-span-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={generationSearch}
                  onChange={(e) => setGenerationSearch(e.target.value)}
                  placeholder="Produit, URL, user, workspace…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary-400 bg-slate-50"
                />
              </div>
              <select
                value={selectedGenerationUser}
                onChange={(e) => setSelectedGenerationUser(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-primary-400"
              >
                <option value="all">Tous les utilisateurs</option>
                {generationUsers.map((user) => (
                  <option key={String(user._id)} value={String(user._id)}>
                    {user.name || user.email || 'Utilisateur'}
                  </option>
                ))}
              </select>
              <select
                value={selectedGenerationStatus}
                onChange={(e) => setSelectedGenerationStatus(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-primary-400"
              >
                <option value="all">Tous les statuts</option>
                {Object.entries(STATUS_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
            <Filter size={13} />
            <span>{filteredGenerationHistory.length} entree{filteredGenerationHistory.length > 1 ? 's' : ''} affichee{filteredGenerationHistory.length > 1 ? 's' : ''}</span>
          </div>

          {/* Generation history cards */}
          <div className="space-y-3">
            {filteredGenerationHistory.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center">
                <FileText size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm text-slate-400 font-medium">Aucune generation ne correspond aux filtres.</p>
              </div>
            )}
            {filteredGenerationHistory.map((item) => {
              const statusMeta = STATUS_META[item.status] || STATUS_META.started;
              const itemUserName = item.userId?.name || item.userSnapshot?.name || item.userId?.email || item.userSnapshot?.email || 'Utilisateur inconnu';
              const itemUserEmail = item.userId?.email || item.userSnapshot?.email || 'Email inconnu';
              const workspaceName = item.workspaceId?.name || item.workspaceSnapshot?.name || 'Workspace inconnue';
              const contentTypes = (item.generatedContentTypes || []).slice(0, 4);

              return (
                <div key={item._id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0" style={{ minWidth: 260 }}>
                      {/* Title + badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-slate-900">
                          {item.productName || item.productUrl || 'Produit sans nom'}
                        </span>
                        <Badge bg={statusMeta.bg} color={statusMeta.color}>{statusMeta.label}</Badge>
                        <Badge bg="#ecfeff" color="#0f766e">{item.creditsUsed || 0} credit{(item.creditsUsed || 0) > 1 ? 's' : ''}</Badge>
                        <Badge bg="#eff6ff" color="#1d4ed8">{item.creditSource || 'unknown'}</Badge>
                        <Badge bg="#f8fafc" color="#475569">{item.outputMode === 'page_with_images' ? 'Page + images' : 'Page seule'}</Badge>
                      </div>

                      <p className="text-xs text-slate-500 mb-1.5">{itemUserName} · {itemUserEmail} · {workspaceName}</p>
                      <p className="text-xs text-slate-400 mb-2.5">
                        Debut: {formatDateTime(item.createdAt)} · Fin: {formatDateTime(item.completedAt)}
                      </p>

                      <div className="flex flex-wrap gap-1.5">
                        {contentTypes.map((ct) => (
                          <Badge key={ct} bg="#f1f5f9" color="#475569">{CONTENT_TYPE_LABELS[ct] || ct}</Badge>
                        ))}
                        {(item.generatedContentTypes || []).length > contentTypes.length && (
                          <Badge bg="#f8fafc" color="#64748b">+{(item.generatedContentTypes || []).length - contentTypes.length}</Badge>
                        )}
                      </div>

                      {item.productUrl && (
                        <p className="mt-2.5 text-xs text-slate-400 break-all">{item.productUrl}</p>
                      )}
                      {item.errorMessage && (
                        <div className="mt-2.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                          {item.errorMessage}
                        </div>
                      )}
                    </div>

                    {/* Stats mini-grid */}
                    <div className="grid grid-cols-2 gap-2.5" style={{ minWidth: 240 }}>
                      {[
                        { label: 'Images generees', val: item.stats?.generatedImageCount || 0 },
                        { label: 'GIFs', val: item.stats?.generatedGifCount || 0 },
                        { label: 'Angles', val: item.stats?.anglesCount || 0 },
                        { label: 'FAQ', val: item.stats?.faqCount || 0 },
                      ].map(({ label, val }) => (
                        <div key={label} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                          <div className="text-xs text-slate-500">{label}</div>
                          <div className="text-lg font-bold text-slate-900 mt-0.5">{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </SuperAdminShell>
  );
};

export default SuperAdminProductPageHistory;
