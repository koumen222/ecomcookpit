import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { usePlanGate } from '../contexts/PlanGateContext.jsx';
import { useMoney } from '../hooks/useMoney.js';
import { formatMoney } from '../utils/currency.js';
import { conversionRates } from '../contexts/CurrencyContext.jsx';
import ecomApi from '../services/ecommApi.js';
import { playCashRegisterSound, playConfirmSound } from '../services/soundService.js';
import { getContextualError } from '../utils/errorMessages';
// ❌ CACHE DÉSACTIVÉ
// import { getCache, setCache, invalidatePrefix } from '../utils/cacheUtils.js';

const SL = { pending: 'En attente', confirmed: 'Confirmé', shipped: 'Expédié', delivered: 'Livré', returned: 'Retour', cancelled: 'Annulé', unreachable: 'Injoignable', called: 'Appelé', postponed: 'Reporté', reported: 'Reporté' };
const SC = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  confirmed: 'bg-primary-50 text-primary-700 border-primary-100',
  shipped: 'bg-primary-50 text-primary-800 border-primary-100',
  delivered: 'bg-green-50 text-green-700 border-green-100',
  returned: 'bg-orange-50 text-orange-700 border-orange-100',
  cancelled: 'bg-red-50 text-red-700 border-red-100',
  unreachable: 'bg-gray-50 text-gray-700 border-gray-200',
  called: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  postponed: 'bg-amber-50 text-amber-700 border-amber-100',
  reported: 'bg-purple-50 text-purple-700 border-purple-100'
};
const STATUS_FILTER_META = [
  { key: 'pending', label: 'En attente', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200' },
  { key: 'confirmed', label: 'Confirmé', color: 'bg-primary-100 text-primary-700 hover:bg-primary-200 border border-primary-200' },
  { key: 'shipped', label: 'Expédié', color: 'bg-primary-100 text-primary-800 hover:bg-primary-200 border border-primary-200' },
  { key: 'delivered', label: 'Livré', color: 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200' },
  { key: 'returned', label: 'Retour', color: 'bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-200' },
  { key: 'cancelled', label: 'Annulé', color: 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200' },
  { key: 'unreachable', label: 'Injoignable', color: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300' },
  { key: 'called', label: 'Appelé', color: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200 border border-cyan-200' },
  { key: 'postponed', label: 'Reporté', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200' },
  { key: 'reported', label: 'Reporté', color: 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200' }
];
const SD = {
  pending: '', confirmed: '', shipped: '',
  delivered: '', returned: '', cancelled: '',
  unreachable: '', called: '', postponed: '', reported: ''
};
const getStatusLabel = (s) => SL[s] || s;
const getStatusColor = (s) => SC[s] || 'bg-primary-100 text-primary-900 border-primary-200';
const getStatusDot = (s) => SD[s] || 'border-l-primary-500';

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

const SCROLL_STORAGE_KEY = 'orders_list_scroll';
const FILTERS_STORAGE_KEY = 'orders_list_filters';
const LIST_STATE_STORAGE_KEY = 'orders_list_state';
const LIST_STATE_MAX_AGE_MS = 30 * 60 * 1000;

const OrdersList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, workspace } = useEcomAuth();
  const { planInfo } = usePlanGate();
  const { fmt, fmtRaw, symbol, currency: userCurrency } = useMoney();
  // Affiche le montant dans la devise de la commande (pas de conversion, juste le bon symbole)
  const fmtOrder = (amount, orderCurrency) => formatMoney(amount, orderCurrency || userCurrency || 'XAF');
  const isAdmin = user?.role === 'ecom_admin';
  const isSuperAdmin = user?.role === 'super_admin';
  const isCloseuse = user?.role === 'ecom_closeuse';
  const listContainerRef = useRef(null);

  const savedListState = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(LIST_STATE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const isFresh = parsed?.savedAt && Date.now() - parsed.savedAt < LIST_STATE_MAX_AGE_MS;
      if (!isFresh) {
        sessionStorage.removeItem(LIST_STATE_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      sessionStorage.removeItem(LIST_STATE_STORAGE_KEY);
      return null;
    }
  }, []);

  const hasRestoredListState = Boolean(savedListState);
  const restoredOrders = Array.isArray(savedListState?.orders) ? savedListState.orders : [];
  const shouldRestoreScroll = useRef(hasRestoredListState);
  const skipNextOrdersFetch = useRef(hasRestoredListState);

  // Restore saved filters from sessionStorage (when coming back from detail)
  const savedFilters = useMemo(() => {
    if (savedListState?.filters) return savedListState.filters;
    try {
      const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }, [savedListState]);

  const [orders, setOrders] = useState(() => restoredOrders);
  const [stats, setStats] = useState(() => savedListState?.stats || {});
  const [loading, setLoading] = useState(() => !hasRestoredListState);
  const [refreshing, setRefreshing] = useState(false);
  const [syncClients, setSyncClients] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncDisabled, setSyncDisabled] = useState(false);
  const [syncController, setSyncController] = useState(null);
  const [backfilling, setBackfilling] = useState(false);
  const [showSyncClientsModal, setShowSyncClientsModal] = useState(false);
  const [syncClientsStatuses, setSyncClientsStatuses] = useState(['delivered', 'confirmed', 'pending', 'shipped']);
  const [search, setSearch] = useState(savedFilters?.search || '');
  const [filterStatus, setFilterStatus] = useState(savedFilters?.filterStatus || '');
  const [filterCity, setFilterCity] = useState(savedFilters?.filterCity || '');
  const [filterProduct, setFilterProduct] = useState(savedFilters?.filterProduct || '');
  const [filterTag, setFilterTag] = useState(savedFilters?.filterTag || '');
  const [filterStartDate, setFilterStartDate] = useState(savedFilters?.filterStartDate || '');
  const [filterEndDate, setFilterEndDate] = useState(savedFilters?.filterEndDate || '');
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({ spreadsheetId: '', sheetName: 'Sheet1' });
  const [configLoading, setConfigLoading] = useState(false);
  const [sources, setSources] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState(savedFilters?.selectedSourceId || '');
  const [sourcesConfig, setSourcesConfig] = useState({});
  const [lastSyncs, setLastSyncs] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(savedFilters?.page || 1);
  const [pagination, setPagination] = useState(() => savedListState?.pagination || {});
  const [itemsPerPage, setItemsPerPage] = useState(savedFilters?.itemsPerPage || 100);
  const [sortOrder, setSortOrder] = useState(savedFilters?.sortOrder || 'newest_first'); // 'newest_first' | 'oldest_first'
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
  // Notifications closeuse + groupes livraison
  const [closeuseNotifNumbers, setCloseuseNotifNumbers] = useState([]);
  const [deliveryGroupNumbers, setDeliveryGroupNumbers] = useState([]);
  const [savingNotifConfig, setSavingNotifConfig] = useState(false);
  const [testingNotifConfig, setTestingNotifConfig] = useState(false);
  const [testNotifResult, setTestNotifResult] = useState(null);
  const [deletingSource, setDeletingSource] = useState(null);
  // Auto WhatsApp config modal
  const [showAutoConfigModal, setShowAutoConfigModal] = useState(false);
  const [whatsappInstances, setWhatsappInstances] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [autoConfig, setAutoConfig] = useState({
    instanceId: '',
    imageUrl: '',
    audioUrl: '',
    template: '',
    productRules: []  // [{productKeyword, instanceId, template, imageUrl, audioUrl}]
  });
  const [savingAutoConfig, setSavingAutoConfig] = useState(false);
  const [uploadingAutoImage, setUploadingAutoImage] = useState(false);
  const [uploadingAutoAudio, setUploadingAutoAudio] = useState(false);
  const [uploadingRuleMedia, setUploadingRuleMedia] = useState({});
  const [testAutoPhone, setTestAutoPhone] = useState('');
  const [testAutoProduct, setTestAutoProduct] = useState('');
  const [testingAuto, setTestingAuto] = useState(false);
  const [testAutoResult, setTestAutoResult] = useState(null);
  const [dbConfig, setDbConfig] = useState(null);
  const [loadingDbConfig, setLoadingDbConfig] = useState(false);
  const [showAddSheetModal, setShowAddSheetModal] = useState(false);
  const [newSheetData, setNewSheetData] = useState({ name: '', spreadsheetId: '', sheetName: 'Sheet1' });
  const [savingSheet, setSavingSheet] = useState(false);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderForm, setOrderForm] = useState({ clientName: '', clientPhone: '', city: '', address: '', product: '', productId: '', quantity: 1, price: 0, status: 'pending', notes: '' });
  const [savingOrder, setSavingOrder] = useState(false);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [viewAllWorkspaces, setViewAllWorkspaces] = useState(Boolean(savedFilters?.viewAllWorkspaces));
  const [commissions, setCommissions] = useState(null);
  const [commissionPeriod, setCommissionPeriod] = useState('month');
  const [showImportMenu, setShowImportMenu] = useState(false);
  const importMenuRef = useRef(null);
  const [loadingCommissions, setLoadingCommissions] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState((savedFilters?.search || '').trim());
  const [debouncedCity, setDebouncedCity] = useState((savedFilters?.filterCity || '').trim());
  const [debouncedProduct, setDebouncedProduct] = useState((savedFilters?.filterProduct || '').trim());
  const [debouncedTag, setDebouncedTag] = useState((savedFilters?.filterTag || '').trim());

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

  // Format postponed/reported date for list display
  const fmtPostponedDate = (deliveryTime) => {
    if (!deliveryTime) return '';
    // deliveryTime can be a raw string from user input (e.g. "28/02/2026 14:00") or an ISO date
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Try to parse the date
    let parsed = null;
    // Try ISO format first
    const isoDate = new Date(deliveryTime);
    if (!isNaN(isoDate.getTime())) {
      parsed = isoDate;
    } else {
      // Try DD/MM/YYYY or DD/MM/YYYY HH:mm
      const match = deliveryTime.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\s*(\d{1,2}:\d{2})?/);
      if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const year = match[3].length === 2 ? 2000 + parseInt(match[3], 10) : parseInt(match[3], 10);
        parsed = new Date(year, month, day);
        if (match[4]) {
          const [h, m] = match[4].split(':');
          parsed.setHours(parseInt(h, 10), parseInt(m, 10));
        }
      }
    }

    if (parsed && !isNaN(parsed.getTime())) {
      const parsedDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      if (parsedDay.getTime() === today.getTime()) return "Aujourd'hui";
      if (parsedDay.getTime() === tomorrow.getTime()) return 'Demain';
      if (parsedDay < today) return 'Dépassé';
      return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    }
    // Fallback: return raw string trimmed
    return deliveryTime.length > 16 ? deliveryTime.slice(0, 16) + '…' : deliveryTime;
  };

  const getPostponedBadgeColor = (deliveryTime) => {
    if (!deliveryTime) return 'bg-amber-50 text-amber-700 border-amber-200';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    let parsed = null;
    const isoDate = new Date(deliveryTime);
    if (!isNaN(isoDate.getTime())) {
      parsed = isoDate;
    } else {
      const match = deliveryTime.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
      if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const year = match[3].length === 2 ? 2000 + parseInt(match[3], 10) : parseInt(match[3], 10);
        parsed = new Date(year, month, day);
      }
    }
    if (parsed && !isNaN(parsed.getTime())) {
      const parsedDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      if (parsedDay < today) return 'bg-red-50 text-red-700 border-red-300';
      if (parsedDay.getTime() === today.getTime()) return 'bg-primary-50 text-primary-700 border-primary-300';
      if (parsedDay.getTime() === tomorrow.getTime()) return 'bg-blue-50 text-blue-700 border-blue-300';
    }
    return 'bg-amber-50 text-amber-700 border-amber-200';
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

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      // Utiliser /stock/products pour avoir le stock calculé depuis StockLocation
      const res = await ecomApi.get('/stock/products', { params: { isActive: true } });
      setAvailableProducts(res.data?.data || []);
    } catch (err) {
      console.error('Erreur chargement produits:', err);
      setAvailableProducts([]);
    } finally {
      setLoadingProducts(false);
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
      setCloseuseNotifNumbers(res.data.data.closeuseNotifNumbers || []);
      setDeliveryGroupNumbers(res.data.data.deliveryGroupNumbers || []);
      setAutoConfig({
        instanceId: res.data.data.whatsappAutoInstanceId || '',
        imageUrl: res.data.data.whatsappAutoImageUrl || '',
        audioUrl: res.data.data.whatsappAutoAudioUrl || '',
        template: res.data.data.whatsappOrderTemplate || '',
        productRules: res.data.data.whatsappAutoProductMediaRules || []
      });
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

  const toggleWhatsAppAuto = async () => {
    if (!whatsappAutoConfirm) {
      // Ouvrir le modal de configuration pour activer
      openAutoConfigModal();
      return;
    }
    // Désactiver directement
    setWhatsappAutoConfirm(false);
    try {
      const res = await ecomApi.patch('/orders/config/whatsapp-auto', { whatsappAutoConfirm: false });
      if (res.data.success) {
        setSuccess(res.data.message);
      }
    } catch (err) {
      setWhatsappAutoConfirm(true);
      setError(getContextualError(err, 'update_settings'));
    }
  };

  const openAutoConfigModal = async () => {
    setShowAutoConfigModal(true);
    setLoadingInstances(true);
    try {
      const res = await ecomApi.get('/orders/whatsapp-instances');
      setWhatsappInstances(res.data.data || []);
    } catch (err) {
      console.error('Erreur chargement instances:', err);
      setWhatsappInstances([]);
    } finally {
      setLoadingInstances(false);
    }
  };

  const handleAutoImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAutoImage(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await ecomApi.post('/v1/external/whatsapp/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data.url) {
        setAutoConfig(prev => ({ ...prev, imageUrl: data.url }));
        setSuccess('Image uploadée');
      }
    } catch (err) {
      setError('Erreur upload image');
    } finally {
      setUploadingAutoImage(false);
    }
  };

  const handleAutoAudioUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAutoAudio(true);
    try {
      const fd = new FormData();
      fd.append('image', file); // Le endpoint accepte 'image' pour tout fichier
      const { data } = await ecomApi.post('/v1/external/whatsapp/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data.url) {
        setAutoConfig(prev => ({ ...prev, audioUrl: data.url }));
        setSuccess('Vocal uploadé');
      }
    } catch (err) {
      setError('Erreur upload vocal');
    } finally {
      setUploadingAutoAudio(false);
    }
  };

  const handleRuleMediaUpload = async (ridx, field, file) => {
    if (!file) return;
    setUploadingRuleMedia(prev => ({ ...prev, [`${ridx}_${field}`]: true }));
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await ecomApi.post('/v1/external/whatsapp/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data.url) {
        setAutoConfig(prev => ({ ...prev, productRules: prev.productRules.map((r, i) => i === ridx ? { ...r, [field]: data.url } : r) }));
      }
    } catch {
      setError('Erreur upload');
    } finally {
      setUploadingRuleMedia(prev => ({ ...prev, [`${ridx}_${field}`]: false }));
    }
  };

  const testAutoConfig = async () => {
    if (!testAutoPhone.trim()) return;
    setTestingAuto(true);
    setTestAutoResult(null);
    try {
      const res = await ecomApi.post('/orders/config/whatsapp-auto/test', {
        phoneNumber: testAutoPhone.trim(),
        productKeyword: testAutoProduct.trim() || undefined
      });
      setTestAutoResult(res.data);
    } catch (err) {
      setTestAutoResult({ success: false, message: err.response?.data?.message || 'Erreur' });
    } finally {
      setTestingAuto(false);
    }
  };

  const saveAutoConfig = async () => {
    setSavingAutoConfig(true);
    try {
      const res = await ecomApi.patch('/orders/config/whatsapp-auto', {
        whatsappAutoConfirm: true,
        whatsappAutoInstanceId: autoConfig.instanceId || null,
        whatsappAutoImageUrl: autoConfig.imageUrl || null,
        whatsappAutoAudioUrl: autoConfig.audioUrl || null,
        whatsappOrderTemplate: autoConfig.template || null,
        whatsappAutoProductMediaRules: (autoConfig.productRules || [])
          .filter(r => r.productKeyword?.trim())
          .map(r => {
            const sendOrder = ['text'];
            if (r.imageUrl) sendOrder.push('image');
            if (r.videoUrl) sendOrder.push('video');
            if (r.audioUrl) sendOrder.push('audio');
            return {
              productKeyword: r.productKeyword.trim(),
              instanceId: r.instanceId || null,
              template: r.template || null,
              imageUrl: r.imageUrl || null,
              videoUrl: r.videoUrl || null,
              audioUrl: r.audioUrl || null,
              sendOrder
            };
          })
      });
      if (res.data.success) {
        setWhatsappAutoConfirm(true);
        setShowAutoConfigModal(false);
        setSuccess('Auto WhatsApp activé et configuré');
      }
    } catch (err) {
      setError(getContextualError(err, 'update_settings'));
    } finally {
      setSavingAutoConfig(false);
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

  const saveNotifConfig = async () => {
    setSavingNotifConfig(true);
    setError('');
    setTestNotifResult(null);
    try {
      const res = await ecomApi.patch('/orders/config/whatsapp-notifs', {
        closeuseNotifNumbers,
        deliveryGroupNumbers
      });
      if (res.data.success) {
        setSuccess('Configuration des notifications sauvegardée');
      }
    } catch (err) {
      setError(getContextualError(err, 'update_settings'));
    } finally {
      setSavingNotifConfig(false);
    }
  };

  const testNotifConfig = async () => {
    setTestingNotifConfig(true);
    setTestNotifResult(null);
    try {
      const res = await ecomApi.post('/orders/config/whatsapp-notifs/test', {
        closeuseNotifNumbers,
        deliveryGroupNumbers
      });
      setTestNotifResult(res.data);
    } catch (err) {
      setTestNotifResult({ success: false, message: getContextualError(err, 'update_settings') });
    } finally {
      setTestingNotifConfig(false);
    }
  };

  // Ouvrir le modal notifs en rechargeant les groupes depuis la DB
  const openNotifModal = async () => {
    await fetchWhatsAppConfig();
    if (whatsappInstances.length === 0) {
      try {
        const res = await ecomApi.get('/orders/whatsapp-instances');
        setWhatsappInstances(res.data.data || []);
      } catch { /* ignore */ }
    }
    setShowWhatsAppConfig(true);
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
    const params = new URLSearchParams(location.search);
    if (params.get('whatsappConfig') === '1') {
      openNotifModal();
    }
  }, [location.search]);

  useEffect(() => {
    const init = async ({ forceFetch = false } = {}) => {
      if (isAdmin || isSuperAdmin) {
        fetchConfig();
        fetchWhatsAppConfig();
        fetchProducts();
      } else if (isCloseuse) {
        await fetchCloseuseSources();
        fetchCommissions('month');
      }
      if (hasRestoredListState && !forceFetch) {
        setLoading(false);
        fetchOrders(true);
        return;
      }
      await fetchOrders();
      setLoading(false);
    };
    init();

    // Re-fetch everything when the active store changes
    const onStoreSwitch = () => {
      setOrders([]);
      setStats({});
      setLoading(true);
      setPage(1);
      setSearch('');
      setFilterStatus('');
      setFilterCity('');
      setFilterProduct('');
      setFilterTag('');
      setFilterStartDate('');
      setFilterEndDate('');
      setSelectedSourceId('');
      setDebouncedSearch('');
      setDebouncedCity('');
      setDebouncedProduct('');
      setDebouncedTag('');
      skipNextOrdersFetch.current = false;
      sessionStorage.removeItem(FILTERS_STORAGE_KEY);
      sessionStorage.removeItem(SCROLL_STORAGE_KEY);
      sessionStorage.removeItem(LIST_STATE_STORAGE_KEY);
      init({ forceFetch: true });
    };
    window.addEventListener('scalor:store-switch', onStoreSwitch);
    return () => window.removeEventListener('scalor:store-switch', onStoreSwitch);
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

  useEffect(() => {
    if (skipNextOrdersFetch.current) {
      skipNextOrdersFetch.current = false;
      return;
    }
    if (!loading) fetchOrders(false);
  }, [debouncedSearch, filterStatus, debouncedCity, debouncedProduct, debouncedTag, filterStartDate, filterEndDate, selectedSourceId, page, viewAllWorkspaces, itemsPerPage, sortOrder]);

  // Scroll-to-top à chaque changement de page (sauf restauration)
  const previousPageRef = useRef(page);
  useEffect(() => {
    if (previousPageRef.current !== page && !shouldRestoreScroll.current) {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    }
    previousPageRef.current = page;
  }, [page]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 10000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 5000); return () => clearTimeout(t); } }, [error]);

  // Restore scroll position after orders have loaded (when coming back from detail)
  useEffect(() => {
    if (!loading && orders.length > 0 && shouldRestoreScroll.current) {
      shouldRestoreScroll.current = false;
      try {
        const savedScroll = sessionStorage.getItem(SCROLL_STORAGE_KEY) ?? savedListState?.scrollY;
        if (savedScroll !== null && savedScroll !== undefined) {
          const scrollY = parseInt(savedScroll, 10);
          requestAnimationFrame(() => {
            if (Number.isFinite(scrollY)) {
              window.scrollTo(0, scrollY);
              return;
            }
            if (savedListState?.selectedOrderId) {
              document
                .querySelector(`[data-order-id="${savedListState.selectedOrderId}"]`)
                ?.scrollIntoView({ block: 'center' });
            }
          });
          sessionStorage.removeItem(SCROLL_STORAGE_KEY);
        }
      } catch {}
    }
  }, [loading, orders]);

  // On first mount, check if we should restore scroll (coming back from detail)
  useEffect(() => {
    if (savedFilters && !hasRestoredListState) {
      shouldRestoreScroll.current = true;
    }
  }, []);

  const buildListFilters = useCallback(() => ({
    search,
    filterStatus,
    filterCity,
    filterProduct,
    filterTag,
    filterStartDate,
    filterEndDate,
    selectedSourceId,
    page,
    itemsPerPage,
    sortOrder,
    viewAllWorkspaces
  }), [search, filterStatus, filterCity, filterProduct, filterTag, filterStartDate, filterEndDate, selectedSourceId, page, itemsPerPage, sortOrder, viewAllWorkspaces]);

  // Save filters to sessionStorage whenever they change
  useEffect(() => {
    sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(buildListFilters()));
  }, [buildListFilters]);

  const saveOrdersListState = useCallback((selectedOrderId) => {
    const scrollY = window.scrollY;
    const filters = buildListFilters();
    try {
      sessionStorage.setItem(SCROLL_STORAGE_KEY, String(scrollY));
      sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
      sessionStorage.setItem(LIST_STATE_STORAGE_KEY, JSON.stringify({
        savedAt: Date.now(),
        selectedOrderId,
        scrollY,
        filters,
        orders,
        stats,
        pagination
      }));
    } catch {
      try {
        sessionStorage.setItem(SCROLL_STORAGE_KEY, String(scrollY));
        sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
      } catch {}
    }
  }, [buildListFilters, orders, stats, pagination]);

  // Helper to save scroll position before navigating to order detail
  const navigateToOrder = useCallback((orderId) => {
    saveOrdersListState(orderId);
    navigate(`/ecom/orders/${orderId}`, { state: { fromOrdersList: true } });
  }, [navigate, saveOrdersListState]);

  // ••• Silent background polling (10s) — no loader, no messages ••••••••••••••
  const lastPollRef = useRef(
    savedListState?.savedAt
      ? new Date(savedListState.savedAt).toISOString()
      : new Date().toISOString()
  );
  const pollingRef = useRef(false);

  const silentPoll = useCallback(async () => {
    // Ne pas faire de polling si des filtres sont actifs (pour éviter d'écraser les résultats filtrés)
    const hasActiveFilters = debouncedSearch || filterStatus || debouncedCity || debouncedProduct || debouncedTag || filterStartDate || filterEndDate;
    if (hasActiveFilters) return;
    
    if (pollingRef.current || loading) return;
    pollingRef.current = true;
    try {
      const params = { since: lastPollRef.current };
      if (selectedSourceId) params.sourceId = selectedSourceId;
      const res = await ecomApi.get('/orders/new-since', {
        params,
        _bypassCache: true,
        _silent: true
      });
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
          const direction = sortOrder === 'oldest_first' ? 1 : -1;
          return Array.from(map.values()).sort((a, b) => {
            const aTime = new Date(a.createdAt || a.date || 0).getTime();
            const bTime = new Date(b.createdAt || b.date || 0).getTime();
            if (aTime !== bTime) return (aTime - bTime) * direction;
            return String(a._id || '').localeCompare(String(b._id || '')) * direction;
          });
        });
      }
    } catch (err) { 
      console.error('❌ [Frontend Poll] Erreur polling:', err.message);
      /* silent — never show errors from polling */ 
    }
    pollingRef.current = false;
  }, [loading, selectedSourceId, debouncedSearch, filterStatus, debouncedCity, debouncedProduct, debouncedTag, filterStartDate, filterEndDate, sortOrder]);

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
        const orderId = String(notif.metadata.orderId);
        if (!/^[a-f0-9]{24}$/i.test(orderId)) return;
        
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
                setSuccess(`Nouvelle commande : ${newOrder.clientName || 'Client'} - ${newOrder.product || 'Produit'}`);
                
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

  // ••• Temps réel: mise à jour du statut commande par le livreur ••••••••••••••
  useEffect(() => {
    const handleOrderStatusChanged = (event) => {
      const { _id, orderId, status, assignedLivreur, updatedAt, tags } = event.detail || {};
      if (!_id || !status) return;
      console.log('[Socket] Mise à jour statut livreur:', orderId, '->', status);
      setOrders(prev => prev.map(o =>
        String(o._id) === String(_id) ? { ...o, status, assignedLivreur: assignedLivreur ?? o.assignedLivreur, updatedAt: updatedAt ?? o.updatedAt, tags: tags ?? o.tags } : o
      ));
    };
    window.addEventListener('ecom:orderStatusChanged', handleOrderStatusChanged);
    return () => window.removeEventListener('ecom:orderStatusChanged', handleOrderStatusChanged);
  }, []);

  // ••• Temps réel: mise à jour des affectations sources (closeuse) •••••••••••
  useEffect(() => {
    if (!isCloseuse) return;
    const handleAssignmentUpdated = () => {
      console.log('📦 [Socket] Affectation mise à jour, rechargement des sources...');
      fetchCloseuseSources();
      fetchOrders(false);
    };
    window.addEventListener('ecom:assignmentUpdated', handleAssignmentUpdated);
    return () => window.removeEventListener('ecom:assignmentUpdated', handleAssignmentUpdated);
  }, [isCloseuse]);

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
      const importPanel = e.target.closest('.orders-import-menu-panel');
      if (importPanel) return;
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
        setSuccess(`${uniqueNewOrders.length} nouvelle${uniqueNewOrders.length > 1 ? 's' : ''} commande${uniqueNewOrders.length > 1 ? 's' : ''} ajoutée${uniqueNewOrders.length > 1 ? 's' : ''}`);
      } else {
        setSuccess('Synchronisation terminée, aucune nouvelle commande');
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
      
      let message = `Synchronisation terminée !\n\n`;
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
    setOrderForm({ clientName: '', clientPhone: '', city: '', address: '', product: '', productId: '', quantity: 1, price: 0, status: 'pending', notes: '', currency: userCurrency || 'XAF' });
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
      currency: order.currency || userCurrency || 'XAF',
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
        const result = await ecomApi.put(`/orders/${editingOrder._id}`, orderForm);
        setSuccess('Commande modifiée');

        // Track order update
        import('../../utils/analytics.js').then(m => {
          const analytics = m.default;
          analytics.trackOrderUpdate(editingOrder._id, {
            client_name: orderForm.clientName,
            status: orderForm.status,
            value: orderForm.price,
            currency: 'EUR'
          });
        }).catch(() => {});
      } else {
        const result = await ecomApi.post('/orders', orderForm);
        setSuccess('Commande créée');

        // Track order creation
        import('../../utils/analytics.js').then(m => {
          const analytics = m.default;
          analytics.trackOrderCreate({
            id: result.data?.data?._id || 'unknown',
            client_name: orderForm.clientName,
            product: orderForm.product,
            quantity: orderForm.quantity,
            total: orderForm.price,
            status: orderForm.status,
            currency: 'EUR'
          });
        }).catch(() => {});
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
      const orderToDelete = orders.find(o => o._id === orderId);
      await ecomApi.delete(`/orders/${orderId}`);
      setSuccess('Commande supprimée');

      // Track order deletion
      import('../../utils/analytics.js').then(m => {
        const analytics = m.default;
        analytics.trackOrderDelete(orderId, {
          client_name: orderToDelete?.clientName,
          status: orderToDelete?.status,
          value: orderToDelete?.price
        });
      }).catch(() => {});

      fetchOrders();
    } catch (err) {
      setError(getContextualError(err, 'delete_order'));
    } finally {
      setDeletingOrderId(null);
    }
  };

  const buildOrderDeliveryMessage = (order) => {
    const brandName = workspace?.name || 'Notre boutique';
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const todayName = dayNames[new Date().getDay()];
    const deliveryDay = order.deliveryDay || `aujourd'hui ${todayName}`;

    const clientName = getClientName(order);
    const phone = getClientPhone(order);
    const city = getCity(order);
    const deliveryLocation = getAddress(order) || order.rawData?.['Address 1'] || '—';
    const deliveryTime = order.deliveryTime || 'Disponible maintenant';
    const product = getProductName(order);
    const quantity = order.quantity || 1;
    const total = (order.price || 0) * quantity;
    const notes = getNotes(order);

    let msg = `*${brandName}*\n\n`;
    msg += `Nom du client : ${clientName || '—'}\n\n`;
    msg += `Ville : ${city || '—'}\n\n`;
    msg += `Lieu de la livraison : ${deliveryLocation}\n\n`;
    msg += `Jour de la livraison : ${deliveryDay}\n\n`;
    msg += `Numéro : ${phone || '—'}\n\n`;
    msg += `Heure de livraison : ${deliveryTime}\n\n`;
    msg += `Article : ${product}\n\n`;
    msg += `Quantité : ${String(quantity).padStart(2, '0')}\n\n`;
    msg += `Montant : ${total.toLocaleString('fr-FR')} ${order.currency || 'XAF'}`;
    if (notes) msg += `\n\nNotes : ${notes}`;
    return msg;
  };

  const handleCopyOrder = (order) => {
    const textToCopy = buildOrderDeliveryMessage(order);
    navigator.clipboard.writeText(textToCopy).then(() => {
      setSuccess('Commande copiée dans le presse-papier');
    }).catch(() => {
      setError('Impossible de copier dans le presse-papier');
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

  const toggleSelectionMode = () => {
    setSelectionMode(prev => !prev);
    setSelectedOrders(new Set());
  };

  const toggleOrderSelection = (id) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o._id)));
    }
  };

  const handleBulkDeleteSelected = async () => {
    if (selectedOrders.size === 0) return;
    if (!window.confirm(`Supprimer ${selectedOrders.size} commande(s) sélectionnée(s) ? Cette action est irréversible.`)) return;
    setDeletingSelected(true);
    try {
      const res = await ecomApi.delete('/orders/bulk-selected', { data: { ids: [...selectedOrders] } });
      setSuccess(res.data.message);
      setSelectedOrders(new Set());
      setSelectionMode(false);
      fetchOrders();
    } catch (err) {
      setError(getContextualError(err, 'delete_order'));
    } finally {
      setDeletingSelected(false);
    }
  };

  
  const getProductName = (o) => {
    // Ignorer les valeurs purement numériques (montants mal mappés)
    const isValidProduct = (v) => v && typeof v === 'string' && v.trim() && isNaN(v.trim());

    if (isValidProduct(o.product)) return o.product.trim();

    // Chercher dans rawData.line_items (commandes Shopify / Skelo)
    if (o.rawData?.line_items?.length) {
      const names = o.rawData.line_items
        .map(li => {
          const title = li.title || li.name || '';
          const qty = (li.quantity > 1) ? ` x${li.quantity}` : '';
          return title ? `${title}${qty}` : null;
        })
        .filter(Boolean);
      if (names.length) return names.join(', ');
    }

    // Chercher dans rawData par clé générique
    if (o.rawData && typeof o.rawData === 'object') {
      const entry = Object.entries(o.rawData).find(([k, v]) => {
        if (!isValidProduct(v)) return false;
        return /produit|product|article|item|d[éé]signation|libell[éé]/i.test(k);
      });
      if (entry?.[1]) return entry[1].trim();
    }

    return isValidProduct(o.product) ? o.product.trim() : '—';
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

  const activeFiltersCount = [filterStatus, filterCity, filterProduct, filterTag, filterStartDate, filterEndDate, search].filter(Boolean).length;

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
    // Fonction de conversion locale
    const convertAmount = (amount, fromCurrency = 'XAF') => {
      const targetCurrency = user?.currency || 'XAF';
      if (!amount || fromCurrency === targetCurrency) return amount;
      const fromRate = conversionRates[fromCurrency] || 1;
      const toRate = conversionRates[targetCurrency] || 1;
      return (amount / fromRate) * toRate;
    };

    if (!hasActiveFilters) {
      // Aucun filtre actif: utiliser les stats globales du serveur
      // MAIS il faut les convertir car le backend renvoie toujours en XAF
      const deliveredRevenueConverted = convertAmount(stats.totalRevenue || 0, 'XAF');

      return {
        total: stats.total || 0,
        delivered: stats.delivered || 0,
        returned: stats.returned || 0,
        pending: stats.pending || 0,
        confirmed: stats.confirmed || 0,
        shipped: stats.shipped || 0,
        totalRevenue: deliveredRevenueConverted,
        deliveredRevenue: deliveredRevenueConverted
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

    // Revenu calculé UNIQUEMENT sur les commandes livrées (avec conversion de devise)
    const deliveredRevenue = filtered
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => {
        const price = parseFloat(o.price) || 0;
        const quantity = parseInt(o.quantity) || 1;
        const orderCurrency = o.currency || 'XAF';
        const convertedPrice = convertAmount(price * quantity, orderCurrency);
        return sum + convertedPrice;
      }, 0);

    // Revenu total (toutes commandes) pour comparaison (avec conversion)
    const totalRevenue = filtered.reduce((sum, o) => {
      const price = parseFloat(o.price) || 0;
      const quantity = parseInt(o.quantity) || 1;
      const orderCurrency = o.currency || 'XAF';
      const convertedPrice = convertAmount(price * quantity, orderCurrency);
      return sum + convertedPrice;
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
  }, [filterStatus, filterCity, filterProduct, filterTag, filterStartDate, filterEndDate, search, orders, stats, user?.currency]);

  const deliveryRate = filteredStats.total ? ((filteredStats.delivered || 0) / filteredStats.total * 100).toFixed(1) : 0;

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

  const renderImportMenuOptions = () => (
    <>
      <button
        onClick={() => {
          setShowImportMenu(false);
          navigate('/ecom/import');
        }}
        className="flex min-h-[44px] w-full min-w-0 items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 transition"
      >
        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
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
        className="flex min-h-[44px] w-full min-w-0 items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 transition"
      >
        <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 24 24"><path d="M15.337 2.136c-.012-.012-.025-.012-.037-.024-.012-.013-.025-.013-.037-.025l-.427-.214c-.287-.15-.65-.1-.888.125l-.325.3c-.1.088-.225.163-.35.238-.538-.163-1.15-.238-1.825-.125-1.05.175-2.037.713-2.787 1.525-.537.575-.925 1.275-1.137 2.038-.688.2-1.175.35-1.2.363-.362.112-.375.125-.425.475-.037.262-1.05 8.1-1.05 8.1l10.562 2.025 5.1-1.188S15.35 2.148 15.337 2.136zm-2.7.938c-.175.05-.375.113-.6.175v-.15c0-.525-.075-1-.2-1.438.375.088.65.725.8 1.413zm-1.4-.363c-.125.038-.25.075-.4.125V1.723c0-.45-.088-.875-.238-1.25.538.2.888.863 1.013 1.638-.125.037-.25.075-.375.1zm-.95-1.788c.15.375.225.813.225 1.313v.088c-.4.125-.838.25-1.288.388.25-.963.725-1.438 1.063-1.788zm-.538 10.325l-.875-2.913c.4-.15.913-.325 1.013-.363.125-.037.15.05.15.1 0 .063-.025 1.663-.288 3.176zm3.338-8.738c-.012-.537-.1-1.025-.237-1.45.537.175.875.8 1.05 1.438-.188.062-.513.15-.813.237v-.225z"/></svg>
        <div className="flex-1 text-left">
          <div className="font-medium text-gray-900">Shopify</div>
          <div className="text-xs text-gray-500">Importer depuis Shopify</div>
        </div>
      </button>
    </>
  );

  if (loading) return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Skeleton header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-gray-200 rounded-md animate-pulse"></div>
          <div className="h-4 w-64 max-w-full bg-gray-100 rounded animate-pulse"></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-11 w-11 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="h-11 w-24 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="h-11 w-24 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
      </div>
      {/* Skeleton stats */}
      <div className="grid grid-cols-2 gap-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mb-3"></div>
            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div>
          </div>
        ))}
      </div>
      {/* Skeleton cards */}
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between gap-4 mb-3">
              <div className="h-5 w-40 bg-gray-200 rounded animate-pulse"></div>
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
    <div className="p-3 sm:p-4 lg:p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Barre de chargement fluide */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-0.5 bg-primary-100 overflow-hidden">
          <div className="h-full bg-primary-600" style={{animation: 'loading-bar 1s ease-in-out infinite', width: '60%'}}></div>
        </div>
      )}
      {success && <div className="mb-3 p-2.5 bg-green-50 text-green-800 rounded-lg text-sm border border-green-200 flex items-center gap-2"><svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>{success}</div>}
      {error && <div className="mb-3 p-2.5 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200 flex items-center gap-2"><svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>{error}</div>}

      {/* Quota commandes plan gratuit */}
      {(() => {
        const maxOrders = planInfo?.limits?.maxOrders;
        const used = planInfo?.ordersThisMonth;
        if (!maxOrders || maxOrders === -1 || used == null) return null;
        const pct = Math.min(100, Math.round((used / maxOrders) * 100));
        const isOver = used >= maxOrders;
        const isWarning = pct >= 80;
        const barColor = isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-primary-500';
        const bgStyle = isOver
          ? 'bg-red-50 border-red-200 text-red-800'
          : isWarning
          ? 'bg-amber-50 border-amber-200 text-amber-800'
          : 'bg-gray-50 border-gray-200 text-gray-700';
        return (
          <div className={`mb-3 p-3 rounded-xl border ${bgStyle}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm mb-2">
              <div className="flex items-center gap-2">
                {isOver || isWarning ? (
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                )}
                <span>
                  {isOver
                    ? <>Limite atteinte — <strong>{used}/{maxOrders}</strong> commandes ce mois. Nouvelles commandes bloquées.</>
                    : isWarning
                    ? <>Quota presque atteint — <strong>{used}/{maxOrders}</strong> commandes ce mois ({pct}%).</>
                    : <>Plan Gratuit — <strong>{used}/{maxOrders}</strong> commandes utilisées ce mois.</>
                  }
                </span>
              </div>
              <a href="/ecom/billing" className={`font-semibold underline underline-offset-2 whitespace-nowrap text-xs ${
                isOver ? 'text-red-700 hover:text-red-900' : isWarning ? 'text-amber-700 hover:text-amber-900' : 'text-primary-700 hover:text-primary-900'
              }`}>Passer à Scalor →</a>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })()}
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0 w-full sm:flex-1">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
            {selectedSourceId ? sources.find(s => s._id === selectedSourceId)?.name : 'Commandes'}
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {hasActiveFilters ? (
              <>
                {filteredStats.total} commande{filteredStats.total > 1 ? 's' : ''} filtrée{filteredStats.total > 1 ? 's' : ''}
                {filterStatus && <> • <span className="text-primary-600 font-medium">{getStatusLabel(filterStatus)}</span></>}
                {filterCity && <> • <span className="text-primary-700 font-medium">{filterCity}</span></>}
                {filterProduct && <> • <span className="text-green-600 font-medium">{filterProduct}</span></>}
              </>
            ) : (
              <>{stats.total || 0} commandes au total</>
            )}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
          {/* Toggle tous les espaces pour Super Admin */}
          {isSuperAdmin && (
            <button
              onClick={() => setViewAllWorkspaces(!viewAllWorkspaces)}
              className={`inline-flex min-h-[44px] items-center gap-1.5 px-3 py-1.5 rounded-lg transition text-xs font-medium ${
                viewAllWorkspaces
                  ? 'bg-gray-900 text-white hover:bg-gray-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={viewAllWorkspaces ? 'Voir toutes les commandes de tous les espaces' : 'Voir uniquement les commandes de mon espace'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={viewAllWorkspaces ? "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" : "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"} />
              </svg>
              {viewAllWorkspaces ? 'Tous les espaces' : 'Mon espace'}
            </button>
          )}
          {isAdmin && (
            <>
              {/* Toggle WhatsApp auto — visible sur desktop et mobile */}
              <div className="inline-flex min-h-[44px] items-center">
                <button
                  onClick={toggleWhatsAppAuto}
                  className={`inline-flex min-h-[44px] items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 transition text-[11px] sm:text-xs font-medium ${
                    whatsappAutoConfirm
                      ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-l-xl border-r-0'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-xl'
                  }`}
                  title={whatsappAutoConfirm ? 'Cliquer pour désactiver' : 'Cliquer pour configurer et activer'}
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span className="hidden sm:inline">{whatsappAutoConfirm ? 'Auto ON' : 'Auto OFF'}</span>
                  <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${whatsappAutoConfirm ? 'bg-green-500' : 'bg-gray-400'}`} />
                </button>
                {whatsappAutoConfirm && (
                  <button
                    onClick={openAutoConfigModal}
                    className="inline-flex h-11 w-11 items-center justify-center px-2 py-1.5 bg-green-50 text-green-600 border border-green-200 border-l-0 rounded-r-xl hover:bg-green-100 transition"
                    title="Modifier la configuration Auto WhatsApp"
                    aria-label="Modifier la configuration Auto WhatsApp"
                  >
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  </button>
                )}
              </div>

              <button
                onClick={openNotifModal}
                className="inline-flex h-11 w-11 items-center justify-center p-2 text-gray-600 bg-white border border-gray-200 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition"
                title="Configurer WhatsApp auto"
                aria-label="Configurer les notifications WhatsApp"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </button>
              <button
                onClick={openCreateOrder}
                className="inline-flex h-11 w-11 items-center justify-center gap-1 px-2.5 sm:h-auto sm:min-h-[44px] sm:w-auto sm:px-3 py-1.5 sm:py-2 bg-primary-600 text-white rounded-xl active:scale-95 transition text-[11px] sm:text-xs font-semibold shadow-sm"
                title="Ajouter une commande"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span className="hidden sm:inline">Ajouter</span>
              </button>
              <div className="relative" ref={importMenuRef}>
                <button
                  onClick={() => setShowImportMenu(!showImportMenu)}
                  className="inline-flex h-11 w-11 items-center justify-center gap-1 px-2.5 sm:h-auto sm:min-h-[44px] sm:w-auto sm:px-3 py-1.5 sm:py-2 bg-white text-gray-700 border border-gray-200 rounded-xl active:scale-95 hover:bg-gray-50 transition text-[11px] sm:text-xs font-semibold"
                  aria-label="Importer des commandes"
                  aria-expanded={showImportMenu}
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 013 3h10a3 3 0 013-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span className="hidden sm:inline">Importer</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showImportMenu && (
                  <div className="orders-import-menu orders-import-menu-panel absolute right-0 mt-2 hidden w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg z-50 sm:block">
                    {renderImportMenuOptions()}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleSync()}
                disabled={syncDisabled}
                className="inline-flex h-11 w-11 items-center justify-center gap-1 px-2.5 sm:h-auto sm:min-h-[44px] sm:w-auto sm:px-3 py-1.5 sm:py-2 bg-white text-gray-700 border border-gray-200 rounded-xl active:scale-95 hover:bg-gray-50 transition text-[11px] sm:text-xs font-semibold disabled:opacity-50"
                title="Synchroniser"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                <span className="hidden sm:inline">Sync</span>
              </button>
              <button
                onClick={() => navigate('/ecom/stats')}
                className="hidden sm:inline-flex min-h-[44px] items-center gap-1.5 px-3 py-2 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-xl transition text-xs font-semibold"
                title="Voir les statistiques globales"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Stats
              </button>
              {orders.length > 0 && (
                <button
                  onClick={toggleSelectionMode}
                  className={`inline-flex h-11 w-11 items-center justify-center gap-1 px-2.5 py-2 sm:w-auto rounded-lg transition text-xs font-medium ${selectionMode ? 'bg-primary-100 text-primary-700 border border-primary-300' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                  title="Sélection multiple"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  <span className="hidden sm:inline">{selectionMode ? 'Annuler' : 'Sélectionner'}</span>
                </button>
              )}
              {orders.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  disabled={deletingAll}
                  className="inline-flex h-11 w-11 items-center justify-center gap-1 px-2.5 py-2 sm:w-auto text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition text-xs font-medium"
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
              className="inline-flex h-11 w-11 items-center justify-center gap-1 px-2.5 sm:h-auto sm:min-h-[44px] sm:w-auto sm:px-3 py-1.5 sm:py-2 bg-orange-600 text-white rounded-xl active:scale-95 transition text-[11px] sm:text-xs font-semibold disabled:opacity-50"
              title="Synchroniser mes sources"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              <span className="hidden sm:inline">Sync</span>
            </button>
          )}
        </div>
      </div>

      {showImportMenu && (
        <div className="orders-import-menu-panel sm:hidden overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-sm">
          {renderImportMenuOptions()}
        </div>
      )}

      {/* Sources */}
      {(isAdmin || isSuperAdmin || (isCloseuse && sources.length > 0)) && (
        <div className="bg-white rounded-xl border border-gray-200 p-2.5">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            <span className="text-[11px] font-semibold text-gray-700">Sources</span>
            <span className="text-[10px] text-gray-400 tabular-nums">({sources.length})</span>
          </div>

          {/* Information d'adaptation au Google Sheet */}
          {selectedSourceId && sourcesConfig[selectedSourceId] && (
            <div className="mb-2 p-1.5 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-1.5 text-[11px]">
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span className="text-primary-700 font-medium truncate">
                  {sourcesConfig[selectedSourceId].name}
                </span>
                {sourcesConfig[selectedSourceId].detectedHeaders.length > 0 && (
                  <span className="text-primary-600 flex-shrink-0">
                    ({sourcesConfig[selectedSourceId].detectedHeaders.length})
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => { setSelectedSourceId(''); setPage(1); }}
              className={`inline-flex min-h-[36px] min-w-[36px] items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                !selectedSourceId
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              <span className="hidden sm:inline">Toutes</span>
              <span className="sm:hidden">All</span>
            </button>
            {sources.map(s => (
              <div key={s._id} className="flex min-w-0 items-center gap-0.5">
                <button
                  onClick={() => { setSelectedSourceId(s._id); setPage(1); }}
                  className={`inline-flex min-h-[36px] min-w-0 items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    selectedSourceId === s._id
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
                  <span className="truncate max-w-[80px] sm:max-w-none">{s.name}</span>
                  {s.lastSyncAt && (
                    <span className="opacity-60 text-[8px] sm:text-[10px] ml-0.5 sm:ml-1 flex-shrink-0">
                      {new Date(s.lastSyncAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  )}
                </button>
                {(isAdmin || isSuperAdmin) && s._id !== 'webhook' && (
                  <button
                    onClick={() => deleteSource(s._id)}
                    disabled={deletingSource === s._id}
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition ${
                      selectedSourceId === s._id
                        ? 'text-red-400 hover:text-red-600 hover:bg-red-50'
                        : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                    } ${deletingSource === s._id ? 'opacity-50 cursor-wait' : ''}`}
                    title="Supprimer"
                  >
                    {deletingSource === s._id ? (
                      <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    )}
                  </button>
                )}
              </div>
            ))}
            {sources.length === 0 && (
              <p className="text-[10px] sm:text-xs text-gray-400 italic py-1">
                {isCloseuse ? 'Aucune source assignée' : 'Aucune source. Importer des commandes.'}
              </p>
            )}
            {/* Source enum filters: Scalor (skelor+boutique) / Shopify */}
            {(isAdmin || isSuperAdmin) && [
              { id: 'scalor', label: 'Scalor', color: 'bg-primary-600 text-white', inactive: 'bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200', deleteIds: ['skelor', 'boutique'] },
              { id: 'shopify', label: 'Shopify', color: 'bg-green-700 text-white', inactive: 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200', deleteIds: ['shopify'] },
            ].map(src => (
              <div key={src.id} className="flex items-center gap-0.5">
                <button
                  onClick={() => { setSelectedSourceId(selectedSourceId === src.id ? '' : src.id); setPage(1); }}
                  className={`inline-flex min-h-[36px] min-w-[36px] items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${selectedSourceId === src.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {src.label}
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm(`Supprimer TOUTES les commandes ${src.label} ? Irréversible.`)) return;
                    Promise.all(src.deleteIds.map(did => ecomApi.delete(`/orders/bulk?sourceId=${did}`))).then(() => { fetchOrders(); setSuccess(`Commandes ${src.label} supprimées`); }).catch(() => setError('Erreur suppression'));
                  }}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                  title={`Supprimer toutes les commandes ${src.label}`}
                >
                  <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barre de filtres compacte */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* En-tête des filtres */}
        <div className="px-2.5 py-2 border-b border-gray-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-gray-900">Filtres</h3>
              <p className="text-[11px] text-gray-500">
                {hasActiveFilters ? (
                  <>
                    <span className="font-semibold text-primary-600">{filteredStats.total}</span> / {stats.total || 0}
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
                className="min-h-[36px] text-[11px] border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary-600"
                title="Ordre d'affichage"
              >
                <option value="newest_first">Plus récentes</option>
                <option value="oldest_first">Plus anciennes</option>
              </select>
              {activeFiltersCount > 0 && (
                <button onClick={clearAllFilters} className="inline-flex min-h-[36px] items-center gap-1 px-2 py-1 bg-white text-red-600 hover:bg-red-50 border border-red-100 rounded-md text-[11px] font-semibold transition-all">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  Réinitialiser
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Chips de filtres actifs */}
        {activeFiltersCount > 0 && (
          <div className="px-2.5 py-1.5 bg-gray-50 border-b border-gray-100">
            <div className="flex flex-wrap gap-1">
              {filterStatus && (
                <div className="inline-flex min-h-[24px] items-center gap-1 px-2 py-0.5 bg-white text-gray-700 rounded-full text-[10px] font-medium border border-gray-200">
                  {getStatusLabel(filterStatus)}
                  <button onClick={() => { setFilterStatus(''); setPage(1); }} className="hover:text-primary-900">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              {filterCity && (
                <div className="inline-flex min-h-[24px] items-center gap-1 px-2 py-0.5 bg-white text-gray-700 rounded-full text-[10px] font-medium border border-gray-200">
                  {filterCity}
                  <button onClick={() => { setFilterCity(''); setPage(1); }} className="hover:text-primary-900">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              {filterProduct && (
                <div className="inline-flex min-h-[24px] items-center gap-1 px-2 py-0.5 bg-white text-gray-700 rounded-full text-[10px] font-medium border border-gray-200">
                  {filterProduct}
                  <button onClick={() => { setFilterProduct(''); setPage(1); }} className="hover:text-green-900">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              {filterStartDate && (
                <div className="inline-flex min-h-[24px] items-center gap-1 px-2 py-0.5 bg-white text-gray-700 rounded-full text-[10px] font-medium border border-gray-200">
                  {filterStartDate}
                  <button onClick={() => { setFilterStartDate(''); setPage(1); }} className="hover:text-orange-900">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              {filterEndDate && (
                <div className="inline-flex min-h-[24px] items-center gap-1 px-2 py-0.5 bg-white text-gray-700 rounded-full text-[10px] font-medium border border-gray-200">
                  {filterEndDate}
                  <button onClick={() => { setFilterEndDate(''); setPage(1); }} className="hover:text-orange-900">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              {search && (
                <div className="inline-flex min-h-[24px] items-center gap-1 px-2 py-0.5 bg-white text-gray-700 rounded-full text-[10px] font-medium border border-gray-200">
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
        <div className="p-2.5">
          <div className="mb-2">
            <div className="relative">
              <svg className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input 
                type="text" 
                placeholder="Client, téléphone, ville ou produit" 
                value={search} 
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full min-h-[38px] pl-9 pr-9 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              />
              {search && (
                <button 
                  onClick={() => { setSearch(''); setPage(1); }}
                  className="absolute right-0.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                  aria-label="Effacer la recherche"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>

          <div className="mb-2">
            <div className="-mx-2.5 flex gap-1.5 overflow-x-auto px-2.5 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          <button onClick={() => { setFilterStatus(''); setPage(1); }} className={`shrink-0 min-h-[34px] px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${!filterStatus ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            Tous ({(filterCity || filterProduct || filterTag || filterStartDate || filterEndDate || search) ? dynamicFilterCounts.total : stats.total || 0})
          </button>
              {statusFilters.map(s => (
                <button key={s.key} onClick={() => { setFilterStatus(filterStatus === s.key ? '' : s.key); setPage(1); }}
                  className={`shrink-0 min-h-[34px] px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${filterStatus === s.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {s.label} ({(filterCity || filterProduct || filterTag || filterStartDate || filterEndDate || search) ? dynamicFilterCounts[s.key] || 0 : stats[s.key] || 0})
                </button>
              ))}
            </div>
          </div>

          <div className="mb-2.5">
            <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Période rapide</label>
            <div className="-mx-2.5 flex gap-1.5 overflow-x-auto px-2.5 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              {[
                { key: 'today', label: "Aujourd'hui" },
                { key: 'yesterday', label: 'Hier' },
                { key: 'last7', label: '7 derniers jours' },
                { key: 'last30', label: '30 derniers jours' }
              ].map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => applyQuickDatePreset(preset.key)}
                  className={`shrink-0 min-h-[34px] px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${
                    activeQuickDatePreset === preset.key
                      ? 'bg-gray-900 text-white border-gray-900'
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
            className={`w-full min-h-[36px] px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all ${showFilters ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v2m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            {showFilters ? 'Masquer avancés' : 'Filtres avancés'}
          </button>

          {/* Advanced filters panel */}
          {showFilters && (
            <div className="mt-2.5 pt-2.5 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Début</label>
                  <input type="date" value={filterStartDate} onChange={e => { setFilterStartDate(e.target.value); setPage(1); }} className="w-full min-h-[38px] px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Fin</label>
                  <input type="date" value={filterEndDate} onChange={e => { setFilterEndDate(e.target.value); setPage(1); }} className="w-full min-h-[38px] px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Ville</label>
                  <select value={filterCity} onChange={e => { setFilterCity(e.target.value); setPage(1); }} className="w-full min-h-[38px] px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent">
                    <option value="">Toutes les villes</option>
                    {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Produit</label>
                  <select value={filterProduct} onChange={e => { setFilterProduct(e.target.value); setPage(1); }} className="w-full min-h-[38px] px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent">
                    <option value="">Tous</option>
                    {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">Tag</label>
                  <select value={filterTag} onChange={e => { setFilterTag(e.target.value); setPage(1); }} className="w-full min-h-[38px] px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent">
                    <option value="">Tous</option>
                    {uniqueTags.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {[filterCity, filterProduct, filterTag, filterStartDate, filterEndDate].filter(Boolean).length > 0 && (
                <div className="flex items-center justify-between mt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {filterStartDate && <span className="inline-flex min-h-[24px] items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700">{filterStartDate} <button onClick={() => { setFilterStartDate(''); setPage(1); }} className="hover:text-gray-900">&times;</button></span>}
                    {filterEndDate && <span className="inline-flex min-h-[24px] items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700">{filterEndDate} <button onClick={() => { setFilterEndDate(''); setPage(1); }} className="hover:text-gray-900">&times;</button></span>}
                    {filterCity && <span className="inline-flex min-h-[24px] items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700">{filterCity} <button onClick={() => { setFilterCity(''); setPage(1); }} className="hover:text-gray-900">&times;</button></span>}
                    {filterProduct && <span className="inline-flex min-h-[24px] items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700">{filterProduct} <button onClick={() => { setFilterProduct(''); setPage(1); }} className="hover:text-gray-900">&times;</button></span>}
                    {filterTag && <span className="inline-flex min-h-[24px] items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700">{filterTag} <button onClick={() => { setFilterTag(''); setPage(1); }} className="hover:text-gray-900">&times;</button></span>}
                  </div>
                  <button onClick={clearAllFilters} className="text-[10px] text-red-600 hover:text-red-800 font-medium">Tout effacer</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>



      {/* KPI Cards - Design compact */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-[11px] font-semibold text-gray-500 mb-1">Revenu livré</p>
          <p className="text-xl font-bold text-gray-900 mb-1 tabular-nums">{fmtRaw(filteredStats.deliveredRevenue || 0) || `0 ${symbol}`}</p>
          <p className="text-[11px] text-green-700 font-medium">{filteredStats.delivered || 0} livrés · {Math.round((filteredStats.delivered || 0) / (filteredStats.total || 1) * 100)}%</p>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-[11px] font-semibold text-gray-500 mb-1">Taux livraison</p>
          <p className="text-xl font-bold text-gray-900 mb-1.5 tabular-nums">{deliveryRate}%</p>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-primary-600 h-1.5 rounded-full" style={{ width: `${Math.min(deliveryRate, 100)}%` }}></div>
          </div>
        </div>
      </div>

      {/* Floating bulk action bar */}
      {selectionMode && selectedOrders.size > 0 && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] sm:bottom-6 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 flex items-center justify-between gap-3 bg-gray-900 text-white rounded-xl shadow-lg px-4 py-3 sm:px-5">
          <span className="text-sm font-semibold">{selectedOrders.size} sélectionnée(s)</span>
          <button
            onClick={handleBulkDeleteSelected}
            disabled={deletingSelected}
            className="inline-flex min-h-[44px] items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
          >
            {deletingSelected ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            )}
            Supprimer
          </button>
          <button
            onClick={() => { setSelectedOrders(new Set()); setSelectionMode(false); }}
            className="min-h-[44px] px-3 py-2 text-gray-300 hover:text-white text-sm transition"
          >
            Annuler
          </button>
        </div>
      )}

      {/* Orders */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          </div>
          <p className="text-gray-500 text-sm font-medium">Aucune commande trouvée</p>
          <p className="text-xs text-gray-400 mt-1">
            {search || filterStatus || filterCity || filterProduct || filterTag || filterStartDate || filterEndDate
              ? 'Essayez de modifier vos filtres ou votre recherche.'
              : isAdmin ? <>Importez vos commandes depuis la page <a href="/ecom/import" className="text-primary-600 hover:underline">Import</a></> : 'Aucune commande disponible.'
            }
          </p>
        </div>
      ) : (
        <>
          {/* Vue liste épurée — Desktop */}
          <div className="hidden md:block space-y-2">
            {/* Select-all bar (desktop) */}
            {selectionMode && (
              <div className="flex items-center gap-3 px-3 py-2 bg-primary-50 border border-primary-200 rounded-xl">
                <input
                  type="checkbox"
                  checked={selectedOrders.size === orders.length && orders.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded accent-primary-600 cursor-pointer"
                />
                <span className="text-xs font-semibold text-primary-700">
                  {selectedOrders.size === 0 ? 'Tout sélectionner' : `${selectedOrders.size} / ${orders.length} sélectionnée(s)`}
                </span>
              </div>
            )}
            {orders.map((o) => {
              const clientName = getClientName(o);
              const clientPhone = getClientPhone(o);
              const city = getCity(o);
              const productName = getProductName(o);
              const totalPrice = (o.price || 0) * (o.quantity || 1);
              const isSelected = selectedOrders.has(o._id);

              return (
                <div key={o._id} data-order-id={o._id} className={`bg-white rounded-xl border transition-colors duration-150 group ${selectionMode ? 'cursor-default' : 'cursor-pointer hover:border-gray-300 hover:bg-gray-50/40'} ${isSelected ? 'border-primary-500 ring-1 ring-primary-400' : 'border-gray-200'}`} onClick={() => selectionMode ? toggleOrderSelection(o._id) : navigateToOrder(o._id)}>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-4">
                      {/* Checkbox (selection mode) */}
                      {selectionMode && (
                        <div className="flex-shrink-0" onClick={(e) => { e.stopPropagation(); toggleOrderSelection(o._id); }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOrderSelection(o._id)}
                            className="w-4 h-4 rounded accent-primary-600 cursor-pointer"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center text-gray-700 font-bold text-sm flex-shrink-0">
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

                      {/* Postponed date badge */}
                      {(o.status === 'postponed' || o.status === 'reported') && o.deliveryTime && (
                        <div className="flex-shrink-0" title={`Reporté au : ${o.deliveryTime}`}>
                          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border flex items-center gap-1 ${getPostponedBadgeColor(o.deliveryTime)}`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                            {fmtPostponedDate(o.deliveryTime)}
                          </span>
                        </div>
                      )}

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
                          <p className="text-sm font-bold text-gray-900">{fmt(totalPrice, o.currency || 'XAF')}</p>
                        </div>
                      )}

                      {/* Pool livreur badge */}
                      {o.readyForDelivery && !o.assignedLivreur && (
                        <div className="flex-shrink-0" title="Dans le pool livreur">
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17a2 2 0 11-4 0 2 2 0 014 0zm12 0a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 17H3V6a1 1 0 011-1h9v12H7m6 0h3m4 0h1v-5l-3-4h-5"/></svg>
                            Pool
                          </span>
                        </div>
                      )}

                      {/* Source badge */}
                      {(o.source === 'skelor' || o.source === 'boutique') && (
                        <div className="flex-shrink-0">
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-md bg-emerald-900 text-white border border-emerald-800 uppercase">Scalor</span>
                        </div>
                      )}
                      {o.source === 'shopify' && (
                        <div className="flex-shrink-0">
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-md bg-lime-400 text-lime-900 border border-lime-500 uppercase">Shopify</span>
                        </div>
                      )}
                      {/* Badge nom de source personnalisée (Scalor Store nommé, webhook, etc.) */}
                      {o.sourceName && !['skelor','shopify','boutique'].includes(o.source) && (
                        <div className="flex-shrink-0">
                          <span className="block max-w-[90px] truncate rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-semibold text-gray-700" title={o.sourceName}>{o.sourceName}</span>
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
                          className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold border cursor-pointer focus:ring-2 focus:ring-primary-600 focus:outline-none transition-all ${getStatusColor(o.status)}`}
                        >
                          {Object.entries(SL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          {!SL[o.status] && <option value={o.status}>{o.status}</option>}
                          <option value="__custom">+ Personnalisé...</option>
                        </select>
                      </div>

                      {/* Copy Button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopyOrder(o); }}
                        className="flex-shrink-0 w-10 h-10 text-primary-600 bg-white hover:bg-primary-50 border border-primary-200 rounded-lg transition flex items-center justify-center"
                        title="Copier la commande"
                        aria-label="Copier la commande"
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

          {/* Vue cartes — Mobile Pro */}
          <div className="md:hidden space-y-2">
            {/* Select-all bar (mobile) */}
            {selectionMode && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-primary-50/80 backdrop-blur-sm border border-primary-200 rounded-2xl">
                <input
                  type="checkbox"
                  checked={selectedOrders.size === orders.length && orders.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded accent-primary-600 cursor-pointer"
                />
                <span className="text-xs font-semibold text-primary-700">
                  {selectedOrders.size === 0 ? 'Tout sélectionner' : `${selectedOrders.size} / ${orders.length} sélectionnée(s)`}
                </span>
              </div>
            )}
            {orders.map(o => {
              const clientName = getClientName(o);
              const clientPhone = getClientPhone(o);
              const city = getCity(o);
              const productName = getProductName(o);
              const totalPrice = (o.price || 0) * (o.quantity || 1);
              const isSelected = selectedOrders.has(o._id);

              return (
                <div key={o._id} data-order-id={o._id} className={`bg-white rounded-2xl border overflow-hidden transition-all duration-150 ${selectionMode ? 'cursor-default' : 'active:scale-[0.99]'} ${isSelected ? 'border-primary-400 ring-2 ring-primary-100' : 'border-gray-100 shadow-sm'}`} onClick={() => selectionMode ? toggleOrderSelection(o._id) : navigateToOrder(o._id)}>
                  <div className="px-4 pt-4 pb-3">
                    {/* Header: Avatar + Name/Phone + Price */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {selectionMode && (
                          <div onClick={(e) => { e.stopPropagation(); toggleOrderSelection(o._id); }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleOrderSelection(o._id)}
                              className="w-4 h-4 rounded accent-primary-600 cursor-pointer"
                            />
                          </div>
                        )}
                        <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                          {clientName ? clientName.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[15px] font-semibold text-gray-900 truncate leading-tight">{clientName || 'Sans nom'}</h3>
                          <p className="text-xs text-gray-500 font-mono mt-0.5 truncate">{clientPhone || '—'}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        {totalPrice > 0 && (
                          <p className="text-[15px] font-bold text-gray-900 tabular-nums">{fmtOrder(totalPrice, o.currency)}</p>
                        )}
                        {o.quantity > 1 && (
                          <span className="text-[10px] text-gray-400 font-medium">Qté : {o.quantity}</span>
                        )}
                      </div>
                    </div>

                    {/* Meta chips: Product + City */}
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      {productName && productName !== '—' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 max-w-[60%]">
                          <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                          <span className="truncate">{productName}</span>
                        </span>
                      )}
                      {city && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
                          <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                          {city}
                        </span>
                      )}
                    </div>

                    {/* Postponed date badge */}
                    {(o.status === 'postponed' || o.status === 'reported') && o.deliveryTime && (
                      <div className="mt-2">
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border inline-flex items-center gap-1 ${getPostponedBadgeColor(o.deliveryTime)}`}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                          Reporté : {fmtPostponedDate(o.deliveryTime)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Footer: Source + Status + Quick Actions */}
                  <div className="border-t border-gray-100/80 px-4 py-2.5 flex items-center justify-between gap-2 bg-gray-50/40" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {o.readyForDelivery && !o.assignedLivreur && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-1.5 py-1 text-[10px] font-semibold text-amber-700">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17a2 2 0 11-4 0 2 2 0 014 0zm12 0a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 17H3V6a1 1 0 011-1h9v12H7m6 0h3m4 0h1v-5l-3-4h-5"/></svg>
                          Pool
                        </span>
                      )}
                      {(o.source === 'skelor' || o.source === 'boutique') && <span className="inline-flex items-center rounded-lg border border-emerald-800 bg-emerald-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Scalor</span>}
                      {o.source === 'shopify' && <span className="inline-flex items-center rounded-lg border border-lime-500 bg-lime-400 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-lime-900">Shopify</span>}
                      {o.sourceName && !['skelor','shopify','boutique'].includes(o.source) && <span className="inline-flex max-w-[72px] items-center truncate rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-gray-500">{o.sourceName}</span>}
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
                        className={`h-8 rounded-lg border px-2 text-[11px] font-semibold cursor-pointer focus:ring-2 focus:ring-primary-500 focus:outline-none ${getStatusColor(o.status)}`}
                      >
                        {Object.entries(SL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        {!SL[o.status] && <option value={o.status}>{o.status}</option>}
                        <option value="__custom">+ Personnalisé...</option>
                      </select>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopyOrder(o); }}
                        className="inline-flex h-8 w-8 items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition"
                        aria-label="Copier commande"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                      <div className="relative menu-container">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(expandedId === o._id ? null : o._id);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition"
                          aria-label="Plus d'actions"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                        </button>
                        {expandedId === o._id && (
                          <div className="absolute right-0 bottom-full mb-1 min-w-[156px] rounded-xl border border-gray-100 bg-white py-1 shadow-xl shadow-gray-200/50" style={{zIndex: 9999}} onClick={(e) => e.stopPropagation()}>
                            <button onClick={(e) => { e.stopPropagation(); navigateToOrder(o._id); setExpandedId(null); }} className="flex min-h-[40px] w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-lg mx-0.5 transition">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                              Voir détails
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(o.clientPhone || ''); setExpandedId(null); setSuccess('Téléphone copié'); }} className="flex min-h-[40px] w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-lg mx-0.5 transition">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                              Copier tél.
                            </button>
                            {isAdmin && (
                              <>
                                <div className="my-1 mx-3 border-t border-gray-100"></div>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(o._id); setExpandedId(null); }} disabled={deletingOrderId === o._id} className="flex min-h-[40px] w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg mx-0.5 disabled:opacity-50 transition">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  Supprimer
                                </button>
                              </>
                            )}
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <p className="text-[11px] text-gray-400">
            {pagination.pages > 1 ? (
              <>
                Page <span className="font-semibold text-gray-900 tabular-nums">{page}</span>
                <span className="text-gray-300"> / </span>
                <span className="tabular-nums">{pagination.pages}</span>
                <span className="text-gray-300"> · </span>
                <span className="tabular-nums">
                  {Math.min((page - 1) * itemsPerPage + 1, pagination.total)}–{Math.min(page * itemsPerPage, pagination.total)}
                </span>
                <span className="text-gray-400"> sur </span>
                <span className="tabular-nums">{pagination.total}</span> commandes
              </>
            ) : (
              <>{orders.length} commande{orders.length > 1 ? 's' : ''} affichée{orders.length > 1 ? 's' : ''}</>
            )}
          </p>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-500 font-medium">Lignes par page:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
              className="min-h-[44px] text-[11px] px-2 py-2 border border-gray-200 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-600"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </div>
        </div>
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="h-11 w-11 px-2.5 py-2 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 ease-out"
              aria-label="Première page"
              title="Première page"
            >
              «
            </button>
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="min-h-[44px] px-3 py-2 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 ease-out"
            >
              Préc
            </button>
            <span className="px-2 text-xs text-gray-400 tabular-nums">
              {page}/{pagination.pages}
            </span>
            <button
              onClick={() => setPage(Math.min(pagination.pages, page + 1))}
              disabled={page >= pagination.pages}
              className="min-h-[44px] px-3 py-2 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 ease-out"
            >
              Suiv
            </button>
            <button
              onClick={() => setPage(pagination.pages)}
              disabled={page >= pagination.pages}
              className="h-11 w-11 px-2.5 py-2 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 ease-out"
              aria-label="Dernière page"
              title="Dernière page"
            >
              »
            </button>
          </div>
        )}
      </div>

      {/* Modal Configuration Auto WhatsApp — Instance + Personnalisation */}
      {showAutoConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAutoConfigModal(false)}>
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Configurer Auto WhatsApp</h3>
                <p className="text-xs text-gray-500 mt-0.5">Personnaliser le message automatique envoyé aux clients</p>
              </div>
              <button onClick={() => setShowAutoConfigModal(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50" aria-label="Fermer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-5">


              {/* Template message texte */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                    Message texte personnalisé
                  </span>
                </label>
                <textarea
                  value={autoConfig.template}
                  onChange={e => setAutoConfig(prev => ({ ...prev, template: e.target.value }))}
                  placeholder="Bonjour {{first_name}}&#10;&#10;Votre commande #{{order_number}} a été reçue...&#10;&#10;Variables : {{first_name}}, {{order_number}}, {{product}}, {{quantity}}, {{city}}, {{total_price}}, {{currency}}, {{store_name}}"
                  rows={5}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">Laissez vide pour utiliser le template par défaut</p>
              </div>

              {/* ─── Règles par produit ─── */}
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Par produit</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Instance et message spécifiques selon le produit commandé</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoConfig(prev => ({ ...prev, productRules: [...(prev.productRules || []), { productKeyword: '', instanceId: '', template: '', imageUrl: '', audioUrl: '' }] }))}
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                    Ajouter
                  </button>
                </div>

                <div className="space-y-3">
                  {(autoConfig.productRules || []).map((rule, ridx) => (
                    <div key={ridx} className="rounded-xl border border-gray-200 p-3 space-y-2.5 bg-gray-50/50">
                      {/* Header: keyword + delete */}
                      <div className="flex items-center gap-2">
                        <select
                          value={rule.productKeyword}
                          onChange={e => setAutoConfig(prev => ({ ...prev, productRules: prev.productRules.map((r, i) => i === ridx ? { ...r, productKeyword: e.target.value } : r) }))}
                          className="flex-1 h-9 px-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500/20 focus:outline-none"
                        >
                          <option value="">— Sélectionner un produit —</option>
                          {availableProducts.map(p => (
                            <option key={p._id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setAutoConfig(prev => ({ ...prev, productRules: prev.productRules.filter((_, i) => i !== ridx) }))}
                          className="h-9 w-9 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>

                      {/* Instance dédiée — obligatoire pour ce produit */}
                      <div>
                        <select
                          value={rule.instanceId || ''}
                          onChange={e => setAutoConfig(prev => ({ ...prev, productRules: prev.productRules.map((r, i) => i === ridx ? { ...r, instanceId: e.target.value } : r) }))}
                          className={`w-full h-9 px-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500/20 focus:outline-none ${!rule.instanceId ? 'border-amber-300 text-gray-400' : 'border-green-300 text-gray-900'}`}
                        >
                          <option value="">⚠️ Choisir une instance pour ce produit</option>
                          {whatsappInstances.map(inst => (
                            <option key={inst._id} value={inst._id}>
                              {inst.customName} — {inst.isConnected ? 'Connectée' : 'Déconnectée'}
                            </option>
                          ))}
                        </select>
                        {!rule.instanceId && (
                          <p className="text-[10px] text-amber-600 mt-1 pl-1">Sans instance, l'instance globale sera utilisée</p>
                        )}
                      </div>

                      {/* Message personnalisé */}
                      <textarea
                        value={rule.template || ''}
                        onChange={e => setAutoConfig(prev => ({ ...prev, productRules: prev.productRules.map((r, i) => i === ridx ? { ...r, template: e.target.value } : r) }))}
                        placeholder="Message personnalisé pour ce produit... (laisser vide = message global)"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-green-500/20 focus:outline-none resize-none"
                      />

                      {/* Image + Vidéo */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Image */}
                        <div>
                          {rule.imageUrl ? (
                            <div className="relative rounded-lg overflow-hidden border border-purple-200 bg-purple-50">
                              <img src={rule.imageUrl} alt="" className="w-full h-20 object-cover" />
                              <button
                                type="button"
                                onClick={() => setAutoConfig(prev => ({ ...prev, productRules: prev.productRules.map((r, i) => i === ridx ? { ...r, imageUrl: '' } : r) }))}
                                className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center bg-black/50 hover:bg-red-500 rounded-full transition"
                              >
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                              </button>
                            </div>
                          ) : (
                            <label className={`flex flex-col items-center justify-center gap-1 h-20 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-purple-300 hover:bg-purple-50 transition ${uploadingRuleMedia[`${ridx}_imageUrl`] ? 'opacity-50 pointer-events-none' : ''}`}>
                              {uploadingRuleMedia[`${ridx}_imageUrl`] ? (
                                <svg className="animate-spin w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                              ) : (
                                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                              )}
                              <span className="text-[10px] text-gray-400">Image</span>
                              <input type="file" accept="image/*" className="hidden" onChange={e => handleRuleMediaUpload(ridx, 'imageUrl', e.target.files?.[0])} />
                            </label>
                          )}
                        </div>

                        {/* Vidéo */}
                        <div>
                          {rule.videoUrl ? (
                            <div className="relative rounded-lg overflow-hidden border border-blue-200 bg-blue-50 h-20 flex items-center justify-center">
                              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                              <p className="text-[10px] text-blue-600 truncate max-w-[80px] ml-1">Vidéo</p>
                              <button
                                type="button"
                                onClick={() => setAutoConfig(prev => ({ ...prev, productRules: prev.productRules.map((r, i) => i === ridx ? { ...r, videoUrl: '' } : r) }))}
                                className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center bg-black/50 hover:bg-red-500 rounded-full transition"
                              >
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                              </button>
                            </div>
                          ) : (
                            <label className={`flex flex-col items-center justify-center gap-1 h-20 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition ${uploadingRuleMedia[`${ridx}_videoUrl`] ? 'opacity-50 pointer-events-none' : ''}`}>
                              {uploadingRuleMedia[`${ridx}_videoUrl`] ? (
                                <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                              ) : (
                                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                              )}
                              <span className="text-[10px] text-gray-400">Vidéo</span>
                              <input type="file" accept="video/*,.mp4,.mov,.avi" className="hidden" onChange={e => handleRuleMediaUpload(ridx, 'videoUrl', e.target.files?.[0])} />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(autoConfig.productRules || []).length === 0 && (
                    <p className="text-xs text-gray-400 italic py-1">Aucune règle — toutes les commandes utilisent la config globale ci-dessus.</p>
                  )}
                </div>
              </div>

              {/* Info envoi progressif */}
              {(autoConfig.template || autoConfig.imageUrl || autoConfig.audioUrl) && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs font-medium text-blue-700 mb-1">Ordre d'envoi progressif :</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-[10px] font-medium">
                      1. Texte
                    </span>
                    {autoConfig.imageUrl && (
                      <>
                        <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-[10px] font-medium">
                          2. Image
                        </span>
                      </>
                    )}
                    {autoConfig.audioUrl && (
                      <>
                        <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-[10px] font-medium">
                          {autoConfig.imageUrl ? '3' : '2'}. Vocal
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Zone debug DB */}
            <div className="px-5 pb-2">
              <button
                type="button"
                onClick={async () => {
                  setLoadingDbConfig(true);
                  setDbConfig(null);
                  try {
                    const res = await ecomApi.get('/orders/config/whatsapp-auto/debug');
                    setDbConfig(res.data.data);
                  } catch { setDbConfig({ error: 'Erreur' }); }
                  finally { setLoadingDbConfig(false); }
                }}
                className="text-[10px] text-gray-400 hover:text-gray-600 underline"
              >
                {loadingDbConfig ? 'Chargement...' : '🔍 Voir config en base de données'}
              </button>
              {dbConfig && (
                <div className="mt-2 p-3 bg-gray-900 text-green-300 rounded-lg text-[10px] font-mono overflow-auto max-h-64">
                  <p><strong>whatsappAutoConfirm:</strong> {String(dbConfig.whatsappAutoConfirm)}</p>
                  <p><strong>Règles produit ({(dbConfig.whatsappAutoProductMediaRules || []).length}):</strong></p>
                  {(dbConfig.whatsappAutoProductMediaRules || []).map((r, i) => (
                    <div key={i} className="pl-2 mt-1 border-l border-green-600">
                      <p>• keyword: "{r.productKeyword?.substring(0, 40)}..."</p>
                      <p className="pl-2">instanceId: {r.instanceId || '❌ null'}</p>
                      <p className="pl-2">template: {r.template ? `✅ (${r.template.length} chars)` : '❌ null'}</p>
                      <p className="pl-2">imageUrl: {r.imageUrl ? '✅' : '❌ null'}</p>
                      <p className="pl-2">videoUrl: {r.videoUrl ? '✅' : '❌ null'}</p>
                      <p className="pl-2">sendOrder: [{(r.sendOrder || []).join(', ')}]</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Zone test */}
            <div className="px-5 pb-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500">Tester l'envoi</p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="Numéro (ex: 237612345678)"
                  value={testAutoPhone}
                  onChange={e => { setTestAutoPhone(e.target.value); setTestAutoResult(null); }}
                  className="flex-1 h-9 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 focus:outline-none"
                />
                <select
                  value={testAutoProduct}
                  onChange={e => { setTestAutoProduct(e.target.value); setTestAutoResult(null); }}
                  className="w-36 h-9 px-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-green-500/20 focus:outline-none"
                >
                  <option value="">— Produit —</option>
                  {availableProducts.map(p => <option key={p._id} value={p.name}>{p.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={testAutoConfig}
                  disabled={testingAuto || !testAutoPhone.trim()}
                  className="h-9 px-3 text-xs font-medium text-white bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-40 transition flex items-center gap-1.5"
                >
                  {testingAuto ? <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>}
                  Tester
                </button>
              </div>
              {testAutoResult && (
                <p className={`text-xs px-3 py-2 rounded-lg ${testAutoResult.success ? 'bg-green-50 text-green-700' : testAutoResult.skipped ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                  {testAutoResult.success ? '✅' : testAutoResult.skipped ? '⚠️' : '❌'} {testAutoResult.message}
                </p>
              )}
            </div>

            {/* Footer boutons */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex items-center justify-between gap-3">
              <button
                onClick={() => setShowAutoConfigModal(false)}
                className="min-h-[44px] px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition"
              >
                Annuler
              </button>
              <button
                onClick={saveAutoConfig}
                disabled={savingAutoConfig}
                className="flex min-h-[44px] items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition disabled:opacity-50"
              >
                {savingAutoConfig ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                )}
                Activer Auto WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configuration WhatsApp Automatique */}


      {/* Modal Créer/Modifier Commande */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowOrderModal(false)}>
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{editingOrder ? 'Modifier la commande' : 'Nouvelle commande'}</h3>
              <button onClick={() => setShowOrderModal(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50" aria-label="Fermer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nom client *</label>
                  <input type="text" value={orderForm.clientName} onChange={e => setOrderForm({...orderForm, clientName: e.target.value})}
                    placeholder="Nom complet" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 focus:border-primary-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Telephone *</label>
                  <input type="text" value={orderForm.clientPhone} onChange={e => setOrderForm({...orderForm, clientPhone: e.target.value})}
                    placeholder="06..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 focus:border-primary-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ville</label>
                  <input type="text" value={orderForm.city} onChange={e => setOrderForm({...orderForm, city: e.target.value})}
                    placeholder="Ville" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 focus:border-primary-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Adresse</label>
                  <input type="text" value={orderForm.address} onChange={e => setOrderForm({...orderForm, address: e.target.value})}
                    placeholder="Adresse de livraison" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 focus:border-primary-600" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Produit *</label>
                {loadingProducts ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-400">
                    Chargement des produits...
                  </div>
                ) : availableProducts.length > 0 ? (
                  <select
                    value={orderForm.productId}
                    onChange={e => {
                      const selectedProduct = availableProducts.find(p => p._id === e.target.value);
                      setOrderForm({
                        ...orderForm,
                        productId: e.target.value,
                        product: selectedProduct?.name || '',
                        price: selectedProduct?.sellingPrice || orderForm.price
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
                  >
                    <option value="">Sélectionner un produit</option>
                    {availableProducts.map(product => (
                      <option key={product._id} value={product._id}>
                        {product.name} - Stock: {product.stock} - {product.sellingPrice || 0} FCFA
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={orderForm.product}
                    onChange={e => setOrderForm({...orderForm, product: e.target.value})}
                    placeholder="Nom du produit (aucun produit en stock)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
                  />
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prix</label>
                  <input type="number" value={orderForm.price} onChange={e => setOrderForm({...orderForm, price: parseFloat(e.target.value) || 0})}
                    min="0" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 focus:border-primary-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantite</label>
                  <input type="number" value={orderForm.quantity} onChange={e => setOrderForm({...orderForm, quantity: parseInt(e.target.value) || 1})}
                    min="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 focus:border-primary-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
                  <select value={orderForm.status} onChange={e => { if (e.target.value === '__custom') { const c = prompt('Entrez le statut personnalisé :'); if (c && c.trim()) setOrderForm({...orderForm, status: c.trim()}); } else setOrderForm({...orderForm, status: e.target.value}); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 focus:border-primary-600">
                    {Object.entries(SL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    {!SL[orderForm.status] && <option value={orderForm.status}>{orderForm.status}</option>}
                    <option value="__custom">+ Personnalisé...</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={orderForm.notes} onChange={e => setOrderForm({...orderForm, notes: e.target.value})}
                  rows={2} placeholder="Notes, remarques..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-600 focus:border-primary-600 resize-none" />
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex gap-3">
              <button onClick={() => setShowOrderModal(false)} className="flex-1 min-h-[44px] px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">
                Annuler
              </button>
              <button onClick={handleSaveOrder} disabled={savingOrder}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
                {savingOrder ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Enregistrement...</>
                ) : editingOrder ? 'Modifier' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showWhatsAppConfig && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50" onClick={() => setShowWhatsAppConfig(false)}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Notifications</h3>
                <p className="text-xs text-gray-400 mt-0.5">Configuration WhatsApp</p>
              </div>
              <button onClick={() => setShowWhatsAppConfig(false)} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">

              {/* ── Section Closeuses ── */}
              <section>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900">Closeuses</h4>
                </div>
                <p className="text-xs text-gray-400 mb-4 pl-[38px]">Reçoivent un message à chaque nouvelle commande.</p>

                <div className="space-y-3">
                  {closeuseNotifNumbers.map((item, idx) => (
                    <div key={idx} className={`rounded-xl border p-4 transition-colors ${item.isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50/50'}`}>
                      {/* Row 1: Label + Phone + Toggle + Delete */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Label"
                          value={item.label}
                          onChange={e => setCloseuseNotifNumbers(prev => prev.map((n, i) => i === idx ? { ...n, label: e.target.value } : n))}
                          className="flex-1 min-w-0 h-10 px-3 bg-gray-50 border-0 rounded-lg text-sm text-gray-900 placeholder:text-gray-300 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition"
                        />
                        <input
                          type="tel"
                          placeholder="+237..."
                          value={item.phoneNumber}
                          onChange={e => setCloseuseNotifNumbers(prev => prev.map((n, i) => i === idx ? { ...n, phoneNumber: e.target.value } : n))}
                          className="w-[140px] h-10 px-3 bg-gray-50 border-0 rounded-lg text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setCloseuseNotifNumbers(prev => prev.map((n, i) => i === idx ? { ...n, isActive: !n.isActive } : n))}
                          className={`relative h-6 w-11 rounded-full transition-colors flex-shrink-0 ${item.isActive ? 'bg-emerald-500' : 'bg-gray-200'}`}
                          title={item.isActive ? 'Actif' : 'Inactif'}
                        >
                          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${item.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCloseuseNotifNumbers(prev => prev.filter((_, i) => i !== idx))}
                          className="h-8 w-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>

                      {/* Row 2: Instance WhatsApp */}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        <select
                          value={item.instanceId || ''}
                          onChange={e => setCloseuseNotifNumbers(prev => prev.map((n, i) => i === idx ? { ...n, instanceId: e.target.value || null } : n))}
                          className="flex-1 h-7 px-2 bg-gray-50 border border-gray-200 rounded-lg text-[11px] text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        >
                          <option value="">— Instance par défaut du workspace —</option>
                          {whatsappInstances.map(inst => (
                            <option key={inst._id} value={inst._id}>
                              {inst.customName || inst.instanceName}{inst.status ? ` (${inst.status})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Row 3: Products */}
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(item.products || []).map((prod, pidx) => (
                            <span key={pidx} className="inline-flex items-center gap-1 h-6 px-2 bg-emerald-50 text-emerald-700 rounded-md text-[11px] font-medium">
                              {prod}
                              <button type="button" onClick={() => setCloseuseNotifNumbers(prev => prev.map((n, i) => i === idx ? { ...n, products: (n.products || []).filter((_, pi) => pi !== pidx) } : n))} className="text-emerald-400 hover:text-red-500 transition">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                              </button>
                            </span>
                          ))}
                          <select
                            value=""
                            onChange={e => {
                              const val = e.target.value;
                              if (val && !(item.products || []).includes(val)) {
                                setCloseuseNotifNumbers(prev => prev.map((n, i) => i === idx ? { ...n, products: [...(n.products || []), val] } : n));
                              }
                            }}
                            className="flex-1 min-w-[140px] h-7 px-2 bg-gray-50 border border-gray-200 rounded-lg text-[11px] text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                          >
                            <option value="">{item.products?.length ? '+ Ajouter un produit...' : 'Tous les produits (sélectionner pour filtrer)'}</option>
                            {availableProducts.filter(p => !(item.products || []).includes(p.name)).map(p => (
                              <option key={p._id} value={p.name}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setCloseuseNotifNumbers(prev => [...prev, { label: '', phoneNumber: '', isActive: true, products: [] }])}
                  className="mt-3 inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-dashed border-gray-200 hover:border-gray-300 rounded-lg transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  Ajouter
                </button>
              </section>

              {/* ── Section Groupes de Livraison ── */}
              <section>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900">Groupes de livraison</h4>
                  </div>
                  <a href="/ecom/settings?tab=delivery_groups" className="text-[11px] font-medium text-gray-400 hover:text-gray-600 transition">
                    Gérer
                  </a>
                </div>
                <p className="text-xs text-gray-400 mb-4 pl-[38px]">Groupes notifiés à chaque nouvelle commande.</p>

                {deliveryGroupNumbers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 py-8 flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </div>
                    <p className="text-xs text-gray-400">Aucun groupe configuré</p>
                    <a href="/ecom/settings?tab=delivery_groups" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 transition">
                      Configurer dans Paramètres
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deliveryGroupNumbers.map((item, idx) => (
                      <label key={idx} className={`flex items-center gap-3 h-14 px-4 rounded-xl border cursor-pointer transition-all ${item.isActive !== false ? 'border-gray-200 bg-white hover:border-gray-300' : 'border-gray-100 bg-gray-50/50'}`}>
                        <input
                          type="checkbox"
                          checked={item.isActive !== false}
                          onChange={() => setDeliveryGroupNumbers(prev => prev.map((n, i) => i === idx ? { ...n, isActive: n.isActive === false ? true : false } : n))}
                          className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/20 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{item.label || 'Groupe sans nom'}</p>
                          <p className="text-[11px] font-mono text-gray-400 truncate">{item.phoneNumber}</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.isActive !== false ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                          {item.isActive !== false ? 'Actif' : 'Off'}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </section>

              {/* Test result */}
              {testNotifResult && (
                <div className={`rounded-xl p-4 text-xs ${testNotifResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                  <p className="font-semibold">{testNotifResult.success ? 'Envoi réussi' : 'Erreur'} — {testNotifResult.message}</p>
                  {testNotifResult.results?.map((r, i) => (
                    <p key={i} className="font-mono text-[11px] mt-1 opacity-75">
                      {r.status === 'ok' ? 'OK' : 'Erreur'} — {r.label ? `${r.label} — ` : ''}{r.phone || r.jid || ''}
                      {r.error ? ` : ${r.error}` : ''}
                    </p>
                  ))}
                  {!testNotifResult.success && testNotifResult.results?.some(r => r.error?.toLowerCase().includes('déconnect') || r.error?.toLowerCase().includes('reconnect')) && (
                    <a href="/ecom/whatsapp" className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-red-700 hover:text-red-800 transition">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                      Reconnecter WhatsApp
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                type="button"
                onClick={testNotifConfig}
                disabled={testingNotifConfig || savingNotifConfig}
                className="h-11 px-4 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl disabled:opacity-40 transition flex items-center gap-2"
              >
                {testingNotifConfig ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/>
                ) : (
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                )}
                Tester
              </button>
              <button
                type="button"
                onClick={saveNotifConfig}
                disabled={savingNotifConfig}
                className="flex-1 h-11 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                {savingNotifConfig ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                )}
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pour ajouter/modifier un numéro WhatsApp */}
      {showWhatsAppMultiConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowWhatsAppMultiConfig(false)}>
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
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
                  className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                  className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                className="flex-1 min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={saveWhatsAppNumber}
                disabled={savingWhatsAppNumber}
                className="flex-1 min-h-[44px] px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
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
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Synchroniser les clients</h3>
              <button onClick={() => setShowSyncClientsModal(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50" aria-label="Fermer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Sélectionnez les statuts de commandes ù  synchroniser :
            </p>
            
            <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
              {[
                { key: 'delivered', label: 'Livré', color: 'bg-green-500' },
                { key: 'confirmed', label: 'Confirmé', color: 'bg-primary-600' },
                { key: 'shipped', label: 'Expédié', color: 'bg-primary-600' },
                { key: 'pending', label: 'En attente', color: 'bg-yellow-500' },
                { key: 'returned', label: 'Retour', color: 'bg-orange-500' },
                { key: 'cancelled', label: 'Annulé', color: 'bg-red-500' },
                { key: 'unreachable', label: 'Injoignable', color: 'bg-gray-500' },
                { key: 'called', label: 'Appelé', color: 'bg-cyan-500' },
                { key: 'postponed', label: 'Reporté', color: 'bg-amber-500' }
              ].map(status => (
                <label key={status.key} className="flex min-h-[44px] items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
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
                className="flex-1 min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleSyncClients}
                disabled={syncProgress !== null || syncClientsStatuses.length === 0}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
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
