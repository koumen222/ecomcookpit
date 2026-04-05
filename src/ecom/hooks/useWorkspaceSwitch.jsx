import React, { useState, useCallback, useRef } from 'react';
import { useEcomAuth } from './useEcomAuth';
import ecomApi from '../services/ecommApi';

const roleDashMap = {
  'super_admin': '/ecom/super-admin',
  'ecom_admin': '/ecom/dashboard/admin',
  'ecom_closeuse': '/ecom/dashboard/closeuse',
  'ecom_compta': '/ecom/dashboard/compta',
  'ecom_livreur': '/ecom/livreur',
  'livreur': '/ecom/livreur'
};

/**
 * Overlay plein écran pendant le switch de workspace
 */
export const SwitchOverlay = ({ name }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(255,255,255,0.93)',
    backdropFilter: 'blur(6px)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 14
  }}>
    <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#0F6B4F', animation: 'spin 0.7s linear infinite' }} />
    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
      Basculer vers <span style={{ color: '#0F6B4F' }}>{name}</span>…
    </p>
  </div>
);

const toId = (v) => (typeof v === 'object' && v !== null) ? (v._id || v.id || String(v)) : String(v || '');

/**
 * Hook partagé pour le switch de workspace.
 * Unifie la logique entre WorkspaceSwitcher, WorkspaceSwitcherMenu et Profile.
 */
export const useWorkspaceSwitch = () => {
  const { user, switchWorkspace } = useEcomAuth();
  const [switchingId, setSwitchingId] = useState(null);
  const [switchingName, setSwitchingName] = useState('');
  const busyRef = useRef(false);

  const handleSwitch = useCallback(async (ws, { onBefore } = {}) => {
    if (busyRef.current) return;
    const wsId = ws._id || ws.id;
    const wsName = ws.name || '';
    const currentWsId = toId(user?.workspaceId);
    if (wsId === currentWsId) return;

    busyRef.current = true;
    setSwitchingId(wsId);
    setSwitchingName(wsName);
    if (onBefore) onBefore();

    try {
      const res = await ecomApi.post('/users/me/switch-workspace', { workspaceId: wsId });
      if (res.data.success) {
        const { token, user: nextUser, workspace: nextWs } = res.data.data;
        if (switchWorkspace) await switchWorkspace(token, nextUser, nextWs);

        const target = roleDashMap[nextUser?.role] || '/ecom/dashboard';
        if (window.location.pathname === target) {
          window.location.reload();
        } else {
          window.location.href = target;
        }
      } else {
        busyRef.current = false;
        setSwitchingId(null);
      }
    } catch (err) {
      busyRef.current = false;
      alert(err.response?.data?.message || 'Erreur lors du changement d\'espace');
      setSwitchingId(null);
    }
  }, [user?.workspaceId, switchWorkspace]);

  return { switchingId, switchingName, handleSwitch };
};
