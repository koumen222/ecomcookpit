import React, { useState, useEffect } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi';

const WorkspaceSwitcherMenu = ({ isSuperAdmin, onWorkspaceSwitch }) => {
  const { user } = useEcomAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await ecomApi.get('/users/me/workspaces');
      if (res.data.success) {
        setWorkspaces(res.data.data.workspaces || []);
      }
    } catch (err) {
      console.error('Erreur récupération workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchWorkspace = async (workspaceId) => {
    if (switching || workspaceId === user?.workspaceId) return;

    try {
      setSwitching(true);
      const res = await ecomApi.post('/users/me/switch-workspace', { workspaceId });
      
      if (res.data.success) {
        if (onWorkspaceSwitch) {
          onWorkspaceSwitch();
        }
        // Recharger la page pour rafraîchir toutes les données
        window.location.reload();
      }
    } catch (err) {
      console.error('Erreur switch workspace:', err);
      alert(err.response?.data?.message || 'Erreur lors du changement d\'espace');
      setSwitching(false);
    }
  };

  const currentWorkspace = workspaces.find(w => w.isActive);
  const otherWorkspaces = workspaces.filter(w => !w.isActive);

  // Ne rien afficher si moins de 2 workspaces ou en chargement
  if (loading || workspaces.length <= 1) {
    return null;
  }

  const roleColors = {
    'ecom_admin': 'bg-emerald-100 text-emerald-700',
    'ecom_closeuse': 'bg-amber-100 text-amber-700',
    'ecom_compta': 'bg-emerald-100 text-emerald-700',
    'ecom_livreur': 'bg-orange-100 text-orange-700'
  };

  const roleLabels = {
    'ecom_admin': 'Admin',
    'ecom_closeuse': 'Closeuse',
    'ecom_compta': 'Compta',
    'ecom_livreur': 'Livreur'
  };

  return (
    <>
      {/* Section workspace actuel */}
      <div className={`px-4 py-3 border-b ${isSuperAdmin ? 'border-gray-700' : 'border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className={`text-xs font-semibold ${isSuperAdmin ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wide`}>
            Espace actuel
          </p>
        </div>
        <div className="flex items-center gap-2 ml-6">
          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${isSuperAdmin ? 'text-gray-100' : 'text-gray-900'} truncate`}>
              {currentWorkspace?.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[currentWorkspace?.role] || 'bg-gray-100 text-gray-700'}`}>
                {roleLabels[currentWorkspace?.role]}
              </span>
              {currentWorkspace?.isOwner && (
                <span className="text-xs text-gray-500">👑</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Autres espaces disponibles */}
      {otherWorkspaces.length > 0 && (
        <div className={`border-b ${isSuperAdmin ? 'border-gray-700' : 'border-gray-100'}`}>
          <div className="px-4 py-2">
            <p className={`text-xs font-semibold ${isSuperAdmin ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wide`}>
              Changer d'espace ({otherWorkspaces.length})
            </p>
          </div>
          <div className="pb-1">
            {otherWorkspaces.map((ws) => (
              <button
                key={ws._id}
                onClick={() => handleSwitchWorkspace(ws._id)}
                disabled={switching}
                className={`w-full px-4 py-2 text-left transition-colors disabled:opacity-50 flex items-center gap-2 ${
                  isSuperAdmin 
                    ? 'text-gray-300 hover:bg-gray-800' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ws.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[ws.role] || 'bg-gray-100 text-gray-700'}`}>
                      {roleLabels[ws.role]}
                    </span>
                    {ws.isOwner && (
                      <span className="text-xs text-gray-500">👑 Propriétaire</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {switching && (
        <div className={`px-4 py-2 border-b ${isSuperAdmin ? 'border-gray-700' : 'border-gray-100'}`}>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Changement en cours...
          </div>
        </div>
      )}
    </>
  );
};

export default WorkspaceSwitcherMenu;
