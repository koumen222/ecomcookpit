import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const LivreurDashboard = () => {
  const navigate = useNavigate();
  const { user } = useEcomAuth();
  const { fmt } = useMoney();
  const [orders, setOrders] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('available'); // available, my_orders
  const [filterCity, setFilterCity] = useState('');

  useEffect(() => {
    if (user?.role !== 'livreur') {
      navigate('/ecom/dashboard');
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [availableRes, myOrdersRes] = await Promise.all([
        ecomApi.get('/orders/available', { params: { city: filterCity, limit: 50 } }),
        ecomApi.get('/orders', { params: { assignedLivreur: user._id, limit: 50 } })
      ]);
      
      setOrders(availableRes.data.data || []);
      setMyOrders(myOrdersRes.data.data.orders || []);
    } catch (err) {
      setError('Erreur chargement des commandes');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignOrder = async (orderId) => {
    setAssigning(prev => ({ ...prev, [orderId]: true }));
    setError('');
    setSuccess('');
    
    try {
      const res = await ecomApi.post(`/orders/${orderId}/assign`);
      setSuccess('Commande assignée avec succès!');
      
      // Mettre à jour les listes
      setOrders(prev => prev.filter(o => o._id !== orderId));
      if (res.data.data) {
        setMyOrders(prev => [res.data.data, ...prev]);
      }
      
      // Rediriger vers la page de la commande
      setTimeout(() => navigate(`/orders/${orderId}`), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'assignation');
    } finally {
      setAssigning(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
      shipped: 'bg-purple-100 text-purple-800 border-purple-200',
      delivered: 'bg-green-100 text-green-800 border-green-200',
      returned: 'bg-orange-100 text-orange-800 border-orange-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'En attente',
      confirmed: 'Confirmé',
      shipped: 'Expédié',
      delivered: 'Livré',
      returned: 'Retour',
      cancelled: 'Annulé'
    };
    return labels[status] || status;
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }) : '-';
  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Chargement des commandes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🚚 Tableau de bord Livreur</h1>
        <p className="text-sm text-gray-500 mt-1">
          Bienvenue {user?.name} - Gérez vos livraisons
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 ml-2">&times;</button>
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess('')} className="text-green-500 hover:text-green-700 ml-2">&times;</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{orders.length}</p>
          <p className="text-xs text-gray-500 uppercase font-medium mt-1">Disponibles</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{myOrders.filter(o => o.status === 'delivered').length}</p>
          <p className="text-xs text-gray-500 uppercase font-medium mt-1">Livrées</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{myOrders.filter(o => ['confirmed', 'shipped'].includes(o.status)).length}</p>
          <p className="text-xs text-gray-500 uppercase font-medium mt-1">En cours</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <p className="text-lg font-bold text-gray-700">{myOrders.reduce((sum, o) => sum + (o.price * o.quantity || 0), 0)}</p>
          <p className="text-xs text-gray-500 uppercase font-medium mt-1">Total commandes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setActiveTab('available')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
            activeTab === 'available' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📦 Commandes disponibles ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('my_orders')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
            activeTab === 'my_orders' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🚚 Mes commandes ({myOrders.length})
        </button>
      </div>

      {/* Filter by city */}
      <div className="bg-white rounded-xl shadow-sm border p-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Filtrer par ville:</label>
          <input
            type="text"
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            placeholder="Ex: Douala, Yaoundé..."
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
          {filterCity && (
            <button
              onClick={() => setFilterCity('')}
              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              Effacer
            </button>
          )}
        </div>
      </div>

      {/* Available Orders */}
      {activeTab === 'available' && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">Aucune commande disponible</p>
              <p className="text-sm text-gray-400 mt-1">Revenez plus tard ou essayez une autre ville</p>
            </div>
          ) : (
            orders.map(order => (
              <div key={order._id} className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-gray-900">{order.clientName}</span>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      {order.orderId && (
                        <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded">
                          #{order.orderId}
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {order.clientPhone}
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {order.city}
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        {order.product} ({order.quantity})
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {fmt(order.price * order.quantity)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>Commandé le {fmtDate(order.date)} à {fmtTime(order.date)}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => handleAssignOrder(order._id)}
                      disabled={assigning[order._id]}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition flex items-center gap-2"
                    >
                      {assigning[order._id] ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Assignation...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Prendre cette commande
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => navigate(`/orders/${order._id}`)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition"
                    >
                      Détails
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* My Orders */}
      {activeTab === 'my_orders' && (
        <div className="space-y-3">
          {myOrders.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">Aucune commande assignée</p>
              <p className="text-sm text-gray-400 mt-1">Prenez des commandes disponibles pour commencer</p>
            </div>
          ) : (
            myOrders.map(order => (
              <div key={order._id} className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-gray-900">{order.clientName}</span>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      {order.orderId && (
                        <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded">
                          #{order.orderId}
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {order.clientPhone}
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {order.city}
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        {order.product} ({order.quantity})
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {fmt(order.price * order.quantity)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>Assigné le {fmtDate(order.updatedAt)} à {fmtTime(order.updatedAt)}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => navigate(`/orders/${order._id}`)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition"
                    >
                      Gérer la livraison
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default LivreurDashboard;
