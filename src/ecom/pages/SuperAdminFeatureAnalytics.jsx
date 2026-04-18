import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3, TrendingUp, Zap, ShoppingBag, MessageSquare,
  FileText, Globe, Bot, RefreshCw, Calendar, Users, Building2,
  ChevronDown, ChevronUp, Clock, Bell, Settings, Activity, Search, Filter, CreditCard, CheckCircle2, AlertTriangle, Sparkles
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

const FEATURE_LABELS = {
  product_page_generator: { label: 'Page Produit IA', icon: FileText, color: '#6366f1' },
  creative_generator:     { label: 'Créas Pub', icon: Zap, color: '#f59e0b' },
  commercial_ia:          { label: 'Commercial IA', icon: Bot, color: '#10b981' },
  boutique_store:         { label: 'Boutique', icon: ShoppingBag, color: '#3b82f6' },
  whatsapp_campaign:      { label: 'Campagne WA', icon: MessageSquare, color: '#22c55e' },
  whatsapp_auto_confirm:  { label: 'WA Auto-Confirm', icon: MessageSquare, color: '#84cc16' },
  order_created:          { label: 'Commande manuelle', icon: ShoppingBag, color: '#64748b' },
  order_shopify:          { label: 'Commande Shopify', icon: Globe, color: '#8b5cf6' },
  order_skelor:           { label: 'Commande Skelo', icon: ShoppingBag, color: '#ec4899' },
  pixel_tracking:         { label: 'Pixel Tracking', icon: Activity, color: '#06b6d4' },
  delivery_offer:         { label: 'Offre Livreur', icon: TrendingUp, color: '#f97316' },
  custom_domain:          { label: 'Domaine Custom', icon: Globe, color: '#14b8a6' },
};

const RANGES = [
  { value: '7', label: '7 jours' },
  { value: '30', label: '30 jours' },
  { value: '90', label: '90 jours' },
];

const CONTENT_TYPE_LABELS = {
  page_copy: 'Page copy',
  marketing_angles: 'Angles marketing',
  faq: 'FAQ',
  testimonials: 'Témoignages',
  benefits: 'Bénéfices',
  conversion_blocks: 'Blocs conversion',
  visual_assets_requested: 'Visuels demandés',
  generated_images: 'Images générées',
  animated_gifs: 'GIFs',
};

const STATUS_META = {
  started: { label: 'Démarrée', bg: '#e0f2fe', color: '#0369a1' },
  processing_images: { label: 'Images en cours', bg: '#ede9fe', color: '#6d28d9' },
  completed: { label: 'Terminée', bg: '#dcfce7', color: '#15803d' },
  partial_failure: { label: 'Partielle', bg: '#fef3c7', color: '#b45309' },
  failed: { label: 'Échouée', bg: '#fee2e2', color: '#b91c1c' },
};

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function badgeStyle(bg, color) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 999,
    background: bg,
    color,
    fontSize: 11,
    fontWeight: 600,
  };
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{value}</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function BarRow({ label, count, max, color }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <div style={{ width: 160, fontSize: 13, color: '#334155', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
      <div style={{ width: 40, fontSize: 13, fontWeight: 600, color: '#0f172a', textAlign: 'right', flexShrink: 0 }}>{count}</div>
    </div>
  );
}

const SuperAdminFeatureAnalytics = () => {
  const location = useLocation();
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

  const totalUsage = data?.topFeatures?.reduce((s, f) => s + f.count, 0) || 0;
  const maxFeatureCount = data?.topFeatures?.[0]?.count || 1;
  const generationOverview = data?.generationOverview || {};
  const generationUsers = data?.generationUsers || [];
  const generationHistory = data?.generationHistory || [];
  const generationContentTypes = data?.generationContentTypes || [];

  // Build workspace leaderboard
  const wsMap = {};
  (data?.perWorkspace || []).forEach(row => {
    const id = row._id.workspaceId;
    if (!wsMap[id]) wsMap[id] = { name: row.workspaceName || id, total: 0, features: {} };
    wsMap[id].total += row.count;
    wsMap[id].features[row._id.feature] = (wsMap[id].features[row._id.feature] || 0) + row.count;
  });
  const wsLeaderboard = Object.values(wsMap).sort((a, b) => b.total - a.total).slice(0, 15);

  const filteredGenerationHistory = generationHistory.filter((item) => {
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
  });

  const generationStatusRows = [
    { key: 'completed', label: 'Terminées', value: generationOverview.completedCount || 0, icon: CheckCircle2, color: '#16a34a' },
    { key: 'processing_images', label: 'Images en cours', value: generationOverview.processingCount || 0, icon: Sparkles, color: '#7c3aed' },
    { key: 'partial_failure', label: 'Partielles', value: generationOverview.partialFailureCount || 0, icon: AlertTriangle, color: '#d97706' },
    { key: 'failed', label: 'Échouées', value: generationOverview.failedCount || 0, icon: AlertTriangle, color: '#dc2626' },
  ];

  const navItems = [
    { to: '/ecom/super-admin', label: 'Dashboard', icon: BarChart3 },
    { to: '/ecom/super-admin/users', label: 'Utilisateurs', icon: Users },
    { to: '/ecom/super-admin/workspaces', label: 'Workspaces', icon: Building2 },
    { to: '/ecom/super-admin/analytics', label: 'Analytics', icon: Activity },
    { to: '/ecom/super-admin/feature-analytics', label: 'Features', icon: Zap },
    { to: '/ecom/super-admin/product-page-history', label: 'Pages IA', icon: FileText },
    { to: '/ecom/super-admin/activity', label: 'Activite', icon: Clock },
    { to: '/ecom/super-admin/push', label: 'Push', icon: Bell },
    { to: '/ecom/super-admin/whatsapp-postulations', label: 'WhatsApp', icon: MessageSquare },
    { to: '/ecom/super-admin/whatsapp-logs', label: 'WA Logs', icon: FileText },
    { to: '/ecom/super-admin/settings', label: 'Config', icon: Settings },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Nav */}
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 6, background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 6, marginBottom: 24 }}>
          {navItems.map(({ to, label, icon: NavIcon }) => {
            const active = location.pathname === to;
            return (
              <Link key={to} to={to} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                borderRadius: 10, fontSize: 13, fontWeight: active ? 600 : 400,
                background: active ? '#6366f1' : 'transparent',
                color: active ? '#fff' : '#64748b', textDecoration: 'none',
                transition: 'all 0.15s'
              }}>
                <NavIcon size={14} /> {label}
              </Link>
            );
          })}
        </nav>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Statistiques Features</h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Fréquence d'utilisation des fonctionnalités par workspace</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4 }}>
              {RANGES.map(r => (
                <button key={r.value} onClick={() => setDays(r.value)} style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
                  background: days === r.value ? '#fff' : 'transparent',
                  color: days === r.value ? '#6366f1' : '#64748b',
                  fontWeight: days === r.value ? 600 : 400,
                  boxShadow: days === r.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}>{r.label}</button>
              ))}
            </div>
            <button onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#64748b' }}>
              <RefreshCw size={14} /> Actualiser
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', color: '#dc2626', marginBottom: 20, fontSize: 14 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
            <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Chargement...
          </div>
        ) : data && (
          <>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
              <StatCard label="Utilisations totales" value={totalUsage.toLocaleString()} icon={Activity} color="#6366f1" />
              <StatCard label="Features distinctes" value={data.topFeatures?.length || 0} icon={Zap} color="#f59e0b" />
              <StatCard label="Workspaces actives" value={wsLeaderboard.length} icon={Building2} color="#10b981" />
              <StatCard label="Utilisateurs actifs" value={data.topUsers?.length || 0} icon={Users} color="#3b82f6" />
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Historique pages produit IA</h2>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0' }}>Qui a généré, quand, avec quels crédits, et quel contenu a été produit.</p>
                </div>
                <div style={badgeStyle('#eef2ff', '#4338ca')}>
                  <CreditCard size={14} />
                  {generationOverview.totalCreditsUsed || 0} crédit{(generationOverview.totalCreditsUsed || 0) > 1 ? 's' : ''} consommé{(generationOverview.totalCreditsUsed || 0) > 1 ? 's' : ''}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                <StatCard label="Générations totales" value={(generationOverview.totalGenerations || 0).toLocaleString()} icon={FileText} color="#4338ca" />
                <StatCard label="Crédits utilisés" value={(generationOverview.totalCreditsUsed || 0).toLocaleString()} icon={CreditCard} color="#0f766e" />
                <StatCard label="Users générateurs" value={(generationOverview.uniqueUsers || 0).toLocaleString()} icon={Users} color="#2563eb" />
                <StatCard label="Workspaces touchées" value={(generationOverview.uniqueWorkspaces || 0).toLocaleString()} icon={Building2} color="#7c3aed" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                {generationStatusRows.map(({ key, label, value, icon: Icon, color }) => (
                  <div key={key} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{label}</div>
                      <Icon size={16} color={color} />
                    </div>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20, marginBottom: 22 }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 18 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>Top utilisateurs générateurs</div>
                  {generationUsers.length === 0 ? <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Aucune donnée</p> : generationUsers.slice(0, 8).map((user, index) => (
                    <button
                      key={String(user._id || index)}
                      type="button"
                      onClick={() => setSelectedGenerationUser((prev) => prev === String(user._id) ? 'all' : String(user._id))}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: selectedGenerationUser === String(user._id) ? '1px solid #c7d2fe' : '1px solid transparent',
                        background: selectedGenerationUser === String(user._id) ? '#eef2ff' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#64748b', flexShrink: 0 }}>{index + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || user.email || 'Utilisateur'}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{user.email || 'Email inconnu'} · {user.workspaceCount || 0} workspace{(user.workspaceCount || 0) > 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#4338ca' }}>{user.generationCount || 0}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{user.creditsUsed || 0} crédit{(user.creditsUsed || 0) > 1 ? 's' : ''}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 18 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>Types de contenu générés</div>
                  {generationContentTypes.length === 0 ? <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Aucune donnée</p> : generationContentTypes.map((row) => (
                    <div key={row._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                      <div style={{ fontSize: 13, color: '#334155' }}>{CONTENT_TYPE_LABELS[row._id] || row._id}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{row.count}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr', gap: 10, marginBottom: 18 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={15} color="#94a3b8" style={{ position: 'absolute', top: 13, left: 12 }} />
                  <input
                    value={generationSearch}
                    onChange={(event) => setGenerationSearch(event.target.value)}
                    placeholder="Rechercher un produit, une URL, un user ou un workspace"
                    style={{ width: '100%', padding: '11px 12px 11px 36px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }}
                  />
                </div>
                <select value={selectedGenerationUser} onChange={(event) => setSelectedGenerationUser(event.target.value)} style={{ padding: '11px 12px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff' }}>
                  <option value="all">Tous les utilisateurs</option>
                  {generationUsers.map((user) => (
                    <option key={String(user._id)} value={String(user._id)}>{user.name || user.email || 'Utilisateur'}</option>
                  ))}
                </select>
                <select value={selectedGenerationStatus} onChange={(event) => setSelectedGenerationStatus(event.target.value)} style={{ padding: '11px 12px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff' }}>
                  <option value="all">Tous les statuts</option>
                  {Object.entries(STATUS_META).map(([key, meta]) => (
                    <option key={key} value={key}>{meta.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 12, color: '#64748b' }}>
                <Filter size={14} />
                {filteredGenerationHistory.length} entrée{filteredGenerationHistory.length > 1 ? 's' : ''} affichée{filteredGenerationHistory.length > 1 ? 's' : ''}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredGenerationHistory.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Aucune génération ne correspond aux filtres.</p>}
                {filteredGenerationHistory.map((item) => {
                  const statusMeta = STATUS_META[item.status] || STATUS_META.started;
                  const itemUserName = item.userId?.name || item.userSnapshot?.name || item.userId?.email || item.userSnapshot?.email || 'Utilisateur inconnu';
                  const itemUserEmail = item.userId?.email || item.userSnapshot?.email || 'Email inconnu';
                  const workspaceName = item.workspaceId?.name || item.workspaceSnapshot?.name || 'Workspace inconnue';
                  const contentTypes = (item.generatedContentTypes || []).slice(0, 4);
                  return (
                    <div key={item._id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fcfdff' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 280 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{item.productName || item.productUrl || 'Produit sans nom'}</div>
                            <span style={badgeStyle(statusMeta.bg, statusMeta.color)}>{statusMeta.label}</span>
                            <span style={badgeStyle('#ecfeff', '#0f766e')}>{item.creditsUsed || 0} crédit{(item.creditsUsed || 0) > 1 ? 's' : ''}</span>
                            <span style={badgeStyle('#eff6ff', '#1d4ed8')}>{item.creditSource || 'unknown'}</span>
                            <span style={badgeStyle('#f8fafc', '#475569')}>{item.outputMode === 'page_with_images' ? 'Page + images' : 'Page seule'}</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{itemUserName} · {itemUserEmail} · {workspaceName}</div>
                          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                            Début: {formatDateTime(item.createdAt)} · Fin: {formatDateTime(item.completedAt)}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {contentTypes.map((contentType) => (
                              <span key={contentType} style={badgeStyle('#f1f5f9', '#475569')}>{CONTENT_TYPE_LABELS[contentType] || contentType}</span>
                            ))}
                            {(item.generatedContentTypes || []).length > contentTypes.length && (
                              <span style={badgeStyle('#f8fafc', '#64748b')}>+{(item.generatedContentTypes || []).length - contentTypes.length}</span>
                            )}
                          </div>
                          {item.productUrl ? (
                            <div style={{ marginTop: 10, fontSize: 12, color: '#475569', wordBreak: 'break-all' }}>{item.productUrl}</div>
                          ) : null}
                          {item.errorMessage ? (
                            <div style={{ marginTop: 10, fontSize: 12, color: '#b91c1c', background: '#fef2f2', borderRadius: 10, padding: '8px 10px' }}>{item.errorMessage}</div>
                          ) : null}
                        </div>

                        <div style={{ minWidth: 250, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(110px, 1fr))', gap: 10 }}>
                          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px' }}>
                            <div style={{ fontSize: 11, color: '#64748b' }}>Images générées</div>
                            <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{item.stats?.generatedImageCount || 0}</div>
                          </div>
                          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px' }}>
                            <div style={{ fontSize: 11, color: '#64748b' }}>GIFs</div>
                            <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{item.stats?.generatedGifCount || 0}</div>
                          </div>
                          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px' }}>
                            <div style={{ fontSize: 11, color: '#64748b' }}>Angles</div>
                            <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{item.stats?.anglesCount || 0}</div>
                          </div>
                          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px' }}>
                            <div style={{ fontSize: 11, color: '#64748b' }}>FAQ</div>
                            <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{item.stats?.faqCount || 0}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              {/* Top features bar chart */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: '0 0 20px' }}>Features les plus utilisées</h2>
                {data.topFeatures?.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8' }}>Aucune donnée</p>}
                {data.topFeatures?.map(f => {
                  const meta = FEATURE_LABELS[f._id] || { label: f._id, color: '#94a3b8' };
                  return (
                    <BarRow key={f._id} label={meta.label} count={f.count} max={maxFeatureCount} color={meta.color} />
                  );
                })}
              </div>

              {/* Top users */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: '0 0 20px' }}>Top utilisateurs</h2>
                {data.topUsers?.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8' }}>Aucune donnée</p>}
                {data.topUsers?.slice(0, 10).map((u, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#64748b', flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || u.name || 'Utilisateur'}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{u.features?.length} feature(s)</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', flexShrink: 0 }}>{u.count}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Workspace leaderboard */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: '0 0 20px' }}>Activité par workspace</h2>
              {wsLeaderboard.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8' }}>Aucune donnée</p>}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 500 }}>Workspace</th>
                      {Object.keys(FEATURE_LABELS).map(k => (
                        <th key={k} style={{ textAlign: 'center', padding: '8px 8px', color: '#64748b', fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap' }}>
                          {FEATURE_LABELS[k].label}
                        </th>
                      ))}
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: '#64748b', fontWeight: 500 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wsLeaderboard.map((ws, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '10px 12px', color: '#0f172a', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</td>
                        {Object.keys(FEATURE_LABELS).map(k => (
                          <td key={k} style={{ textAlign: 'center', padding: '10px 8px', color: ws.features[k] ? '#0f172a' : '#e2e8f0' }}>
                            {ws.features[k] || '—'}
                          </td>
                        ))}
                        <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, color: '#6366f1' }}>{ws.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent product page generations */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: '0 0 20px' }}>Dernières générations de pages produit</h2>
              {data.recentGenerations?.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8' }}>Aucune génération récente</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.recentGenerations?.slice(0, 20).map((g, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#6366f120', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={14} color="#6366f1" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.meta?.productName || g.meta?.productUrl || 'Produit sans nom'}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {g.workspaceId?.name || '—'} · {g.userId?.email || '—'}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: g.meta?.generationType === 'free' ? '#dcfce7' : '#fef3c7', color: g.meta?.generationType === 'free' ? '#16a34a' : '#d97706', flexShrink: 0 }}>
                      {g.meta?.generationType === 'free' ? 'Gratuite' : 'Payante'}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, textAlign: 'right' }}>
                      {new Date(g.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default SuperAdminFeatureAnalytics;
