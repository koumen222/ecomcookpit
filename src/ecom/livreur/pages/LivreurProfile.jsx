import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Phone,
  Mail,
  LogOut,
  ChevronRight,
  Shield,
  Bell,
  HelpCircle,
  Edit3,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useEcomAuth } from '../../hooks/useEcomAuth.jsx';

export default function LivreurProfile() {
  const { user, logout } = useEcomAuth();
  const navigate = useNavigate();
  const localUser = user || JSON.parse(localStorage.getItem('ecomUser') || 'null');
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (!window.confirm('Se déconnecter ?')) return;
    setLoggingOut(true);
    try {
      await logout();
      navigate('/ecom/login', { replace: true });
    } catch {
      // Still navigate on failure
      navigate('/ecom/login', { replace: true });
    }
  };

  const initials = localUser?.name
    ? localUser.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  const menuItems = [
    {
      group: 'Compte',
      items: [
        { icon: User, label: 'Informations personnelles', onClick: () => navigate('/ecom/profile') },
        { icon: Shield, label: 'Sécurité', onClick: () => navigate('/ecom/settings') },
      ],
    },
    {
      group: 'Préférences',
      items: [
        { icon: Bell, label: 'Notifications', onClick: () => {} },
      ],
    },
    {
      group: 'Support',
      items: [
        { icon: HelpCircle, label: 'Aide & Support', onClick: () => {} },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 px-4 pt-12 pb-8">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {localUser?.avatar ? (
              <img
                src={localUser.avatar}
                alt={localUser.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-white text-xl font-bold">{localUser?.name || 'Livreur'}</h1>
            <p className="text-gray-400 text-sm mt-0.5">{localUser?.email || ''}</p>
            <div className="mt-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                🚚 Livreur
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Contact info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Coordonnées</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {localUser?.phone && (
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Phone size={16} className="text-indigo-400" />
                <span className="text-gray-700 text-sm">{localUser.phone}</span>
              </div>
            )}
            {localUser?.email && (
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Mail size={16} className="text-indigo-400" />
                <span className="text-gray-700 text-sm">{localUser.email}</span>
              </div>
            )}
            {!localUser?.phone && !localUser?.email && (
              <div className="px-4 py-3.5 text-gray-400 text-sm">Aucune coordonnée renseignée</div>
            )}
          </div>
        </div>

        {/* Menu groups */}
        {menuItems.map((group) => (
          <div key={group.group} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{group.group}</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-gray-50 transition-colors"
                  >
                    <Icon size={18} className="text-gray-400" />
                    <span className="flex-1 text-sm text-gray-700">{item.label}</span>
                    <ChevronRight size={16} className="text-gray-300" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Workspace */}
        {localUser?.workspaceId && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
            <p className="text-xs text-indigo-400 uppercase tracking-wide font-medium mb-1">Espace de travail</p>
            <p className="text-indigo-700 text-sm font-medium">
              {localUser.workspaceName || localUser.workspaceId}
            </p>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-50 border border-red-100 text-red-600 font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          <LogOut size={18} />
          {loggingOut ? 'Déconnexion...' : 'Se déconnecter'}
        </button>

        {/* Version */}
        <p className="text-center text-gray-300 text-xs pb-2">Scalor Livreur</p>
      </div>
    </div>
  );
}
