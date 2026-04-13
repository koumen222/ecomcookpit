import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { marketingApi } from '../services/marketingApi.js';

const fmtDate = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function EmailCampaignResults() {
  const { id } = useParams();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = async (nextPage = page) => {
    setLoading(true);
    setError('');
    try {
      const r = await marketingApi.getCampaignResults(id, { page: nextPage, limit: 100 });
      setData(r.data?.data || null);
      setPage(nextPage);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur de chargement');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Statistiques détaillées campagne</h1>
            <p className="text-sm text-gray-500">Historique des envois, ouvertures et clics par destinataire</p>
          </div>
          <Link to="/ecom/marketing" className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-100">
            Retour marketing
          </Link>
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">Chargement...</div>
        ) : !data ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">Aucune donnée</div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">{data.campaign?.name}</h3>
              <p className="text-sm text-gray-600">Envoyée le {data.campaign?.sentAt ? fmtDate(data.campaign.sentAt) : 'Non envoyée'}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center"><p className="text-2xl font-bold text-blue-600">{data.summary?.total || 0}</p><p className="text-xs text-gray-500">Total destinataires</p></div>
              <div className="bg-green-50 p-4 rounded-lg text-center"><p className="text-2xl font-bold text-green-600">{data.summary?.sent || 0}</p><p className="text-xs text-gray-500">Envoyés</p></div>
              <div className="bg-purple-50 p-4 rounded-lg text-center"><p className="text-2xl font-bold text-purple-600">{data.summary?.opened || 0}</p><p className="text-xs text-gray-500">Ouvertures</p><p className="text-xs text-purple-500 font-medium">{data.summary?.openRate || 0}%</p></div>
              <div className="bg-orange-50 p-4 rounded-lg text-center"><p className="text-2xl font-bold text-orange-600">{data.summary?.clicked || 0}</p><p className="text-xs text-gray-500">Clics uniques</p><p className="text-xs text-orange-500 font-medium">{data.summary?.clickRate || 0}%</p></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-indigo-50 p-3 rounded-lg"><p className="text-sm font-medium text-indigo-900">Taux clic / ouverture</p><p className="text-xl font-bold text-indigo-600">{data.summary?.clickToOpenRate || 0}%</p></div>
              <div className="bg-teal-50 p-3 rounded-lg"><p className="text-sm font-medium text-teal-900">Total des clics</p><p className="text-xl font-bold text-teal-600">{data.summary?.totalClicks || 0}</p></div>
            </div>

            {data.topLinks?.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Top liens cliqués</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {data.topLinks.map((link, idx) => (
                    <div key={`${link.url}-${idx}`} className="flex items-center justify-between gap-3 text-xs">
                      <p className="text-gray-700 truncate">{link.url}</p>
                      <p className="text-gray-500 whitespace-nowrap">{link.clicks} clics • {link.uniqueRecipients} pers.</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Détails par destinataire ({data.pagination?.total || data.recipients?.length || 0})</h4>
              <div className="max-h-[560px] overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-3 py-2 text-left">Destinataire</th>
                      <th className="px-3 py-2 text-center">Statut</th>
                      <th className="px-3 py-2 text-center">Ouvert</th>
                      <th className="px-3 py-2 text-center">Clics</th>
                      <th className="px-3 py-2 text-left">Erreur</th>
                      <th className="px-3 py-2 text-left">Date envoi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data.recipients || []).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2"><p className="text-gray-900 font-medium">{r.email}</p>{r.name && <p className="text-gray-500 text-xs">{r.name}</p>}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            r.status === 'sent' ? 'bg-green-100 text-green-800' :
                            r.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {r.status === 'sent' ? 'Envoyé' : r.status === 'failed' ? 'Échec' : r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {r.opened ? (
                            <div>
                              <span className="text-green-600 font-medium">Oui ({r.openCount || 1})</span>
                              {r.openedAt && <p className="text-xs text-gray-500">{new Date(r.openedAt).toLocaleDateString('fr-FR')}</p>}
                            </div>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {r.uniqueClicks > 0 ? (
                            <div>
                              <span className="text-orange-600 font-medium">{r.uniqueClicks}</span>
                              {r.totalClicks > r.uniqueClicks && <p className="text-xs text-gray-500">({r.totalClicks} total)</p>}
                            </div>
                          ) : <span className="text-gray-400">0</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-500 max-w-[220px] truncate" title={r.error || ''}>{r.error || '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{r.sentAt ? fmtDate(r.sentAt) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data.pagination?.pages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-gray-500">Page {data.pagination.page}/{data.pagination.pages}</p>
                  <div className="flex gap-2">
                    <button onClick={() => load(page - 1)} disabled={page <= 1} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Préc.</button>
                    <button onClick={() => load(page + 1)} disabled={page >= data.pagination.pages} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50">Suiv. →</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
