import React, { useState, useEffect } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi';

const PALETTE = [
  'bg-emerald-500', 'bg-violet-500', 'bg-blue-500',
  'bg-orange-500', 'bg-rose-500', 'bg-cyan-500', 'bg-amber-500'
];

const wsColor = (name = '') => PALETTE[name.charCodeAt(0) % PALETTE.length];
const wsInitials = (name = '') => name.slice(0, 2).toUpperCase();

const roleLabels = {
  'ecom_admin': 'Admin',
  'ecom_closeuse': 'Closeuse',
  'ecom_compta': 'Compta',
  'ecom_livreur': 'Livreur'
};

// Overlay de transition plein écran
const SwitchOverlay = ({ name }) => (
  <div
    style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(6px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16, animation: 'fadeIn 0.15s ease'
    }}
  >
    <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#0F6B4F', animation: 'spin 0.7s linear infinite' }} />
    <p style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Basculer vers <span style={{ color: '#0F6B4F' }}>{name}</span>…</p>
  </div>
);

const WorkspaceSwitcherMenu = ({ isSuperAdmin, onWorkspaceSwitch }) => {
  const { user, switchWorkspace } = useEcomAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState(null);
  const [switchingName, setSwitchingName] = useState('');

  useEffect(() => { fetchWorkspaces(); }, []);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await ecomApi.get('/users/me/workspaces');
      if (res.data.success) setWorkspaces(res.data.data.workspaces || []);
    } catch {}
    finally { setLoading(false); }
  };

  const handleSwitch = async (ws) => {
    if (switchingId || ws._id === user?.workspaceId) return;
    setSwitchingId(ws._id);
    setSwitchingName(ws.name);
    if (onWorkspaceSwitch) onWorkspaceSwitch();
    try {
      const res = await ecomApi.post('/users/me/switch-workspace', { workspaceId: ws._id });
      if (res.data.success) {
        const { token, user: nextUser, workspace: nextWs } = res.data.data;
        if (switchWorkspace) await switchWorkspace(token, nextUser, nextWs);
        const roleDashMap = {
          'super_admin': '/ecom/super-admin',
          'ecom_admin': '/ecom/dashboard/admin',
          'ecom_closeuse': '/ecom/dashboard/closeuse',
          'ecom_compta': '/ecom/dashboard/compta',
          'ecom_livreur': '/ecom/livreur',
          'livreur': '/ecom/livreur'
        };
        const target = roleDashMap[nextUser?.role] || '/ecom/dashboard';
        if (window.location.pathname === target) {
          window.location.reload();
        } else {
          window.location.href = target;
        }
      } else {
        setSwitchingId(null);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors du changement d\'espace');
      setSwitchingId(null);
    }
  };

  const currentWorkspace = workspaces.find(w => w.isActive);
  const otherWorkspaces = workspaces.filter(w => !w.isActive);

  if (loading || workspaces.length <= 1) return null;

  return (
    <>
      {/* Overlay de transition */}
      {switchingId && <SwitchOverlay name={switchingName} />}

      {/* Espace actuel */}
      <div className={`px-4 py-3 border-b ${isSuperAdmin ? 'border-gray-700' : 'border-gray-100'}`}>
        <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${isSuperAdmin ? 'text-gray-500' : 'text-gray-400'}`}>
          Espace actuel
        </p>
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg ${wsColor(currentWorkspace?.name)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
            {wsInitials(currentWorkspace?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold truncate ${isSuperAdmin ? 'text-gray-100' : 'text-gray-900'}`}>
              {currentWorkspace?.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                {roleLabels[currentWorkspace?.role] || currentWorkspace?.role}
              </span>
              {currentWorkspace?.isOwner && <span className="text-[10px] text-gray-400">Propriétaire</span>}
            </div>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
        </div>
      </div>

      {/* Autres espaces */}
      {otherWorkspaces.length > 0 && (
        <div className={`border-b ${isSuperAdmin ? 'border-gray-700' : 'border-gray-100'}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider px-4 pt-2.5 pb-1 ${isSuperAdmin ? 'text-gray-500' : 'text-gray-400'}`}>
            Changer d'espace
          </p>
          {otherWorkspaces.map((ws) => (
            <button
              key={ws._id}
              onClick={() => handleSwitch(ws)}
              disabled={!!switchingId}
              className={`w-full px-4 py-2.5 text-left flex items-center gap-2.5 transition-colors disabled:opacity-50 ${
                isSuperAdmin ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg ${wsColor(ws.name)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                {wsInitials(ws.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isSuperAdmin ? 'text-gray-200' : 'text-gray-800'}`}>{ws.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    isSuperAdmin ? 'text-gray-400 bg-gray-700' : 'text-gray-500 bg-gray-100'
                  }`}>
                    {roleLabels[ws.role] || ws.role}
                  </span>
                  {ws.isOwner && <span className={`text-[10px] ${isSuperAdmin ? 'text-gray-500' : 'text-gray-400'}`}>Propriétaire</span>}
                </div>
              </div>
              <svg className={`w-4 h-4 flex-shrink-0 ${isSuperAdmin ? 'text-gray-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </>
  );
};

export default WorkspaceSwitcherMenu;
