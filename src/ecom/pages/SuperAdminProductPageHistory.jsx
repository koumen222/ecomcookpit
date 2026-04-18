import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3, Users, Building2, Activity, Clock, Bell, MessageSquare,
  FileText, Settings, Search, Filter, CreditCard, CheckCircle2,
  AlertTriangle, Sparkles, RefreshCw, Globe
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

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

const SuperAdminProductPageHistory = () => {
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

  const navItems = [
    { to: '/ecom/super-admin', label: 'Dashboard', icon: BarChart3 },
    { to: '/ecom/super-admin/users', label: 'Utilisateurs', icon: Users },
    { to: '/ecom/super-admin/workspaces', label: 'Workspaces', icon: Building2 },
    { to: '/ecom/super-admin/analytics', label: 'Analytics', icon: Activity },
    { to: '/ecom/super-admin/feature-analytics', label: 'Features', icon: Sparkles },
    { to: '/ecom/super-admin/product-page-history', label: 'Pages IA', icon: FileText },
    { to: '/ecom/super-admin/activity', label: 'Activite', icon: Clock },
    { to: '/ecom/super-admin/push', label: 'Push', icon: Bell },
    { to: '/ecom/super-admin/whatsapp-postulations', label: 'WhatsApp', icon: MessageSquare },
    { to: '/ecom/super-admin/settings', label: 'Config', icon: Settings },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 6, background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 6, marginBottom: 24 }}>
          {navItems.map(({ to, label, icon: NavIcon }) => {
            const active = location.pathname === to;
            return (
              <Link key={to} to={to} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                borderRadius: 10, fontSize: 13, fontWeight: active ? 600 : 400,
                background: active ? '#0f766e' : 'transparent',
                color: active ? '#fff' : '#64748b', textDecoration: 'none', transition: 'all 0.15s'
              }}>
                <NavIcon size={14} /> {label}
              </Link>
            );
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Historique pages produit IA</h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Suivi detaille par utilisateur, credits utilises et contenu genere.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4 }}>
              {RANGES.map((range) => (
                <button key={range.value} onClick={() => setDays(range.value)} style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
                  background: days === range.value ? '#fff' : 'transparent',
                  color: days === range.value ? '#0f766e' : '#64748b',
                  fontWeight: days === range.value ? 600 : 400,
                  boxShadow: days === range.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}>{range.label}</button>
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
            <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Chargement...
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
              <StatCard label="Generations totales" value={(generationOverview.totalGenerations || 0).toLocaleString()} icon={FileText} color="#0f766e" />
              <StatCard label="Credits utilises" value={(generationOverview.totalCreditsUsed || 0).toLocaleString()} icon={CreditCard} color="#1d4ed8" />
              <StatCard label="Users generateurs" value={(generationOverview.uniqueUsers || 0).toLocaleString()} icon={Users} color="#7c3aed" />
              <StatCard label="Workspaces touchees" value={(generationOverview.uniqueWorkspaces || 0).toLocaleString()} icon={Building2} color="#ea580c" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
              {generationStatusRows.map(({ key, label, value, icon: Icon, color }) => (
                <div key={key} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{label}</div>
                    <Icon size={16} color={color} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 20 }}>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>Top utilisateurs generateurs</div>
                {generationUsers.length === 0 ? <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Aucune donnee</p> : generationUsers.slice(0, 10).map((user, index) => (
                  <button
                    key={String(user._id || index)}
                    type="button"
                    onClick={() => setSelectedGenerationUser((prev) => prev === String(user._id) ? 'all' : String(user._id))}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                      borderRadius: 12, textAlign: 'left', cursor: 'pointer', marginBottom: 8,
                      border: selectedGenerationUser === String(user._id) ? '1px solid #99f6e4' : '1px solid transparent',
                      background: selectedGenerationUser === String(user._id) ? '#f0fdfa' : 'transparent',
                    }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#64748b', flexShrink: 0 }}>{index + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || user.email || 'Utilisateur'}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{user.email || 'Email inconnu'} · {user.workspaceCount || 0} workspace{(user.workspaceCount || 0) > 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f766e' }}>{user.generationCount || 0}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{user.creditsUsed || 0} credit{(user.creditsUsed || 0) > 1 ? 's' : ''}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>Types de contenu</div>
                {generationContentTypes.length === 0 ? <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Aucune donnee</p> : generationContentTypes.map((row) => (
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
              {filteredGenerationHistory.length} entree{filteredGenerationHistory.length > 1 ? 's' : ''} affichee{filteredGenerationHistory.length > 1 ? 's' : ''}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredGenerationHistory.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Aucune generation ne correspond aux filtres.</p>}
              {filteredGenerationHistory.map((item) => {
                const statusMeta = STATUS_META[item.status] || STATUS_META.started;
                const itemUserName = item.userId?.name || item.userSnapshot?.name || item.userId?.email || item.userSnapshot?.email || 'Utilisateur inconnu';
                const itemUserEmail = item.userId?.email || item.userSnapshot?.email || 'Email inconnu';
                const workspaceName = item.workspaceId?.name || item.workspaceSnapshot?.name || 'Workspace inconnue';
                const contentTypes = (item.generatedContentTypes || []).slice(0, 4);

                return (
                  <div key={item._id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{item.productName || item.productUrl || 'Produit sans nom'}</div>
                          <span style={badgeStyle(statusMeta.bg, statusMeta.color)}>{statusMeta.label}</span>
                          <span style={badgeStyle('#ecfeff', '#0f766e')}>{item.creditsUsed || 0} credit{(item.creditsUsed || 0) > 1 ? 's' : ''}</span>
                          <span style={badgeStyle('#eff6ff', '#1d4ed8')}>{item.creditSource || 'unknown'}</span>
                          <span style={badgeStyle('#f8fafc', '#475569')}>{item.outputMode === 'page_with_images' ? 'Page + images' : 'Page seule'}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{itemUserName} · {itemUserEmail} · {workspaceName}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                          Debut: {formatDateTime(item.createdAt)} · Fin: {formatDateTime(item.completedAt)}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {contentTypes.map((contentType) => (
                            <span key={contentType} style={badgeStyle('#f1f5f9', '#475569')}>{CONTENT_TYPE_LABELS[contentType] || contentType}</span>
                          ))}
                          {(item.generatedContentTypes || []).length > contentTypes.length && (
                            <span style={badgeStyle('#f8fafc', '#64748b')}>+{(item.generatedContentTypes || []).length - contentTypes.length}</span>
                          )}
                        </div>
                        {item.productUrl ? <div style={{ marginTop: 10, fontSize: 12, color: '#475569', wordBreak: 'break-all' }}>{item.productUrl}</div> : null}
                        {item.errorMessage ? <div style={{ marginTop: 10, fontSize: 12, color: '#b91c1c', background: '#fef2f2', borderRadius: 10, padding: '8px 10px' }}>{item.errorMessage}</div> : null}
                      </div>

                      <div style={{ minWidth: 260, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(110px, 1fr))', gap: 10 }}>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 11, color: '#64748b' }}>Images generees</div>
                          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{item.stats?.generatedImageCount || 0}</div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 11, color: '#64748b' }}>GIFs</div>
                          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{item.stats?.generatedGifCount || 0}</div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 11, color: '#64748b' }}>Angles</div>
                          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{item.stats?.anglesCount || 0}</div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 11, color: '#64748b' }}>FAQ</div>
                          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{item.stats?.faqCount || 0}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default SuperAdminProductPageHistory;