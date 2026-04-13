import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AFFILIATE_API_BASE,
  affiliatePortalApi,
  clearAffiliateToken,
  getAffiliateToken
} from '../services/affiliatePortalApi.js';
import AffiliateLayout from '../components/AffiliateLayout.jsx';

export default function AffiliateLinks() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [affiliate, setAffiliate] = useState(null);
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState({ name: '', destinationUrl: '' });
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const token = getAffiliateToken();
    if (!token) { navigate('/affiliate/login'); return; }
    setLoading(true);
    setError('');
    try {
      const [me, l] = await Promise.all([
        affiliatePortalApi.me(),
        affiliatePortalApi.getLinks()
      ]);
      setAffiliate(me.data?.data || me.data?.affiliate || null);
      setLinks(l.data?.data?.links || []);
    } catch (err) {
      if (err.response?.status === 401) { clearAffiliateToken(); navigate('/affiliate/login'); return; }
      setError(err.response?.data?.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const createLink = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await affiliatePortalApi.createLink(newLink);
      setNewLink({ name: '', destinationUrl: '' });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Création du lien impossible');
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = links.filter(l =>
    !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.code?.toLowerCase().includes(search.toLowerCase())
  );

  const totalClicks = links.reduce((s, l) => s + (l.clickCount || 0), 0);

  if (loading) {
    return (
      <AffiliateLayout affiliate={null}>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="flex flex-col items-center gap-3">
            <svg className="w-8 h-8 animate-spin text-[#0F6B4F]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            <p className="text-sm text-gray-500">Chargement...</p>
          </div>
        </div>
      </AffiliateLayout>
    );
  }

  return (
    <AffiliateLayout affiliate={affiliate}>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-gray-900">{links.length}</p>
            <p className="text-xs uppercase tracking-wide text-gray-500 mt-0.5">Liens créés</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-gray-900">{totalClicks.toLocaleString('fr-FR')}</p>
            <p className="text-xs uppercase tracking-wide text-gray-500 mt-0.5">Clics totaux</p>
          </div>
        </div>

        {/* Create link form */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Créer un nouveau lien</h3>
          <form onSubmit={createLink} className="flex flex-col sm:flex-row gap-3">
            <input value={newLink.name} onChange={(e) => setNewLink((p) => ({ ...p, name: e.target.value }))} placeholder="Nom du lien" required
              className="flex-1 px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition" />
            <input value={newLink.destinationUrl} onChange={(e) => setNewLink((p) => ({ ...p, destinationUrl: e.target.value }))} placeholder="URL de destination (ex: https://...)" required
              className="flex-1 px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition" />
            <button disabled={creating} className="px-5 py-2.5 rounded-xl bg-[#0F6B4F] hover:bg-[#0a5040] text-white text-sm font-semibold disabled:opacity-50 transition-colors whitespace-nowrap">
              {creating ? 'Création...' : '+ Créer un lien'}
            </button>
          </form>
        </div>

        {/* Search */}
        {links.length > 3 && (
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un lien..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition" />
          </div>
        )}

        {/* Links list */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Tous les liens ({filtered.length})</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {filtered.map((l) => {
              const linkUrl = `${AFFILIATE_API_BASE}/api/affiliate/r/${l.code}`;
              return (
                <div key={l._id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-900">{l.name}</p>
                      <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{l.code}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{l.destinationUrl}</p>
                    <code className="block mt-1.5 text-[11px] bg-gray-900 text-emerald-300 rounded-lg px-3 py-2 break-all font-mono">{linkUrl}</code>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900">{l.clickCount || 0}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Clics</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(linkUrl, l._id)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        copied === l._id
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {copied === l._id ? '✓ Copié' : 'Copier'}
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">
                {search ? 'Aucun lien trouvé.' : 'Aucun lien créé. Créez votre premier lien ci-dessus.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </AffiliateLayout>
  );
}
