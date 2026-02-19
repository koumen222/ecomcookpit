import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import CurrencySelector from './CurrencySelector.jsx';
import NotificationPanel, { useNotifications } from './NotificationPanel.jsx';
import PushNotificationBanner from './PushNotificationBanner.jsx';
import InstallPrompt from './InstallPrompt.jsx';
import { useDmUnread } from '../hooks/useDmUnread.js';

const EcomLayout = ({ children }) => {
  const { user, workspace, logout, isImpersonating, impersonatedUser, stopImpersonation } = useEcomAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);
  const { unreadCount, refreshCount } = useNotifications();
  const { unreadDm, clearUnread } = useDmUnread();

  // Utiliser l'utilisateur incarné si en mode incarnation, sinon l'utilisateur normal
  const displayUser = isImpersonating ? impersonatedUser : user;
  const displayWorkspace = isImpersonating ? impersonatedUser?.workspaceId : workspace;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    if (isImpersonating) {
      stopImpersonation();
    } else {
      logout();
      navigate('/ecom/login');
    }
  };

  const roleDashboardMap = {
    'super_admin': '/ecom/super-admin',
    'ecom_admin': '/ecom/dashboard/admin',
    'ecom_closeuse': '/ecom/dashboard/closeuse',
    'ecom_compta': '/ecom/dashboard/compta',
    'ecom_livreur': '/ecom/livreur'
  };

  const dashboardPath = roleDashboardMap[displayUser?.role] || '/ecom/dashboard';

  const roleLabel = {
    'super_admin': 'Super Admin',
    'ecom_admin': 'Admin',
    'ecom_closeuse': 'Closeuse',
    'ecom_compta': 'Comptabilité',
    'ecom_livreur': 'Livreur'
  };

  const roleColors = {
    'super_admin': 'bg-purple-500',
    'ecom_admin': 'bg-blue-600',
    'ecom_closeuse': 'bg-pink-500',
    'ecom_compta': 'bg-emerald-500',
    'ecom_livreur': 'bg-orange-500'
  };

  // --- Navigation items grouped by section ---
  const mainNav = [
    {
      name: 'Accueil', shortName: 'Accueil', href: dashboardPath, primary: true,
      roles: ['ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    },
    {
      name: 'Commandes', shortName: 'Cmd', href: '/ecom/orders', primary: true,
      roles: ['ecom_admin', 'ecom_closeuse', 'ecom_livreur'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
    },
    {
      name: 'Produits', shortName: 'Produits', href: '/ecom/products', primary: true,
      roles: ['ecom_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
    },
    {
      name: 'Clients', shortName: 'Clients', href: '/ecom/clients', primary: true,
      roles: ['ecom_admin', 'ecom_closeuse'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    },
    {
      name: 'Rapports', shortName: 'Rapports', href: '/ecom/reports', primary: true,
      roles: ['ecom_admin', 'ecom_closeuse', 'ecom_compta'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    },
    {
      name: 'Objectifs', shortName: 'Buts', href: '/ecom/goals', primary: true,
      roles: ['ecom_admin', 'ecom_closeuse', 'ecom_compta'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    },
    {
      name: 'Recherche Produits', shortName: 'Recherche', href: '/ecom/product-research', primary: true,
      roles: ['ecom_admin', 'ecom_closeuse', 'ecom_compta'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5l7 7M5 11h19M12 11l-7 7m-7 7m-7-7v6" /></svg>
    },
    {
      name: 'Data', shortName: 'Data', href: '/ecom/data', primary: false,
      roles: ['ecom_admin', 'ecom_compta', 'super_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
    },
    {
      name: 'Transactions', shortName: 'Compta', href: '/ecom/transactions', primary: true,
      roles: ['ecom_admin', 'ecom_compta'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
  ];

  const secondaryNav = [
    {
      name: 'Marketing', shortName: 'Marketing', href: '/ecom/campaigns', primary: false,
      roles: ['ecom_admin', 'ecom_closeuse'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
    },
        {
      name: 'Fournisseurs', shortName: 'Fourn.', href: '/ecom/stock/orders', primary: false,
      roles: ['ecom_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
    },
    {
      name: 'Gestion Stock', shortName: 'Stock', href: '/ecom/stock-locations', primary: false,
      roles: ['ecom_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    },
    {
      name: 'Équipe', shortName: 'Équipe', href: '/ecom/users', primary: false,
      roles: ['ecom_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
    },
    {
      name: 'Affectations', shortName: 'Affectations', href: '/ecom/assignments', primary: false,
      roles: ['ecom_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
    },
  ];

  const bottomNav = [
    {
      name: 'Paramètres', shortName: 'Réglages', href: '/ecom/settings', primary: false,
      roles: ['ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    },
  ];

  const superAdminNav = [
    {
      name: 'Dashboard', shortName: 'Accueil', href: '/ecom/super-admin', primary: true,
      roles: ['super_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
    },
    {
      name: 'Utilisateurs', shortName: 'Users', href: '/ecom/super-admin/users', primary: true,
      roles: ['super_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
    },
    {
      name: 'Espaces', shortName: 'Espaces', href: '/ecom/super-admin/workspaces', primary: true,
      roles: ['super_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
    },
    {
      name: 'Activité', shortName: 'Activité', href: '/ecom/super-admin/activity', primary: false,
      roles: ['super_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {
      name: 'Sécurité', shortName: 'Sécurité', href: '/ecom/security', primary: false,
      roles: ['super_admin', 'ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
    },
  ];

  const allNav = [...mainNav, ...secondaryNav, ...bottomNav, ...superAdminNav];
  const filteredMain = mainNav.filter(i => i.roles.includes(user?.role));
  const filteredSecondary = secondaryNav.filter(i => i.roles.includes(user?.role));
  const filteredBottom = bottomNav.filter(i => i.roles.includes(user?.role));
  const filteredSuperAdmin = superAdminNav.filter(i => i.roles.includes(user?.role));
  const filteredAll = allNav.filter(i => i.roles.includes(user?.role));

  const mobileMainTabs = filteredAll.filter(i => i.primary).slice(0, 4);
  const mobileSecondaryTabs = filteredAll.filter(i => !mobileMainTabs.includes(i));
  const showMoreTab = mobileSecondaryTabs.length > 0;

  const isActive = (href) => {
    if (href === dashboardPath) return location.pathname.includes('/dashboard') || location.pathname === dashboardPath;
    return location.pathname.startsWith(href);
  };

  const initial = displayUser?.name?.charAt(0)?.toUpperCase() || displayUser?.email?.charAt(0)?.toUpperCase() || 'U';

  const NavLink = ({ item }) => {
    const active = isActive(item.href);
    return (
      <Link
        to={item.href}
        className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          active
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
      >
        <span className={`flex-shrink-0 ${active ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'}`}>
          {item.icon}
        </span>
        <span className="truncate">{item.name}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Desktop Sidebar - Clean Shopify Style */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[240px] lg:fixed lg:inset-y-0 bg-gray-50 z-30 border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo Area */}
          <div className="flex items-center h-14 px-4 border-b border-gray-200">
            <Link to={dashboardPath} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">EC</span>
              </div>
              <span className="text-gray-900 font-semibold text-lg">Ecom Cockpit</span>
            </Link>
          </div>

          {/* Main navigation */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {user?.role === 'super_admin' ? (
              <>
                <p className="px-3 pt-2 pb-1.5 text-xs font-medium text-gray-400 uppercase">Administration</p>
                {filteredSuperAdmin.map(item => <NavLink key={item.name} item={item} />)}
              </>
            ) : (
              <>
                <p className="px-3 pt-2 pb-1.5 text-xs font-medium text-gray-400 uppercase">Menu</p>
                {filteredMain.map(item => <NavLink key={item.name} item={item} />)}

                {filteredSecondary.length > 0 && (
                  <>
                    <p className="px-3 pt-6 pb-1.5 text-xs font-medium text-gray-400 uppercase">Gestion</p>
                    {filteredSecondary.map(item => <NavLink key={item.name} item={item} />)}
                  </>
                )}
              </>
            )}
          </nav>

          {/* Bottom Actions */}
          <div className="p-3 border-t border-gray-200 space-y-0.5">
            <Link
              to="/ecom/security"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Sécurité</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-[240px]">
        {/* ── Mobile Header: Apple frosted glass (hidden on chat) ── */}
        <header className={`lg:hidden bg-white/80 backdrop-blur-xl border-b border-gray-200/60 sticky top-0 z-20 pt-safe ${location.pathname.startsWith('/ecom/chat') ? 'hidden' : ''}`}>
          <div className="flex items-center justify-between h-11 px-4">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className={`w-8 h-8 ${roleColors[displayUser?.role] || 'bg-gray-900'} rounded-full flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <span className="text-white text-xs font-bold">{initial}</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-[17px] font-semibold text-gray-900 tracking-tight leading-tight truncate">{getPageTitle(location.pathname)}</h1>
              </div>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {/* Messages icon mobile */}
              <Link
                to="/ecom/chat"
                onClick={clearUnread}
                className={`relative w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                  location.pathname.startsWith('/ecom/chat') ? 'text-blue-500' : 'text-gray-900'
                } active:bg-gray-100/80`}
              >
                <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                {unreadDm > 0 && !location.pathname.startsWith('/ecom/chat') && (
                  <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-[#25D366] text-white text-[11px] font-bold shadow-sm">{unreadDm > 99 ? '99+' : unreadDm}</span>
                )}
              </Link>
              <div className="relative" ref={notifRef}>
                <button onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }} className="relative w-9 h-9 flex items-center justify-center rounded-full active:bg-gray-100/80 transition-colors">
                  <svg className="w-[22px] h-[22px] text-gray-900" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  {unreadCount > 0 && <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[11px] font-bold shadow-sm">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </button>
                <NotificationPanel isOpen={notifOpen} onClose={() => { setNotifOpen(false); refreshCount(); }} />
              </div>
            </div>
          </div>
        </header>

        {/* ── Desktop Header ── */}
        <header className="hidden lg:flex bg-white border-b border-gray-200 h-14 items-center px-6 sticky top-0 z-20">
          <div className="flex-1 flex items-center justify-between gap-4">
            <div className="flex items-center flex-1 max-w-md">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
                <input type="text" placeholder="Rechercher..." className="block w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg leading-5 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Messages icon - Facebook style */}
              <Link
                to="/ecom/chat"
                onClick={clearUnread}
                className={`relative p-2 rounded-lg transition-colors ${
                  location.pathname.startsWith('/ecom/chat') ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title="Messages"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                {unreadDm > 0 && !location.pathname.startsWith('/ecom/chat') && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full bg-[#25D366] text-white text-[10px] font-bold">{unreadDm > 99 ? '99+' : unreadDm}</span>
                )}
              </Link>
              <div className="relative" ref={notifRef}>
                <button onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }} className="relative p-2 text-gray-500 hover:text-gray-700 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  {unreadCount > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </button>
                <NotificationPanel isOpen={notifOpen} onClose={() => { setNotifOpen(false); refreshCount(); }} />
              </div>
              <div className="relative ml-2" ref={userMenuRef}>
                <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100">
                  <div className={`w-8 h-8 ${roleColors[displayUser?.role] || 'bg-gray-900'} rounded-lg flex items-center justify-center`}><span className="text-white text-xs font-bold">{initial}</span></div>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{displayUser?.name || displayUser?.email?.split('@')[0]}</p>
                      <p className="text-xs text-gray-500">{displayUser?.email}</p>
                    </div>
                    <div className="py-1">
                      <Link to="/ecom/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"><svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>Profil</Link>
                      <Link to="/ecom/settings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"><svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>Paramètres</Link>
                    </div>
                    <div className="border-t border-gray-100 py-1">
                      {isImpersonating ? (
                        <button onClick={() => { setUserMenuOpen(false); stopImpersonation(); }} className="flex items-center gap-2 px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 w-full"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>Revenir Admin</button>
                      ) : (
                        <button onClick={() => { setUserMenuOpen(false); handleLogout(); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>Déconnexion</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Push notification banner */}
        <PushNotificationBanner />

        {/* Page content - pb-safe-nav = pb-20 + home indicator sur iOS */}
        <main className="flex-1 overflow-y-auto pb-safe-nav lg:pb-0">
          {children}
        </main>
      </div>

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* ── iOS-Style Bottom Tab Bar (hidden on chat page) ── */}
      <nav className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-t border-gray-200/60 ${location.pathname.startsWith('/ecom/chat') ? 'hidden' : ''}`}>
        <div className="flex items-stretch justify-around px-2 bottom-nav-safe" style={{ height: '50px' }}>
          {mobileMainTabs.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMoreMenuOpen(false)}
                className={`flex flex-col items-center justify-center flex-1 gap-0.5 transition-all duration-200 active:scale-90 ${
                  active ? 'text-blue-500' : 'text-gray-400'
                }`}
              >
                <span className={`transition-transform duration-200 ${active ? 'scale-110' : ''}`}>{item.icon}</span>
                <span className={`text-[10px] font-medium leading-none ${active ? 'text-blue-500' : 'text-gray-400'}`}>{item.shortName}</span>
              </Link>
            );
          })}

          {showMoreTab && (
            <div className="relative flex-1">
              <button
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className={`flex flex-col items-center justify-center w-full h-full gap-0.5 transition-all duration-200 active:scale-90 ${
                  moreMenuOpen ? 'text-blue-500' : 'text-gray-400'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01" /><circle cx="12" cy="12" r="10" strokeWidth={1.5} /></svg>
                <span className="text-[10px] font-medium leading-none">Plus</span>
              </button>

              {/* iOS-style action sheet */}
              {moreMenuOpen && (
                <>
                  <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 ios-fade-in" onClick={() => setMoreMenuOpen(false)} />
                  <div className="fixed bottom-0 left-0 right-0 z-40 px-2 ios-slide-up" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}>
                    <div className="bg-white/95 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl mb-2">
                      <div className="px-4 pt-3 pb-2">
                        <div className="w-9 h-1 bg-gray-300 rounded-full mx-auto mb-2" />
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Plus d'options</p>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {mobileSecondaryTabs.map((item) => {
                          const active = isActive(item.href);
                          return (
                            <Link
                              key={item.name}
                              to={item.href}
                              onClick={() => setMoreMenuOpen(false)}
                              className={`flex items-center gap-3.5 px-5 py-3.5 text-[15px] font-medium active:bg-gray-100 transition-colors ${
                                active ? 'text-blue-500' : 'text-gray-900'
                              }`}
                            >
                              <span className={`flex-shrink-0 ${active ? 'text-blue-500' : 'text-gray-400'}`}>{item.icon}</span>
                              <span className="flex-1">{item.name}</span>
                              {active && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                            </Link>
                          );
                        })}
                      </div>
                      <div className="border-t border-gray-100">
                        <Link to="/ecom/profile" onClick={() => setMoreMenuOpen(false)} className="flex items-center gap-3.5 px-5 py-3.5 text-[15px] font-medium text-gray-900 active:bg-gray-100">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          Mon profil
                        </Link>
                      </div>
                    </div>
                    <button
                      onClick={() => { setMoreMenuOpen(false); handleLogout(); }}
                      className="w-full bg-white/95 backdrop-blur-xl rounded-2xl py-3.5 text-[17px] font-semibold text-red-500 active:bg-gray-100 shadow-2xl transition-colors"
                    >
                      Déconnexion
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </nav>
    </div>
  );
};

const getPageTitle = (pathname) => {
  if (pathname.includes('/profile')) return 'Mon profil';
  if (pathname.includes('/dashboard')) return 'Dashboard';
  if (pathname.includes('/data')) return 'Data';
  if (pathname.includes('/products/new')) return 'Nouveau produit';
  if (pathname.includes('/products') && pathname.includes('/edit')) return 'Modifier le produit';
  if (pathname.match(/\/products\/[a-f0-9]+$/)) return 'Détail du produit';
  if (pathname.includes('/products')) return 'Produits';
  if (pathname.includes('/reports/new')) return 'Nouveau rapport';
  if (pathname.includes('/reports') && pathname.includes('/edit')) return 'Modifier le rapport';
  if (pathname.includes('/reports/')) return 'Détail du rapport';
  if (pathname.includes('/reports')) return 'Rapports';
  if (pathname.includes('/stock/orders/new')) return 'Nouvelle commande';
  if (pathname.includes('/stock/orders') && pathname.includes('/edit')) return 'Modifier commande';
  if (pathname.includes('/stock-locations')) return 'Gestion de stock';
  if (pathname.includes('/stock')) return 'Gestion des fournisseurs';
  if (pathname.includes('/transactions/new')) return 'Nouvelle transaction';
  if (pathname.includes('/transactions') && pathname.includes('/edit')) return 'Modifier transaction';
  if (pathname.match(/\/transactions\/[a-f0-9]+$/)) return 'Détail transaction';
  if (pathname.includes('/transactions')) return 'Transactions';
  if (pathname.includes('/decisions/new')) return 'Nouvelle décision';
  if (pathname.includes('/decisions')) return 'Décisions';
  if (pathname.includes('/import')) return 'Import Commandes';
  if (pathname.match(/\/orders\/[a-f0-9]{24}/)) return 'Détail commande';
  if (pathname.includes('/orders')) return 'Commandes';
  if (pathname.includes('/clients/new')) return 'Nouveau client';
  if (pathname.includes('/clients') && pathname.includes('/edit')) return 'Modifier client';
  if (pathname.includes('/clients')) return 'Clients';
  if (pathname.includes('/campaigns')) return 'Marketing';
    if (pathname.includes('/super-admin/users')) return 'Gestion des utilisateurs';
  if (pathname.includes('/super-admin/workspaces')) return 'Gestion des espaces';
  if (pathname.includes('/super-admin/activity')) return 'Activité';
  if (pathname.includes('/super-admin/settings')) return 'Paramètres';
  if (pathname.includes('/chat')) return 'Chat Équipe';
  if (pathname.includes('/goals')) return 'Objectifs Hebdomadaires';
  if (pathname.includes('/settings')) return 'Paramètres';
  if (pathname.includes('/super-admin')) return 'Super Administration';
  if (pathname.includes('/users')) return 'Gestion Équipe';
  return 'Ecom Cockpit';
};

export default EcomLayout;
