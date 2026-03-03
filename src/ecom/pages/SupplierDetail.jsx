import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ecomApi from '../services/ecommApi';
import { useMoney } from '../hooks/useMoney';
import { getContextualError } from '../utils/errorMessages';

const I = {
  back: 'M15 19l-7-7 7-7',
  plus: 'M12 4v16m8-8H4',
  building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  box: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  check: 'M5 13l4 4L19 7',
  truck: 'M8 14H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v6a2 2 0 01-2 2h-3m-4 0v3a2 2 0 01-2 2H8a2 2 0 01-2-2v-3m4 0h-4'
};

const Ico = ({d, className="w-5 h-5"}) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={d}/></svg>
);

const STATUS_CONFIG = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Payé', color: 'bg-blue-100 text-blue-800' },
  shipped: { label: 'Expédié', color: 'bg-purple-100 text-purple-800' },
  received: { label: 'Reçu', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800' }
};

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatMoney } = useMoney();
  
  const [activeTab, setActiveTab] = useState('orders'); // orders, new_order, stats
  const [supplier, setSupplier] = useState(null);
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form states pour nouvelle commande
  const [orderForm, setOrderForm] = useState({
    products: [{ productName: '', quantity: 1, unitPrice: 0 }],
    shippingCost: 0,
    status: 'pending',
    paymentStatus: 'unpaid',
    paymentMethod: '',
    referenceNumber: '',
    notes: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [suppRes, ordersRes] = await Promise.all([
        ecomApi.get(`/sourcing/suppliers/${id}`),
        ecomApi.get(`/sourcing/suppliers/${id}/orders`)
      ]);
      setSupplier(suppRes.data.data.supplier);
      setStats(suppRes.data.data.stats);
      setOrders(ordersRes.data.data);
      setError(null);
    } catch (err) {
      setError(getContextualError(err, 'load_sourcing'));
      if (err.response?.status === 404) navigate('/ecom/sourcing');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Handle Product Form
  const addProductRow = () => {
    setOrderForm(prev => ({
      ...prev,
      products: [...prev.products, { productName: '', quantity: 1, unitPrice: 0 }]
    }));
  };

  const removeProductRow = (index) => {
    setOrderForm(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index)
    }));
  };

  const updateProductRow = (index, field, value) => {
    setOrderForm(prev => {
      const newProducts = [...prev.products];
      newProducts[index] = { ...newProducts[index], [field]: value };
      return { ...prev, products: newProducts };
    });
  };

  // Calculate totals
  const productsTotal = orderForm.products.reduce((sum, p) => sum + (Number(p.quantity) * Number(p.unitPrice)), 0);
  const orderTotal = productsTotal + Number(orderForm.shippingCost);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    try {
      const formattedProducts = orderForm.products.map(p => ({
        ...p,
        totalPrice: Number(p.quantity) * Number(p.unitPrice)
      }));

      const payload = {
        ...orderForm,
        products: formattedProducts,
        totalAmount: orderTotal
      };

      await ecomApi.post(`/sourcing/suppliers/${id}/orders`, payload);
      
      // Reset form & reload
      setOrderForm({
        products: [{ productName: '', quantity: 1, unitPrice: 0 }],
        shippingCost: 0, status: 'pending', paymentStatus: 'unpaid', paymentMethod: '', referenceNumber: '', notes: ''
      });
      setActiveTab('orders');
      loadData();
    } catch (err) {
      alert(getContextualError(err, 'save_order'));
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm("Supprimer cette commande ?")) return;
    try {
      await ecomApi.delete(`/sourcing/suppliers/${id}/orders/${orderId}`);
      loadData();
    } catch (err) {
      alert(getContextualError(err, 'delete_order'));
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await ecomApi.put(`/sourcing/suppliers/${id}/orders/${orderId}`, { status: newStatus });
      loadData();
    } catch (err) {
      alert(getContextualError(err, 'update_order'));
    }
  };

  if (loading && !supplier) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-medium text-gray-500 animate-pulse">Chargement fournisseur...</div>;
  if (!supplier) return null;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 lg:pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => navigate('/ecom/sourcing')} className="p-2 -ml-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-900 transition">
              <Ico d={I.back} className="w-5 h-5"/>
            </button>
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center font-black text-xl text-gray-600">
              {supplier.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">{supplier.name}</h1>
              <p className="text-sm text-gray-500 font-medium">{supplier.phone || 'Aucun numéro'} • {stats?.totalOrders || 0} commande(s)</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-1 bg-gray-100/50 p-1 rounded-xl w-full sm:w-fit overflow-x-auto no-scrollbar">
            {[
              { id: 'orders', label: 'Commandes', icon: I.box },
              { id: 'new_order', label: 'Ajouter une commande', icon: I.plus },
              { id: 'stats', label: 'Statistiques', icon: I.chart }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex-1 sm:flex-none justify-center
                  ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>
                <Ico d={tab.icon} className="w-4 h-4"/>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* TAB: COMMANDES */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                  <Ico d={I.box} className="w-8 h-8"/>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Aucune commande</h3>
                <p className="text-gray-500 text-sm font-medium mb-6">Vous n'avez pas encore passé de commande chez ce fournisseur.</p>
                <button onClick={() => setActiveTab('new_order')} className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition">
                  Créer une commande
                </button>
              </div>
            ) : (
              orders.map(order => (
                <div key={order._id} className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-300 transition-all shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4 pb-4 border-b border-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Ico d={I.box} className="w-5 h-5"/>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{new Date(order.orderDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p className="text-xs font-medium text-gray-500">Réf: {order.referenceNumber || 'N/A'} • {order.products.length} produit(s)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:justify-end">
                      <div className="text-right">
                        <p className="text-lg font-black text-gray-900">{formatMoney(order.totalAmount)}</p>
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide mt-1 ${STATUS_CONFIG[order.status]?.color}`}>
                          {STATUS_CONFIG[order.status]?.label}
                        </span>
                      </div>
                      <button onClick={() => handleDeleteOrder(order._id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                        <Ico d={I.trash} className="w-5 h-5"/>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {order.products.map((p, i) => (
                      <div key={i} className="flex justify-between items-center text-sm font-medium">
                        <span className="text-gray-700">{p.quantity}x {p.productName}</span>
                        <span className="text-gray-500">{formatMoney(p.totalPrice)}</span>
                      </div>
                    ))}
                    {order.shippingCost > 0 && (
                      <div className="flex justify-between items-center text-sm font-medium pt-2 border-t border-gray-50">
                        <span className="text-gray-500 flex items-center gap-2"><Ico d={I.truck} className="w-4 h-4"/> Frais de port</span>
                        <span className="text-gray-500">{formatMoney(order.shippingCost)}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Rapides Statut */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50">
                    {order.status !== 'paid' && order.status !== 'received' && (
                      <button onClick={() => handleUpdateOrderStatus(order._id, 'paid')} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition">
                        Marquer Payé
                      </button>
                    )}
                    {order.status === 'paid' && (
                      <button onClick={() => handleUpdateOrderStatus(order._id, 'shipped')} className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-100 transition">
                        Marquer Expédié
                      </button>
                    )}
                    {order.status === 'shipped' && (
                      <button onClick={() => handleUpdateOrderStatus(order._id, 'received')} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition">
                        Marquer Reçu
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: NOUVELLE COMMANDE */}
        {activeTab === 'new_order' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Ico d={I.plus} className="w-5 h-5 text-gray-400"/>
                Créer une commande
              </h2>
            </div>
            
            <form onSubmit={handleCreateOrder} className="p-6">
              {/* Produits */}
              <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center justify-between">
                  Produits commandés
                  <button type="button" onClick={addProductRow} className="text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg normal-case flex items-center gap-1.5 transition">
                    <Ico d={I.plus} className="w-4 h-4"/> Ajouter une ligne
                  </button>
                </h3>
                
                <div className="space-y-3">
                  {orderForm.products.map((prod, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex-1 w-full">
                        <label className="block text-xs font-bold text-gray-500 mb-1">Nom du produit *</label>
                        <input type="text" required value={prod.productName} onChange={e=>updateProductRow(idx, 'productName', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 outline-none" placeholder="Ex: T-shirt noir XL"/>
                      </div>
                      <div className="w-full sm:w-24">
                        <label className="block text-xs font-bold text-gray-500 mb-1">Quantité *</label>
                        <input type="number" required min="1" value={prod.quantity} onChange={e=>updateProductRow(idx, 'quantity', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 outline-none"/>
                      </div>
                      <div className="w-full sm:w-32">
                        <label className="block text-xs font-bold text-gray-500 mb-1">Prix U. (XAF) *</label>
                        <input type="number" required min="0" value={prod.unitPrice} onChange={e=>updateProductRow(idx, 'unitPrice', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 outline-none"/>
                      </div>
                      <div className="w-full sm:w-auto pt-5">
                        <button type="button" onClick={()=>removeProductRow(idx)} disabled={orderForm.products.length === 1}
                          className="w-full sm:w-auto p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400">
                          <Ico d={I.trash} className="w-5 h-5 mx-auto"/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Détails Global */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Frais de livraison (XAF)</label>
                  <input type="number" min="0" value={orderForm.shippingCost} onChange={e=>setOrderForm({...orderForm, shippingCost: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-gray-900/10 outline-none"/>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">N° de Suivi / Référence</label>
                  <input type="text" value={orderForm.referenceNumber} onChange={e=>setOrderForm({...orderForm, referenceNumber: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-gray-900/10 outline-none" placeholder="Tracking..."/>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Statut de la commande</label>
                  <select value={orderForm.status} onChange={e=>setOrderForm({...orderForm, status: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-gray-900/10 outline-none">
                    <option value="pending">En attente</option>
                    <option value="paid">Payée</option>
                    <option value="shipped">Expédiée</option>
                    <option value="received">Reçue</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Méthode de paiement</label>
                  <input type="text" value={orderForm.paymentMethod} onChange={e=>setOrderForm({...orderForm, paymentMethod: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-gray-900/10 outline-none" placeholder="Ex: Virement, Alibaba, Espèces..."/>
                </div>
              </div>

              {/* Récapitulatif Total */}
              <div className="bg-gray-900 rounded-xl p-5 sm:p-6 text-white flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  <p className="text-gray-400 text-sm font-medium mb-1">Montant Total de la commande</p>
                  <p className="text-3xl font-black">{formatMoney(orderTotal)}</p>
                </div>
                <button type="submit" className="w-full sm:w-auto px-8 py-3 bg-white text-gray-900 rounded-lg font-bold hover:bg-gray-50 transition active:scale-95 text-sm">
                  Valider la commande
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB: STATS */}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Ico d={I.box} className="w-6 h-6"/>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Commandes</p>
              <p className="text-3xl font-black text-gray-900">{stats?.totalOrders || 0}</p>
            </div>
            
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 text-xl font-black">
                XAF
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Dépensé</p>
              <p className="text-3xl font-black text-gray-900">{formatMoney(stats?.totalSpent || 0)}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4">
                <Ico d={I.chart} className="w-6 h-6"/>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">Panier Moyen</p>
              <p className="text-3xl font-black text-gray-900">{formatMoney(stats?.avgOrderValue || 0)}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center mb-4">
                <Ico d={I.clock} className="w-6 h-6"/>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">Dernière commande</p>
              <p className="text-xl sm:text-2xl font-black text-gray-900 mt-2">
                {stats?.lastOrderDate ? new Date(stats.lastOrderDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Aucune'}
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
