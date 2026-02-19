import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const SL = { pending: 'En attente', confirmed: 'Confirmé', shipped: 'Expédié', delivered: 'Livré', returned: 'Retour', cancelled: 'Annulé', unreachable: 'Injoignable', called: 'Appelé', postponed: 'Reporté' };
const SC = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  shipped: 'bg-purple-100 text-purple-800 border-purple-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  returned: 'bg-orange-100 text-orange-800 border-orange-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  unreachable: 'bg-gray-100 text-gray-800 border-gray-300',
  called: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  postponed: 'bg-amber-100 text-amber-800 border-amber-200'
};
const SD = {
  pending: 'border-l-yellow-400', confirmed: 'border-l-blue-400', shipped: 'border-l-purple-400',
  delivered: 'border-l-green-400', returned: 'border-l-orange-400', cancelled: 'border-l-red-400',
  unreachable: 'border-l-gray-400', called: 'border-l-cyan-400', postponed: 'border-l-amber-400'
};
const getStatusLabel = (s) => SL[s] || s;
const getStatusColor = (s) => SC[s] || 'bg-indigo-100 text-indigo-800 border-indigo-200';
const getStatusDot = (s) => SD[s] || 'border-l-indigo-400';



// Liste des pays avec leurs codes et noms
const COUNTRIES = [
  { code: 'CM', name: 'Cameroun', flag: '🇨🇲', dialCode: '+237' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dialCode: '+33' },
  { code: 'CI', name: 'Côte d\'Ivoire', flag: '🇨🇮', dialCode: '+225' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳', dialCode: '+221' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱', dialCode: '+223' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫', dialCode: '+226' },
  { code: 'NE', name: 'Niger', flag: '🇳🇪', dialCode: '+227' },
  { code: 'TG', name: 'Togo', flag: '🇹🇬', dialCode: '+228' },
  { code: 'BJ', name: 'Bénin', flag: '🇧🇯', dialCode: '+229' },
  { code: 'GA', name: 'Gabon', flag: '🇬🇦', dialCode: '+241' },
  { code: 'CD', name: 'Congo RDC', flag: '🇨🇩', dialCode: '+243' },
  { code: 'CG', name: 'Congo Brazzaville', flag: '🇨🇬', dialCode: '+242' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', dialCode: '+1' },
  { code: 'US', name: 'États-Unis', flag: '🇺🇸', dialCode: '+1' },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧', dialCode: '+44' },
  { code: 'BE', name: 'Belgique', flag: '🇧🇪', dialCode: '+32' },
  { code: 'CH', name: 'Suisse', flag: '🇨🇭', dialCode: '+41' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺', dialCode: '+352' },
  { code: 'MA', name: 'Maroc', flag: '🇲🇦', dialCode: '+212' },
  { code: 'TN', name: 'Tunisie', flag: '🇹🇳', dialCode: '+216' },
  { code: 'DZ', name: 'Algérie', flag: '🇩🇿', dialCode: '+213' },
  { code: 'EG', name: 'Égypte', flag: '🇪🇬', dialCode: '+20' },
  { code: 'OTHER', name: 'Autre', flag: '🌍', dialCode: '+' }
];

const OrdersList = () => {
  const navigate = useNavigate();
  const { user } = useEcomAuth();
  const { fmt } = useMoney();
  const isAdmin = user?.role === 'ecom_admin';
  const isSuperAdmin = user?.role === 'super_admin';

    const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncClients, setSyncClients] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncDisabled, setSyncDisabled] = useState(false);
  const [syncController, setSyncController] = useState(null);
  const [backfilling, setBackfilling] = useState(false);
  const [showSyncClientsModal, setShowSyncClientsModal] = useState(false);
  const [syncClientsStatuses, setSyncClientsStatuses] = useState(['delivered', 'confirmed', 'pending', 'shipped']);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({ spreadsheetId: '', sheetName: 'Sheet1' });
  const [configLoading, setConfigLoading] = useState(false);
  const [sources, setSources] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [sourcesConfig, setSourcesConfig] = useState({});
  const [lastSyncs, setLastSyncs] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [viewMode, setViewMode] = useState('table');
  const [showSourceSelector, setShowSourceSelector] = useState(true);
  const [showWhatsAppConfig, setShowWhatsAppConfig] = useState(false);
  const [customWhatsAppNumber, setCustomWhatsAppNumber] = useState('');
  const [savingWhatsAppConfig, setSavingWhatsAppConfig] = useState(false);
  const [whatsappNumbers, setWhatsappNumbers] = useState([]);
  const [showWhatsAppMultiConfig, setShowWhatsAppMultiConfig] = useState(false);
  const [editingWhatsAppNumber, setEditingWhatsAppNumber] = useState(null);
  const [whatsappForm, setWhatsappForm] = useState({
    country: '',
    countryName: '',
    phoneNumber: '',
    isActive: true,
    autoNotifyOrders: true
  });
  const [savingWhatsAppNumber, setSavingWhatsAppNumber] = useState(false);
  const [deletingSource, setDeletingSource] = useState(null);
  const [showAddSheetModal, setShowAddSheetModal] = useState(false);
  const [newSheetData, setNewSheetData] = useState({ name: '', spreadsheetId: '', sheetName: 'Sheet1' });
  const [savingSheet, setSavingSheet] = useState(false);
  const [showGuide, setShowGuide] = useState(() => !localStorage.getItem('ecom_guide_dismissed'));
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderForm, setOrderForm] = useState({ clientName: '', clientPhone: '', city: '', address: '', product: '', quantity: 1, price: 0, status: 'pending', notes: '' });
  const [savingOrder, setSavingOrder] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [viewAllWorkspaces, setViewAllWorkspaces] = useState(false);

  // Fonction pour générer les champs à afficher selon les colonnes détectées
  const getDisplayFields = (sourceId) => {
    const config = sourcesConfig[sourceId];
    if (!config || !config.detectedColumns) {
      // Configuration par défaut si aucune détection
      return [
        { key: 'clientPhone', label: 'Téléphone', icon: 'phone', getValue: getClientPhone, priority: 1 },
        { key: 'city', label: 'Ville', icon: 'location', getValue: getCity, priority: 2 },
        { key: 'address', label: 'Adresse', icon: 'home', getValue: getAddress, priority: 3 },
        { key: 'product', label: 'Produit', icon: 'package', getValue: getProductName, priority: 4 },
        { key: 'notes', label: 'Notes', icon: 'note', getValue: getNotes, priority: 5 }
      ];
    }

    const columns = config.detectedColumns;
    const fields = [];

    // Ordre de priorité des champs
    const fieldPriority = {
      clientPhone: 1,
      city: 2,
      address: 3,
      product: 4,
      notes: 5,
      orderId: 6,
      date: 7,
      price: 8,
      quantity: 9
    };

    // Mapper les colonnes détectées vers les champs d'affichage
    Object.entries(columns).forEach(([field, columnIndex]) => {
      const fieldConfig = {
        clientPhone: { label: 'Téléphone', icon: 'phone', getValue: getClientPhone },
        city: { label: 'Ville', icon: 'location', getValue: getCity },
        address: { label: 'Adresse', icon: 'home', getValue: getAddress },
        product: { label: 'Produit', icon: 'package', getValue: getProductName },
        notes: { label: 'Notes', icon: 'note', getValue: getNotes },
        orderId: { label: 'N°', icon: 'hashtag', getValue: getOrderId },
        date: { label: 'Date', icon: 'calendar', getValue: getDate },
        price: { label: 'Prix', icon: 'money', getValue: getPrice },
        quantity: { label: 'Qté', icon: 'number', getValue: getQuantity }
      }[field];

      if (fieldConfig) {
        fields.push({
          key: field,
          label: fieldConfig.label,
          icon: fieldConfig.icon,
          getValue: fieldConfig.getValue,
          priority: fieldPriority[field] || 999,
          columnIndex
        });
      }
    });

    // Trier par priorité
    return fields.sort((a, b) => a.priority - b.priority);
  };

  const getOrderId = (o) => o.orderId || '';
  const getDate = (o) => fmtDate(o.date);
  const getPrice = (o) => o.price != null ? `${o.price}` : '';
  const getQuantity = (o) => o.quantity != null ? `${o.quantity}` : '';

  // Fonctions de formatage
  const fmtDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  const fmtTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const fetchOrders = async () => {
    try {
      const params = { page, limit: itemsPerPage };
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      if (filterCity) params.city = filterCity;
      if (filterProduct) params.product = filterProduct;
      if (filterTag) params.tag = filterTag;
      if (filterStartDate) params.startDate = filterStartDate;
      if (filterEndDate) params.endDate = filterEndDate;
      if (selectedSourceId) params.sourceId = selectedSourceId;
      // Si super admin et mode tous les espaces activé
      if (isSuperAdmin && viewAllWorkspaces) params.allWorkspaces = 'true';
      const res = await ecomApi.get('/orders', { params });
      setOrders(res.data.data.orders);
      setStats(res.data.data.stats);
      setPagination(res.data.data.pagination || {});
    } catch (err) { 
      console.error('❌ Erreur fetchOrders:', err);
      setError(err.response?.data?.message || err.message || 'Erreur chargement commandes'); 
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await ecomApi.get('/orders/settings');
      if (res.data.success) {
        let allSources = res.data.data.sources || [];
        
        // Ajouter la source "Legacy/Principal" si elle est configurée
        if (res.data.data.googleSheets?.spreadsheetId) {
          allSources = [
            {
              _id: 'legacy',
              name: 'Commandes Zendo',
              sheetName: res.data.data.googleSheets.sheetName || 'Sheet1',
              isActive: true,
              lastSyncAt: res.data.data.googleSheets.lastSyncAt,
              detectedHeaders: res.data.data.googleSheets.detectedHeaders || [],
              detectedColumns: res.data.data.googleSheets.detectedColumns || {}
            },
            ...allSources
          ];
        }

        // Créer un objet de configuration des sources avec leurs colonnes détectées
        const configMap = {};
        allSources.forEach(source => {
          configMap[source._id] = {
            detectedHeaders: source.detectedHeaders || [],
            detectedColumns: source.detectedColumns || {},
            name: source.name
          };
        });
        
        setSourcesConfig(configMap);
        
        setSources(allSources);
        
        const syncs = {};
        allSources.forEach(s => {
          if (s.lastSyncAt) syncs[s._id] = s.lastSyncAt;
        });
        setLastSyncs(syncs);
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  const fetchWhatsAppConfig = async () => {
    try {
      const res = await ecomApi.get('/orders/config/whatsapp');
      setCustomWhatsAppNumber(res.data.data.customWhatsAppNumber || '');
      setWhatsappNumbers(res.data.data.whatsappNumbers || []);
    } catch (err) {
      console.error('Erreur récupération config WhatsApp:', err);
    }
  };

  const fetchWhatsAppNumbers = async () => {
    try {
      const res = await ecomApi.get('/orders/whatsapp-numbers');
      setWhatsappNumbers(res.data.data || []);
    } catch (err) {
      console.error('Erreur récupération numéros WhatsApp:', err);
    }
  };

  const saveWhatsAppNumber = async () => {
    setSavingWhatsAppNumber(true);
    setError('');
    try {
      if (editingWhatsAppNumber) {
        // Mise à jour
        const res = await ecomApi.put(`/orders/whatsapp-numbers/${editingWhatsAppNumber._id}`, whatsappForm);
        setSuccess(res.data.message);
      } else {
        // Ajout
        const res = await ecomApi.post('/orders/whatsapp-numbers', whatsappForm);
        setSuccess(res.data.message);
      }
      
      await fetchWhatsAppNumbers();
      setShowWhatsAppMultiConfig(false);
      setEditingWhatsAppNumber(null);
      setWhatsappForm({
        country: '',
        countryName: '',
        phoneNumber: '',
        isActive: true,
        autoNotifyOrders: true
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSavingWhatsAppNumber(false);
    }
  };

  const editWhatsAppNumber = (number) => {
    setEditingWhatsAppNumber(number);
    setWhatsappForm({
      country: number.country,
      countryName: number.countryName,
      phoneNumber: number.phoneNumber,
      isActive: number.isActive,
      autoNotifyOrders: number.autoNotifyOrders
    });
    setShowWhatsAppMultiConfig(true);
  };

  const deleteWhatsAppNumber = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce numéro WhatsApp ?')) {
      return;
    }
    
    try {
      const res = await ecomApi.delete(`/orders/whatsapp-numbers/${id}`);
      setSuccess(res.data.message);
      await fetchWhatsAppNumbers();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const testWhatsAppNumber = async (country) => {
    try {
      const res = await ecomApi.post('/orders/test-whatsapp', { country });
      setSuccess(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors du test');
    }
  };

  const saveWhatsAppConfig = async () => {
    setSavingWhatsAppConfig(true);
    setError('');
    try {
      const res = await ecomApi.post('/orders/config/whatsapp', {
        customWhatsAppNumber: customWhatsAppNumber
      });
      
      if (res.data.success) {
        setSuccess(res.data.message + ' - Synchronisation du Google Sheets recommandée');
        setShowWhatsAppConfig(false);
        // Ne pas vider le champ pour garder la valeur affichée
        await fetchWhatsAppConfig(); // Rafraîchir la configuration
        
        // Proposer de synchroniser immédiatement
        setTimeout(() => {
          if (window.confirm('Voulez-vous synchroniser le Google Sheets maintenant pour tester l\'envoi WhatsApp ?')) {
            handleSync();
          }
        }, 1000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la configuration');
    } finally {
      setSavingWhatsAppConfig(false);
    }
  };

  const deleteSource = async (sourceId) => {
    let confirmMessage = 'Êtes-vous sûr de vouloir supprimer cette source ? Cette action est irréversible.';
    
    if (sourceId === 'legacy') {
      confirmMessage = '⚠️ ATTENTION ! Vous êtes sur le point de supprimer le Google Sheet par défaut. Seul l\'ID du sheet sera supprimé. Les autres configurations (API key, mapping colonnes, etc.) seront conservées. Cette action est irréversible. Voulez-vous continuer ?';
    }
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    setDeletingSource(sourceId);
    setError('');
    try {
      const endpoint = sourceId === 'legacy' ? '/orders/sources/legacy/confirm' : `/orders/sources/${sourceId}`;
      const res = await ecomApi.delete(endpoint);
      
      if (res.data.success) {
        setSuccess(res.data.message);
        await fetchConfig();
        
        if (selectedSourceId === sourceId) {
          setSelectedSourceId('');
        }
        
        // Rafraîchir la liste des commandes pour retirer celles de la source supprimée
        await fetchOrders();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setDeletingSource(null);
    }
  };

  const handleAddSheet = async () => {
    if (!newSheetData.name || !newSheetData.spreadsheetId) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setSavingSheet(true);
    setError('');
    try {
      const res = await ecomApi.post('/orders/sources', {
        name: newSheetData.name,
        spreadsheetId: newSheetData.spreadsheetId,
        sheetName: newSheetData.sheetName || 'Sheet1'
      });
      
      if (res.data.success) {
        const newSourceId = res.data.data.source?._id || res.data.data.sourceId;
        
        setSuccess('Source ajoutée avec succès ! Lancement de la première synchronisation...');
        setShowAddSheetModal(false);
        setNewSheetData({ name: '', spreadsheetId: '', sheetName: 'Sheet1' });
        await fetchConfig();
        
        // Lancer automatiquement la première synchronisation pour la nouvelle source
        if (newSourceId) {
          setTimeout(() => {
            handleSync(newSourceId);
          }, 1000);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'ajout de la source');
    } finally {
      setSavingSheet(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (isAdmin) {
        await fetchConfig();
        await fetchWhatsAppConfig();
      }
      // On n'appelle fetchOrders que si on n'est pas en mode sélection de source
      // ou si on veut charger les stats globales
      await fetchOrders();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => { if (!loading) fetchOrders(); }, [search, filterStatus, filterCity, filterProduct, filterTag, filterStartDate, filterEndDate, selectedSourceId, page, viewAllWorkspaces, itemsPerPage]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 10000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 5000); return () => clearTimeout(t); } }, [error]);

  // ─── Silent background polling (10s) — no loader, no messages ───────────
  const lastPollRef = useRef(new Date().toISOString());
  const pollingRef = useRef(false);

  const silentPoll = useCallback(async () => {
    if (pollingRef.current || loading) return;
    pollingRef.current = true;
    try {
      const params = { since: lastPollRef.current };
      if (selectedSourceId) params.sourceId = selectedSourceId;
      const res = await ecomApi.get('/orders/new-since', { params });
      const { orders: newOrders, count, serverTime } = res.data?.data || {};
      if (serverTime) lastPollRef.current = serverTime;
      if (count > 0 && Array.isArray(newOrders)) {
        console.log(`🔄 [Frontend Poll] ${count} nouvelle(s) commande(s) détectée(s)`);
        setOrders(prev => {
          const map = new Map(prev.map(o => [o._id, o]));
          let changed = false;
          let newCount = 0;
          let updatedCount = 0;
          for (const o of newOrders) {
            if (!map.has(o._id)) {
              changed = true;
              newCount++;
            } else {
              const existing = prev.find(p => p._id === o._id);
              if (existing && JSON.stringify(existing) !== JSON.stringify(o)) {
                changed = true;
                updatedCount++;
              }
            }
            map.set(o._id, o);
          }
          if (changed) {
            console.log(`📈 [Frontend Poll] ${newCount} nouvelles, ${updatedCount} mises à jour`);
          }
          if (!changed) return prev;
          return Array.from(map.values()).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        });
      }
    } catch (err) { 
      console.error('❌ [Frontend Poll] Erreur polling:', err.message);
      /* silent — never show errors from polling */ 
    }
    pollingRef.current = false;
  }, [loading, selectedSourceId]);

  useEffect(() => {
    if (loading) return;
    const id = setInterval(silentPoll, 10000);
    return () => clearInterval(id);
  }, [silentPoll, loading]);

  const handleSync = async (sourceId = null) => {
    // Protection contre les appels multiples
    if (syncDisabled) {
      console.log('⏸️ Sync déjà en cours, ignorée');
      return;
    }

    setSyncDisabled(true);
    setError('');
    setSuccess('🔄 Synchronisation en cours...');
    
    const controller = new AbortController();
    setSyncController(controller);
    
    try {
      const targetSourceId = sourceId || selectedSourceId;
      
      if (!targetSourceId) {
        setError('Veuillez sélectionner une source à synchroniser');
        return;
      }

      console.log(`🔄 Sync manuelle pour source: ${targetSourceId}`);
      
      const res = await ecomApi.post('/orders/sync-sheets', { sourceId: targetSourceId }, { 
        timeout: 120000,
        signal: controller.signal
      });
      
      console.log('✅ Sync Google Sheets terminée');
      
      // Récupérer les nouvelles commandes
      const newOrdersRes = await ecomApi.get('/orders', { 
        params: { 
          sourceId: targetSourceId, 
          page: 1, 
          limit: 100,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        } 
      });
      
      // Merge nouvelles commandes avec existantes (éviter les doublons)
      const newOrders = newOrdersRes.data.data.orders || [];
      const existingOrderIds = new Set(orders.map(o => o._id));
      const uniqueNewOrders = newOrders.filter(o => !existingOrderIds.has(o._id));
      
      if (uniqueNewOrders.length > 0) {
        setOrders(prev => [...uniqueNewOrders, ...prev]);
        setStats(prev => ({
          ...prev,
          total: (prev.total || 0) + uniqueNewOrders.length
        }));
        setSuccess(`✅ ${uniqueNewOrders.length} nouvelle${uniqueNewOrders.length > 1 ? 's' : ''} commande${uniqueNewOrders.length > 1 ? 's' : ''} ajoutée${uniqueNewOrders.length > 1 ? 's' : ''}`);
      } else {
        setSuccess('✅ Synchronisation terminée, aucune nouvelle commande');
      }
      
      // Sync clients auto après sync sheets
      ecomApi.post('/orders/sync-clients', { 
        statuses: ['delivered', 'confirmed', 'pending', 'shipped', 'returned'] 
      }, { timeout: 120000 }).catch(err => {
        console.warn('⚠️ Erreur sync clients auto:', err.message);
      });
      
      fetchConfig();
      
    } catch (err) { 
      if (err.name === 'AbortError') {
        setSuccess('');
      } else {
        setError(err.response?.data?.message || 'Erreur synchronisation');
      }
    } finally { 
      setSyncController(null);
      setSyncDisabled(false);
    }
  };
  
  const handleCancelSync = () => {
    if (syncController) {
      syncController.abort();
      setSyncController(null);
    }
    setSyncDisabled(false);
  };

  const handleBackfillClients = async () => {
    setBackfilling(true); setError('');
    try {
      const res = await ecomApi.post('/orders/backfill-clients', {}, { timeout: 120000 });
      setSuccess(res.data.message);
    } catch (err) { setError(err.response?.data?.message || 'Erreur backfill clients'); }
    finally { setBackfilling(false); }
  };

  const handleSaveConfig = async () => {
    setConfigLoading(true);
    try {
      await ecomApi.put('/orders/settings', config);
      setSuccess('Configuration sauvegardée');
      setShowConfig(false);
    } catch (err) { setError(err.response?.data?.message || 'Erreur sauvegarde'); }
    finally { setConfigLoading(false); }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      // Find the order before updating to get its price
      const order = orders.find(o => o._id === orderId);
      const oldStatus = order?.status;
      const orderRevenue = (order?.price || 0) * (order?.quantity || 1);
      
      await ecomApi.put(`/orders/${orderId}`, { status: newStatus });
      
      // Update local state instantly for immediate UI feedback
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: newStatus } : o));
      
      // Update stats when status changes
      setStats(prev => {
        const newStats = { ...prev };
        
        // Decrease old status count
        if (oldStatus && prev[oldStatus] > 0) {
          newStats[oldStatus] = prev[oldStatus] - 1;
        }
        
        // Increase new status count
        newStats[newStatus] = (prev[newStatus] || 0) + 1;
        
        // Adjust totalRevenue based on delivered status transitions
        if (newStatus === 'delivered' && oldStatus !== 'delivered') {
          newStats.totalRevenue = (prev.totalRevenue || 0) + orderRevenue;
        } else if (oldStatus === 'delivered' && newStatus !== 'delivered') {
          newStats.totalRevenue = (prev.totalRevenue || 0) - orderRevenue;
        }
        
        return newStats;
      });
      
      // Refetch from server after short delay to ensure stats are accurate
      setTimeout(() => fetchOrders(), 500);
    } catch (err) { 
      console.error('❌ Erreur modification statut:', err);
      setError(err.response?.data?.message || err.message || 'Erreur modification'); 
    }
  };

  const handleSyncClients = async () => {
    if (syncClientsStatuses.length === 0) {
      setError('Veuillez sélectionner au moins un statut');
      return;
    }
    
    try {
      setSyncProgress({ type: 'start', message: 'Démarrage de la synchronisation...', percentage: 0 });
      
      const res = await ecomApi.post('/orders/sync-clients', { statuses: syncClientsStatuses }, { timeout: 120000 });
      const { created, updated, total, statusGroups } = res.data.data;
      
      setSyncProgress({ 
        type: 'complete', 
        message: 'Synchronisation terminée avec succès !',
        percentage: 100,
        created,
        updated,
        total
      });
      
      let message = `✅ Synchronisation terminée !\n\n`;
      message += `📊 ${total} clients traités (${created} créés, ${updated} mis à jour)\n\n`;
      message += `📈 Répartition par statut :\n`;
      
      Object.entries(statusGroups).forEach(([status, count]) => {
        const statusLabels = {
          prospect: 'Prospects',
          confirmed: 'Confirmés', 
          delivered: 'Clients',
          returned: 'Retours'
        };
        message += `• ${statusLabels[status] || status}: ${count}\n`;
      });
      
      alert(message);
      setSyncProgress(null);
      setShowSyncClientsModal(false);
      
    } catch (error) {
      setError('Erreur lors de la synchronisation des clients');
      setSyncProgress(null);
    }
  };

  const openCreateOrder = () => {
    setEditingOrder(null);
    setOrderForm({ clientName: '', clientPhone: '', city: '', address: '', product: '', quantity: 1, price: 0, status: 'pending', notes: '' });
    setShowOrderModal(true);
  };

  const openEditOrder = (order) => {
    setEditingOrder(order);
    setOrderForm({
      clientName: order.clientName || '',
      clientPhone: order.clientPhone || '',
      city: order.city || '',
      address: order.address || order.deliveryLocation || '',
      product: order.product || '',
      quantity: order.quantity || 1,
      price: order.price || 0,
      status: order.status || 'pending',
      notes: order.notes || ''
    });
    setShowOrderModal(true);
  };

  const handleSaveOrder = async () => {
    if (!orderForm.clientName && !orderForm.clientPhone) {
      setError('Nom client ou telephone requis');
      return;
    }
    setSavingOrder(true);
    setError('');
    try {
      if (editingOrder) {
        await ecomApi.put(`/orders/${editingOrder._id}`, orderForm);
        setSuccess('Commande modifiee');
      } else {
        await ecomApi.post('/orders', orderForm);
        setSuccess('Commande creee');
      }
      setShowOrderModal(false);
      fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur sauvegarde');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Supprimer cette commande ?')) return;
    setDeletingOrderId(orderId);
    try {
      await ecomApi.delete(`/orders/${orderId}`);
      setSuccess('Commande supprimee');
      fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur suppression');
    } finally {
      setDeletingOrderId(null);
    }
  };

  // 📝 Fonction pour copier les infos de la commande dans le presse-papier
  const handleCopyOrder = (order) => {
    const clientName = getClientName(order);
    const clientPhone = getClientPhone(order);
    const city = getCity(order);
    const address = getAddress(order);
    const product = getProductName(order);
    const quantity = order.quantity || 1;
    const price = order.price || 0;
    const total = price * quantity;
    const status = getStatusLabel(order.status);
    const notes = getNotes(order);
    const orderId = order.orderId || order._id;

    const textToCopy = `📦 COMMANDE #${orderId}
👤 Client: ${clientName}
📞 Téléphone: ${clientPhone}
📍 Ville: ${city}
🏠 Adresse: ${address}
🛒 Produit: ${product}
🔢 Quantité: ${quantity}
💰 Prix unitaire: ${fmt(price)}
💵 Total: ${fmt(total)}
📊 Statut: ${status}
📝 Notes: ${notes || 'Aucune'}
`;

    navigator.clipboard.writeText(textToCopy).then(() => {
      setSuccess('✅ Commande copiée dans le presse-papier !');
    }).catch((err) => {
      console.error('Erreur copie:', err);
      setError('❌ Impossible de copier dans le presse-papier');
    });
  };

  const handleDeleteAll = async () => {
    const label = selectedSourceId ? sources.find(s => s._id === selectedSourceId)?.name || 'cette source' : 'TOUTES les sources';
    if (!window.confirm(`Supprimer TOUTES les commandes de ${label} ? Cette action est irreversible.`)) return;
    setDeletingAll(true);
    try {
      const params = selectedSourceId ? `?sourceId=${selectedSourceId}` : '';
      const res = await ecomApi.delete(`/orders/bulk${params}`);
      setSuccess(res.data.message);
      fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur suppression');
    } finally {
      setDeletingAll(false);
    }
  };

  
  const getProductName = (o) => {
    if (o.product && typeof o.product === 'string' && o.product.trim()) {
      return o.product.trim();
    }
    if (o.rawData && typeof o.rawData === 'object') {
      const entry = Object.entries(o.rawData).find(([k, v]) => {
        if (typeof v !== 'string' || !v.trim()) return false;
        return /produit|product|article|item|d[eé]signation|libell[eé]/i.test(k);
      });
      if (entry && entry[1]) return entry[1].trim();
    }
    return o.product || 'Non spécifié';
  };

  const getClientName = (o) => {
    if (o.clientName && typeof o.clientName === 'string' && o.clientName.trim()) {
      return o.clientName.trim();
    }
    if (o.rawData && typeof o.rawData === 'object') {
      const entry = Object.entries(o.rawData).find(([k, v]) => {
        if (typeof v !== 'string' || !v.trim()) return false;
        return /client|customer|nom|name|pr[eé]nom/i.test(k);
      });
      if (entry && entry[1]) return entry[1].trim();
    }
    return 'Client inconnu';
  };

  const getClientPhone = (o) => {
    if (o.clientPhone && typeof o.clientPhone === 'string' && o.clientPhone.trim()) {
      return o.clientPhone.trim();
    }
    if (o.rawData && typeof o.rawData === 'object') {
      const entry = Object.entries(o.rawData).find(([k, v]) => {
        if (typeof v !== 'string' || !v.trim()) return false;
        return /t[eé]l[eé]phone|phone|contact|mobile/i.test(k);
      });
      if (entry && entry[1]) return entry[1].trim();
    }
    return '';
  };

  const getCity = (o) => {
    if (o.city && typeof o.city === 'string' && o.city.trim()) {
      return o.city.trim();
    }
    if (o.rawData && typeof o.rawData === 'object') {
      const entry = Object.entries(o.rawData).find(([k, v]) => {
        if (typeof v !== 'string' || !v.trim()) return false;
        return /ville|city|localit[eé]/i.test(k);
      });
      if (entry && entry[1]) return entry[1].trim();
    }
    // Fallback: use address if it looks like a city (single word / no street indicators)
    if (o.address && typeof o.address === 'string' && o.address.trim()) {
      return o.address.trim();
    }
    return '';
  };

  const getAddress = (o) => {
    const city = o.city && typeof o.city === 'string' ? o.city.trim() : '';
    if (o.address && typeof o.address === 'string' && o.address.trim()) {
      const addr = o.address.trim();
      // Don't return address if it's the same as city (avoid duplicate display)
      if (addr.toLowerCase() === city.toLowerCase()) return '';
      return addr;
    }
    if (o.deliveryLocation && typeof o.deliveryLocation === 'string' && o.deliveryLocation.trim()) {
      return o.deliveryLocation.trim();
    }
    if (o.rawData && typeof o.rawData === 'object') {
      const entry = Object.entries(o.rawData).find(([k, v]) => {
        if (typeof v !== 'string' || !v.trim()) return false;
        return /adresse|address|rue|street|location/i.test(k);
      });
      if (entry && entry[1]) {
        const val = entry[1].trim();
        if (val.toLowerCase() === city.toLowerCase()) return '';
        return val;
      }
    }
    return '';
  };

  const getNotes = (o) => {
    if (o.notes && typeof o.notes === 'string' && o.notes.trim()) {
      return o.notes.trim();
    }
    if (o.rawData && typeof o.rawData === 'object') {
      const entry = Object.entries(o.rawData).find(([k, v]) => {
        if (typeof v !== 'string' || !v.trim()) return false;
        return /notes|note|commentaire|comment|remarque|observation|description|details|info/i.test(k);
      });
      if (entry && entry[1]) return entry[1].trim();
    }
    return o.notes || '';
  };

  const sheetCols = useMemo(() => {
    const hasRaw = orders.some(o => o.rawData && Object.keys(o.rawData).length > 0);
    return hasRaw ? [...new Set(orders.flatMap(o => Object.keys(o.rawData || {})))] : [];
  }, [orders]);

  const uniqueCities = useMemo(() => [...new Set(orders.map(o => getCity(o)).filter(Boolean))].sort(), [orders]);
  const uniqueProducts = useMemo(() => [...new Set(orders.map(o => getProductName(o)).filter(p => p && p !== 'Non spécifié'))].sort(), [orders]);
  const uniqueTags = useMemo(() => [...new Set(orders.flatMap(o => o.tags || []))].filter(Boolean).sort(), [orders]);

  const activeFiltersCount = [filterCity, filterProduct, filterTag, filterStartDate, filterEndDate].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterStatus('');
    setFilterCity('');
    setFilterProduct('');
    setFilterTag('');
    setFilterStartDate('');
    setFilterEndDate('');
    setSearch('');
    setPage(1);
  };

  // Calculer les statistiques filtrées en fonction de TOUS les filtres actifs
  const hasActiveFilters = filterStatus || filterCity || filterProduct || filterTag || filterStartDate || filterEndDate || search;
  
  const filteredStats = useMemo(() => {
    if (!hasActiveFilters) {
      // Aucun filtre actif: utiliser les stats globales du serveur (toutes commandes, pas paginées)
      // stats.totalRevenue = revenu livré calculé côté serveur sur TOUTES les commandes livrées
      return {
        total: stats.total || 0,
        delivered: stats.delivered || 0,
        returned: stats.returned || 0,
        pending: stats.pending || 0,
        confirmed: stats.confirmed || 0,
        shipped: stats.shipped || 0,
        totalRevenue: stats.totalRevenue || 0,
        deliveredRevenue: stats.totalRevenue || 0
      };
    }
    
    // Appliquer TOUS les filtres aux commandes
    let filtered = [...orders];
    
    // Filtre par statut
    if (filterStatus) {
      filtered = filtered.filter(o => o.status === filterStatus);
    }
    
    // Filtre par ville
    if (filterCity) {
      filtered = filtered.filter(o => {
        const city = getCity(o);
        return city && city.toLowerCase().includes(filterCity.toLowerCase());
      });
    }
    
    // Filtre par produit
    if (filterProduct) {
      filtered = filtered.filter(o => {
        const product = getProductName(o);
        return product && product.toLowerCase().includes(filterProduct.toLowerCase());
      });
    }
    
    // Filtre par tag
    if (filterTag) {
      filtered = filtered.filter(o => o.tags && o.tags.includes(filterTag));
    }
    
    // Filtre par dates
    if (filterStartDate) {
      const startDate = new Date(filterStartDate);
      filtered = filtered.filter(o => o.date && new Date(o.date) >= startDate);
    }
    if (filterEndDate) {
      const endDate = new Date(filterEndDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(o => o.date && new Date(o.date) <= endDate);
    }
    
    // Filtre par recherche
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(o => {
        const clientName = getClientName(o).toLowerCase();
        const clientPhone = getClientPhone(o).toLowerCase();
        const city = getCity(o).toLowerCase();
        const product = getProductName(o).toLowerCase();
        return clientName.includes(searchLower) || 
               clientPhone.includes(searchLower) || 
               city.includes(searchLower) || 
               product.includes(searchLower);
      });
    }
    
    // Calculer les stats pour les commandes filtrées
    const delivered = filtered.filter(o => o.status === 'delivered').length;
    const returned = filtered.filter(o => o.status === 'returned').length;
    const pending = filtered.filter(o => o.status === 'pending').length;
    const confirmed = filtered.filter(o => o.status === 'confirmed').length;
    const shipped = filtered.filter(o => o.status === 'shipped').length;
    
    // Revenu calculé UNIQUEMENT sur les commandes livrées
    const deliveredRevenue = filtered
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => {
        const price = parseFloat(o.price) || 0;
        const quantity = parseInt(o.quantity) || 1;
        return sum + (price * quantity);
      }, 0);
    
    // Revenu total (toutes commandes) pour comparaison
    const totalRevenue = filtered.reduce((sum, o) => {
      const price = parseFloat(o.price) || 0;
      const quantity = parseInt(o.quantity) || 1;
      return sum + (price * quantity);
    }, 0);
    
    return {
      total: filtered.length,
      delivered,
      returned,
      pending,
      confirmed,
      shipped,
      totalRevenue, // Garder pour compatibilité
      deliveredRevenue // Nouveau : revenu des commandes livrées uniquement
    };
  }, [filterStatus, filterCity, filterProduct, filterTag, filterStartDate, filterEndDate, search, orders, stats]);

  const deliveryRate = filteredStats.total ? ((filteredStats.delivered || 0) / filteredStats.total * 100).toFixed(1) : 0;
  const returnRate = filteredStats.total ? ((filteredStats.returned || 0) / filteredStats.total * 100).toFixed(1) : 0;

  // Calculer les compteurs de filtres dynamiques (sans le filtre de statut)
  const dynamicFilterCounts = useMemo(() => {
    // Appliquer tous les filtres SAUF le statut
    let baseFiltered = [...orders];
    
    if (filterCity) {
      baseFiltered = baseFiltered.filter(o => {
        const city = getCity(o);
        return city && city.toLowerCase().includes(filterCity.toLowerCase());
      });
    }
    
    if (filterProduct) {
      baseFiltered = baseFiltered.filter(o => {
        const product = getProductName(o);
        return product && product.toLowerCase().includes(filterProduct.toLowerCase());
      });
    }
    
    if (filterTag) {
      baseFiltered = baseFiltered.filter(o => o.tags && o.tags.includes(filterTag));
    }
    
    if (filterStartDate) {
      const startDate = new Date(filterStartDate);
      baseFiltered = baseFiltered.filter(o => o.date && new Date(o.date) >= startDate);
    }
    
    if (filterEndDate) {
      const endDate = new Date(filterEndDate);
      endDate.setHours(23, 59, 59, 999);
      baseFiltered = baseFiltered.filter(o => o.date && new Date(o.date) <= endDate);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      baseFiltered = baseFiltered.filter(o => {
        const clientName = getClientName(o).toLowerCase();
        const clientPhone = getClientPhone(o).toLowerCase();
        const city = getCity(o).toLowerCase();
        const product = getProductName(o).toLowerCase();
        return clientName.includes(searchLower) || 
               clientPhone.includes(searchLower) || 
               city.includes(searchLower) || 
               product.includes(searchLower);
      });
    }
    
    // Compter par statut
    const counts = {
      total: baseFiltered.length,
      pending: baseFiltered.filter(o => o.status === 'pending').length,
      confirmed: baseFiltered.filter(o => o.status === 'confirmed').length,
      shipped: baseFiltered.filter(o => o.status === 'shipped').length,
      delivered: baseFiltered.filter(o => o.status === 'delivered').length,
      returned: baseFiltered.filter(o => o.status === 'returned').length,
      cancelled: baseFiltered.filter(o => o.status === 'cancelled').length,
      unreachable: baseFiltered.filter(o => o.status === 'unreachable').length,
      called: baseFiltered.filter(o => o.status === 'called').length,
      postponed: baseFiltered.filter(o => o.status === 'postponed').length
    };
    
    return counts;
  }, [filterCity, filterProduct, filterTag, filterStartDate, filterEndDate, search, orders]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  /* Source selector removed — import is now handled at /import */

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-[1400px] mx-auto">
      {success && <div className="mb-3 p-2.5 bg-green-50 text-green-800 rounded-lg text-sm border border-green-200 flex items-center gap-2"><svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>{success}</div>}
      {error && <div className="mb-3 p-2.5 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200 flex items-center gap-2"><svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>{error}</div>}
      
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between mb-3 sm:mb-4 gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
            {selectedSourceId ? sources.find(s => s._id === selectedSourceId)?.name : 'Commandes'}
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
            {hasActiveFilters ? (
              <>
                {filteredStats.total} commande{filteredStats.total > 1 ? 's' : ''} filtrée{filteredStats.total > 1 ? 's' : ''}
                {filterStatus && <> • <span className="text-blue-600 font-medium">{getStatusLabel(filterStatus)}</span></>}
                {filterCity && <> • <span className="text-purple-600 font-medium">{filterCity}</span></>}
                {filterProduct && <> • <span className="text-green-600 font-medium">{filterProduct}</span></>}
              </>
            ) : (
              <>{stats.total || 0} commandes au total</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle tous les espaces pour Super Admin */}
          {isSuperAdmin && (
            <button
              onClick={() => setViewAllWorkspaces(!viewAllWorkspaces)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg transition text-xs font-medium ${
                viewAllWorkspaces
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={viewAllWorkspaces ? 'Voir toutes les commandes de tous les espaces' : 'Voir uniquement les commandes de mon espace'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={viewAllWorkspaces ? "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" : "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"} />
              </svg>
              {viewAllWorkspaces ? '🌍 Tous les espaces' : '🏢 Mon espace'}
            </button>
          )}
          {isAdmin && (
            <>
              <button onClick={() => setShowGuide(!showGuide)} className="hidden sm:flex p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition" title="Guide d'utilisation">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>
              <button onClick={() => setShowWhatsAppConfig(true)} className="hidden sm:flex p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition" title="Configurer WhatsApp auto">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </button>
              <button
                onClick={openCreateOrder}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-emerald-600 text-white rounded-xl active:scale-95 transition text-[11px] sm:text-xs font-semibold"
                title="Ajouter une commande"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span className="hidden sm:inline">Ajouter</span>
              </button>
              <button
                onClick={() => navigate('/ecom/import')}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-blue-600 text-white rounded-xl active:scale-95 transition text-[11px] sm:text-xs font-semibold"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                <span className="hidden sm:inline">Importer</span>
              </button>
              <button
                onClick={() => handleSync()}
                disabled={syncDisabled}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-orange-600 text-white rounded-xl active:scale-95 transition text-[11px] sm:text-xs font-semibold disabled:opacity-50"
                title="Synchroniser"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                <span className="hidden sm:inline">Sync</span>
              </button>
              <button
                onClick={() => navigate('/ecom/stats')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-xl transition text-xs font-semibold"
                title="Voir les statistiques globales"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Stats
              </button>
              {orders.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  disabled={deletingAll}
                  className="inline-flex items-center gap-1 px-2.5 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition text-xs font-medium"
                  title="Supprimer toutes les commandes"
                >
                  {deletingAll ? (
                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sources */}
      {isAdmin && (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 shadow-sm p-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Sources ({sources.length})</span>
          </div>

          {/* Information d'adaptation au Google Sheet */}
          {selectedSourceId && sourcesConfig[selectedSourceId] && (
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-xs">
                <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span className="text-blue-700 font-medium">
                  Affichage adapté à : {sourcesConfig[selectedSourceId].name}
                </span>
                {sourcesConfig[selectedSourceId].detectedHeaders.length > 0 && (
                  <span className="text-blue-600">
                    ({sourcesConfig[selectedSourceId].detectedHeaders.length} colonnes détectées)
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setSelectedSourceId(''); setPage(1); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                !selectedSourceId
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              Toutes
            </button>
            {sources.map(s => (
              <div key={s._id} className="flex items-center gap-0.5">
                <button
                  onClick={() => { setSelectedSourceId(s._id); setPage(1); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedSourceId === s._id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
                  {s.name}
                  {s.lastSyncAt && (
                    <span className="opacity-60 text-[10px] ml-1">
                      {new Date(s.lastSyncAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => deleteSource(s._id)}
                  disabled={deletingSource === s._id}
                  className={`p-1 rounded-md transition ${
                    selectedSourceId === s._id
                      ? 'text-red-400 hover:text-red-600 hover:bg-red-50'
                      : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                  } ${deletingSource === s._id ? 'opacity-50 cursor-wait' : ''}`}
                  title="Supprimer cette source et ses commandes"
                >
                  {deletingSource === s._id ? (
                    <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                </button>
              </div>
            ))}
            {sources.length === 0 && (
              <p className="text-xs text-gray-400 italic py-1">Aucune source configuree. Cliquez sur "Importer" pour ajouter des commandes.</p>
            )}
          </div>
        </div>
      )}

      {/* Barre de filtres moderne style GAFAM */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-6">
        {/* En-tête des filtres */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3 border-b border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Filtres intelligents</h3>
                <p className="text-xs text-gray-500">
                  {hasActiveFilters ? (
                    <>
                      <span className="font-semibold text-blue-600">{filteredStats.total}</span> résultat{filteredStats.total > 1 ? 's' : ''} sur {stats.total || 0}
                    </>
                  ) : (
                    <>{stats.total || 0} commandes au total</>
                  )}
                </p>
              </div>
            </div>
            {activeFiltersCount > 0 && (
              <button onClick={clearAllFilters} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-semibold transition-all hover:shadow-md">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                Réinitialiser tout
              </button>
            )}
          </div>
        </div>

        {/* Chips de filtres actifs */}
        {activeFiltersCount > 0 && (
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <div className="flex flex-wrap gap-2">
              {filterStatus && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold border border-blue-200">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
                  Statut: {getStatusLabel(filterStatus)}
                  <button onClick={() => { setFilterStatus(''); setPage(1); }} className="ml-1.5 hover:text-blue-900">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              )}
              {filterCity && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold border border-purple-200">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  Ville: {filterCity}
                  <button onClick={() => { setFilterCity(''); setPage(1); }} className="ml-1.5 hover:text-purple-900">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              )}
              {filterProduct && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold border border-green-200">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                  Produit: {filterProduct}
                  <button onClick={() => { setFilterProduct(''); setPage(1); }} className="ml-1.5 hover:text-green-900">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              )}
              {filterStartDate && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold border border-orange-200">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  Depuis: {filterStartDate}
                  <button onClick={() => { setFilterStartDate(''); setPage(1); }} className="ml-1.5 hover:text-orange-900">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              )}
              {filterEndDate && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold border border-orange-200">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  Jusqu'au: {filterEndDate}
                  <button onClick={() => { setFilterEndDate(''); setPage(1); }} className="ml-1.5 hover:text-orange-900">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              )}
              {search && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold border border-gray-300">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  Recherche: {search}
                  <button onClick={() => { setSearch(''); setPage(1); }} className="ml-1.5 hover:text-gray-900">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contenu des filtres */}
        <div className="p-5">
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-2">Recherche rapide</label>
            <div className="relative">
              <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input 
                type="text" 
                placeholder="Rechercher par nom, téléphone, ville, produit..." 
                value={search} 
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              {search && (
                <button 
                  onClick={() => { setSearch(''); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-2">Filtrer par statut</label>
            <div className="flex flex-wrap gap-1.5">
          <button onClick={() => { setFilterStatus(''); setPage(1); }} className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${!filterStatus ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Tous ({(filterCity || filterProduct || filterTag || filterStartDate || filterEndDate || search) ? dynamicFilterCounts.total : stats.total || 0})
          </button>
          {[
            { key: 'pending', label: 'En attente', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200' },
            { key: 'confirmed', label: 'Confirmé', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200' },
            { key: 'shipped', label: 'Expédié', color: 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200' },
            { key: 'delivered', label: 'Livré', color: 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200' },
            { key: 'returned', label: 'Retour', color: 'bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-200' },
            { key: 'cancelled', label: 'Annulé', color: 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200' },
            { key: 'unreachable', label: 'Injoignable', color: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300' },
            { key: 'called', label: 'Appelé', color: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200 border border-cyan-200' },
            { key: 'postponed', label: 'Reporté', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200' }
          ].map(s => (
            <button key={s.key} onClick={() => { setFilterStatus(filterStatus === s.key ? '' : s.key); setPage(1); }}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${filterStatus === s.key ? 'ring-2 ring-offset-1 ring-gray-400 shadow-sm ' : ''}${s.color}`}>
              {s.label} ({(filterCity || filterProduct || filterTag || filterStartDate || filterEndDate || search) ? dynamicFilterCounts[s.key] || 0 : stats[s.key] || 0})
            </button>
          ))}
          </div>
          </div>

          <button 
            onClick={() => setShowFilters(!showFilters)} 
            className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${showFilters ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            {showFilters ? 'Masquer les filtres avancés' : 'Afficher les filtres avancés'}
          </button>

          {/* Advanced filters panel */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Date début</label>
                  <input type="date" value={filterStartDate} onChange={e => { setFilterStartDate(e.target.value); setPage(1); }} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Date fin</label>
                  <input type="date" value={filterEndDate} onChange={e => { setFilterEndDate(e.target.value); setPage(1); }} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Ville</label>
                  <select value={filterCity} onChange={e => { setFilterCity(e.target.value); setPage(1); }} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="">Toutes les villes</option>
                    {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Produit</label>
                  <select value={filterProduct} onChange={e => { setFilterProduct(e.target.value); setPage(1); }} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="">Tous les produits</option>
                    {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Tag</label>
                  <select value={filterTag} onChange={e => { setFilterTag(e.target.value); setPage(1); }} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="">Tous les tags</option>
                    {uniqueTags.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {activeFiltersCount > 0 && (
                <div className="flex items-center justify-between mt-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {filterStartDate && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-medium">{filterStartDate} <button onClick={() => { setFilterStartDate(''); setPage(1); }} className="hover:text-blue-900">&times;</button></span>}
                    {filterEndDate && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-medium">{filterEndDate} <button onClick={() => { setFilterEndDate(''); setPage(1); }} className="hover:text-blue-900">&times;</button></span>}
                    {filterCity && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[10px] font-medium">{filterCity} <button onClick={() => { setFilterCity(''); setPage(1); }} className="hover:text-purple-900">&times;</button></span>}
                    {filterProduct && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[10px] font-medium">{filterProduct} <button onClick={() => { setFilterProduct(''); setPage(1); }} className="hover:text-green-900">&times;</button></span>}
                    {filterTag && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-[10px] font-medium">{filterTag} <button onClick={() => { setFilterTag(''); setPage(1); }} className="hover:text-orange-900">&times;</button></span>}
                  </div>
                  <button onClick={clearAllFilters} className="text-[10px] text-red-600 hover:text-red-800 font-medium">Tout effacer</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sync clients button */}
      {isAdmin && (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 shadow-sm p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Synchronisation clients</span>
            </div>
            <button
              onClick={() => setShowSyncClientsModal(true)}
              disabled={syncProgress !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncProgress ? 'Synchronisation...' : 'Sync clients'}
            </button>
          </div>
          
          {/* Progress bar */}
          {syncProgress && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">{syncProgress.message}</span>
                {syncProgress.percentage > 0 && (
                  <span className="text-gray-500 font-medium">{syncProgress.percentage}%</span>
                )}
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${syncProgress.percentage}%` }}
                />
              </div>
              
              {syncProgress.type === 'complete' && (
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Total: {syncProgress.total} clients</span>
                  <span>Créés: {syncProgress.created || 0} | Mis à jour: {syncProgress.updated || 0}</span>
                </div>
              )}
            </div>
          )}
          
          <p className="text-[10px] text-gray-500 mt-2">Regroupez tous les clients par statut depuis les commandes pour préparer vos campagnes de relance.</p>
        </div>
      )}

      {/* Guide visuel */}
      {showGuide && isAdmin && (
        <div className="mb-4 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 bg-white/60 border-b border-blue-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Comment importer et retrouver vos commandes</h3>
                <p className="text-[11px] text-gray-500">Suivez ces 3 etapes simples</p>
              </div>
            </div>
            <button onClick={() => { setShowGuide(false); localStorage.setItem('ecom_guide_dismissed', '1'); }} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-white/80 rounded-lg transition" title="Fermer le guide">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Etape 1 */}
              <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <h4 className="text-sm font-semibold text-gray-900">Importer</h4>
                </div>
                <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <svg className="w-6 h-6 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>
                  <span className="text-xs text-blue-700 font-medium">Cliquez sur le bouton bleu "Importer" en haut a droite</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">Collez le lien de votre Google Sheet ou selectionnez une source configuree, puis lancez l'import.</p>
                <button onClick={() => navigate('/ecom/import')} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Aller a la page d'import
                </button>
              </div>

              {/* Etape 2 */}
              <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <h4 className="text-sm font-semibold text-gray-900">Retrouver</h4>
                </div>
                <div className="flex items-center gap-2 mb-3 p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                  <svg className="w-6 h-6 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                  <span className="text-xs text-indigo-700 font-medium">Filtrez par source avec le menu deroulant</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">Apres l'import, vos commandes apparaissent ici. Utilisez le <strong>menu deroulant des sources</strong> (en haut) pour filtrer par Google Sheet.</p>
                <div className="mt-3 flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  <span className="text-[11px] text-gray-500">Toutes les sources</span>
                  <svg className="w-3 h-3 text-gray-300 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>

              {/* Etape 3 */}
              <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <h4 className="text-sm font-semibold text-gray-900">Filtrer & Chercher</h4>
                </div>
                <div className="flex items-center gap-2 mb-3 p-2 bg-purple-50 rounded-lg border border-purple-100">
                  <svg className="w-6 h-6 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <span className="text-xs text-purple-700 font-medium">Utilisez les filtres et la recherche</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">Filtrez par <strong>statut</strong> (pastilles colorees), cherchez par <strong>nom, telephone, ville</strong>, ou utilisez les <strong>filtres avances</strong> (dates, produit, tag).</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {['Tous', 'En attente', 'Confirme', 'Livre'].map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">{s}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-[11px] text-gray-400">Ce guide s'affiche une seule fois. Cliquez sur <strong>?</strong> en haut pour le revoir.</p>
              <button onClick={() => { setShowGuide(false); localStorage.setItem('ecom_guide_dismissed', '1'); }} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                J'ai compris, fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards - Design ultra-moderne avec animations */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="group bg-gradient-to-br from-green-50 via-green-50 to-emerald-100 rounded-2xl border border-green-200/50 shadow-sm p-5 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-400/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wider">Revenu livré</p>
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform duration-300">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-gray-900 mb-1 tracking-tight">{fmt(filteredStats.deliveredRevenue || 0) || '0 FCFA'}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-green-600 font-semibold">{filteredStats.delivered || 0} livrées</p>
              <div className="flex items-center gap-0.5 text-green-600">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
                <span className="text-xs font-bold">+{Math.round((filteredStats.delivered || 0) / (filteredStats.total || 1) * 100)}%</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="group bg-gradient-to-br from-blue-50 via-blue-50 to-indigo-100 rounded-2xl border border-blue-200/50 shadow-sm p-5 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-400/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Taux livraison</p>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform duration-300">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-gray-900 mb-2 tracking-tight">{deliveryRate}%</p>
            <div className="w-full bg-blue-100/50 rounded-full h-2.5 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-700 ease-out shadow-sm" style={{ width: `${Math.min(deliveryRate, 100)}%` }}></div>
            </div>
          </div>
        </div>
        
        <div className="group bg-gradient-to-br from-orange-50 via-orange-50 to-amber-100 rounded-2xl border border-orange-200/50 shadow-sm p-5 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-400/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-orange-700 uppercase tracking-wider">Taux retour</p>
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform duration-300">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z"/></svg>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-gray-900 mb-2 tracking-tight">{returnRate}%</p>
            <div className="w-full bg-orange-100/50 rounded-full h-2.5 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-400 via-orange-500 to-amber-600 h-2.5 rounded-full transition-all duration-700 ease-out shadow-sm" style={{ width: `${Math.min(returnRate, 100)}%` }}></div>
            </div>
          </div>
        </div>
        
        <div className="group bg-gradient-to-br from-purple-50 via-purple-50 to-violet-100 rounded-2xl border border-purple-200/50 shadow-sm p-5 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-400/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">En cours</p>
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform duration-300">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-gray-900 mb-1 tracking-tight">{filteredStats.delivered || 0}</p>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">{filteredStats.delivered || 0} livrées</span>
              <span className="text-gray-300">·</span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold">{(filteredStats.pending || 0) + (filteredStats.confirmed || 0) + (filteredStats.shipped || 0)} en cours</span>
            </div>
          </div>
        </div>
      </div>

      {/* Orders */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-10 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          </div>
          <p className="text-gray-500 text-sm font-medium">Aucune commande trouvée</p>
          <p className="text-xs text-gray-400 mt-1">
            {search || filterStatus || filterCity || filterProduct || filterTag || filterStartDate || filterEndDate
              ? 'Essayez de modifier vos filtres ou votre recherche.'
              : isAdmin ? <>Importez vos commandes depuis la page <a href="/ecom/import" className="text-blue-600 hover:underline">Import</a></> : 'Aucune commande disponible.'
            }
          </p>
        </div>
      ) : (
        <>
          {/* Vue tableau structuré — Desktop adapté au Google Sheet */}
          <div className="hidden md:block bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b-2 border-gray-200">
                    {/* Colonnes fixes */}
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Nom</th>
                    
                    {/* Colonnes dynamiques selon le Google Sheet */}
                    {getDisplayFields(selectedSourceId).map(field => (
                      <th key={field.key} className="px-4 py-4 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                        {field.label}
                      </th>
                    ))}
                    
                    {/* Colonnes fixes */}
                    <th className="px-4 py-4 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Total</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap sticky right-0 bg-gradient-to-r from-gray-50 to-gray-100/50">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((o) => {
                    const clientName = getClientName(o);
                    const totalPrice = (o.price || 0) * (o.quantity || 1);

                    return (
                      <tr key={o._id} className="hover:bg-gradient-to-r hover:from-blue-50/60 hover:to-indigo-50/40 transition-all duration-200 cursor-pointer group border-l-4 border-l-transparent hover:border-l-blue-500 hover:shadow-sm" onClick={() => navigate(`/ecom/orders/${o._id}`)}>
                        {/* Colonne nom fixe */}
                        <td className="px-4 py-4 whitespace-nowrap max-w-[180px]">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm">
                              {clientName ? clientName.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-gray-900 truncate block" title={clientName}>{clientName || <span className="text-gray-300">—</span>}</span>
                              {o.orderId && (
                                <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200 mt-0.5 inline-block">{o.orderId}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        
                        {/* Colonnes dynamiques */}
                        {getDisplayFields(selectedSourceId).map(field => {
                          const value = field.getValue(o);
                          return (
                            <td key={field.key} className={`px-4 py-4 ${field.key === 'address' ? 'max-w-[160px]' : field.key === 'product' ? 'max-w-[150px]' : field.key === 'notes' ? 'max-w-[130px]' : 'whitespace-nowrap'}`}>
                              {value ? (
                                <span className={`text-sm ${field.key === 'clientPhone' ? 'text-gray-700 font-mono bg-gray-50 px-2 py-1 rounded-md' : field.key === 'notes' ? 'text-gray-500 italic' : 'text-gray-800 font-medium'} truncate block`} title={String(value)}>
                                  {field.key === 'price' ? fmt(value) : 
                                   field.key === 'date' ? fmtDate(value) :
                                   field.key === 'quantity' && o.quantity > 1 ? `${value}×${o.quantity}` :
                                   String(value)}
                                </span>
                              ) : (
                                <span className="text-gray-300 text-sm">—</span>
                              )}
                            </td>
                          );
                        })}
                        
                        {/* Colonne total fixe */}
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          {totalPrice > 0 ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                              <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/></svg>
                              <span className="text-sm font-bold text-green-700">{fmt(totalPrice)}</span>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </td>
                        
                        {/* Colonne actions fixe */}
                        <td className="px-4 py-4 whitespace-nowrap sticky right-0 bg-white group-hover:bg-gradient-to-r group-hover:from-blue-50/60 group-hover:to-indigo-50/40" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <select value={o.status} onChange={(e) => { if (e.target.value === '__custom') { const c = prompt('Entrez le statut personnalisé :'); if (c && c.trim()) handleStatusChange(o._id, c.trim()); } else handleStatusChange(o._id, e.target.value); }}
                              className={`text-xs px-3 py-1.5 rounded-lg font-semibold border-2 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all hover:shadow-md ${getStatusColor(o.status)}`}>
                              {Object.entries(SL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              {!SL[o.status] && <option value={o.status}>{o.status}</option>}
                              <option value="__custom">+ Personnalisé...</option>
                            </select>
                            {/* Bouton copier - icône uniquement */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopyOrder(o); }}
                              className="inline-flex items-center justify-center w-8 h-8 text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all hover:shadow-md hover:scale-110"
                              title="Copier la commande"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vue cartes — Mobile */}
          <div className="md:hidden space-y-3">
            {orders.map(o => {
              const clientName = getClientName(o);
              const clientPhone = getClientPhone(o);
              const city = getCity(o);
              const address = getAddress(o);
              const productName = getProductName(o);
              const totalPrice = (o.price || 0) * (o.quantity || 1);

              return (
                <div key={o._id} className={`bg-white rounded-xl shadow-sm border-l-4 ${getStatusDot(o.status)} overflow-hidden hover:shadow-md transition-all duration-200`}>
                  <div className="p-4 cursor-pointer" onClick={() => navigate(`/ecom/orders/${o._id}`)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{clientName}</h3>
                          {o.orderId && (
                            <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 flex-shrink-0">{o.orderId}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${getStatusColor(o.status)}`}>
                            {getStatusLabel(o.status)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        {totalPrice > 0 && <p className="text-base font-bold text-gray-900">{fmt(totalPrice)}</p>}
                        <p className="text-[10px] text-gray-400">{fmtDate(o.date)}</p>
                      </div>
                    </div>

                    {/* Ligne unique avec tous les détails - Mobile adapté au Google Sheet */}
                    <div className="mt-3 overflow-x-auto">
                      <div className="flex items-center gap-3 text-xs whitespace-nowrap pb-1">
                        {getDisplayFields(selectedSourceId).map(field => {
                          const value = field.getValue(o);
                          if (!value) return null;
                          
                          // Déterminer l'icône SVG selon le type
                          const getIcon = (iconType) => {
                            const icons = {
                              phone: <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>,
                              location: <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
                              home: <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
                              package: <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>,
                              note: <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>,
                              hashtag: <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>,
                              calendar: <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
                              money: <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/></svg>,
                              number: <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>
                            };
                            return icons[iconType] || icons.note;
                          };

                          // Déterminer la largeur maximale selon le type
                          const getMaxWidth = (fieldKey) => {
                            const widths = {
                              clientPhone: 'max-w-[100px]',
                              city: 'max-w-[80px]',
                              address: 'max-w-[120px]',
                              product: 'max-w-[100px]',
                              notes: 'max-w-[80px]',
                              orderId: 'max-w-[60px]',
                              date: 'max-w-[70px]',
                              price: 'max-w-[60px]',
                              quantity: 'max-w-[40px]'
                            };
                            return widths[fieldKey] || 'max-w-[80px]';
                          };

                          // Formatter la valeur selon le type
                          const formatValue = (fieldKey, value, order) => {
                            if (fieldKey === 'price') return fmt(value);
                            if (fieldKey === 'date') return fmtDate(value);
                            if (fieldKey === 'quantity' && order.quantity > 1) return `${value}×${order.quantity}`;
                            return String(value);
                          };

                          return (
                            <div key={field.key} className={`flex items-center gap-1.5 text-gray-600 flex-shrink-0`}>
                              {getIcon(field.icon)}
                              <span className={`truncate ${getMaxWidth(field.key)} ${field.key === 'notes' ? 'text-[10px]' : ''}`}>
                                {formatValue(field.key, value, o)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between bg-gray-50/50">
                    <select value={o.status} onChange={(e) => { if (e.target.value === '__custom') { const c = prompt('Entrez le statut personnalisé :'); if (c && c.trim()) handleStatusChange(o._id, c.trim()); } else handleStatusChange(o._id, e.target.value); }}
                      className={`text-[10px] px-2.5 py-1 rounded-full font-medium border cursor-pointer ${getStatusColor(o.status)}`}>
                      {Object.entries(SL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      {!SL[o.status] && <option value={o.status}>{o.status}</option>}
                      <option value="__custom">+ Personnalisé...</option>
                    </select>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        {/* Bouton copier - mobile */}
                        <button onClick={(e) => { e.stopPropagation(); handleCopyOrder(o); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition" title="Copier la commande">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copier
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openEditOrder(o); }} className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition" title="Modifier">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(o._id); }} disabled={deletingOrderId === o._id} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Supprimer">
                          {deletingOrderId === o._id ? (
                            <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          )}
                        </button>
                      </div>
                    )}
                    {/* Bouton copier visible pour tous si pas admin */}
                    {!isAdmin && (
                      <button onClick={(e) => { e.stopPropagation(); handleCopyOrder(o); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition" title="Copier la commande">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copier
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 bg-white rounded-xl shadow-sm border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <p className="text-[11px] text-gray-400">
            {pagination.pages > 1 ? (
              <>Page {page}/{pagination.pages} · {pagination.total} commandes</>
            ) : (
              <>{orders.length} commande{orders.length > 1 ? 's' : ''} affichée{orders.length > 1 ? 's' : ''}</>
            )}
          </p>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-500 font-medium">Lignes par page:</label>
            <select 
              value={itemsPerPage} 
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
              className="text-[11px] px-2 py-1 border border-gray-200 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>
        {pagination.pages > 1 && (
          <div className="flex gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">Préc</button>
            <button onClick={() => setPage(Math.min(pagination.pages, page + 1))} disabled={page >= pagination.pages} className="px-3 py-1 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">Suiv</button>
          </div>
        )}
      </div>

      {/* Modal Configuration WhatsApp Automatique */}
      {showWhatsAppConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowWhatsAppConfig(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Configuration WhatsApp automatique</h3>
              <button onClick={() => setShowWhatsAppConfig(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-medium text-blue-700 mb-2">Configuration WhatsApp</p>
                <p className="text-xs text-blue-600">Configurez les numéros WhatsApp pour recevoir automatiquement les notifications de nouvelles commandes.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Créer/Modifier Commande */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowOrderModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{editingOrder ? 'Modifier la commande' : 'Nouvelle commande'}</h3>
              <button onClick={() => setShowOrderModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nom client *</label>
                  <input type="text" value={orderForm.clientName} onChange={e => setOrderForm({...orderForm, clientName: e.target.value})}
                    placeholder="Nom complet" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Telephone *</label>
                  <input type="text" value={orderForm.clientPhone} onChange={e => setOrderForm({...orderForm, clientPhone: e.target.value})}
                    placeholder="06..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ville</label>
                  <input type="text" value={orderForm.city} onChange={e => setOrderForm({...orderForm, city: e.target.value})}
                    placeholder="Ville" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Adresse</label>
                  <input type="text" value={orderForm.address} onChange={e => setOrderForm({...orderForm, address: e.target.value})}
                    placeholder="Adresse de livraison" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Produit</label>
                <input type="text" value={orderForm.product} onChange={e => setOrderForm({...orderForm, product: e.target.value})}
                  placeholder="Nom du produit" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prix</label>
                  <input type="number" value={orderForm.price} onChange={e => setOrderForm({...orderForm, price: parseFloat(e.target.value) || 0})}
                    min="0" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantite</label>
                  <input type="number" value={orderForm.quantity} onChange={e => setOrderForm({...orderForm, quantity: parseInt(e.target.value) || 1})}
                    min="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
                  <select value={orderForm.status} onChange={e => { if (e.target.value === '__custom') { const c = prompt('Entrez le statut personnalisé :'); if (c && c.trim()) setOrderForm({...orderForm, status: c.trim()}); } else setOrderForm({...orderForm, status: e.target.value}); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    {Object.entries(SL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    {!SL[orderForm.status] && <option value={orderForm.status}>{orderForm.status}</option>}
                    <option value="__custom">+ Personnalisé...</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={orderForm.notes} onChange={e => setOrderForm({...orderForm, notes: e.target.value})}
                  rows={2} placeholder="Notes, remarques..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" />
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex gap-3">
              <button onClick={() => setShowOrderModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">
                Annuler
              </button>
              <button onClick={handleSaveOrder} disabled={savingOrder}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2">
                {savingOrder ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Enregistrement...</>
                ) : editingOrder ? 'Modifier' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showWhatsAppConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowWhatsAppConfig(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Configuration WhatsApp Multi-Pays</h3>
              <button onClick={() => setShowWhatsAppConfig(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Configurez des numéros WhatsApp pour recevoir automatiquement les détails des nouvelles commandes selon le pays
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numéro WhatsApp</label>
                <input
                  type="text"
                  value={customWhatsAppNumber}
                  onChange={(e) => setCustomWhatsAppNumber(e.target.value)}
                  placeholder="Ex: 237676463725"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Format: 237 + numéro (sans + ni espaces)
                </p>
                <button
                  onClick={() => testWhatsAppNumber()}
                  disabled={savingWhatsAppConfig}
                  className="mt-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-xs"
                >
                  Tester par défaut
                </button>
              </div>

              {/* Numéros par pays */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Numéros par pays</h4>
                  <button
                    onClick={() => setShowWhatsAppMultiConfig(true)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs"
                  >
                    Ajouter un pays
                  </button>
                </div>
                
                {whatsappNumbers.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Aucun numéro configuré. Ajoutez des numéros pour recevoir les notifications par pays.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {whatsappNumbers.map((number) => {
                      const country = COUNTRIES.find(c => c.code === number.country);
                      return (
                        <div key={number._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{country?.flag || '🌍'}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{number.countryName}</p>
                              <p className="text-xs text-gray-600">{number.phoneNumber}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              number.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {number.isActive ? 'Actif' : 'Inactif'}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              number.autoNotifyOrders ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {number.autoNotifyOrders ? 'Auto' : 'Manuel'}
                            </span>
                            <button
                              onClick={() => testWhatsAppNumber(number.country)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Tester"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                            </button>
                            <button
                              onClick={() => editWhatsAppNumber(number)}
                              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                              title="Modifier"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => deleteWhatsAppNumber(number._id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Supprimer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-medium text-blue-700 mb-2">Ce qui sera envoyé automatiquement :</p>
                <ul className="text-xs text-blue-600 space-y-1">
                  <li>- Détails complets de la commande (client, produit, prix, etc.)</li>
                  <li>- Détection automatique du pays (par téléphone ou ville)</li>
                  <li>- Message formaté et professionnel</li>
                  <li>- Envoi vers le numéro configuré pour le pays détecté</li>
                </ul>
              </div>

              <div className="bg-yellow-50 rounded-lg p-3">
                <p className="text-xs font-medium text-yellow-700 mb-2">Important :</p>
                <ul className="text-xs text-yellow-600 space-y-1">
                  <li>- Les numéros doivent être valides et actives sur WhatsApp</li>
                  <li>- Format international: +indicatif + numéro</li>
                  <li>- Les messages seront envoyés automatiquement pour les nouvelles commandes</li>
                  <li>- Vous pouvez activer/désactiver les notifications par pays</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowWhatsAppConfig(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={saveWhatsAppConfig}
                disabled={savingWhatsAppConfig}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                {savingWhatsAppConfig ? 'Enregistrement...' : 'Enregistrer par défaut'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pour ajouter/modifier un numéro WhatsApp */}
      {showWhatsAppMultiConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowWhatsAppMultiConfig(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingWhatsAppNumber ? 'Modifier le numéro WhatsApp' : 'Ajouter un numéro WhatsApp'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
                <select
                  value={whatsappForm.country}
                  onChange={(e) => {
                    const country = COUNTRIES.find(c => c.code === e.target.value);
                    setWhatsappForm({
                      ...whatsappForm,
                      country: e.target.value,
                      countryName: country?.name || '',
                      phoneNumber: country?.dialCode || ''
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Sélectionner un pays</option>
                  {COUNTRIES.map(country => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numéro WhatsApp</label>
                <input
                  type="text"
                  value={whatsappForm.phoneNumber}
                  onChange={(e) => setWhatsappForm({ ...whatsappForm, phoneNumber: e.target.value })}
                  placeholder="+237676463725"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Format: +indicatif + numéro (ex: +237676463725)
                </p>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={whatsappForm.isActive}
                    onChange={(e) => setWhatsappForm({ ...whatsappForm, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Numéro actif</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={whatsappForm.autoNotifyOrders}
                    onChange={(e) => setWhatsappForm({ ...whatsappForm, autoNotifyOrders: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">Notifier automatiquement</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowWhatsAppMultiConfig(false);
                  setEditingWhatsAppNumber(null);
                  setWhatsappForm({
                    country: '',
                    countryName: '',
                    phoneNumber: '',
                    isActive: true,
                    autoNotifyOrders: true
                  });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={saveWhatsAppNumber}
                disabled={savingWhatsAppNumber}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                {savingWhatsAppNumber ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Clients Modal */}
      {showSyncClientsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSyncClientsModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Synchroniser les clients</h3>
              <button onClick={() => setShowSyncClientsModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Sélectionnez les statuts de commandes à synchroniser :
            </p>
            
            <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
              {[
                { key: 'delivered', label: 'Livré', color: 'bg-green-500' },
                { key: 'confirmed', label: 'Confirmé', color: 'bg-blue-500' },
                { key: 'shipped', label: 'Expédié', color: 'bg-purple-500' },
                { key: 'pending', label: 'En attente', color: 'bg-yellow-500' },
                { key: 'returned', label: 'Retour', color: 'bg-orange-500' },
                { key: 'cancelled', label: 'Annulé', color: 'bg-red-500' },
                { key: 'unreachable', label: 'Injoignable', color: 'bg-gray-500' },
                { key: 'called', label: 'Appelé', color: 'bg-cyan-500' },
                { key: 'postponed', label: 'Reporté', color: 'bg-amber-500' }
              ].map(status => (
                <label key={status.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncClientsStatuses.includes(status.key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSyncClientsStatuses([...syncClientsStatuses, status.key]);
                      } else {
                        setSyncClientsStatuses(syncClientsStatuses.filter(s => s !== status.key));
                      }
                    }}
                    className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                  />
                  <span className={`w-2 h-2 rounded-full ${status.color}`}></span>
                  <span className="text-sm text-gray-700">{status.label}</span>
                </label>
              ))}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowSyncClientsModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleSyncClients}
                disabled={syncProgress !== null || syncClientsStatuses.length === 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
              >
                {syncProgress ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Sync...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Lancer la sync
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>  
  );
};

export default OrdersList;
