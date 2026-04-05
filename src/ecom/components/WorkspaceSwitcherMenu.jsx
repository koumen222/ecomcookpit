import React, { useState, useEffect } from 'react';
import { useWorkspaceSwitch, SwitchOverlay } from '../hooks/useWorkspaceSwitch';
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

const WorkspaceSwitcherMenu = ({ isSuperAdmin, onWorkspaceSwitch }) => {
  const { switchingId, switchingName, handleSwitch } = useWorkspaceSwitch();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchWorkspaces(); }, []);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await ecomApi.get('/users/me/workspaces');
      if (res.data.success) setWorkspaces(res.data.data.workspaces || []);
    } catch {}
    finally { setLoading(false); }
  };

  const onSwitch = (ws) => handleSwitch(ws, { onBefore: onWorkspaceSwitch });

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
              onClick={() => onSwitch(ws)}
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
