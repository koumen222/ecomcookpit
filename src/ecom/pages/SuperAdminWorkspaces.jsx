import React, { useState, useEffect } from 'react';
import ecomApi from '../services/ecommApi.js';

const SuperAdminWorkspaces = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchWorkspaces = async () => {
    try {
      const res = await ecomApi.get('/super-admin/workspaces');
      setWorkspaces(res.data.data.workspaces);
    } catch { setError('Erreur chargement espaces'); }
  };

  useEffect(() => { fetchWorkspaces().finally(() => setLoading(false)); }, []);

  const handleToggle = async (wsId) => {
    try { const res = await ecomApi.put(`/super-admin/workspaces/${wsId}/toggle`); setSuccess(res.data.message); fetchWorkspaces(); }
    catch { setError('Erreur modification'); }
  };

  const copyCode = (code) => { navigator.clipboard.writeText(code); setSuccess('Code copié !'); };

  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 4000); return () => clearTimeout(t); } }, [error]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div></div>;

  const active = workspaces.filter(w => w.isActive).length;
  const totalMembers = workspaces.reduce((sum, w) => sum + (w.memberCount || 0), 0);

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      {success && <div className="mb-4 p-3 bg-green-50 text-green-800 rounded-lg text-sm border border-green-200">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200">{error}</div>}

      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Gestion des espaces</h1>
        <p className="text-sm text-gray-500 mt-1">{workspaces.length} espace{workspaces.length > 1 ? 's' : ''} · {active} actif{active > 1 ? 's' : ''} · {totalMembers} membre{totalMembers > 1 ? 's' : ''} au total</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{workspaces.length}</p>
          <p className="text-xs text-gray-500 mt-1">Espaces créés</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{active}</p>
          <p className="text-xs text-gray-500 mt-1">Actifs</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{totalMembers}</p>
          <p className="text-xs text-gray-500 mt-1">Membres total</p>
        </div>
      </div>

      {/* Workspaces grid */}
      {workspaces.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">Aucun espace créé</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map(ws => (
            <div key={ws._id} className={`bg-white rounded-xl shadow-sm border ${ws.isActive ? 'border-green-200' : 'border-red-200 opacity-70'}`}>
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-base">{ws.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{ws.slug}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${ws.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {ws.isActive ? 'Actif' : 'Désactivé'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                    <p className="text-xl font-bold text-gray-900">{ws.memberCount || 0}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Membres</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5 text-center cursor-pointer hover:bg-gray-100 transition" onClick={() => copyCode(ws.inviteCode)}>
                    <p className="text-xs font-mono text-gray-700 truncate">{ws.inviteCode}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Code invite (cliquer)</p>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-gray-500 mb-4">
                  <div className="flex justify-between">
                    <span>Propriétaire</span>
                    <span className="font-medium text-gray-700 truncate ml-2">{ws.owner?.email || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Créé le</span>
                    <span className="font-medium text-gray-700">{new Date(ws.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleToggle(ws._id)}
                  className={`w-full py-2 text-xs font-medium rounded-lg transition ${
                    ws.isActive
                      ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                      : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                  }`}
                >
                  {ws.isActive ? 'Désactiver cet espace' : 'Réactiver cet espace'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuperAdminWorkspaces;
