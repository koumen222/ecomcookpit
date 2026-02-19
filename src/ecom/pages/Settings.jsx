import React, { useState, useEffect } from 'react';
import CurrencySelector from '../components/CurrencySelector.jsx';
import { useMoney } from '../hooks/useMoney.js';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';
import ecomApi, { settingsApi } from '../services/ecommApi.js';

const Settings = () => {
  const { fmt, currency, symbol } = useMoney();
  const { user, workspace, logout } = useEcomAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  const savePushPreferences = async (key, value) => {
    try {
      const updatedPrefs = { ...notifications, [key]: value };
      setNotifications(updatedPrefs);
      
      const pushPrefs = {
        push_new_orders: updatedPrefs.push_new_orders,
        push_status_changes: updatedPrefs.push_status_changes,
        push_deliveries: updatedPrefs.push_deliveries,
        push_stock_updates: updatedPrefs.push_stock_updates,
        push_low_stock: updatedPrefs.push_low_stock,
        push_sync_completed: updatedPrefs.push_sync_completed
      };
      
      await settingsApi.updatePushNotificationPreferences(pushPrefs);
    } catch (err) {
      console.error('Error saving push preferences:', err);
      // Revert on error
      setNotifications(prev => ({ ...prev, [key]: !value }));
    }
  };

  useEffect(() => {
    fetchPushPreferences();
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
      alert(err.response?.data?.message || 'Erreur mise à jour');
    }
  };

  const handleDeleteSource = async (id) => {
    if (!window.confirm('Supprimer cette source ?')) return;
    try {
      await ecomApi.delete(`/orders/sources/${id}`);
      setSources(sources.filter(s => s._id !== id));
    } catch (err) {
      alert('Erreur suppression');
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Paramètres</h1>
        <p className="mt-1 text-sm text-gray-500">Gérez votre compte, vos préférences et la configuration de votre espace.</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Tabs en haut */}
        <nav className="border-b border-gray-200">
          <div className="flex gap-1 overflow-x-auto pb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className={activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'}>{tab.icon}</span>
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
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">Profil</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Informations de votre compte</p>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-white text-2xl font-bold">{user?.email?.charAt(0).toUpperCase() || 'U'}</span>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{user?.name || user?.email?.split('@')[0]}</p>
                      <p className="text-sm text-gray-500">{user?.email}</p>
                      <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {roleLabels[user?.role] || user?.role}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email</label>
                      <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">{user?.email || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Téléphone</label>
                      <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">{user?.phone || 'Non renseigné'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Rôle</label>
                      <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">{roleLabels[user?.role] || user?.role}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Membre depuis</label>
                      <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
                        {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                      </p>
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
                              className="px-3 py-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
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
                      <span className="text-xs font-medium px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full">{currency} {symbol}</span>
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

              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-blue-900">Comment ça marche ?</h4>
                  <p className="text-sm text-blue-700 mt-1">
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
                        { key: 'email_orders', label: 'Nouvelles commandes', desc: 'Recevez un email à chaque nouvelle commande.' },
                        { key: 'email_stock', label: 'Alertes de stock', desc: 'Soyez prévenu quand un produit atteint son seuil critique.' },
                        { key: 'email_reports', label: 'Rapports hebdomadaires', desc: 'Recevez un résumé de vos performances chaque semaine.' },
                      ].map(item => (
                        <div key={item.key} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.label}</p>
                            <p className="text-xs text-gray-500">{item.desc}</p>
                          </div>
                          <button
                            onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              notifications[item.key] ? 'bg-blue-600' : 'bg-gray-300'
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
                              notifications[item.key] ? 'bg-blue-600' : 'bg-gray-300'
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
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
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
                        <div key={source._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border rounded-lg hover:border-blue-200 transition-colors gap-4">
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
                    <button className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition">
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
                      <p className="text-sm font-medium text-gray-900">Supprimer mon compte</p>
                      <p className="text-xs text-gray-500">Toutes vos données seront définitivement supprimées.</p>
                    </div>
                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition border border-red-200"
                      >
                        Supprimer
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                        >
                          Annuler
                        </button>
                        <button className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition">
                          Confirmer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Settings;
