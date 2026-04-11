import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Search, ChevronLeft, ChevronRight, Loader2, AlertCircle, Phone, Plus, MoreHorizontal, Filter, Columns3, ArrowUpDown, X, MapPin, Clock, Trash2, MessageCircle, Package, Edit3 } from 'lucide-react';
import { storeOrdersApi } from '../services/storeApi.js';
import { Link, useNavigate } from 'react-router-dom';
import { formatMoney } from '../utils/currency.js';

const STATUS_OPTIONS = [
  { value: '', label: 'Toutes' },
  { value: 'pending', label: 'Non traitées' },
  { value: 'confirmed', label: 'Non payées' },
  { value: 'processing', label: 'Ouvertes' },
  { value: 'delivered', label: 'Archivées' },
];

const ALL_STATUSES = [
  { value: 'pending', label: 'En attente' },
  { value: 'confirmed', label: 'Confirmée' },
  { value: 'processing', label: 'En traitement' },
  { value: 'shipped', label: 'Expédiée' },
  { value: 'delivered', label: 'Livrée' },
  { value: 'cancelled', label: 'Annulée' },
];

const PAYMENT_STATUS = {
  pending: { label: 'Paiement en attente', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
  confirmed: { label: 'Paiement en attente', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
  processing: { label: 'En cours', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
  shipped: { label: 'Payée', color: 'bg-gray-100 text-gray-700', dot: 'bg-green-500' },
  delivered: { label: 'Payée', color: 'bg-gray-100 text-gray-700', dot: 'bg-green-500' },
  cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-700', dot: 'bg-red-400' },
  paid: { label: 'Payée', color: 'bg-gray-100 text-gray-700', dot: 'bg-green-500' },
};

const FULFILLMENT_STATUS = {
  pending: { label: 'Non traité', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
  confirmed: { label: 'Non traité', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
  processing: { label: 'En cours', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
  shipped: { label: 'Expédié', color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
  delivered: { label: 'Livré', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-700', dot: 'bg-red-400' },
};

const StoreOrdersDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const navigate = useNavigate();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  const fetchOrders = useCallback(async (page = 1, status = '', searchTerm = '') => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (status) params.status = status;
      if (searchTerm) params.search = searchTerm;
      const res = await storeOrdersApi.getOrders(params);
      const data = res.data?.data;
      setOrders(data?.orders || []);
      setPagination(data?.pagination || { page: 1, limit: 50, total: 0, pages: 0 });
    } catch {
      setError('Impossible de charger les commandes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(1, statusFilter, ''); }, [fetchOrders, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => fetchOrders(1, statusFilter, search), 400);
    return () => clearTimeout(timer);
  }, [search, statusFilter, fetchOrders]);

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingStatus(true);
    try {
      await storeOrdersApi.updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder?._id === orderId) setSelectedOrder(prev => ({ ...prev, status: newStatus }));
    } catch {
      setError('Erreur lors de la mise à jour');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async (orderId) => {
    if (!window.confirm('Supprimer cette commande ?')) return;
    setDeleting(true);
    try {
      await storeOrdersApi.deleteOrder(orderId);
      setOrders(prev => prev.filter(o => o._id !== orderId));
      setSelectedOrder(null);
      setPagination(prev => ({ ...prev, total: prev.total - 1 }));
    } catch {
      setError('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Supprimer ${selectedOrders.length} commande(s) ?`)) return;
    try {
      await storeOrdersApi.bulkDelete(selectedOrders);
      setOrders(prev => prev.filter(o => !selectedOrders.includes(o._id)));
      setPagination(prev => ({ ...prev, total: prev.total - selectedOrders.length }));
      setSelectedOrders([]);
    } catch {
      setError('Erreur lors de la suppression');
    }
  };

  const handleBulkStatus = async (status) => {
    try {
      await storeOrdersApi.bulkStatus(selectedOrders, status);
      setOrders(prev => prev.map(o => selectedOrders.includes(o._id) ? { ...o, status } : o));
      setSelectedOrders([]);
      setShowBulkMenu(false);
    } catch {
      setError('Erreur lors de la mise à jour');
    }
  };

  const formatPrice = (amount, currency) => formatMoney(amount, currency);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return "aujourd'hui à " + time;
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'hier à ' + time;
    if (Math.floor((now - d) / 86400000) < 7) return dayNames[d.getDay()] + ' à ' + time;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + time;
  };

  const formatDateLong = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const toggleSelectAll = () => setSelectedOrders(selectedOrders.length === orders.length ? [] : orders.map(o => o._id));
  const toggleSelect = (id) => setSelectedOrders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const totalArticles = (order) => order.products?.reduce((sum, p) => sum + (p.quantity || 1), 0) || 0;

  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString());
  const todayItems = todayOrders.reduce((s, o) => s + totalArticles(o), 0);
  const returnOrders = orders.filter(o => o.status === 'cancelled');
  const fulfilledOrders = orders.filter(o => o.status === 'delivered' || o.status === 'shipped');

  const whatsappLink = (order) => {
    const phone = (order.phone || '').replace(/\D/g, '');
    if (!phone) return null;
    const statusLabel = ALL_STATUSES.find(s => s.value === order.status)?.label || order.status;
    return `https://wa.me/${phone}?text=${encodeURIComponent(`Bonjour ${order.customerName || ''}, votre commande #${order.orderNumber || ''} est ${statusLabel.toLowerCase()}. Merci !`)}`;
  };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 flex items-center justify-between border-b border-gray-200 bg-white">
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-gray-700" />
          Commandes
        </h1>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">Exporter</button>
          {selectedOrders.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowBulkMenu(!showBulkMenu)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-1"
              >
                {selectedOrders.length} sélectionnée(s) <MoreHorizontal size={14} />
              </button>
              {showBulkMenu && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1">
                  <p className="px-3 py-1.5 text-xs text-gray-400 font-medium">Changer le statut</p>
                  {ALL_STATUSES.map(s => (
                    <button key={s.value} onClick={() => handleBulkStatus(s.value)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">{s.label}</button>
                  ))}
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={handleBulkDelete} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                    <Trash2 size={14} /> Supprimer ({selectedOrders.length})
                  </button>
                </div>
              )}
            </div>
          )}
          <Link to="/ecom/boutique/orders/new" className="px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition">
            Créer une commande
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="px-4 sm:px-6 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-stretch gap-0 divide-x divide-gray-200 overflow-x-auto">
          <KpiMini label="Aujourd'hui" icon="📅" />
          <KpiMini label="Commandes" value={todayOrders.length} spark />
          <KpiMini label="Articles commandés" value={todayItems} spark />
          <KpiMini label="Retours" value={formatPrice(returnOrders.reduce((s, o) => s + (o.total || 0), 0))} spark />
          <KpiMini label="Commandes traitées" value={fulfilledOrders.length} spark />
          <KpiMini label="Commandes livrées" value={orders.filter(o => o.status === 'delivered').length} spark />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6 bg-white border-b border-gray-200">
        <div className="flex items-center gap-0">
          {STATUS_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
              className={"px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap " +
                (statusFilter === opt.value ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')}>
              {opt.label}
            </button>
          ))}
          <button className="px-3 py-2.5 text-gray-400 hover:text-gray-600"><Plus size={16} /></button>
        </div>
      </div>

      {error && (
        <div className="mx-4 sm:mx-6 mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Search */}
      <div className="px-4 sm:px-6 py-3 bg-white flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher des commandes"
            className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 bg-gray-50" />
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition"><Filter size={16} /></button>
          <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition"><Columns3 size={16} /></button>
          <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition"><ArrowUpDown size={16} /></button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white">
        {loading ? (
          <div className="px-4 sm:px-6">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100">
                <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                <div className="flex-1" />
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-gray-500 mt-3 text-sm">Aucune commande</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="pl-4 sm:pl-6 pr-2 py-2.5 w-8">
                    <input type="checkbox" checked={selectedOrders.length === orders.length && orders.length > 0} onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500" />
                  </th>
                  <th className="px-2 py-2.5 text-xs font-medium text-gray-500">Commande</th>
                  <th className="px-2 py-2.5 text-xs font-medium text-gray-500">Date ↓</th>
                  <th className="px-2 py-2.5 text-xs font-medium text-gray-500">Client</th>
                  <th className="px-2 py-2.5 text-xs font-medium text-gray-500">Canal</th>
                  <th className="px-2 py-2.5 text-xs font-medium text-gray-500">Total</th>
                  <th className="px-2 py-2.5 text-xs font-medium text-gray-500">Statut du paiement</th>
                  <th className="px-2 py-2.5 text-xs font-medium text-gray-500">Statut du traitement</th>
                  <th className="px-2 py-2.5 text-xs font-medium text-gray-500">Articles</th>
                  <th className="px-2 py-2.5 text-xs font-medium text-gray-500">Livraison</th>
                  <th className="px-2 py-2.5 text-xs font-medium text-gray-500 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const payment = PAYMENT_STATUS[order.paymentStatus || order.status] || PAYMENT_STATUS.pending;
                  const fulfillment = FULFILLMENT_STATUS[order.fulfillmentStatus || order.status] || FULFILLMENT_STATUS.pending;
                  const items = totalArticles(order);
                  const isSelected = selectedOrders.includes(order._id);
                  return (
                    <tr key={order._id} onClick={() => navigate(`/ecom/orders/${order.linkedOrderId || order._id}`)}
                      className={"border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer " + (isSelected ? 'bg-blue-50' : '')}>
                      <td className="pl-4 sm:pl-6 pr-2 py-2.5">
                        <input type="checkbox" checked={isSelected} onChange={(e) => { e.stopPropagation(); toggleSelect(order._id); }}
                          className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500" />
                      </td>
                      <td className="px-2 py-2.5 font-medium text-gray-900 whitespace-nowrap">#{order.orderNumber || order._id?.slice(-4)}</td>
                      <td className="px-2 py-2.5 text-gray-500 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                      <td className="px-2 py-2.5 text-gray-900 whitespace-nowrap">{order.customerName || '-'}</td>
                      <td className="px-2 py-2.5 text-gray-500 whitespace-nowrap">{order.channel || order.source || ''}</td>
                      <td className="px-2 py-2.5 font-medium text-gray-900 whitespace-nowrap">{formatPrice(order.total, order.currency)}</td>
                      <td className="px-2 py-2.5 whitespace-nowrap">
                        <StatusBadge {...payment} />
                      </td>
                      <td className="px-2 py-2.5 whitespace-nowrap">
                        <StatusBadge {...fulfillment} />
                      </td>
                      <td className="px-2 py-2.5 text-gray-500 whitespace-nowrap">{items} article{items > 1 ? 's' : ''}</td>
                      <td className="px-2 py-2.5 whitespace-nowrap">
                        {order.status === 'delivered' ? <StatusBadge label="Livré" color="bg-emerald-100 text-emerald-700" dot="bg-emerald-500" />
                          : order.status === 'shipped' ? <StatusBadge label="En transit" color="bg-purple-100 text-purple-700" dot="bg-purple-500" />
                          : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-2 py-2.5">
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(order._id); }}
                          className="p-1 text-gray-400 hover:text-red-500 rounded transition" title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 0 && (
        <div className="px-4 sm:px-6 py-3 bg-white border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => fetchOrders(pagination.page - 1, statusFilter, search)} disabled={pagination.page <= 1}
              className="p-1.5 rounded border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => fetchOrders(pagination.page + 1, statusFilter, search)} disabled={pagination.page >= pagination.pages}
              className="p-1.5 rounded border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="text-sm text-gray-500">
            {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}
          </span>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-base font-bold text-gray-900">Commande #{selectedOrder.orderNumber || selectedOrder._id?.slice(-4)}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{formatDateLong(selectedOrder.createdAt)}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><X size={18} /></button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* Status Change */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Statut de la commande</label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_STATUSES.map(s => (
                    <button key={s.value} onClick={() => handleStatusChange(selectedOrder._id, s.value)} disabled={updatingStatus}
                      className={"px-3 py-1.5 text-xs font-medium rounded-lg border transition " +
                        (selectedOrder.status === s.value
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')}>
                      {s.label}
                    </button>
                  ))}
                </div>
                {updatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 mt-1.5" />}
              </div>

              {/* Customer Info */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Client</h3>
                <p className="text-sm font-semibold text-gray-900">{selectedOrder.customerName || '-'}</p>
                {selectedOrder.phone && (
                  <p className="text-sm text-gray-600 flex items-center gap-1.5">
                    <Phone size={13} />
                    <a href={'tel:' + selectedOrder.phone} className="text-emerald-600 hover:underline">{selectedOrder.phone}</a>
                  </p>
                )}
                {selectedOrder.email && <p className="text-sm text-gray-600">{selectedOrder.email}</p>}
                {(selectedOrder.city || selectedOrder.address) && (
                  <p className="text-sm text-gray-600 flex items-center gap-1.5">
                    <MapPin size={13} />
                    {[selectedOrder.address, selectedOrder.city, selectedOrder.country].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>

              {/* Products */}
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Articles</h3>
                <div className="space-y-2">
                  {selectedOrder.products?.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                      {p.image && <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-500">Qté: {p.quantity || 1} × {formatPrice(p.price, selectedOrder.currency)}</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{formatPrice((p.price || 0) * (p.quantity || 1), selectedOrder.currency)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between py-3 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-500">Total</span>
                <span className="text-lg font-bold text-gray-900">{formatPrice(selectedOrder.total, selectedOrder.currency)}</span>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="bg-yellow-50 rounded-xl p-3">
                  <p className="text-xs font-medium text-yellow-700 mb-1">Notes</p>
                  <p className="text-sm text-yellow-800">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                {whatsappLink(selectedOrder) && (
                  <a href={whatsappLink(selectedOrder)} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition">
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                )}
                <button onClick={() => handleDelete(selectedOrder._id)} disabled={deleting}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition disabled:opacity-50">
                  <Trash2 size={16} /> {deleting ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatusBadge = ({ label, color, dot }) => (
  <span className={"inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium " + color}>
    <span className={"w-1.5 h-1.5 rounded-full " + dot}></span>
    {label}
  </span>
);

const KpiMini = ({ label, value, icon, spark }) => (
  <div className="flex-1 min-w-0 px-4 py-2 first:pl-0">
    <div className="flex items-center gap-1.5">
      {icon && <span className="text-sm">{icon}</span>}
      <span className="text-xs text-gray-500 whitespace-nowrap">{label}</span>
    </div>
    {value !== undefined && (
      <div className="flex items-baseline gap-2 mt-0.5">
        <span className="text-sm font-bold text-gray-900">{value}</span>
        <span className="text-xs text-gray-400">—</span>
        {spark && <div className="h-1 w-12 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full" />}
      </div>
    )}
  </div>
);

export default StoreOrdersDashboard;
