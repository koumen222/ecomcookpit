import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import CurrencySelector from './CurrencySelector.jsx';
import NotificationPanel from './NotificationPanel.jsx';
import { useNotifications } from '../hooks/useNotifications';
import NotificationModal from './NotificationModal.jsx';
import PushNotificationBanner from './PushNotificationBanner.jsx';
import InstallPrompt from './InstallPrompt.jsx';
import { useDmUnread } from '../hooks/useDmUnread.js';
import GlobalSearch from './GlobalSearch.jsx';
import WorkspaceSwitcherMenu from './WorkspaceSwitcherMenu.jsx';
import WorkspaceSwitcher from './WorkspaceSwitcher.jsx';
import TopLoader from './TopLoader.jsx';

const EcomLayoutComponent = ({ children }) => {
  const { user, workspace, logout } = useEcomAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);
  const { unreadCount, refreshCount } = useNotifications();
  const { unreadDm, clearUnread, lastMessage, clearLastMessage } = useDmUnread();

  // ── Tutorial popup ──
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    if (user?.role === 'ecom_livreur') return;
    const todayKey = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const storageKey = `ecom_tutorial_shown_${user.id}`;
    if (localStorage.getItem(storageKey) === todayKey) return;
    const timer = setTimeout(() => {
      setShowTutorial(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [user?.id]);

  const closeTutorial = () => {
    setShowTutorial(false);
    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `ecom_tutorial_shown_${user?.id}`;
    localStorage.setItem(storageKey, todayKey);
  };

  // ── Toast notification in-app ──
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((data) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(data);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // 1. Écouter notification:new via WebSocket (relayé par useDmUnread → window event)
  useEffect(() => {
    const handleNotification = (event) => {
      const notif = event.detail;
      if (!notif) return;
      showToast({
        title: notif.title || '🔔 Nouvelle notification',
        body: notif.message || '',
        type: notif.type || 'info',
      });
      // refreshCount géré par useNotifications qui écoute aussi ecom:notification
    };
    window.addEventListener('ecom:notification', handleNotification);
    return () => window.removeEventListener('ecom:notification', handleNotification);
  }, [showToast]);

  // 2. Déclencher le toast quand un DM arrive via WebSocket (lastMessage du hook useDmUnread)
  useEffect(() => {
    if (!lastMessage) return;
    if (location.pathname.startsWith('/ecom/chat')) {
      clearLastMessage();
      return;
    }
    const preview = lastMessage.content.length > 60 ? lastMessage.content.slice(0, 60) + '…' : lastMessage.content;
    showToast({
      title: lastMessage.channel
        ? `💬 #${lastMessage.channel} — ${lastMessage.senderName}`
        : `💬 Message de ${lastMessage.senderName}`,
      body: preview,
      type: 'new_message',
    });
    refreshCount();
    clearLastMessage();
  }, [lastMessage, showToast, refreshCount, clearLastMessage, location.pathname]);

  // 3. Écouter les push notifications via Service Worker (fallback)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleSWMessage = (event) => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        const payload = event.data.payload || {};
        showToast({
          title: payload.title || '📣 Nouvelle notification',
          body: payload.body || '',
          type: payload.type || 'info',
        });
        refreshCount();
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSWMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage);
  }, [showToast, refreshCount]);

  // Utilisateur et workspace actifs
  const displayUser = user;
  const displayWorkspace = workspace;

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
    logout();
    navigate('/ecom/login');
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
    'super_admin': 'bg-gradient-to-br from-emerald-700 to-emerald-900',
    'ecom_admin': 'bg-scalor-green',
    'ecom_closeuse': 'bg-scalor-copper',
    'ecom_compta': 'bg-emerald-600',
    'ecom_livreur': 'bg-amber-600'
  };

  const isSuperAdmin = user?.role === 'super_admin';

  // --- Navigation items grouped by section (mémorisés pour éviter re-création) ---
  const mainNav = useMemo(() => [
    {
      name: 'Accueil', shortName: 'Accueil', href: dashboardPath, primary: true,
      roles: ['ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    },
    {
      name: 'Commandes', shortName: 'Cmd', href: '/ecom/orders', primary: true,
      roles: ['ecom_admin', 'ecom_closeuse'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
    },
    {
      name: 'Clients', shortName: 'Clients', href: '/ecom/clients', primary: true,
      roles: ['ecom_admin', 'ecom_closeuse'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    },
    {
      name: 'Produits', shortName: 'Produits', href: '/ecom/products', primary: false,
      roles: ['ecom_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
    },
    {
      name: 'Sourcing', shortName: 'Sourcing', href: '/ecom/sourcing', primary: false,
      roles: ['ecom_admin', 'ecom_compta'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
    },
        {
      name: 'Ma Boutique', shortName: 'Boutique', href: '/ecom/boutique', primary: true,
      roles: ['ecom_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
    },
    {
      name: 'Commissions', shortName: 'Commissions', href: '/ecom/commissions', primary: true,
      roles: ['ecom_closeuse'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {
      name: 'Courses dispo', shortName: 'Dispo', href: '/ecom/livreur/available', primary: true,
      roles: ['ecom_livreur'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
    },
    {
      name: 'Mes livraisons', shortName: 'En cours', href: '/ecom/livreur/deliveries', primary: true,
      roles: ['ecom_livreur'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
    },
    {
      name: 'Historique', shortName: 'Histo', href: '/ecom/livreur/history', primary: true,
      roles: ['ecom_livreur'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {      name: 'Revenus livreur', shortName: 'Revenus', href: '/ecom/livreur/revenus', primary: true,
      roles: ['ecom_livreur'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {      name: 'Montant encaissé', shortName: 'Encaissé', href: '/ecom/livreur/earnings', primary: false,
      roles: ['ecom_livreur'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    },
    {
      name: 'Rapports', shortName: 'Rapports', href: '/ecom/reports', primary: true,
      roles: ['ecom_admin', 'ecom_closeuse', 'ecom_compta'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    },
    {
      name: 'Objectifs', shortName: 'Buts', href: '/ecom/goals', primary: false,
      roles: ['ecom_admin', 'ecom_closeuse', 'ecom_compta'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    },
    {
      name: 'Recherche Produits', shortName: 'Recherche', href: '/ecom/product-research', primary: false,
      roles: ['ecom_admin', 'ecom_closeuse', 'ecom_compta'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5l7 7M5 11h19M12 11l-7 7m-7 7m-7-7v6" /></svg>
    },
    {
      name: 'Data', shortName: 'Data', href: '/ecom/data', primary: false,
      roles: ['ecom_admin', 'ecom_compta', 'super_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
    },
    {
      name: 'Finances', shortName: 'Finances', href: '/ecom/transactions', primary: false,
      roles: ['ecom_admin', 'ecom_compta'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
  ], [dashboardPath]);

  const secondaryNav = useMemo(() => [
    {
      name: 'Marketing', shortName: 'Marketing', href: '/ecom/campaigns', primary: false,
      roles: ['ecom_admin', 'ecom_closeuse'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
    },
    {
      name: 'Service WhatsApp', shortName: 'WhatsApp', href: '/ecom/whatsapp/service', primary: false,
      roles: ['ecom_admin', 'ecom_closeuse', 'ecom_compta'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
    },
    {
      name: 'Agent IA', shortName: 'Agent IA', href: '/ecom/agent-ia', primary: false,
      roles: ['ecom_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.59.659H9.06a2.25 2.25 0 01-1.591-.659L5 14.5m14 0V17a2 2 0 01-2 2H7a2 2 0 01-2-2v-2.5" /></svg>
    },
    {
      name: 'Automation Flows', shortName: 'Flows', href: '/ecom/rita-flows', primary: false,
      roles: ['ecom_admin'],
      requiresRitaAccess: true,
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
    },
        {
      name: 'Fournisseurs', shortName: 'Fournisseurs', href: '/ecom/suppliers', primary: false,
      roles: ['ecom_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
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
    {
      name: 'Suivi livraisons', shortName: 'Livraisons', href: '/ecom/livreur-management', primary: false,
      roles: ['ecom_admin', 'ecom_closeuse'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
    },
    {
      name: 'API Développeur', shortName: 'Dev API', href: '/ecom/developer', primary: false,
      roles: ['ecom_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
    },
  ], []);

  const bottomNav = useMemo(() => [
    {
      name: 'Abonnement', shortName: 'Plan', href: '/ecom/billing', primary: false,
      roles: ['ecom_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
    },
    {
      name: 'Paramètres', shortName: 'Réglages', href: '/ecom/settings', primary: false,
      roles: ['ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    },
  ], []);

  const superAdminNav = useMemo(() => [
    {
      name: 'Dashboard', shortName: 'Accueil', href: '/ecom/super-admin', primary: true,
      roles: ['super_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
    },
    {
      name: 'Push Center', shortName: 'Push', href: '/ecom/super-admin/push', primary: true,
      roles: ['super_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
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
      name: 'Analytics', shortName: 'Analytics', href: '/ecom/super-admin/analytics', primary: true,
      roles: ['super_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    },
    {
      name: 'Marketing', shortName: 'Marketing', href: '/ecom/marketing', primary: true,
      roles: ['super_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
    },
    {
      name: 'WhatsApp', shortName: 'WhatsApp', href: '/ecom/super-admin/whatsapp-postulations', primary: true,
      roles: ['super_admin'],
      icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
    },
    {
      name: 'Support', shortName: 'Support', href: '/ecom/super-admin/support', primary: true,
      roles: ['super_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
    },
    {
      name: 'Logs WhatsApp', shortName: 'WA Logs', href: '/ecom/super-admin/whatsapp-logs', primary: false,
      roles: ['super_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    },
    {
      name: 'Activité', shortName: 'Activité', href: '/ecom/super-admin/activity', primary: false,
      roles: ['super_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {
      name: 'Paramètres', shortName: 'Réglages', href: '/ecom/super-admin/settings', primary: false,
      roles: ['super_admin'],
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    },
  ], []);

  const allNav = useMemo(() => [...mainNav, ...secondaryNav, ...bottomNav, ...superAdminNav], [mainNav, secondaryNav, bottomNav, superAdminNav]);
  const canAccessNavItem = useCallback((item) => {
    if (!item.roles.includes(user?.role)) return false;
    return true;
  }, [user?.role]);
  const filteredMain = useMemo(() => mainNav.filter(canAccessNavItem), [mainNav, canAccessNavItem]);
  const filteredSecondary = useMemo(() => secondaryNav.filter(canAccessNavItem), [secondaryNav, canAccessNavItem]);
  const filteredBottom = useMemo(() => bottomNav.filter(canAccessNavItem), [bottomNav, canAccessNavItem]);
  const filteredSuperAdmin = useMemo(() => superAdminNav.filter(canAccessNavItem), [superAdminNav, canAccessNavItem]);
  const filteredAll = useMemo(() => allNav.filter(canAccessNavItem), [allNav, canAccessNavItem]);

  const mobileMainTabs = useMemo(() => filteredAll.filter(i => i.primary).slice(0, 5), [filteredAll]);
  // Icônes mobile agrandies (w-7 h-7 au lieu de w-8 h-8)
  const mobileIcon = (item) => React.cloneElement(item.icon, { className: 'w-5 h-5' });
  const mobileIconLg = (item) => React.cloneElement(item.icon, { className: 'w-5 h-5' });
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
        className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
          active
            ? 'bg-[#0F6B4F]/10 text-[#0F6B4F]'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <span className={`flex-shrink-0 ${
          active ? 'text-[#0F6B4F]' : 'text-gray-400 group-hover:text-gray-600'
        }`}>
          {item.icon}
        </span>
        <span className="truncate flex-1">{item.name}</span>
        {active && <span className="w-1.5 h-1.5 rounded-full bg-[#0F6B4F] flex-shrink-0" />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row overflow-x-hidden max-w-[100vw]">
      <TopLoader />
      {/* Desktop Sidebar — white, clean, Chariow-inspired */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[220px] lg:fixed lg:inset-y-0 z-30 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">

          {/* Logo + workspace area */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <Link to={dashboardPath} className="flex items-center gap-2.5 mb-3">
              <img src="/logo.png" alt="Scalor" className="h-8 object-contain" />
            </Link>
            {/* Workspace switcher */}
            {!isSuperAdmin && <WorkspaceSwitcher />}
          </div>

          {/* Main navigation */}
          <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
            {isSuperAdmin ? (
              <>
                <p className="px-2 pt-1 pb-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Administration</p>
                {filteredSuperAdmin.map(item => <NavLink key={item.name} item={item} />)}
              </>
            ) : (
              <>
                {filteredMain.map(item => <NavLink key={item.name} item={item} />)}
                {filteredSecondary.length > 0 && (
                  <>
                    <div className="my-2 border-t border-gray-100" />
                    <p className="px-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gestion</p>
                    {filteredSecondary.map(item => <NavLink key={item.name} item={item} />)}
                  </>
                )}
              </>
            )}
          </nav>

          {/* Bottom: settings + user */}
          <div className="border-t border-gray-100">
            {filteredBottom.map(item => (
              <div key={item.name} className="px-3 py-2">
                <NavLink item={item} />
              </div>
            ))}
            {/* User row */}
            <div className="px-3 pb-3">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <div className={`w-7 h-7 ${roleColors[displayUser?.role] || 'bg-gray-300'} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white text-xs font-bold">{initial}</span>
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-xs font-semibold text-gray-800 truncate">{displayUser?.name || displayUser?.email?.split('@')[0]}</p>
                  <p className="text-[10px] text-gray-400 truncate">{roleLabel[displayUser?.role] || displayUser?.role}</p>
                </div>
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-[220px]">
        {/* ── Mobile Header: Scalor style (hidden on chat) ── */}
        <header className={`lg:hidden fixed top-0 left-0 right-0 z-20 bg-white border-b border-gray-200 ${location.pathname.startsWith('/ecom/chat') ? 'hidden' : ''}`}>
          <div className="flex items-center justify-between h-14 px-4">
            {/* Logo left */}
            <Link to={dashboardPath} className="flex items-center gap-2">
              <img src="/logo.png" alt="Scalor" className="h-7 object-contain" />
            </Link>

            {/* Icons right */}
            <div className="flex items-center gap-1">
              {/* Search */}
              <GlobalSearch isSuperAdmin={isSuperAdmin} isMobile={true} />
              
              {/* Notifications */}
              <div ref={notifRef}>
                <button
                  onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
                  className="relative w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:bg-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  {unreadCount > 0 && <span className="absolute top-0 right-0 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-[#0F6B4F] text-white text-[10px] font-bold">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </button>
              </div>

              {/* Profile */}
              <Link to="/ecom/profile" className="w-9 h-9 flex items-center justify-center">
                {displayUser?.avatar ? (
                  <img src={displayUser.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className={`w-9 h-9 ${roleColors[displayUser?.role] || 'bg-[#0F6B4F]'} rounded-full flex items-center justify-center`}>
                    <span className="text-white text-sm font-bold">{initial}</span>
                  </div>
                )}
              </Link>
            </div>
          </div>
        </header>

        {/* ── Desktop Header ── Chariow-inspired: page title left, search center, actions right */}
        <header className="hidden lg:flex border-b h-14 items-center px-5 fixed top-0 left-[220px] right-0 z-20 bg-white border-gray-200 gap-4">
          {/* Left: page title */}
          <div className="flex items-center gap-2 min-w-[160px]">
            <h1 className="text-[15px] font-semibold text-gray-900 truncate">{getPageTitle(location.pathname)}</h1>
          </div>

          {/* Center: search bar */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-sm">
              <GlobalSearch isSuperAdmin={isSuperAdmin} />
            </div>
          </div>

          {/* Right: action icons + user */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <CurrencySelector compact={true} />

            {/* Chat */}
            <Link
              to="/ecom/chat"
              onClick={clearUnread}
              className={`relative p-2 rounded-lg transition-colors ${
                location.pathname.startsWith('/ecom/chat')
                  ? 'text-[#0F6B4F] bg-[#0F6B4F]/10'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title="Messages"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              {unreadDm > 0 && !location.pathname.startsWith('/ecom/chat') && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">{unreadDm > 99 ? '99+' : unreadDm}</span>
              )}
            </Link>

            {/* Notifications */}
            <div ref={notifRef}>
              <button
                onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
                className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {unreadCount > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
            </div>

            {/* User avatar + dropdown */}
            <div className="relative ml-1" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {displayUser?.avatar ? (
                  <img src={displayUser.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className={`w-7 h-7 ${roleColors[displayUser?.role] || 'bg-[#0F6B4F]'} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-xs font-bold">{initial}</span>
                  </div>
                )}
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 rounded-xl shadow-xl border overflow-hidden z-50 bg-white border-gray-200">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">{displayUser?.name || displayUser?.email?.split('@')[0]}</p>
                    <p className="text-xs text-gray-500">{displayUser?.email}</p>
                    {isSuperAdmin && <span className="inline-block text-[10px] font-bold text-[#0F6B4F] uppercase tracking-wider mt-1">Super Admin</span>}
                  </div>
                  {!isSuperAdmin && <WorkspaceSwitcherMenu isSuperAdmin={isSuperAdmin} onWorkspaceSwitch={() => setUserMenuOpen(false)} />}
                  <div className="py-1">
                    <Link to="/ecom/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      Mon profil
                    </Link>
                    <Link to="/ecom/settings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                      Paramètres
                    </Link>
                  </div>
                  <div className="border-t py-1 border-gray-100">
                      <button onClick={() => { setUserMenuOpen(false); handleLogout(); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Déconnexion
                      </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Push notification banner */}
        <PushNotificationBanner />

        {/* ── Toast notification in-app ── */}
        {toast && (
          <div
            className="fixed top-4 left-4 right-4 lg:left-auto lg:right-6 lg:w-96 z-[100] animate-[slideDown_0.3s_ease-out]"
            style={{ animation: 'slideDown 0.3s ease-out' }}
          >
            <button
              onClick={() => { setToast(null); setNotifOpen(true); }}
              className="w-full flex items-start gap-3 p-4 bg-white rounded-2xl shadow-2xl border border-gray-200 hover:shadow-xl transition-shadow"
            >
              <div className="flex-shrink-0 w-10 h-10 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-gray-900 truncate">{toast.title}</p>
                {toast.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{toast.body}</p>}
                <p className="text-[11px] text-emerald-600 font-medium mt-1">Voir les notifications →</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setToast(null); }}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </button>
          </div>
        )}

        {/* Page content - pb-safe-nav = pb-20 + home indicator sur iOS */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pt-14 pt-safe-header pb-safe-nav lg:pt-14 lg:pb-0">
          {children}
        </main>
      </div>

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Tutorial popup */}
      {showTutorial && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeTutorial} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#0F6B4F]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-white font-bold text-base leading-tight">Bienvenue sur Scalor !</h2>
                  <p className="text-white/70 text-xs">Regardez ce tutoriel pour maîtriser la plateforme</p>
                </div>
              </div>
              <button onClick={closeTutorial} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Video */}
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube.com/embed/405eKEysE0Q?autoplay=1"
                title="Tutoriel Scalor"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            {/* Footer */}
            <div className="px-6 py-4 flex items-center justify-between bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-500">Ce tutoriel ne s'affichera plus après fermeture</p>
              <button onClick={closeTutorial} className="px-4 py-2 bg-[#0F6B4F] text-white text-sm font-medium rounded-xl hover:bg-[#0a5040] transition-colors">
                C'est parti !
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Panel - unique instance */}
      <NotificationPanel
        isOpen={notifOpen}
        onClose={() => { setNotifOpen(false); refreshCount(); }}
        onMarkAllRead={refreshCount}
        onOpenModal={() => { setNotifOpen(false); setNotifModalOpen(true); }}
      />

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notifModalOpen}
        onClose={() => { setNotifModalOpen(false); refreshCount(); }}
        onMarkAllRead={refreshCount}
      />

      {/* ── Mobile Bottom Tab Bar - Scalor style (hidden on chat page) ── */}
      <nav className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 ${location.pathname.startsWith('/ecom/chat') ? 'hidden' : ''}`}>
        <div className="flex items-stretch px-2 bottom-nav-safe" style={{ height: '60px' }}>
          {mobileMainTabs.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMoreMenuOpen(false)}
                className="flex flex-col items-center justify-center flex-1 gap-1 transition-all duration-200 active:scale-95"
              >
                <span className={`transition-colors duration-200 ${active ? 'text-[#0F6B4F]' : 'text-gray-500'}`}>
                  {mobileIcon(item)}
                </span>
                <span className={`text-[10px] font-medium leading-none transition-colors duration-200 ${
                  active ? 'text-gray-900' : 'text-gray-500'
                }`}>{item.shortName}</span>
              </Link>
            );
          })}

          {showMoreTab && (
            <div className="relative flex-1">
              <button
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className="flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 active:scale-95"
              >
                <svg className={`w-5 h-5 transition-colors duration-200 ${moreMenuOpen ? 'text-[#0F6B4F]' : 'text-gray-500'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01" />
                  <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
                </svg>
                <span className={`text-[10px] font-medium leading-none transition-colors duration-200 ${
                  moreMenuOpen ? 'text-gray-900' : 'text-gray-500'
                }`}>Menu</span>
              </button>

              {/* iOS-style action sheet */}
              {moreMenuOpen && (
                <>
                  <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[45] ios-fade-in" onClick={() => setMoreMenuOpen(false)} />
                  <div className="fixed bottom-0 left-0 right-0 z-50 px-3 ios-slide-up" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}>
                    <div className="bg-white/95 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl mb-2 max-h-[70vh] flex flex-col">
                      <div className="px-5 pt-3 pb-2 flex-shrink-0">
                        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Plus d'options</p>
                          <button onClick={() => setMoreMenuOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                      <div className="overflow-y-auto flex-1">
                        <div className="divide-y divide-gray-100">
                          {mobileSecondaryTabs.map((item) => {
                            const active = isActive(item.href);
                            return (
                              <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setMoreMenuOpen(false)}
                                className={`flex items-center gap-4 px-5 py-4 text-[16px] font-medium active:bg-gray-100 transition-colors ${active ? 'text-scalor-green' : 'text-gray-900'
                                  }`}
                              >
                                <span className={`flex-shrink-0 ${active ? 'text-scalor-green' : 'text-gray-400'}`}>{mobileIconLg(item)}</span>
                                <span className="flex-1 truncate">{item.name}</span>
                                {active && <span className="w-2.5 h-2.5 bg-scalor-green rounded-full flex-shrink-0" />}
                              </Link>
                            );
                          })}
                        </div>
                        <div className="border-t border-gray-100">
                          <Link to="/ecom/profile" onClick={() => setMoreMenuOpen(false)} className="flex items-center gap-4 px-5 py-4 text-[16px] font-medium text-gray-900 active:bg-gray-100">
                            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            Mon profil
                          </Link>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => { setMoreMenuOpen(false); handleLogout(); }}
                      className="w-full bg-white/95 backdrop-blur-xl rounded-2xl py-4 text-[17px] font-semibold text-red-500 active:bg-gray-100 shadow-2xl transition-colors"
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
  if (pathname.includes('/boutique')) return 'Ma Boutique';
  if (pathname.includes('/profile')) return 'Mon profil';
  if (pathname.includes('/dashboard')) return 'Scalor';
  if (pathname.includes('/data')) return 'Data';
  if (pathname.includes('/store/products/new')) return 'Nouveau produit boutique';
  if (pathname.includes('/store/products') && pathname.includes('/edit')) return 'Modifier le produit boutique';
  if (pathname.includes('/store/products')) return 'Produits boutique';
  if (pathname.includes('/store/orders')) return 'Commandes boutique';
  if (pathname.includes('/store/setup')) return 'Configuration boutique';
  if (pathname.includes('/store')) return 'Boutique';
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
  if (pathname.includes('/suppliers')) return 'Fournisseurs';
  if (pathname.includes('/transactions/new')) return 'Nouvelle transaction';
  if (pathname.includes('/transactions') && pathname.includes('/edit')) return 'Modifier transaction';
  if (pathname.match(/\/transactions\/[a-f0-9]+$/)) return 'Détail transaction';
  if (pathname.includes('/transactions')) return 'Finances';
  if (pathname.includes('/decisions/new')) return 'Nouvelle décision';
  if (pathname.includes('/decisions')) return 'Décisions';
  if (pathname.includes('/import')) return 'Import Commandes';
  if (pathname.match(/\/orders\/[a-f0-9]{24}/)) return 'Détail commande';
  if (pathname.includes('/orders')) return 'Commandes';
  if (pathname.includes('/clients/new')) return 'Nouveau client';
  if (pathname.includes('/clients') && pathname.includes('/edit')) return 'Modifier client';
  if (pathname.includes('/clients')) return 'Clients';
  if (pathname.includes('/agent-ia')) return 'Agent IA';
  if (pathname.includes('/whatsapp/agent-config')) return 'Configurer Agent IA';
  if (pathname.includes('/whatsapp/service')) return 'Service WhatsApp';
  if (pathname.includes('/whatsapp/connexion')) return 'Service WhatsApp';
  if (pathname.includes('/rita-flows')) return 'Automation Flows';
  if (pathname.includes('/campaigns')) return 'Marketing';
  if (pathname.includes('/super-admin/users')) return 'Gestion des utilisateurs';
  if (pathname.includes('/super-admin/workspaces')) return 'Gestion des espaces';
  if (pathname.includes('/super-admin/activity')) return 'Activité';
  if (pathname.includes('/super-admin/settings')) return 'Paramètres';
  if (pathname.includes('/super-admin/whatsapp')) return 'Postulations WhatsApp';
  if (pathname.includes('/super-admin')) return 'Super Administration';
  if (pathname.includes('/users')) return 'Gestion Équipe';
  if (pathname.includes('/assignments')) return 'Affectations';
  if (pathname.includes('/commissions')) return 'Commissions';
  if (pathname.includes('/settings')) return 'Paramètres';
  if (pathname.includes('/chat')) return 'Chat Équipe';
  if (pathname.includes('/product-research')) return 'Recherche Produits';
  if (pathname.includes('/product-finder')) return 'Product Finder';
  if (pathname.includes('/stats')) return 'Statistiques';
  if (pathname.includes('/goals')) return 'Objectifs Hebdomadaires';
  if (pathname.includes('/marketing')) return 'Marketing';
  return 'Scalor';
};

// Mémoriser le layout pour éviter les re-renders inutiles
const EcomLayout = memo(EcomLayoutComponent);

export default EcomLayout;
