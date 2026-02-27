import React, { useState, useEffect, useRef } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi';

const WorkspaceSwitcher = () => {
  const { user, workspace, switchWorkspace } = useEcomAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
        const { token, user: updatedUser, workspace: newWorkspace } = res.data.data;
        
        // Mettre ù  jour le token et l'utilisateur via le contexte
        if (switchWorkspace) {
          await switchWorkspace(token, updatedUser, newWorkspace);
        }
        
        setIsOpen(false);
        
        // Recharger la page pour rafraîchir toutes les données
        window.location.reload();
      }
    } catch (err) {
      console.error('Erreur switch workspace:', err);
      alert(err.response?.data?.message || 'Erreur lors du changement d\'espace');
    } finally {
      setSwitching(false);
    }
  };

  const currentWorkspace = workspaces.find(w => w.isActive);
  const otherWorkspaces = workspaces.filter(w => !w.isActive);

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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors w-full text-left"
        disabled={switching}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {currentWorkspace?.name || workspace?.name || 'Espace'}
              </p>
              {currentWorkspace?.role && (
                <p className="text-xs text-gray-500">
                  {roleLabels[currentWorkspace.role]}
                </p>
              )}
            </div>
          </div>
        </div>
        <svg 
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 max-h-64 overflow-y-auto">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Mes espaces ({workspaces.length})
            </p>
          </div>
          
          {/* Espace actuel */}
          {currentWorkspace && (
            <div className="px-3 py-2 bg-emerald-50 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{currentWorkspace.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[currentWorkspace.role] || 'bg-gray-100 text-gray-700'}`}>
                      {roleLabels[currentWorkspace.role]}
                    </span>
                    {currentWorkspace.isOwner && (
                      <span className="text-xs text-gray-500">👑 Propriétaire</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Autres espaces */}
          {otherWorkspaces.length > 0 && (
            <div className="py-1">
              {otherWorkspaces.map((ws) => (
                <button
                  key={ws._id}
                  onClick={() => handleSwitchWorkspace(ws._id)}
                  disabled={switching}
                  className="w-full px-3 py-2 hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{ws.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[ws.role] || 'bg-gray-100 text-gray-700'}`}>
                          {roleLabels[ws.role]}
                        </span>
                        {ws.isOwner && (
                          <span className="text-xs text-gray-500">👑</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {switching && (
            <div className="px-3 py-2 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Changement en cours...
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkspaceSwitcher;
