import React, { useState, useEffect, useRef } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useWorkspaceSwitch, SwitchOverlay } from '../hooks/useWorkspaceSwitch';
import ecomApi from '../services/ecommApi';

const PALETTE = [
  '#10b981', '#8b5cf6', '#3b82f6',
  '#f97316', '#f43f5e', '#06b6d4', '#f59e0b'
];
const wsColor = (name = '') => PALETTE[name.charCodeAt(0) % PALETTE.length];
const wsInitials = (name = '') => name.slice(0, 2).toUpperCase();

const roleLabels = {
  'ecom_admin': 'Admin',
  'ecom_closeuse': 'Closeuse',
  'ecom_compta': 'Compta',
  'ecom_livreur': 'Livreur'
};

const WorkspaceSwitcher = () => {
  const { user, workspace } = useEcomAuth();
  const { switchingId, switchingName, handleSwitch } = useWorkspaceSwitch();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => { fetchWorkspaces(); }, []);

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
      if (res.data.success) setWorkspaces(res.data.data.workspaces || []);
    } catch {}
    finally { setLoading(false); }
  };

  const onSwitch = (ws) => handleSwitch(ws, { onBefore: () => setIsOpen(false) });

  const currentWorkspace = workspaces.find(w => w.isActive);
  const otherWorkspaces = workspaces.filter(w => !w.isActive);
  const canSwitch = !loading && workspaces.length > 1;

  const wsName = currentWorkspace?.name || workspace?.name || 'Espace';

  return (
    <>
      {switchingId && <SwitchOverlay name={switchingName} />}

      <div className="relative" ref={dropdownRef}>
        {/* Trigger */}
        <button
          onClick={() => canSwitch && setIsOpen(!isOpen)}
          disabled={!!switchingId || !canSwitch}
          className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl transition-colors text-left group ${canSwitch ? 'hover:bg-gray-100 cursor-pointer' : 'cursor-default'}`}
        >
          {/* Avatar initiales */}
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
            style={{ background: wsColor(wsName) }}
          >
            {wsInitials(wsName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{wsName}</p>
            <p className="text-[10px] text-gray-400 leading-tight">{roleLabels[currentWorkspace?.role] || 'Espace'}</p>
          </div>
          {canSwitch && (
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>

        {/* Dropdown */}
        {canSwitch && isOpen && (
          <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 overflow-hidden">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pb-1.5 pt-0.5">
              Mes espaces ({workspaces.length})
            </p>

            {/* Espace actif */}
            <div className="mx-1.5 mb-1 px-2.5 py-2 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                style={{ background: wsColor(currentWorkspace?.name || '') }}
              >
                {wsInitials(currentWorkspace?.name || '')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{currentWorkspace?.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-emerald-600">{roleLabels[currentWorkspace?.role]}</span>
                  {currentWorkspace?.isOwner && <span className="text-[10px] text-gray-400">· Propriétaire</span>}
                </div>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
            </div>

            {/* Autres espaces */}
            {otherWorkspaces.map((ws) => (
              <button
                key={ws._id}
                onClick={() => onSwitch(ws)}
                disabled={!!switchingId}
                className="w-full px-3 py-2 hover:bg-gray-50 transition-colors text-left flex items-center gap-2.5 disabled:opacity-50"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ background: wsColor(ws.name) }}
                >
                  {wsInitials(ws.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{ws.name}</p>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400">{roleLabels[ws.role] || ws.role}</span>
                    {ws.isOwner && <span className="text-[10px] text-gray-400">· Propriétaire</span>}
                  </div>
                </div>
                <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default WorkspaceSwitcher;
