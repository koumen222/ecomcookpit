import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CurrencySelector from '../components/CurrencySelector.jsx';
import { useMoney } from '../hooks/useMoney.js';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';
import ecomApi, { settingsApi } from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';

const Settings = () => {
  const { fmt, currency, symbol } = useMoney();
  const { user, workspace, logout } = useEcomAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sources, setSources] = useState([]);
  const [newSource, setNewSource] = useState({ name: '', spreadsheetId: '', sheetName: 'Sheet1' });
  const [editingSource, setEditingSource] = useState(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [notifications, setNotifications] = useState({
    email_orders: true,
    email_stock: true,
    email_reports: false,
    push_new_orders: true,
    push_status_changes: true,
    push_deliveries: true,
    push_stock_updates: true,
    push_low_stock: true,
    push_sync_completed: true
  });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmWord, setDeleteConfirmWord] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchSources = async () => {
    try {
      setSourcesLoading(true);
      const res = await ecomApi.get('/orders/settings');
      if (res.data.success) {
        setSources(res.data.data.sources || []);
      }
    } catch (err) {
      console.error('Error fetching sources:', err);
    } finally {
      setSourcesLoading(false);
    }
  };

  const fetchPushPreferences = async () => {
    try {
      const res = await settingsApi.getPushNotificationPreferences();
      if (res.data.success) {
        setNotifications(prev => ({ ...prev, ...res.data.data }));
      }
    } catch (err) {
      console.error('Error fetching push preferences:', err);
    }
  };

  const checkPushPermission = () => {
    if (!('Notification' in window)) {
      return false;
    }
    return Notification.permission === 'granted';
  };

  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      alert('Les notifications push ne sont pas supportées par votre navigateur.');
      return;
    }

    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushEnabled(true);
        // Subscribe to push notifications
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          // Add push subscription logic here if needed
        }
      } else {
        setPushEnabled(false);
      }
    } catch (err) {
      console.error('Error requesting push permission:', err);
    } finally {
      setPushLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      // Sauvegarder toutes les préférences
      const pushPrefs = {
        push_new_orders: notifications.push_new_orders,
        push_status_changes: notifications.push_status_changes,
        push_deliveries: notifications.push_deliveries,
        push_stock_updates: notifications.push_stock_updates,
        push_low_stock: notifications.push_low_stock,
        push_sync_completed: notifications.push_sync_completed
      };
      
      await settingsApi.updatePushNotificationPreferences(pushPrefs);
      // Sauvegarder aussi les préférences email si nécessaire
      
      setHasChanges(false);
    } catch (err) {
      console.error('Error saving settings:', err);
      alert(getContextualError(err, 'update_settings'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelChanges = () => {
    // Recharger les préférences depuis le serveur
    fetchPushPreferences();
    setHasChanges(false);
  };

  const saveEmailPreferences = async (key, value) => {
    try {
      const updatedPrefs = { ...notifications, [key]: value };
      setNotifications(updatedPrefs);
      setHasChanges(true);
      // Sauvegarde immédiate pour les emails
    } catch (err) {
      console.error('Error saving email preferences:', err);
      setNotifications(prev => ({ ...prev, [key]: !value }));
    }
  };

  const savePushPreferences = async (key, value) => {
    try {
      const updatedPrefs = { ...notifications, [key]: value };
      setNotifications(updatedPrefs);
      setHasChanges(true);
      
      const pushPrefs = {
        push_new_orders: updatedPrefs.push_new_orders,
        push_status_changes: updatedPrefs.push_status_changes,
        push_deliveries: updatedPrefs.push_deliveries,
        push_stock_updates: updatedPrefs.push_stock_updates,
        push_low_stock: updatedPrefs.push_low_stock,
        push_sync_completed: updatedPrefs.push_sync_completed
      };
      
      await settingsApi.updatePushNotificationPreferences(pushPrefs);
      // Ne pas réinitialiser hasChanges ici, on attend le clic sur Enregistrer
    } catch (err) {
      console.error('Error saving push preferences:', err);
      // Revert on error
      setNotifications(prev => ({ ...prev, [key]: !value }));
    }
  };

  useEffect(() => {
    fetchPushPreferences();
    setPushEnabled(checkPushPermission());
  }, []);

  const handleAddSource = async () => {
    try {
      const res = await ecomApi.post('/orders/sources', newSource);
      if (res.data.success) {
        setSources([...sources, res.data.data]);
        setNewSource({ name: '', spreadsheetId: '', sheetName: 'Sheet1' });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur ajout source');
    }
  };

  const handleUpdateSource = async (id, data) => {
    try {
      const res = await ecomApi.put(`/orders/sources/${id}`, data);
      if (res.data.success) {
        setSources(sources.map(s => s._id === id ? res.data.data : s));
        setEditingSource(null);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur mise ù  jour');
    }
  };

  const handleDeleteSource = async (id) => {
    if (!window.confirm('Supprimer cette source ?')) return;
    try {
      await ecomApi.delete(`/orders/sources/${id}`);
      setSources(sources.filter(s => s._id !== id));
    } catch (err) {
      alert(getContextualError(err, 'delete_order'));
    }
  };

  useEffect(() => {
    if (activeTab === 'google_sheets') fetchSources();
  }, [activeTab]);

  const tabs = [
    { id: 'general', label: 'Général', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    { id: 'currency', label: 'Devise', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { id: 'notifications', label: 'Notifications', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> },
    { id: 'google_sheets', label: 'Google Sheets', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    { id: 'account', label: 'Compte', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
    { id: 'security', label: 'Sécurité', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
  ];

  const roleLabels = {
    'super_admin': 'Super Administrateur',
    'ecom_admin': 'Administrateur',
    'ecom_closeuse': 'Closeuse',
    'ecom_compta': 'Comptabilité',
    'ecom_livreur': 'Livreur'
  };

  const examples = [
    { label: 'Prix d\'un produit', amount: 15000 },
    { label: 'Coût de livraison', amount: 2500 },
    { label: 'Dépense publicitaire', amount: 50000 },
    { label: 'Chiffre d\'affaires', amount: 250000 },
    { label: 'Bénéfice net', amount: 45000 }
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Paramètres</h1>
              <p className="mt-1.5 text-sm text-gray-500">Gérez votre compte et les paramètres de votre espace de travail.</p>
            </div>
            {hasChanges && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-amber-600 font-medium mr-2">Modifications non sauvegardées</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

      <div className="flex flex-col gap-6">
        {/* Tabs - Modern Pills Style */}
        <nav className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap rounded-lg transition-all flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className={activeTab === tab.id ? 'text-white' : 'text-gray-400'}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="min-w-0">

          {/* === GÉNÉRAL === */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Profil */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">Profil</h2>
                  <p className="text-sm text-gray-500 mt-1">Informations de votre compte</p>
                </div>
                <div className="p-6">
                  <div className="flex items-start gap-5 mb-6">
                    <div className="w-18 h-18 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                      <span className="text-white text-3xl font-bold">{user?.email?.charAt(0).toUpperCase() || 'U'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-gray-900">{user?.name || user?.email?.split('@')[0]}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                          {roleLabels[user?.role] || user?.role}
                        </span>
                        <Link to="/ecom/profile" className="px-4 py-1.5 text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors">
                          Mon compte
                        </Link>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        </div>
                        <input type="text" value={user?.email || '—'} readOnly className="w-full pl-10 pr-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        </div>
                        <input type="text" value={user?.phone || 'Non renseigné'} readOnly className="w-full pl-10 pr-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Rôle</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                        <input type="text" value={roleLabels[user?.role] || user?.role} readOnly className="w-full pl-10 pr-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Membre depuis</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <input type="text" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} readOnly className="w-full pl-10 pr-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Espace de travail */}
              {workspace && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">Espace de travail</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Configuration de votre espace</p>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Nom</label>
                        <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">{workspace.name || '—'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Slug</label>
                        <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200 font-mono">{workspace.slug || '—'}</p>
                      </div>
                      {workspace.inviteCode && user?.role === 'ecom_admin' && (
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Code d'invitation</label>
                          <div className="flex items-center gap-2">
                            <p className="flex-1 text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200 font-mono tracking-widest">{workspace.inviteCode}</p>
                            <button
                              onClick={() => { navigator.clipboard.writeText(workspace.inviteCode); }}
                              className="px-3 py-2.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition text-sm font-medium"
                            >
                              Copier
                            </button>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Partagez ce code pour inviter des membres dans votre espace.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Plan & Abonnement */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-50 rounded-xl shadow-sm border border-emerald-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-emerald-200 bg-white/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Plan & Abonnement</h2>
                      <p className="text-sm text-gray-600 mt-1">Gérez votre abonnement et votre facturation</p>
                    </div>
                    <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wide">
                      Free
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-lg p-4 border border-emerald-200">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Utilisateurs</p>
                      <p className="text-2xl font-bold text-gray-900">5 / 10</p>
                      <p className="text-xs text-gray-500 mt-1">membres actifs</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-emerald-200">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Commandes</p>
                      <p className="text-2xl font-bold text-gray-900">∞</p>
                      <p className="text-xs text-gray-500 mt-1">illimitées</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-emerald-200">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Stockage</p>
                      <p className="text-2xl font-bold text-gray-900">2 GB</p>
                      <p className="text-xs text-gray-500 mt-1">sur 5 GB</p>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-5 border border-emerald-200">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-gray-900 mb-2">Passez à Pro pour débloquer plus de fonctionnalités</h3>
                        <ul className="space-y-2">
                          <li className="flex items-center gap-2 text-sm text-gray-600">
                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            Utilisateurs illimités
                          </li>
                          <li className="flex items-center gap-2 text-sm text-gray-600">
                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            Stockage illimité
                          </li>
                          <li className="flex items-center gap-2 text-sm text-gray-600">
                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            Support prioritaire
                          </li>
                          <li className="flex items-center gap-2 text-sm text-gray-600">
                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            Analytics avancées
                          </li>
                        </ul>
                      </div>
                      <button className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-lg hover:shadow-xl">
                        Upgrade vers Pro
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === DEVISE === */}
          {activeTab === 'currency' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">Devise préférée</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Tous les montants seront convertis et affichés dans cette devise.</p>
                </div>
                <div className="p-6">
                  <CurrencySelector />

                  <div className="mt-6 bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-700">Aperçu de conversion</h3>
                      <span className="text-xs font-medium px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full">{currency} {symbol}</span>
                    </div>
                    <div className="space-y-0 divide-y divide-gray-200">
                      {examples.map((ex, i) => (
                        <div key={i} className="flex justify-between items-center py-3">
                          <span className="text-sm text-gray-600">{ex.label}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 line-through">XAF {ex.amount.toLocaleString('fr-FR')}</span>
                            <span className="text-sm font-semibold text-gray-900">{fmt(ex.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 flex items-start gap-3">
                <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-emerald-900">Comment ça marche ?</h4>
                  <p className="text-sm text-emerald-700 mt-1">
                    Les taux de conversion sont basés sur le FCFA (XAF). Quand vous changez de devise,
                    tous les montants dans l'application sont automatiquement convertis.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* === NOTIFICATIONS === */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              {/* Activation Push Notifications */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-50 rounded-xl shadow-sm border border-emerald-200 overflow-hidden">
                <div className="px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        <h3 className="text-lg font-bold text-gray-900">Activer les notifications push</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">Recevez des notifications en temps réel sur votre appareil, même quand l'application est fermée.</p>
                      {pushEnabled ? (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          <span className="text-green-700 font-medium">Notifications push activées</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                          <span className="text-gray-600">Notifications push désactivées</span>
                        </div>
                      )}
                    </div>
                    {!pushEnabled && (
                      <button
                        onClick={requestPushPermission}
                        disabled={pushLoading}
                        className="px-5 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        {pushLoading ? 'Activation...' : 'Activer'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">Préférences de notification</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Choisissez comment et quand vous souhaitez être notifié.</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {/* Email notifications */}
                  <div className="p-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Notifications par email
                    </h3>
                    <div className="space-y-4">
                      {[
                        { key: 'email_orders', label: 'Nouvelles commandes', desc: 'Recevez un email à chaque nouvelle commande.' },,
                        { key: 'email_stock', label: 'Alertes de stock', desc: 'Soyez prévenu quand un produit atteint son seuil critique.' },
                        { key: 'email_reports', label: 'Rapports hebdomadaires', desc: 'Recevez un résumé de vos performances chaque semaine.' },
                      ].map(item => (
                        <div key={item.key} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.label}</p>
                            <p className="text-xs text-gray-500">{item.desc}</p>
                          </div>
                          <button
                            onClick={() => saveEmailPreferences(item.key, !notifications[item.key])}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              notifications[item.key] ? 'bg-emerald-600' : 'bg-gray-300'
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                              notifications[item.key] ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Push notifications */}
                  <div className="p-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      Notifications push (mobile)
                    </h3>
                    <div className="space-y-4">
                      {[
                        { key: 'push_new_orders', label: '🛒 Nouvelles commandes', desc: 'Notification instantanée pour chaque nouvelle commande créée.' },
                        { key: 'push_status_changes', label: '📋 Changements de statut', desc: 'Alertes quand le statut d\'une commande change (confirmée, expédiée, livrée, etc.).' },
                        { key: 'push_deliveries', label: '🚚 Assignations livreur', desc: 'Notification quand une commande est assignée à un livreur.' },
                        { key: 'push_stock_updates', label: '📦 Modifications de stock', desc: 'Alertes lors des changements de stock des produits.' },
                        { key: 'push_low_stock', label: '⚠️ Stock faible', desc: 'Alerte immédiate quand un produit atteint le seuil de stock minimum.' },
                        { key: 'push_sync_completed', label: '📊 Synchronisations terminées', desc: 'Notification quand une synchro Google Sheets ou un import se termine.' },
                      ].map(item => (
                        <div key={item.key} className="flex items-center justify-between">
                          <div className="flex-1 pr-4">
                            <p className="text-sm font-medium text-gray-700">{item.label}</p>
                            <p className="text-xs text-gray-500">{item.desc}</p>
                          </div>
                          <button
                            onClick={() => savePushPreferences(item.key, !notifications[item.key])}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                              notifications[item.key] ? 'bg-emerald-600' : 'bg-gray-300'
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                              notifications[item.key] ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === GOOGLE SHEETS === */}
          {activeTab === 'google_sheets' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Sources Google Sheets</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Gérez plusieurs feuilles de calcul pour vos commandes.</p>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Ajouter une source */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Ajouter une nouvelle source</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Nom (ex: Boutique A)"
                        value={newSource.name}
                        onChange={e => setNewSource({ ...newSource, name: e.target.value })}
                        className="px-3 py-2 border rounded-lg text-sm"
                      />
                      <input
                        type="text"
                        placeholder="ID ou URL Spreadsheet"
                        value={newSource.spreadsheetId}
                        onChange={e => setNewSource({ ...newSource, spreadsheetId: e.target.value })}
                        className="px-3 py-2 border rounded-lg text-sm sm:col-span-1"
                      />
                      <input
                        type="text"
                        placeholder="Nom de l'onglet (ex: Sheet1)"
                        value={newSource.sheetName}
                        onChange={e => setNewSource({ ...newSource, sheetName: e.target.value })}
                        className="px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                    <button
                      onClick={handleAddSource}
                      disabled={!newSource.name || !newSource.spreadsheetId}
                      className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Ajouter la source
                    </button>
                  </div>

                  {/* Liste des sources */}
                  <div className="space-y-3">
                    {sourcesLoading ? (
                      <div className="text-center py-4 text-gray-500 text-sm">Chargement des sources...</div>
                    ) : sources.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed text-gray-400 text-sm">
                        Aucune source configurée
                      </div>
                    ) : (
                      sources.map(source => (
                        <div key={source._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border rounded-lg hover:border-emerald-200 transition-colors gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${source.isActive ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                              <h4 className="font-semibold text-gray-900 truncate">{source.name}</h4>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 truncate">ID: {source.spreadsheetId}</p>
                            <p className="text-xs text-gray-400">Onglet: {source.sheetName} • Sync: {source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleString() : 'Jamais'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleUpdateSource(source._id, { isActive: !source.isActive })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${source.isActive ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-green-50 text-green-600 border-green-100'}`}
                            >
                              {source.isActive ? 'Désactiver' : 'Activer'}
                            </button>
                            <button
                              onClick={() => handleDeleteSource(source._id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === COMPTE === */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              {/* Sécurité */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">Sécurité</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Gérez la sécurité de votre compte.</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Mot de passe</p>
                      <p className="text-xs text-gray-500">Dernière modification : inconnue</p>
                    </div>
                    <button className="px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition">
                      Modifier
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Sessions actives</p>
                      <p className="text-xs text-gray-500">Gérez vos appareils connectés</p>
                    </div>
                    <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">1 active</span>
                  </div>
                </div>
              </div>

              {/* Déconnexion */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Déconnexion</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Vous serez redirigé vers la page de connexion.</p>
                    </div>
                    <button
                      onClick={logout}
                      className="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 transition border border-orange-200"
                    >
                      Se déconnecter
                    </button>
                  </div>
                </div>
              </div>

              {/* Zone de danger */}
              <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-red-100 bg-red-50">
                  <h2 className="text-base font-semibold text-red-900">Zone de danger</h2>
                  <p className="text-xs text-red-600 mt-0.5">Actions irréversibles sur votre compte.</p>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Supprimer toutes mes données</p>
                      <p className="text-xs text-gray-500">Toutes vos données seront définitivement supprimées.</p>
                    </div>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition border border-red-200"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal de confirmation de suppression */}
              {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmWord(''); setDeleteError(''); }}>
                  <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Supprimer toutes mes données</h3>
                      </div>
                      <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmWord(''); setDeleteError(''); }} className="text-gray-400 hover:text-gray-600 transition">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    
                    <div className="mb-5">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-red-800 font-medium mb-2">⚠️ Cette action est irréversible !</p>
                        <p className="text-xs text-red-700">Les données suivantes seront supprimées :</p>
                        <ul className="text-xs text-red-700 mt-2 space-y-1 ml-4">
                          <li>• Toutes vos commandes</li>
                          <li>• Toutes vos transactions</li>
                          <li>• Tous vos journaux d'audit</li>
                          <li>• Votre compte utilisateur</li>
                        </ul>
                      </div>
                      
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pour confirmer, tapez le mot : <span className="text-red-600 font-bold text-base">SUPPRIMER</span>
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmWord}
                        onChange={e => { setDeleteConfirmWord(e.target.value); setDeleteError(''); }}
                        placeholder="Tapez SUPPRIMER"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        disabled={isDeleting}
                      />
                      {deleteError && (
                        <p className="text-xs text-red-600 mt-2">{deleteError}</p>
                      )}
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmWord(''); setDeleteError(''); }}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium transition disabled:opacity-50"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={async () => {
                          if (deleteConfirmWord !== 'SUPPRIMER') {
                            setDeleteError('Vous devez taper exactement "SUPPRIMER" pour confirmer');
                            return;
                          }
                          
                          setIsDeleting(true);
                          setDeleteError('');
                          
                          try {
                            const res = await ecomApi.delete('/users/me/delete-all-data', {
                              data: { confirmEmail: user?.email }
                            });
                            
                            if (res.data.success) {
                              alert('Toutes vos données ont été supprimées. Vous allez être déconnecté.');
                              logout();
                            }
                          } catch (err) {
                            console.error('Erreur suppression:', err);
                            setDeleteError(getContextualError(err, 'delete_user'));
                            setIsDeleting(false);
                          }
                        }}
                        disabled={isDeleting || !deleteConfirmWord}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isDeleting ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Suppression...
                          </>
                        ) : (
                          'Supprimer définitivement'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === SÉCURITÉ === */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">Tableau de bord sécurité</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Consultez les journaux d'activité et les alertes de sécurité.</p>
                </div>
                <div className="p-6">
                  <Link
                    to="/ecom/security"
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Ouvrir le tableau de bord sécurité</p>
                        <p className="text-xs text-gray-500">Journaux d'accès, alertes et activité suspecte</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Link>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Barre d'actions sticky - apparait quand il y a des modifications */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Vous avez des modifications non sauvegardées</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancelChanges}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Enregistrer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Padding bottom pour compenser la barre sticky */}
      {hasChanges && <div className="h-20" />}
      </div>
    </div>
  );
};

export default Settings;
