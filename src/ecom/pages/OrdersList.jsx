import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';
import { playCashRegisterSound, playConfirmSound } from '../services/soundService.js';
import { getContextualError } from '../utils/errorMessages';
// ❌ CACHE DÉSACTIVÉ
// import { getCache, setCache, invalidatePrefix } from '../utils/cacheUtils.js';

const SL = { pending: 'En attente', confirmed: 'Confirmé', shipped: 'Expédié', delivered: 'Livré', returned: 'Retour', cancelled: 'Annulé', unreachable: 'Injoignable', called: 'Appelé', postponed: 'Reporté' };
const SC = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  shipped: 'bg-emerald-50 text-emerald-800 border-emerald-100',
  delivered: 'bg-green-50 text-green-700 border-green-100',
  returned: 'bg-orange-50 text-orange-700 border-orange-100',
  cancelled: 'bg-red-50 text-red-700 border-red-100',
  unreachable: 'bg-gray-50 text-gray-700 border-gray-200',
  called: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  postponed: 'bg-amber-50 text-amber-700 border-amber-100'
};
const STATUS_FILTER_META = [
  { key: 'pending', label: 'En attente', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200' },
  { key: 'confirmed', label: 'Confirmé', color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200' },
  { key: 'shipped', label: 'Expédié', color: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200' },
  { key: 'delivered', label: 'Livré', color: 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200' },
  { key: 'returned', label: 'Retour', color: 'bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-200' },
  { key: 'cancelled', label: 'Annulé', color: 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200' },
  { key: 'unreachable', label: 'Injoignable', color: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300' },
  { key: 'called', label: 'Appelé', color: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200 border border-cyan-200' },
  { key: 'postponed', label: 'Reporté', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200' }
];
const SD = {
  pending: '', confirmed: '', shipped: '',
  delivered: '', returned: '', cancelled: '',
  unreachable: '', called: '', postponed: ''
};
const getStatusLabel = (s) => SL[s] || s;
const getStatusColor = (s) => SC[s] || 'bg-emerald-100 text-emerald-900 border-emerald-200';
const getStatusDot = (s) => SD[s] || 'border-l-emerald-500';

const toDateInputValue = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};



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
  const isCloseuse = user?.role === 'ecom_closeuse';

    const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const [sortOrder, setSortOrder] = useState('newest_first'); // 'newest_first' | 'oldest_first'
  const [viewMode, setViewMode] = useState('table');
  const [showSourceSelector, setShowSourceSelector] = useState(true);
  const [showWhatsAppConfig, setShowWhatsAppConfig] = useState(false);
  const [customWhatsAppNumber, setCustomWhatsAppNumber] = useState('');
  const [whatsappAutoConfirm, setWhatsappAutoConfirm] = useState(false);
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
  const [commissions, setCommissions] = useState(null);
  const [commissionPeriod, setCommissionPeriod] = useState('month');
  const [showImportMenu, setShowImportMenu] = useState(false);
  const importMenuRef = useRef(null);
  const [loadingCommissions, setLoadingCommissions] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');
  const [debouncedProduct, setDebouncedProduct] = useState('');
  const [debouncedTag, setDebouncedTag] = useState('');

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

  const fetchOrders = async (silent = false) => {
    if (!silent) setRefreshing(true);

    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (filterStatus) params.status = filterStatus;
    if (debouncedCity) params.city = debouncedCity;
    if (debouncedProduct) params.product = debouncedProduct;
    if (debouncedTag) params.tag = debouncedTag;
    if (filterStartDate) params.startDate = filterStartDate;
    if (filterEndDate) params.endDate = filterEndDate;
    if (selectedSourceId) params.sourceId = selectedSourceId;
    if (isSuperAdmin && viewAllWorkspaces) params.allWorkspaces = 'true';
    if (sortOrder) params.sortOrder = sortOrder;

    // ❌ CACHE DÉSACTIVÉ - Phase 1 : quick endpoint uniquement
    const hasFilters = debouncedSearch || filterStatus || debouncedCity || debouncedProduct || debouncedTag || filterStartDate || filterEndDate;
    if (!hasFilters && page === 1 && !silent) {
      try {
        const quickParams = { sortOrder };
        if (selectedSourceId) quickParams.sourceId = selectedSourceId;
        const quick = await ecomApi.get('/orders/quick', { params: quickParams });
        if (quick.data.data.orders.length > 0) {
          setOrders(quick.data.data.orders);
          setLoading(false);
        }
      } catch { /* ignore, full load will follow */ }
    }

    // •• Phase 2 : chargement complet ••
    try {
      const fullParams = { ...params, page, limit: itemsPerPage };
      const res = await ecomApi.get('/orders', { params: fullParams });
      const d = { orders: res.data.data.orders, stats: res.data.data.stats, pagination: res.data.data.pagination || {} };
      // ❌ CACHE DÉSACTIVÉ
      setOrders(d.orders); setStats(d.stats); setPagination(d.pagination);
    } catch (err) {
      setError(getContextualError(err, 'load_orders'));
    } finally {
      setRefreshing(false);
    }
  };

  const fetchCloseuseSources = async () => {
    try {
      const res = await ecomApi.get('/assignments/my-sources');
      const assignedSources = res.data?.data?.sources || [];
      setSources(assignedSources);
      const configMap = {};
      assignedSources.forEach(source => {
        configMap[source._id] = {
          detectedHeaders: source.detectedHeaders || [],
          detectedColumns: source.detectedColumns || {},
          name: source.name
        };
      });
      setSourcesConfig(configMap);
      if (assignedSources.length === 1) {
        setSelectedSourceId(assignedSources[0]._id);
      }
    } catch (err) {
      console.error('Erreur chargement sources closeuse:', err);
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

        // Charger le taux de commission
        if (res.data.data.commissionRate !== undefined) {
          setConfig(prev => ({ ...prev, commissionRate: res.data.data.commissionRate }));
        }
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
      setWhatsappAutoConfirm(res.data.data.whatsappAutoConfirm || false);
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
      setError(getContextualError(err, 'update_settings'));
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
      setError(getContextualError(err, 'delete_order'));
    }
  };

  const testWhatsAppNumber = async (country) => {
    try {
      const res = await ecomApi.post('/orders/test-whatsapp', { country });
      setSuccess(res.data.message);
    } catch (err) {
      setError(getContextualError(err, 'send_message'));
    }
  };

  const saveWhatsAppConfig = async () => {
    setSavingWhatsAppConfig(true);
    setError('');
    try {
      const res = await ecomApi.post('/orders/config/whatsapp', {
        customWhatsAppNumber: customWhatsAppNumber,
        whatsappAutoConfirm: whatsappAutoConfirm
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
      setError(getContextualError(err, 'update_settings'));
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
      setError(getContextualError(err, 'delete_order'));
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
        const createdSource = res.data.data || {};
        const newSourceId = createdSource._id || createdSource.source?._id || createdSource.sourceId;
        
        setSuccess('Source ajoutée avec succès ! Lancement de la première synchronisation...');
        setShowAddSheetModal(false);
        setNewSheetData({ name: '', spreadsheetId: '', sheetName: 'Sheet1' });
        await fetchConfig();
        
        // Lancer automatiquement la première synchronisation pour la nouvelle source
        if (newSourceId) {
          setSelectedSourceId(newSourceId);
          setTimeout(() => {
            handleSync(newSourceId);
          }, 1000);
        }
      }
    } catch (err) {
      setError(getContextualError(err, 'update_settings'));
    } finally {
      setSavingSheet(false);
    }
  };

  const fetchCommissions = async (period = commissionPeriod) => {
    if (!isCloseuse) return;
    try {
      setLoadingCommissions(true);
      const res = await ecomApi.get(`/orders/my-commissions?period=${period}`);
      if (res.data.success) setCommissions(res.data.data);
    } catch (err) {
      console.error('Erreur commissions:', err);
    } finally {
      setLoadingCommissions(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (isAdmin || isSuperAdmin) {
        // Config en parallèle avec le quick load
        fetchConfig();
        fetchWhatsAppConfig();
      } else if (isCloseuse) {
        await fetchCloseuseSources();
        fetchCommissions('month');
      }
      await fetchOrders();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => { if (isCloseuse && !loading) fetchCommissions(commissionPeriod); }, [commissionPeriod]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setDebouncedCity(filterCity.trim());
      setDebouncedProduct(filterProduct.trim());
      setDebouncedTag(filterTag.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [search, filterCity, filterProduct, filterTag]);

  useEffect(() => { if (!loading) fetchOrders(false); }, [debouncedSearch, filterStatus, debouncedCity, debouncedProduct, debouncedTag, filterStartDate, filterEndDate, selectedSourceId, page, viewAllWorkspaces, itemsPerPage, sortOrder]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 10000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 5000); return () => clearTimeout(t); } }, [error]);

  // ••• Silent background polling (10s) — no loader, no messages ••••••••••••••
  const lastPollRef = useRef(new Date().toISOString());
  const pollingRef = useRef(false);

  const silentPoll = useCallback(async () => {
    // Ne pas faire de polling si des filtres sont actifs (pour éviter d'écraser les résultats filtrés)
    const hasActiveFilters = debouncedSearch || filterStatus || debouncedCity || debouncedProduct || debouncedTag || filterStartDate || filterEndDate;
    if (hasActiveFilters) return;
    
    if (pollingRef.current || loading) return;
    pollingRef.current = true;
    try {
      const params = {};
      if (selectedSourceId) params.sourceId = selectedSourceId;
      const res = await ecomApi.get('/orders/new-since', { params });
      const { orders: newOrders, count, serverTime } = res.data?.data || {};
      if (serverTime) lastPollRef.current = serverTime;
      if (count > 0 && Array.isArray(newOrders)) {
        console.log(`🔥 [Frontend Poll] ${count} nouvelle(s) commande(s) détectée(s)`);
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
          return Array.from(map.values()).sort((a, b) => (a.sheetRowIndex || 0) - (b.sheetRowIndex || 0));
        });
      }
    } catch (err) { 
      console.error('❌ [Frontend Poll] Erreur polling:', err.message);
      /* silent — never show errors from polling */ 
    }
    pollingRef.current = false;
  }, [loading, selectedSourceId, debouncedSearch, filterStatus, debouncedCity, debouncedProduct, debouncedTag, filterStartDate, filterEndDate]);

  useEffect(() => {
    if (loading) return;
    const id = setInterval(silentPoll, 10000);
    return () => clearInterval(id);
  }, [silentPoll, loading]);

  // ••• WebSocket: Écouter les nouvelles commandes en temps réel •••••••••••••••
  useEffect(() => {
    const handleNewOrderNotification = (event) => {
      const notif = event.detail;
      
      // Vérifier si c'est une notification de nouvelle commande
      if (notif?.type === 'order_new' && notif?.metadata?.orderId) {
        const orderId = notif.metadata.orderId;
        
        // Vérifier si la commande n'est pas déjà dans la liste
        setOrders(prev => {
          const exists = prev.some(o => o._id === orderId);
          if (exists) return prev;
          
          // Récupérer la commande complète depuis l'API
          ecomApi.get(`/orders/${orderId}`)
            .then(res => {
              const newOrder = res.data?.data;
              if (newOrder) {
                console.log('🔥 [WebSocket] Nouvelle commande reçue:', newOrder.orderId);
                
                // Ajouter la commande en haut de la liste
                setOrders(prev => {
                  // Double vérification pour éviter les doublons
                  if (prev.some(o => o._id === newOrder._id)) return prev;
                  
                  // Ajouter en haut de la liste
                  return [newOrder, ...prev];
                });
                
                // Mettre à jour les stats
                setStats(prev => ({
                  ...prev,
                  total: (prev.total || 0) + 1,
                  [newOrder.status]: (prev[newOrder.status] || 0) + 1
                }));
                
                // Afficher un message de succès
                setSuccess(`✅ Nouvelle commande: ${newOrder.clientName || 'Client'} — ${newOrder.product || 'Produit'}`);
                
                // Jouer un son
                playCashRegisterSound();
              }
            })
            .catch(err => {
              console.error('❌ Erreur récupération nouvelle commande:', err);
            });
          
          return prev;
        });
      }
    };
    
    window.addEventListener('ecom:notification', handleNewOrderNotification);
    return () => window.removeEventListener('ecom:notification', handleNewOrderNotification);
  }, []);

  // Fermer le menu à trois points quand on clique ailleurs
  useEffect(() => {
    if (!expandedId) return;
    
    const handleClickOutside = (e) => {
      const menuContainer = e.target.closest('.menu-container');
      if (!menuContainer) {
        console.log('Click outside menu, closing');
        setExpandedId(null);
      }
    };
    
    // Petit délai pour éviter que le clic d'ouverture ne ferme immédiatement le menu
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expandedId]);

  // Fermer le menu d'importation quand on clique ailleurs
  useEffect(() => {
    if (!showImportMenu) return;
    
    const handleClickOutside = (e) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target)) {
        setShowImportMenu(false);
      }
    };
    
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showImportMenu]);

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
        setError(getContextualError(err, 'load_orders'));
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
    } catch (err) { setError(getContextualError(err, 'save_client')); }
    finally { setBackfilling(false); }
  };

  const handleSaveConfig = async () => {
    setConfigLoading(true);
    try {
      await ecomApi.put('/orders/settings', config);
      setSuccess('Configuration sauvegardée');
      setShowConfig(false);
    } catch (err) { setError(getContextualError(err, 'update_settings')); }
    finally { setConfigLoading(false); }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const order = orders.find(o => o._id === orderId);
      const oldStatus = order?.status;
      const oldDeliveryTime = order?.deliveryTime || '';
      const orderRevenue = (order?.price || 0) * (order?.quantity || 1);
      let postponedDate = '';

      if (newStatus === 'postponed') {
        const input = window.prompt('Entrez la date de report (ex: 28/02/2026 14:00)', oldDeliveryTime || '');
        if (!input || !input.trim()) {
          setError('Date de report requise pour le statut Reporté');
          return;
        }
        postponedDate = input.trim();
      }
      
      // 1. Update UI INSTANTLY (optimistic update)
      setOrders(prev => {
        const map = new Map(prev.map(o => [o._id, o]));
        let changed = false;
        let newCount = 0;
        let updatedCount = 0;
        for (const o of prev) {
          if (o._id === orderId) {
            map.set(o._id, {
              ...o,
              status: newStatus,
              ...(newStatus === 'postponed' ? { deliveryTime: postponedDate } : {})
            });
            changed = true;
            if (oldStatus !== newStatus) {
              if (newStatus === 'delivered') {
                newCount++;
              } else if (oldStatus === 'delivered') {
                updatedCount++;
              }
            }
          }
        }
        if (changed) {
          console.log(`📈 [Frontend Poll] ${newCount} nouvelles, ${updatedCount} mises à jour`);
        }
        if (!changed) return prev;
        return Array.from(map.values()).sort((a, b) => (a.sheetRowIndex || 0) - (b.sheetRowIndex || 0));
      });
      
      // 2. Update stats INSTANTLY
      setStats(prev => {
        const newStats = { ...prev };
        if (oldStatus && prev[oldStatus] > 0) newStats[oldStatus] = prev[oldStatus] - 1;
        newStats[newStatus] = (prev[newStatus] || 0) + 1;
        if (newStatus === 'delivered' && oldStatus !== 'delivered') {
          newStats.totalRevenue = (prev.totalRevenue || 0) + orderRevenue;
        } else if (oldStatus === 'delivered' && newStatus !== 'delivered') {
          newStats.totalRevenue = (prev.totalRevenue || 0) - orderRevenue;
        }
        return newStats;
      });
      
      // 3. Son de notification (ne doit jamais bloquer l'update statut)
      try {
        if (newStatus === 'delivered') {
          playCashRegisterSound();
        } else if (['confirmed', 'shipped'].includes(newStatus)) {
          playConfirmSound();
        }
      } catch (soundErr) {
        console.warn('⚠️ Erreur audio non bloquante:', soundErr?.message || soundErr);
      }

      // 4. API call en arrière-plan (non bloquant, pas de await)
      const payload = { status: newStatus };
      if (newStatus === 'postponed') {
        payload.deliveryTime = postponedDate;
      }

      ecomApi.put(`/orders/${orderId}`, payload).catch(err => {
        console.error('❌ Erreur modification statut:', err);
        // Rollback en cas d'erreur
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: oldStatus, deliveryTime: oldDeliveryTime } : o));
        setError(getContextualError(err, 'save_order'));
      });
    } catch (err) { 
      console.error('❌ Erreur modification statut:', err);
      setError(getContextualError(err, 'save_order')); 
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
      setError(getContextualError(error, 'save_client'));
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
      setError('Nom client ou téléphone requis');
      return;
    }
    setSavingOrder(true);
    setError('');
    try {
      if (editingOrder) {
        await ecomApi.put(`/orders/${editingOrder._id}`, orderForm);
        setSuccess('Commande modifiée');
      } else {
        await ecomApi.post('/orders', orderForm);
        setSuccess('Commande créée');
      }
      setShowOrderModal(false);
      fetchOrders();
    } catch (err) {
      setError(getContextualError(err, 'save_order'));
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Supprimer cette commande ?')) return;
    setDeletingOrderId(orderId);
    try {
      await ecomApi.delete(`/orders/${orderId}`);
      setSuccess('Commande supprimée');
      fetchOrders();
    } catch (err) {
      setError(getContextualError(err, 'delete_order'));
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

    const textToCopy = `📝 COMMANDE #${orderId}
👥 Client: ${clientName}
📞 Téléphone: ${clientPhone}
📍 Ville: ${city}
🏠 Adresse: ${address}
📦 Produit: ${product}
📝 Quantité: ${quantity}
💸 Prix unitaire: ${fmt(price)}
💸 Total: ${fmt(total)}
📝 Statut: ${status}
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
      setError(getContextualError(err, 'delete_order'));
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
        return /produit|product|article|item|d[éé]signation|libell[éé]/i.test(k);
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
        return /client|customer|nom|name|pr[éé]nom/i.test(k);
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
        return /t[éé]l[éé]phone|phone|contact|mobile/i.test(k);
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
        return /ville|city|localit[éé]/i.test(k);
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

  const statusFilters = useMemo(() => {
    const metaByKey = new Map(STATUS_FILTER_META.map(s => [s.key, s]));
    const knownStatusKeys = new Set(STATUS_FILTER_META.map(s => s.key));
    const statsStatusKeys = Object.keys(stats || {}).filter(k => !['total', 'totalRevenue', 'deliveredRevenue', 'periodRevenue', 'periodLabel'].includes(k));
    const orderStatusKeys = orders.map(o => o.status).filter(Boolean);
    const allStatusKeys = [...new Set([...STATUS_FILTER_META.map(s => s.key), ...statsStatusKeys, ...orderStatusKeys])];

    return allStatusKeys.map((key) => {
      if (metaByKey.has(key)) return metaByKey.get(key);
      return {
        key,
        label: getStatusLabel(key),
        color: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
      };
    }).filter(s => knownStatusKeys.has(s.key) || stats[s.key] || orders.some(o => o.status === s.key));
  }, [orders, stats]);

  const activeFiltersCount = [filterCity, filterProduct, filterTag, filterStartDate, filterEndDate].filter(Boolean).length;

  const quickDatePresets = useMemo(() => {
    const todayDate = new Date();
    const today = toDateInputValue(todayDate);

    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = toDateInputValue(yesterdayDate);

    const last7Date = new Date(todayDate);
    last7Date.setDate(last7Date.getDate() - 6);
    const last7 = toDateInputValue(last7Date);

    const last30Date = new Date(todayDate);
    last30Date.setDate(last30Date.getDate() - 29);
    const last30 = toDateInputValue(last30Date);

    return {
      today: { startDate: today, endDate: today },
      yesterday: { startDate: yesterday, endDate: yesterday },
      last7: { startDate: last7, endDate: today },
      last30: { startDate: last30, endDate: today }
    };
  }, []);

  const activeQuickDatePreset = useMemo(() => {
    if (!filterStartDate || !filterEndDate) return '';
    const entries = Object.entries(quickDatePresets);
    const match = entries.find(([, range]) => range.startDate === filterStartDate && range.endDate === filterEndDate);
    return match?.[0] || '';
  }, [filterStartDate, filterEndDate, quickDatePresets]);

  const applyQuickDatePreset = (presetKey) => {
    const range = quickDatePresets[presetKey];
    if (!range) return;
    setFilterStartDate(range.startDate);
    setFilterEndDate(range.endDate);
    setPage(1);
  };

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
    const counts = { total: baseFiltered.length };
    baseFiltered.forEach((o) => {
      if (!o.status) return;
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    
    return counts;
  }, [filterCity, filterProduct, filterTag, filterStartDate, filterEndDate, search, orders]);

  if (loading) return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-[1400px] mx-auto">
      {/* Skeleton header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="h-7 w-40 bg-gray-200 rounded-lg animate-pulse mb-2"></div>
          <div className="h-4 w-24 bg-gray-100 rounded animate-pulse"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-20 bg-gray-200 rounded-xl animate-pulse"></div>
          <div className="h-9 w-20 bg-gray-200 rounded-xl animate-pulse"></div>
        </div>
      </div>
      {/* Skeleton stats */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-3 border border-gray-100">
            <div className="h-3 w-16 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-6 w-10 bg-gray-200 rounded animate-pulse"></div>
          </div>
        ))}
      </div>
      {/* Skeleton cards */}
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex justify-between mb-3">
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-5 w-20 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="flex gap-3 mb-3">
              <div className="h-4 w-28 bg-gray-100 rounded animate-pulse"></div>
              <div className="h-4 w-20 bg-gray-100 rounded animate-pulse"></div>
              <div className="h-4 w-24 bg-gray-100 rounded animate-pulse"></div>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-50">
              <div className="h-6 w-24 bg-gray-100 rounded animate-pulse"></div>
              <div className="h-6 w-16 bg-gray-100 rounded animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* Source selector removed — import is now handled at /import */

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-[1400px] mx-auto">
      {/* Barre de chargement fluide */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-0.5 bg-emerald-100 overflow-hidden">
          <div className="h-full bg-emerald-600" style={{animation: 'loading-bar 1s ease-in-out infinite', width: '60%'}}></div>
        </div>
      )}
      {success && <div className="mb-3 p-2.5 bg-green-50 text-green-800 rounded-lg text-sm border border-green-200 flex items-center gap-2"><svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>{success}</div>}
      {error && <div className="mb-3 p-2.5 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200 flex items-center gap-2"><svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>{error}</div>}
      
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between mb-3 sm:mb-4 gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
            {selectedSourceId ? sources.find(s => s._id === selectedSourceId)?.name : 'Commandes'}
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {hasActiveFilters ? (
              <>
                {filteredStats.total} commande{filteredStats.total > 1 ? 's' : ''} filtrée{filteredStats.total > 1 ? 's' : ''}
                {filterStatus && <> • <span className="text-emerald-600 font-medium">{getStatusLabel(filterStatus)}</span></>}
                {filterCity && <> • <span className="text-emerald-700 font-medium">{filterCity}</span></>}
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition text-xs font-medium ${
                viewAllWorkspaces
                  ? 'bg-emerald-700 text-white hover:bg-emerald-800'
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
              <button onClick={() => setShowGuide(!showGuide)} className="hidden sm:flex p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition" title="Guide d'utilisation">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </button>
              <button
                onClick={() => setShowWhatsAppConfig(true)}
                className="hidden sm:flex p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition"
                title="Configurer WhatsApp auto"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </button>
              <button
                onClick={openCreateOrder}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-emerald-600 text-white rounded-xl active:scale-95 transition text-[11px] sm:text-xs font-semibold"
                title="Ajouter une commande"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span className="hidden sm:inline">Ajouter</span>
              </button>
              <div className="relative" ref={importMenuRef}>
                <button
                  onClick={() => setShowImportMenu(!showImportMenu)}
                  className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-emerald-600 text-white rounded-xl active:scale-95 transition text-[11px] sm:text-xs font-semibold"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 013 3h10a3 3 0 013-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span className="hidden sm:inline">Importer</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showImportMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                    <button
                      onClick={() => {
                        setShowImportMenu(false);
                        navigate('/ecom/import');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 transition"
                    >
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900">Google Sheets</div>
                        <div className="text-xs text-gray-500">Importer depuis un tableur</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setShowImportMenu(false);
                        navigate('/ecom/integrations/shopify');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 transition"
                    >
                      <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M15.337 2.136c-.012-.012-.025-.012-.037-.024-.012-.013-.025-.013-.037-.025l-.427-.214c-.287-.15-.65-.1-.888.125l-.325.3c-.1.088-.225.163-.35.238-.538-.163-1.15-.238-1.825-.125-1.05.175-2.037.713-2.787 1.525-.537.575-.925 1.275-1.137 2.038-.688.2-1.175.35-1.2.363-.362.112-.375.125-.425.475-.037.262-1.05 8.1-1.05 8.1l10.562 2.025 5.1-1.188S15.35 2.148 15.337 2.136zm-2.7.938c-.175.05-.375.113-.6.175v-.15c0-.525-.075-1-.2-1.438.375.088.65.725.8 1.413zm-1.4-.363c-.125.038-.25.075-.4.125V1.723c0-.45-.088-.875-.238-1.25.538.2.888.863 1.013 1.638-.125.037-.25.075-.375.1zm-.95-1.788c.15.375.225.813.225 1.313v.088c-.4.125-.838.25-1.288.388.25-.963.725-1.438 1.063-1.788zm-.538 10.325l-.875-2.913c.4-.15.913-.325 1.013-.363.125-.037.15.05.15.1 0 .063-.025 1.663-.288 3.176zm3.338-8.738c-.012-.537-.1-1.025-.237-1.45.537.175.875.8 1.05 1.438-.188.062-.513.15-.813.237v-.225z"/></svg>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900">Shopify</div>
                        <div className="text-xs text-gray-500">Importer depuis Shopify</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
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
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 text-white rounded-xl transition text-xs font-semibold"
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
          {/* Sync button for closeuse - only for their assigned sources */}
          {isCloseuse && sources.length > 0 && (
            <button
              onClick={() => handleSync()}
              disabled={syncDisabled}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-orange-600 text-white rounded-xl active:scale-95 transition text-[11px] sm:text-xs font-semibold disabled:opacity-50"
              title="Synchroniser mes sources"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              <span className="hidden sm:inline">Sync</span>
            </button>
          )}
        </div>
      </div>

      {/* Sources */}
      {(isAdmin || isSuperAdmin || (isCloseuse && sources.length > 0)) && (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 shadow-sm p-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Sources ({sources.length})</span>
          </div>

          {/* Information d'adaptation au Google Sheet */}
          {selectedSourceId && sourcesConfig[selectedSourceId] && (
            <div className="mb-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-2 text-xs">
                <svg className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span className="text-emerald-700 font-medium">
                  Affichage adapté à : {sourcesConfig[selectedSourceId].name}
                </span>
                {sourcesConfig[selectedSourceId].detectedHeaders.length > 0 && (
                  <span className="text-emerald-600">
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
                  ? 'bg-emerald-600 text-white shadow-sm'
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
                      ? 'bg-emerald-600 text-white shadow-sm'
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
                {(isAdmin || isSuperAdmin) && (
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
                )}
              </div>
            ))}
            {sources.length === 0 && (
              <p className="text-xs text-gray-400 italic py-1">
                {isCloseuse ? 'Aucune source assignée. Contactez votre administrateur.' : 'Aucune source configurée. Cliquez sur "Importer" pour ajouter des commandes.'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Barre de filtres compacte */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-3">
        {/* En-tête des filtres */}
        <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-gray-900">Filtres</h3>
              <p className="text-[11px] text-gray-500">
                {hasActiveFilters ? (
                  <>
                    <span className="font-semibold text-emerald-600">{filteredStats.total}</span> / {stats.total || 0}
                  </>
                ) : (
                  <>{stats.total || 0} commandes</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Sélecteur d'ordre */}
              <select 
                value={sortOrder} 
                onChange={(e) => { setSortOrder(e.target.value); setPage(1); }}
                className="text-[10px] border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                title="Ordre d'affichage"
              >
                <option value="newest_first">Plus récentes</option>
                <option value="oldest_first">Plus anciennes</option>
              </select>
              {activeFiltersCount > 0 && (
                <button onClick={clearAllFilters} className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[10px] font-semibold transition-all">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  Réinitialiser
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Chips de filtres actifs */}
        {activeFiltersCount > 0 && (
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <div className="flex flex-wrap gap-1.5">
              {filterStatus && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-semibold border border-emerald-200">
                  {getStatusLabel(filterStatus)}
                  <button onClick={() => { setFilterStatus(''); setPage(1); }} className="hover:text-emerald-900">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              {filterCity && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-semibold border border-emerald-200">
                  {filterCity}
                  <button onClick={() => { setFilterCity(''); setPage(1); }} className="hover:text-emerald-900">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              {filterProduct && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-semibold border border-green-200">
                  {filterProduct}
                  <button onClick={() => { setFilterProduct(''); setPage(1); }} className="hover:text-green-900">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              {filterStartDate && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-semibold border border-orange-200">
                  {filterStartDate}
                  <button onClick={() => { setFilterStartDate(''); setPage(1); }} className="hover:text-orange-900">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              {filterEndDate && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-semibold border border-orange-200">
                  {filterEndDate}
                  <button onClick={() => { setFilterEndDate(''); setPage(1); }} className="hover:text-orange-900">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              {search && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-[10px] font-semibold border border-gray-300">
                  {search}
                  <button onClick={() => { setSearch(''); setPage(1); }} className="hover:text-gray-900">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contenu des filtres */}
        <div className="p-3">
          <div className="mb-2">
            <div className="relative">
              <svg className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input 
                type="text" 
                placeholder="Rechercher..." 
                value={search} 
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-4 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-transparent"
              />
              {search && (
                <button 
                  onClick={() => { setSearch(''); setPage(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>

          <div className="mb-2">
            <div className="flex flex-wrap gap-1">
          <button onClick={() => { setFilterStatus(''); setPage(1); }} className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${!filterStatus ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Tous ({(filterCity || filterProduct || filterTag || filterStartDate || filterEndDate || search) ? dynamicFilterCounts.total : stats.total || 0})
          </button>
              {statusFilters.map(s => (
                <button key={s.key} onClick={() => { setFilterStatus(filterStatus === s.key ? '' : s.key); setPage(1); }}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${filterStatus === s.key ? 'ring-1 ring-gray-400 ' : ''}${s.color}`}>
                  {s.label} ({(filterCity || filterProduct || filterTag || filterStartDate || filterEndDate || search) ? dynamicFilterCounts[s.key] || 0 : stats[s.key] || 0})
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-2">Période rapide</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'today', label: "Aujourd'hui" },
                { key: 'yesterday', label: 'Hier' },
                { key: 'last7', label: '7 derniers jours' },
                { key: 'last30', label: '30 derniers jours' }
              ].map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => applyQuickDatePreset(preset.key)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                    activeQuickDatePreset === preset.key
                      ? 'bg-orange-100 text-orange-800 border-orange-300'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={() => setShowFilters(!showFilters)} 
            className={`w-full px-3 py-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all ${showFilters ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v2m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            {showFilters ? 'Masquer avancés' : 'Filtres avancés'}
          </button>

          {/* Advanced filters panel */}
          {showFilters && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                <div>
                  <label className="block text-[9px] font-medium text-gray-500 mb-0.5">Début</label>
                  <input type="date" value={filterStartDate} onChange={e => { setFilterStartDate(e.target.value); setPage(1); }} className="w-full px-2 py-1 border border-gray-200 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-[9px] font-medium text-gray-500 mb-0.5">Fin</label>
                  <input type="date" value={filterEndDate} onChange={e => { setFilterEndDate(e.target.value); setPage(1); }} className="w-full px-2 py-1 border border-gray-200 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-[9px] font-medium text-gray-500 mb-0.5">Ville</label>
                  <select value={filterCity} onChange={e => { setFilterCity(e.target.value); setPage(1); }} className="w-full px-2 py-1 border border-gray-200 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-transparent">
                    <option value="">Toutes les villes</option>
                    {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-medium text-gray-500 mb-0.5">Produit</label>
                  <select value={filterProduct} onChange={e => { setFilterProduct(e.target.value); setPage(1); }} className="w-full px-2 py-1 border border-gray-200 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-transparent">
                    <option value="">Tous</option>
                    {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-medium text-gray-500 mb-0.5">Tag</label>
                  <select value={filterTag} onChange={e => { setFilterTag(e.target.value); setPage(1); }} className="w-full px-2 py-1 border border-gray-200 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-transparent">
                    <option value="">Tous</option>
                    {uniqueTags.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {activeFiltersCount > 0 && (
                <div className="flex items-center justify-between mt-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {filterStartDate && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-medium">{filterStartDate} <button onClick={() => { setFilterStartDate(''); setPage(1); }} className="hover:text-emerald-900">&times;</button></span>}
                    {filterEndDate && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-medium">{filterEndDate} <button onClick={() => { setFilterEndDate(''); setPage(1); }} className="hover:text-emerald-900">&times;</button></span>}
                    {filterCity && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-full text-[10px] font-medium">{filterCity} <button onClick={() => { setFilterCity(''); setPage(1); }} className="hover:text-emerald-900">&times;</button></span>}
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

      {/* Guide visuel */}
      {showGuide && isAdmin && (
        <div className="mb-4 bg-gradient-to-br from-emerald-50 via-emerald-50 to-emerald-50 border border-emerald-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 bg-white/60 border-b border-emerald-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Comment importer et retrouver vos commandes</h3>
                <p className="text-[11px] text-gray-500">Suivez ces 3 étapes simples</p>
              </div>
            </div>
            <button onClick={() => { setShowGuide(false); localStorage.setItem('ecom_guide_dismissed', '1'); }} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-white/80 rounded-lg transition" title="Fermer le guide">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Etape 1 */}
              <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <h4 className="text-sm font-semibold text-gray-900">Importer</h4>
                </div>
                <div className="flex items-center gap-2 mb-3 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                  <svg className="w-6 h-6 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>
                  <span className="text-xs text-emerald-700 font-medium">Cliquez sur le bouton bleu "Importer" en haut à droite</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">Collez le lien de votre Google Sheet ou sélectionnez une source configurée, puis lancez l'import.</p>
                <button onClick={() => navigate('/ecom/import')} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-xs font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 013 3h10a3 3 0 013-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Aller à la page d'import
                </button>
              </div>

              {/* Etape 2 */}
              <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 bg-emerald-700 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <h4 className="text-sm font-semibold text-gray-900">Retrouver</h4>
                </div>
                <div className="flex items-center gap-2 mb-3 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                  <svg className="w-6 h-6 text-emerald-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                  <span className="text-xs text-emerald-800 font-medium">Filtrez par source avec le menu déroulant</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">Après l'import, vos commandes apparaissent ici. Utilisez le <strong>menu déroulant des sources</strong> (en haut) pour filtrer par Google Sheet.</p>
                <div className="mt-3 flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  <span className="text-[11px] text-gray-500">Toutes les sources</span>
                  <svg className="w-3 h-3 text-gray-300 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>

              {/* Etape 3 */}
              <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 bg-emerald-700 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <h4 className="text-sm font-semibold text-gray-900">Filtrer & Chercher</h4>
                </div>
                <div className="flex items-center gap-2 mb-3 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                  <svg className="w-6 h-6 text-emerald-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <span className="text-xs text-emerald-800 font-medium">Utilisez les filtres et la recherche</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">Filtrez par <strong>statut</strong> (pastilles colorées), cherchez par <strong>nom, téléphone, ville</strong>, ou utilisez les <strong>filtres avancés</strong> (dates, produit, tag).</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {['Tous', 'En attente', 'Confirmé', 'Livré'].map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">{s}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-[11px] text-gray-400">Ce guide s'affiche une seule fois. Cliquez sur <strong>?</strong> en haut pour le revoir.</p>
              <button onClick={() => { setShowGuide(false); localStorage.setItem('ecom_guide_dismissed', '1'); }} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                J'ai compris, fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards - Design compact */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200 p-3">
          <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide mb-1">Revenu livré</p>
          <p className="text-xl font-extrabold text-gray-900 mb-1">{fmt(filteredStats.deliveredRevenue || 0) || '0 FCFA'}</p>
          <p className="text-[10px] text-green-600 font-semibold">{filteredStats.delivered || 0} livrés · +{Math.round((filteredStats.delivered || 0) / (filteredStats.total || 1) * 100)}%</p>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-50 rounded-lg border border-emerald-200 p-3">
          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">Taux livraison</p>
          <p className="text-xl font-extrabold text-gray-900 mb-1.5">{deliveryRate}%</p>
          <div className="w-full bg-emerald-100 rounded-full h-1.5">
            <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${Math.min(deliveryRate, 100)}%` }}></div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-200 p-3">
          <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wide mb-1">Taux retour</p>
          <p className="text-xl font-extrabold text-gray-900 mb-1.5">{returnRate}%</p>
          <div className="w-full bg-orange-100 rounded-full h-1.5">
            <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${Math.min(returnRate, 100)}%` }}></div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-50 rounded-lg border border-emerald-200 p-3">
          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide mb-1">En cours</p>
          <p className="text-xl font-extrabold text-gray-900 mb-1">{filteredStats.delivered || 0}</p>
          <p className="text-[10px] text-gray-600">{filteredStats.delivered || 0} livrées · {(filteredStats.pending || 0) + (filteredStats.confirmed || 0) + (filteredStats.shipped || 0)} en cours</p>
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
              : isAdmin ? <>Importez vos commandes depuis la page <a href="/ecom/import" className="text-emerald-600 hover:underline">Import</a></> : 'Aucune commande disponible.'
            }
          </p>
        </div>
      ) : (
        <>
          {/* Vue liste épurée — Desktop */}
          <div className="hidden md:block space-y-2">
            {orders.map((o) => {
              const clientName = getClientName(o);
              const clientPhone = getClientPhone(o);
              const city = getCity(o);
              const productName = getProductName(o);
              const totalPrice = (o.price || 0) * (o.quantity || 1);

              return (
                <div key={o._id} className="bg-white rounded-xl border border-gray-200 hover:border-emerald-400 hover:shadow-md transition-all duration-200 cursor-pointer group" onClick={() => navigate(`/ecom/orders/${o._id}`)}>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-4">
                      {/* Client Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                          {clientName ? clientName.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-gray-900 truncate">{clientName || 'Sans nom'}</h3>
                          <div className="flex items-center gap-2 text-xs">
                            {clientPhone && (
                              <span className="text-gray-600 font-mono">{clientPhone}</span>
                            )}
                            {city && (
                              <span className="text-gray-500">• {city}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Product */}
                      {productName && (
                        <div className="flex-shrink-0 max-w-[160px] hidden sm:block">
                          <p className="text-xs text-gray-500 text-right truncate">{productName}</p>
                          {o.quantity > 1 && (
                            <p className="text-[10px] text-gray-400 text-right">Qté : {o.quantity}</p>
                          )}
                        </div>
                      )}

                      {/* Price */}
                      {totalPrice > 0 && (
                        <div className="flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900">{fmt(totalPrice)}</p>
                        </div>
                      )}

                      {/* Status */}
                      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <select 
                          value={o.status} 
                          onChange={(e) => { 
                            if (e.target.value === '__custom') { 
                              const c = prompt('Entrez le statut personnalisé'); 
                              if (c && c.trim()) handleStatusChange(o._id, c.trim()); 
                            } else handleStatusChange(o._id, e.target.value); 
                          }}
                          className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold border cursor-pointer focus:ring-2 focus:ring-emerald-600 focus:outline-none transition-all ${getStatusColor(o.status)}`}
                        >
                          {Object.entries(SL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          {!SL[o.status] && <option value={o.status}>{o.status}</option>}
                          <option value="__custom">+ Personnalisé...</option>
                        </select>
                      </div>

                      {/* Copy Button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopyOrder(o); }}
                        className="flex-shrink-0 w-8 h-8 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all hover:scale-110 flex items-center justify-center"
                        title="Copier la commande"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vue cartes — Mobile */}
          <div className="md:hidden space-y-3">
            {orders.map(o => {
              const clientName = getClientName(o);
              const clientPhone = getClientPhone(o);
              const city = getCity(o);
              const productName = getProductName(o);
              const totalPrice = (o.price || 0) * (o.quantity || 1);

              return (
                <div key={o._id} className="bg-white rounded-xl border border-gray-200 hover:border-emerald-400 hover:shadow-md transition-all" onClick={() => navigate(`/ecom/orders/${o._id}`)}>
                  <div className="p-2.5">
                    {/* En-tête: Nom + Prix */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-md flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {clientName ? clientName.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-gray-900 truncate">{clientName || 'Sans nom'}</h3>
                        </div>
                      </div>
                      {totalPrice > 0 && (
                        <p className="text-sm font-bold text-gray-900 ml-2 flex-shrink-0">{fmt(totalPrice)}</p>
                      )}
                    </div>

                    {/* Infos essentielles */}
                    <div className="mb-2 space-y-1">
                      {clientPhone && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                          <span className="text-xs text-gray-700 font-mono">{clientPhone}</span>
                        </div>
                      )}
                      {city && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                          <span className="text-xs text-gray-600">{city}</span>
                        </div>
                      )}
                      {productName && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                          <span className="text-xs text-gray-600 truncate">{productName}</span>
                          {o.quantity > 1 && <span className="text-[10px] text-gray-500">×{o.quantity}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="border-t border-gray-100 px-2.5 py-2 flex items-center justify-between bg-gray-50/50" onClick={(e) => e.stopPropagation()}>
                    <select 
                      value={o.status} 
                      onChange={(e) => { 
                        e.stopPropagation(); 
                        if (e.target.value === '__custom') { 
                          const c = prompt('Entrez le statut personnalisé :'); 
                          if (c && c.trim()) handleStatusChange(o._id, c.trim()); 
                        } else handleStatusChange(o._id, e.target.value); 
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={`text-[9px] font-medium px-1.5 py-0.5 rounded border cursor-pointer focus:ring-2 focus:ring-emerald-600 focus:outline-none ${getStatusColor(o.status)}`}
                    >
                      {Object.entries(SL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      {!SL[o.status] && <option value={o.status}>{o.status}</option>}
                      <option value="__custom">+ Personnalisé...</option>
                    </select>
                    <div className="flex items-center gap-1.5">
                      {/* Bouton principal */}
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/ecom/orders/${o._id}`); }} className="px-2.5 py-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition">
                        Voir
                      </button>
                      {/* Menu ⋯ */}
                      <div className="relative menu-container">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            console.log('Menu clicked, current expandedId:', expandedId, 'order id:', o._id);
                            setExpandedId(expandedId === o._id ? null : o._id);
                          }} 
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                        </button>
                        {expandedId === o._id && (
                          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-300 py-1 min-w-[160px]" style={{zIndex: 9999}} onClick={(e) => e.stopPropagation()}>
                            {isAdmin && (
                              <button onClick={(e) => { e.stopPropagation(); handleCopyOrder(o); setExpandedId(null); }} className="w-full px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                Copier
                              </button>
                            )}
                            {isAdmin && (
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(o._id); setExpandedId(null); }} disabled={deletingOrderId === o._id} className="w-full px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                Supprimer
                              </button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(o.clientPhone || ''); setExpandedId(null); }} className="w-full px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                              Copier téléphone
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
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
              className="text-[11px] px-2 py-1 border border-gray-200 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
              <div className="bg-emerald-50 rounded-lg p-3">
                <p className="text-xs font-medium text-emerald-700 mb-2">Configuration WhatsApp</p>
                <p className="text-xs text-emerald-600">Configurez les numéros WhatsApp pour recevoir automatiquement les notifications de nouvelles commandes.</p>
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
                    placeholder="Nom complet" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Telephone *</label>
                  <input type="text" value={orderForm.clientPhone} onChange={e => setOrderForm({...orderForm, clientPhone: e.target.value})}
                    placeholder="06..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ville</label>
                  <input type="text" value={orderForm.city} onChange={e => setOrderForm({...orderForm, city: e.target.value})}
                    placeholder="Ville" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Adresse</label>
                  <input type="text" value={orderForm.address} onChange={e => setOrderForm({...orderForm, address: e.target.value})}
                    placeholder="Adresse de livraison" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Produit</label>
                <input type="text" value={orderForm.product} onChange={e => setOrderForm({...orderForm, product: e.target.value})}
                  placeholder="Nom du produit" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prix</label>
                  <input type="number" value={orderForm.price} onChange={e => setOrderForm({...orderForm, price: parseFloat(e.target.value) || 0})}
                    min="0" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantite</label>
                  <input type="number" value={orderForm.quantity} onChange={e => setOrderForm({...orderForm, quantity: parseInt(e.target.value) || 1})}
                    min="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
                  <select value={orderForm.status} onChange={e => { if (e.target.value === '__custom') { const c = prompt('Entrez le statut personnalisé :'); if (c && c.trim()) setOrderForm({...orderForm, status: c.trim()}); } else setOrderForm({...orderForm, status: e.target.value}); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600">
                    {Object.entries(SL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    {!SL[orderForm.status] && <option value={orderForm.status}>{orderForm.status}</option>}
                    <option value="__custom">+ Personnalisé...</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={orderForm.notes} onChange={e => setOrderForm({...orderForm, notes: e.target.value})}
                  rows={2} placeholder="Notes, remarques..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 resize-none" />
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex gap-3">
              <button onClick={() => setShowOrderModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">
                Annuler
              </button>
              <button onClick={handleSaveOrder} disabled={savingOrder}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2">
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
              {/* Toggle confirmation WhatsApp au client */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">Confirmation WhatsApp au client</p>
                    <p className="text-xs text-blue-600 mt-0.5">Envoyer automatiquement un message de confirmation au client après chaque commande Shopify</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWhatsappAutoConfirm(!whatsappAutoConfirm)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      whatsappAutoConfirm ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      whatsappAutoConfirm ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

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
                  className="mt-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-xs"
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
                              number.autoNotifyOrders ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {number.autoNotifyOrders ? 'Auto' : 'Manuel'}
                            </span>
                            <button
                              onClick={() => testWhatsAppNumber(number.country)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
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

              <div className="bg-emerald-50 rounded-lg p-3">
                <p className="text-xs font-medium text-emerald-700 mb-2">Ce qui sera envoyé automatiquement :</p>
                <ul className="text-xs text-emerald-600 space-y-1">
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
              Sélectionnez les statuts de commandes ù  synchroniser :
            </p>
            
            <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
              {[
                { key: 'delivered', label: 'Livré', color: 'bg-green-500' },
                { key: 'confirmed', label: 'Confirmé', color: 'bg-emerald-600' },
                { key: 'shipped', label: 'Expédié', color: 'bg-emerald-600' },
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
