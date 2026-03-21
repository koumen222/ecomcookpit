import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ecomApi from '../services/ecommApi';
import { useMoney } from '../hooks/useMoney';
import { getContextualError } from '../utils/errorMessages';

const EMPTY_ORDER_FORM = {
  productId: '', productName: '', sourcing: 'local', quantity: '',
  weightKg: '', pricePerKg: '', purchasePrice: '', sellingPrice: '',
  supplierName: '', expectedArrival: '', trackingNumber: '', notes: '',
  paidPurchase: false, paidTransport: false, paid: false
};

const I = {
  plus: 'M12 4v16m8-8H4',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  box: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  chevronRight: 'M9 5l7 7-7 7'
};

const Ico = ({d, className="w-5 h-5"}) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={d}/></svg>
);

export default function SourcingList() {
  const navigate = useNavigate();
  const { fmt: formatMoney } = useMoney();
  
  // Tab state
  const [activeTab, setActiveTab] = useState('commandes');
  
  // Suppliers state
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  
  // Supplier Modal state
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', link: '', email: '', notes: '' });
  
  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [products, setProducts] = useState([]);
  
  // Order Modal state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [orderFormData, setOrderFormData] = useState(EMPTY_ORDER_FORM);
  const [orderFormLoading, setOrderFormLoading] = useState(false);
  const [orderFormError, setOrderFormError] = useState('');

  useEffect(() => {
    loadSuppliers();
    loadOrders();
    loadProducts();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const res = await ecomApi.get('/sourcing/suppliers');
      setSuppliers(res.data.data || []);
      setError(null);
    } catch (err) {
      setError(getContextualError(err, 'load_sourcing'));
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      setOrdersLoading(true);

      const response = await ecomApi.get('/sourcing/orders');
      const ordersData = response.data?.data?.orders || response.data?.data || [];
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (err) {
      console.error('Erreur chargement commandes:', err);
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const r = await ecomApi.get('/products', { params: { isActive: true } });
      const d = r.data?.data || [];
      setProducts(Array.isArray(d) ? d : []);
    } catch { setProducts([]); }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase()) || 
    (s.phone && s.phone.includes(search))
  );

  // Calcul du montant à prévoir (en transit non payé) et chiffre d'affaires potentiel
  const { amountToPlan, chinaPurchaseToPlan, chinaTransportToPlan, localToPlan, potentialRevenue } = React.useMemo(() => {
    const inTransitOrders = orders.filter(o => o.status === 'in_transit');
    
    let chinaPurchase = 0;
    let chinaTransport = 0;
    let local = 0;
    let revenue = 0;
    
    inTransitOrders.forEach(order => {
      const totalSelling = (order.sellingPrice || 0) * (order.quantity || 0);
      revenue += totalSelling;
      
      if (order.sourcing === 'chine') {
        // Achat Chine payé ?
        if (!order.paidPurchase) {
          chinaPurchase += (order.purchasePrice || 0) * (order.quantity || 0);
        }
        // Transport payé ?
        if (!order.paidTransport) {
          chinaTransport += order.transportCost || 0;
        }
      } else if (order.sourcing === 'local') {
        // Commande locale payée ?
        if (!order.paid) {
          local += (order.purchasePrice || 0) * (order.quantity || 0);
        }
      }
    });
    
    return {
      amountToPlan: chinaPurchase + chinaTransport + local,
      chinaPurchaseToPlan: chinaPurchase,
      chinaTransportToPlan: chinaTransport,
      localToPlan: local,
      potentialRevenue: revenue
    };
  }, [orders]);

  // Supplier handlers
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await ecomApi.put(`/sourcing/suppliers/${editingId}`, formData);
      } else {
        await ecomApi.post('/sourcing/suppliers', formData);
      }
      closeSupplierModal();
      loadSuppliers();
    } catch (err) {
      alert(getContextualError(err, 'save_sourcing'));
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Supprimer ce fournisseur ?")) return;
    try {
      await ecomApi.delete(`/sourcing/suppliers/${id}`);
      loadSuppliers();
    } catch (err) {
      alert(getContextualError(err, 'delete_sourcing'));
    }
  };

  const openSupplierModal = (supplier = null) => {
    if (supplier) {
      setEditingId(supplier._id);
      setFormData({ name: supplier.name || '', phone: supplier.phone || '', link: supplier.link || '', email: supplier.email || '', notes: supplier.notes || '' });
    } else {
      setEditingId(null);
      setFormData({ name: '', phone: '', link: '', email: '', notes: '' });
    }
    setShowSupplierModal(true);
  };

  const closeSupplierModal = () => {
    setShowSupplierModal(false);
    setEditingId(null);
  };

  // Order handlers
  const openOrderModal = (order = null) => {
    if (order) {
      setEditingOrderId(order._id);
      setOrderFormData({
        productId: order.productId?._id || order.productId || '',
        productName: order.productName || '',
        sourcing: order.sourcing || 'local',
        quantity: order.quantity?.toString() || '',
        weightKg: order.weightKg?.toString() || '',
        pricePerKg: order.pricePerKg?.toString() || '',
        purchasePrice: order.purchasePrice?.toString() || '',
        sellingPrice: order.sellingPrice?.toString() || '',
        supplierName: order.supplierName || '',
        expectedArrival: order.expectedArrival ? new Date(order.expectedArrival).toISOString().split('T')[0] : '',
        trackingNumber: order.trackingNumber || '',
        notes: order.notes || '',
        paidPurchase: order.paidPurchase || false,
        paidTransport: order.paidTransport || false,
        paid: order.paid || false
      });
    } else {
      setEditingOrderId(null);
      setOrderFormData(EMPTY_ORDER_FORM);
    }
    setOrderFormError('');
    setShowOrderModal(true);
  };

  const closeOrderModal = () => {
    setShowOrderModal(false);
    setEditingOrderId(null);
    setOrderFormData(EMPTY_ORDER_FORM);
    setOrderFormError('');
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    setOrderFormLoading(true);
    setOrderFormError('');
    
    const qty = parseInt(orderFormData.quantity) || 0;
    const wKg = parseFloat(orderFormData.weightKg) || 0;
    const pKg = parseFloat(orderFormData.pricePerKg) || 0;
    const pp = parseFloat(orderFormData.purchasePrice) || 0;
    const sp = parseFloat(orderFormData.sellingPrice) || 0;
    const tc = wKg * pKg;
    
    const payload = {
      productId: orderFormData.productId || undefined,
      productName: orderFormData.productName,
      sourcing: orderFormData.sourcing,
      quantity: qty, weightKg: wKg, pricePerKg: pKg,
      purchasePrice: pp, sellingPrice: sp, transportCost: tc,
      supplierName: orderFormData.supplierName,
      expectedArrival: orderFormData.expectedArrival || undefined,
      trackingNumber: orderFormData.trackingNumber,
      notes: orderFormData.notes,
      paidPurchase: orderFormData.paidPurchase,
      paidTransport: orderFormData.paidTransport,
      paid: orderFormData.paid
    };
    
    try {
      if (editingOrderId) {
        await ecomApi.put(`/sourcing/orders/${editingOrderId}`, payload);
      } else {
        await ecomApi.post('/sourcing/orders', payload);
      }
      closeOrderModal();
      loadOrders();
    } catch (err) {
      setOrderFormError(getContextualError(err, 'save_order'));
    } finally {
      setOrderFormLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, action) => {
    try {
      // Si on reçoit le produit, on met automatiquement tous les paiements à payé
      if (action === 'receive') {
        await ecomApi.put(`/sourcing/orders/${orderId}`, {
          status: 'received',
          paidPurchase: true,
          paidTransport: true,
          paid: true
        });
      } else if (action === 'back-to-transit') {
        // Repasser en transit
        await ecomApi.put(`/sourcing/orders/${orderId}`, {
          status: 'in_transit'
        });
      } else {
        await ecomApi.put(`/sourcing/orders/${orderId}/${action}`);
      }
      loadOrders();
    } catch (err) {
      setError(getContextualError(err, 'save_order'));
    }
  };

  const deleteOrder = async (orderId) => {
    if (!window.confirm('Supprimer cette commande ? Cette action est irréversible.')) return;
    try {
      await ecomApi.delete(`/sourcing/orders/${orderId}`);
      loadOrders();
    } catch (err) {
      setError(getContextualError(err, 'delete_order'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 lg:pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Ico d={I.building} className="w-6 h-6 text-gray-400" />
                Sourcing & Fournisseurs
              </h1>
              <p className="text-sm text-gray-500 mt-1 font-medium">Gérez vos fournisseurs et commandes d'approvisionnement</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/ecom/sourcing/stats')}
                className="inline-flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-purple-700 transition active:scale-95 shadow-sm">
                <Ico d={I.chart} className="w-4 h-4" />
                Statistiques
              </button>
              <button onClick={() => openOrderModal()}
                className="inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition active:scale-95 shadow-sm">
                <Ico d={I.plus} className="w-4 h-4" />
                + Commande fournisseur
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 mt-4 border-b border-gray-200 -mb-px">
            <button onClick={() => setActiveTab('commandes')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === 'commandes' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Commandes
            </button>
            <button onClick={() => setActiveTab('fournisseurs')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === 'fournisseurs' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Fournisseurs
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium flex items-center gap-2 border border-red-100">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 mb-6 overflow-x-auto">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm min-w-0">
            <p className="text-xs font-medium text-blue-600 truncate">Total fournisseurs</p>
            <p className="text-lg font-bold text-blue-900 truncate">{suppliers.length}</p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm min-w-0">
            <p className="text-xs font-medium text-emerald-600 truncate">Commandes</p>
            <p className="text-lg font-bold text-emerald-900 truncate">{orders.length}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm min-w-0">
            <p className="text-xs font-medium text-purple-600 truncate">Total dépensé</p>
            <p className="text-lg font-bold text-purple-900 truncate">
              {formatMoney(orders.reduce((acc, o) => acc + ((o.purchasePrice || 0) * (o.quantity || 0) + (o.transportCost || 0)), 0))}
            </p>
          </div>

          <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 shadow-sm min-w-0">
            <p className="text-xs font-medium text-orange-600 truncate">Montant à prévoir</p>
            <p className="text-lg font-bold text-orange-900 truncate">{formatMoney(amountToPlan)}</p>
            <p className="text-xs text-orange-600 font-medium mt-1 truncate">
              Achat: {formatMoney(chinaPurchaseToPlan)}
            </p>
            <p className="text-xs text-orange-600 font-medium truncate">
              Transport: {formatMoney(chinaTransportToPlan)}
            </p>
            {localToPlan > 0 && (
              <p className="text-xs text-orange-600 font-medium truncate">
                Local: {formatMoney(localToPlan)}
              </p>
            )}
          </div>

          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm min-w-0">
            <p className="text-xs font-medium text-emerald-600 truncate">CA potentiel</p>
            <p className="text-lg font-bold text-emerald-700 truncate">{formatMoney(potentialRevenue)}</p>
            <p className="text-xs text-emerald-600 font-medium mt-1 truncate">
              {orders.filter(o => o.status === 'in_transit').length} en transit
            </p>
          </div>
        </div>

        {/* TAB: COMMANDES */}
        {activeTab === 'commandes' && (
          <div>
            {ordersLoading ? (
              <div className="text-center py-12 text-gray-500 font-medium animate-pulse">Chargement des commandes...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                  <Ico d={I.box} className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Aucune commande</h3>
                <p className="text-gray-500 text-sm font-medium mb-6">Créez votre première commande fournisseur.</p>
                <button onClick={() => openOrderModal()} className="inline-flex bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition">
                  + Commande fournisseur
                </button>
              </div>
            ) : (
              <div className="bg-white shadow rounded-xl overflow-hidden overflow-x-auto border border-gray-100">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Produit</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase hidden sm:table-cell">Sourcing</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Qté</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase hidden md:table-cell">Achat</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase hidden lg:table-cell">Transport</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Paiement</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Statut</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {orders.map((order) => {
                      const totalCost = (order.purchasePrice || 0) * (order.quantity || 0) + (order.transportCost || 0);
                      return (
                        <tr key={order._id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <button onClick={() => openOrderModal(order)} className="text-sm font-medium text-emerald-600 hover:underline text-left">{order.productName || 'N/A'}</button>
                            {order.supplierName && <div className="text-xs text-gray-500">{order.supplierName}</div>}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap hidden sm:table-cell">
                            <span className={`px-2 text-xs font-semibold rounded-full ${order.sourcing === 'chine' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {order.sourcing === 'chine' ? 'Chine' : 'Local'}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">{order.quantity || 0}</div>
                            {order.weightKg > 0 && <div className="text-xs text-gray-500">{order.weightKg} kg</div>}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap hidden md:table-cell text-sm text-gray-900">{formatMoney((order.purchasePrice || 0) * (order.quantity || 0))}</td>
                          <td className="px-4 py-4 whitespace-nowrap hidden lg:table-cell text-sm text-gray-900">{formatMoney(order.transportCost)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{formatMoney(totalCost)}</td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {order.sourcing === 'chine' ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <span className={`w-2 h-2 rounded-full ${order.paidPurchase ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                  <span className="text-xs font-medium">{order.paidPurchase ? 'Achat payé' : 'Achat impayé'}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className={`w-2 h-2 rounded-full ${order.paidTransport ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                  <span className="text-xs font-medium">{order.paidTransport ? 'Transport payé' : 'Transport impayé'}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full ${order.paid ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                <span className="text-xs font-medium">{order.paid ? 'Payé' : 'Impayé'}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`px-2 text-xs font-semibold rounded-full ${order.status === 'received' ? 'bg-green-100 text-green-800' : order.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {order.status === 'received' ? 'Reçue' : order.status === 'cancelled' ? 'Annulée' : 'En transit'}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                            <button onClick={() => openOrderModal(order)} className="text-emerald-600 hover:text-emerald-900 mr-3">Modifier</button>
                            {order.status === 'in_transit' && (
                              <button onClick={() => updateOrderStatus(order._id, 'receive')} className="text-green-600 hover:text-green-900 mr-3">Recevoir</button>
                            )}
                            {order.status === 'received' && (
                              <button onClick={() => updateOrderStatus(order._id, 'back-to-transit')} className="text-amber-600 hover:text-amber-900 mr-3">Repasser en transit</button>
                            )}
                            <button onClick={() => deleteOrder(order._id)} className="text-red-600 hover:text-red-900">Supprimer</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: FOURNISSEURS */}
        {activeTab === 'fournisseurs' && (
          <div>
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Ico d={I.search} className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Rechercher un fournisseur..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
              </div>
              <button onClick={() => openSupplierModal()}
                className="inline-flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-800 transition">
                <Ico d={I.plus} className="w-4 h-4" />
                Nouveau fournisseur
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-500 font-medium animate-pulse">Chargement...</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                  <Ico d={I.building} className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Aucun fournisseur</h3>
                <p className="text-gray-500 text-sm font-medium mb-6">Commencez par ajouter votre premier fournisseur.</p>
                <button onClick={() => openSupplierModal()} className="inline-flex bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-800 transition">
                  Ajouter un fournisseur
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSuppliers.map(supplier => (
                  <div key={supplier._id} onClick={() => navigate(`/ecom/sourcing/${supplier._id}`)}
                    className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer group relative">
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); openSupplierModal(supplier); }} className="p-2 bg-gray-50 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition">
                        <Ico d={I.edit} className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => handleDelete(supplier._id, e)} className="p-2 bg-red-50 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-100 transition">
                        <Ico d={I.trash} className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-start gap-4 pr-20">
                      <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0 text-gray-500 font-bold text-lg">
                        {supplier.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg mb-1">{supplier.name}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 font-medium mt-2">
                          {supplier.phone && <div className="flex items-center gap-1.5"><Ico d={I.phone} className="w-4 h-4" /><span>{supplier.phone}</span></div>}
                          {supplier.email && <div className="flex items-center gap-1.5"><Ico d={I.mail} className="w-4 h-4" /><span className="truncate max-w-[150px]">{supplier.email}</span></div>}
                          {supplier.link && <a href={supplier.link.startsWith('http') ? supplier.link : `https://${supplier.link}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="flex items-center gap-1.5 text-blue-600 hover:underline"><Ico d={I.link} className="w-4 h-4" /><span>Lien</span></a>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 pt-4 border-t border-gray-50 flex items-center justify-between">
                      <div className="flex gap-6">
                        <div><p className="text-[11px] font-bold text-gray-400 uppercase mb-0.5">Commandes</p><p className="font-bold text-gray-900">{supplier.stats?.totalOrders || 0}</p></div>
                        <div><p className="text-[11px] font-bold text-gray-400 uppercase mb-0.5">Dépenses</p><p className="font-bold text-emerald-600">{formatMoney(supplier.stats?.totalSpent || 0)}</p></div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-gray-900 group-hover:text-white transition-colors">
                        <Ico d={I.chevronRight} className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: FOURNISSEUR */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-lg">{editingId ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h3>
              <button onClick={closeSupplierModal} className="text-gray-400 hover:text-gray-600 transition text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Nom du fournisseur *</label>
                <input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900/10 outline-none text-sm" placeholder="Ex: Alibaba"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Téléphone</label>
                  <input type="text" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900/10 outline-none text-sm" placeholder="+86..."/>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Email</label>
                  <input type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900/10 outline-none text-sm" placeholder="contact@..."/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Lien</label>
                <input type="text" value={formData.link} onChange={e=>setFormData({...formData, link: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900/10 outline-none text-sm" placeholder="https://..."/>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Notes</label>
                <textarea value={formData.notes} onChange={e=>setFormData({...formData, notes: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900/10 outline-none text-sm resize-none" rows="3" placeholder="Notes..."></textarea>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={closeSupplierModal} className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition">Annuler</button>
                <button type="submit" className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COMMANDE */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeOrderModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-900">{editingOrderId ? 'Modifier la commande' : 'Nouvelle commande de stock'}</h2>
              <button onClick={closeOrderModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <form id="order-form" onSubmit={handleOrderSubmit} className="space-y-5">
                {orderFormError && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">{orderFormError}</div>}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Produit et sourcing</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Produit *</label>
                      <select name="productId" required value={orderFormData.productId}
                        onChange={(e) => { const sel = products.find(p => p._id === e.target.value); setOrderFormData(prev => ({ ...prev, productId: e.target.value, productName: sel?.name || prev.productName })); }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600">
                        <option value="">Sélectionnez un produit</option>
                        {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Sourcing *</label>
                      <select name="sourcing" value={orderFormData.sourcing} onChange={(e) => setOrderFormData(prev => ({ ...prev, sourcing: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600">
                        <option value="local">Local</option>
                        <option value="chine">Chine</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Quantité *</label>
                      <input type="number" name="quantity" required min="1" value={orderFormData.quantity} onChange={(e) => setOrderFormData(prev => ({ ...prev, quantity: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="100" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Fournisseur</label>
                      <input type="text" name="supplierName" value={orderFormData.supplierName} onChange={(e) => setOrderFormData(prev => ({ ...prev, supplierName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="Nom du fournisseur" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Prix et poids</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Poids total (kg)</label>
                      <input type="number" step="0.01" value={orderFormData.weightKg} onChange={(e) => setOrderFormData(prev => ({ ...prev, weightKg: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Prix par kg (FCFA)</label>
                      <input type="number" value={orderFormData.pricePerKg} onChange={(e) => setOrderFormData(prev => ({ ...prev, pricePerKg: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Prix d'achat unitaire (FCFA) *</label>
                      <input type="number" required value={orderFormData.purchasePrice} onChange={(e) => setOrderFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Prix de vente unitaire (FCFA) *</label>
                      <input type="number" required value={orderFormData.sellingPrice} onChange={(e) => setOrderFormData(prev => ({ ...prev, sellingPrice: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="0" />
                    </div>
                  </div>
                </div>

                {/* Statuts de paiement */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Statut de paiement</p>
                  {orderFormData.sourcing === 'chine' ? (
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                        <input type="checkbox" checked={orderFormData.paidPurchase} onChange={(e) => setOrderFormData(prev => ({ ...prev, paidPurchase: e.target.checked }))}
                          className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Achat Chine payé</p>
                          <p className="text-xs text-gray-500">Cochez si l'achat en Chine a été payé</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                        <input type="checkbox" checked={orderFormData.paidTransport} onChange={(e) => setOrderFormData(prev => ({ ...prev, paidTransport: e.target.checked }))}
                          className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Transport payé</p>
                          <p className="text-xs text-gray-500">Cochez si le transport a été payé</p>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                      <input type="checkbox" checked={orderFormData.paid} onChange={(e) => setOrderFormData(prev => ({ ...prev, paid: e.target.checked }))}
                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Commande payée</p>
                        <p className="text-xs text-gray-500">Cochez si la commande locale a été payée</p>
                      </div>
                    </label>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Informations complémentaires</p>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Date d'arrivée prévue</label>
                      <input type="date" value={orderFormData.expectedArrival} onChange={(e) => setOrderFormData(prev => ({ ...prev, expectedArrival: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Numéro de suivi</label>
                      <input type="text" value={orderFormData.trackingNumber} onChange={(e) => setOrderFormData(prev => ({ ...prev, trackingNumber: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="Tracking..." />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                      <textarea value={orderFormData.notes} onChange={(e) => setOrderFormData(prev => ({ ...prev, notes: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none" rows="2" placeholder="Notes..."></textarea>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-gray-50/50">
              <button type="button" onClick={closeOrderModal} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition">Annuler</button>
              <button type="submit" form="order-form" disabled={orderFormLoading} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50">
                {orderFormLoading ? 'Enregistrement...' : 'Créer la commande'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
