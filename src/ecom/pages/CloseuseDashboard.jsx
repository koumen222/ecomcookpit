import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const CloseuseDashboard = () => {
  const { user } = useEcomAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [todayReports, setTodayReports] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [myAssignments, setMyAssignments] = useState({ orderSources: [], productAssignments: [] });
  const [stats, setStats] = useState({
    todayOrders: 0,
    pendingOrders: 0,
    deliveredToday: 0,
    weeklyPerformance: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Charger toutes les données nécessaires pour la closeuse
      const [productsRes, reportsRes, ordersRes, assignmentsRes] = await Promise.all([
        ecomApi.get('/products?isActive=true'),
        ecomApi.get('/reports?date=' + today),
        ecomApi.get('/orders?limit=10&sort=-createdAt'), // Commandes récentes
        ecomApi.get('/assignments/my-assignments') // Mes affectations
      ]);

      setTodayReports(reportsRes.data.data.reports || []);
      setRecentOrders(ordersRes.data.data.orders || []);
      setMyAssignments(assignmentsRes.data.data);

      // Filtrer les produits selon les affectations
      const assignments = assignmentsRes.data.data;
      let filteredProducts = productsRes.data.data;
      
      // Collecter les noms de produits Google Sheets assignés
      const sheetProductNames = (assignments.productAssignments || []).flatMap(pa => pa.sheetProductNames || []);
      
      if (assignments.productAssignments && assignments.productAssignments.length > 0) {
        const assignedProductIds = assignments.productAssignments.flatMap(pa => (pa.productIds || []).map(p => p._id));
        if (assignedProductIds.length > 0) {
          filteredProducts = filteredProducts.filter(product => assignedProductIds.includes(product._id));
        }
      }
      
      // Ajouter les produits Google Sheets comme des objets virtuels
      const sheetProductObjects = sheetProductNames.map((name, idx) => ({
        _id: `sheet_${idx}`,
        name,
        isSheetProduct: true,
        status: 'active',
        sellingPrice: '-',
        stock: '-'
      }));
      
      setProducts([...filteredProducts, ...sheetProductObjects]);

      // Filtrer les commandes selon les sources et produits assignés
      let filteredOrders = ordersRes.data.data.orders || [];
      
      const hasSourceAssignments = assignments.orderSources?.length > 0;
      const hasProductAssignments = sheetProductNames.length > 0;
      
      if (hasSourceAssignments || hasProductAssignments) {
        const assignedSourceIds = (assignments.orderSources || []).map(os => os.sourceId?._id);
        
        filteredOrders = filteredOrders.filter(order => {
          // Filtre par source
          const sourceMatch = !hasSourceAssignments || !order.sourceId || assignedSourceIds.includes(order.sourceId);
          // Filtre par produit (si des produits sheets sont assignés, ne montrer que ceux-là)
          const productMatch = !hasProductAssignments || sheetProductNames.some(name => 
            order.product?.toLowerCase().includes(name.toLowerCase()) || 
            name.toLowerCase().includes(order.product?.toLowerCase() || '')
          );
          return sourceMatch && productMatch;
        });
      }
      setRecentOrders(filteredOrders);

      // Calculer les statistiques
      const todayOrders = filteredOrders.filter(order => 
        new Date(order.date).toISOString().split('T')[0] === today
      ).length;

      const pendingOrders = filteredOrders.filter(order => 
        order.status === 'pending' || order.status === 'confirmed'
      ).length;

      const deliveredToday = reportsRes.data.data.reports?.reduce((sum, report) => 
        sum + (report.ordersDelivered || 0), 0
      ) || 0;

      // Performance hebdomadaire
      const weekReports = await ecomApi.get('/reports?startDate=' + weekAgo + '&endDate=' + today);
      const weekTotal = weekReports.data.data.reports?.reduce((sum, report) => 
        sum + (report.ordersReceived || 0), 0
      ) || 0;
      const weekDelivered = weekReports.data.data.reports?.reduce((sum, report) => 
        sum + (report.ordersDelivered || 0), 0
      ) || 0;
      const weeklyPerformance = weekTotal > 0 ? Math.round((weekDelivered / weekTotal) * 100) : 0;

      setStats({
        todayOrders,
        pendingOrders,
        deliveredToday,
        weeklyPerformance
      });

    } catch (error) {
      console.error('Erreur chargement dashboard closeuse:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      test: 'bg-yellow-100 text-yellow-800',
      stable: 'bg-blue-100 text-blue-800',
      winner: 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Dashboard Closeuse 👩‍💼
          </h1>
          <p className="text-gray-600 mt-1">
            Bienvenue {user?.name || user?.email} - Vue d'ensemble de vos commandes
          </p>
          
          {/* Sources assignées */}
          {myAssignments.orderSources && myAssignments.orderSources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-sm text-gray-500">Vos sources:</span>
              {myAssignments.orderSources.map((os) => (
                <span
                  key={os.sourceId._id}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: os.sourceId.color + '20', color: os.sourceId.color }}
                >
                  {os.sourceId.icon} {os.sourceId.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Widgets de statistiques */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Commandes du jour</p>
                <p className="text-2xl font-bold text-gray-900">{stats.todayOrders}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-full">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">En attente</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingOrders}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Livrées aujourd'hui</p>
                <p className="text-2xl font-bold text-gray-900">{stats.deliveredToday}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-full">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Performance semaine</p>
                <p className="text-2xl font-bold text-gray-900">{stats.weeklyPerformance}%</p>
              </div>
            </div>
          </div>

          {/* Widget Marketing */}
          <Link to="/campaigns" className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg shadow p-4 hover:from-pink-600 hover:to-purple-700 transition-all transform hover:scale-105">
            <div className="flex items-center text-white">
              <div className="p-3 bg-white/20 rounded-full">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6 0 3 3 0 000 6zM13.73 21a2.765 2.765 0 00-3.46 0" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-white/90">Marketing</p>
                <p className="text-lg font-bold text-white">Campagnes</p>
              </div>
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Colonnes de droite */}
          <div className="lg:col-span-2 space-y-6">
            {/* Commandes récentes */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Commandes Récentes</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Dernières commandes enregistrées
                </p>
              </div>
              <div className="p-3 sm:p-6">
                <div className="space-y-3">
                  {recentOrders.slice(0, 5).map((order) => (
                    <div key={order._id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{order.clientName}</span>
                            <span className="text-gray-400">•</span>
                            <span className="text-sm text-gray-600">{order.product}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-sm text-gray-500">{order.quantity}x</span>
                            <span className="text-sm font-medium text-gray-900">{order.price} FCFA</span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(order.status)}`}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                        <Link 
                          to={`/orders/${order._id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Voir
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
                
                {recentOrders.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    Aucune commande récente
                  </p>
                )}

                {recentOrders.length > 5 && (
                  <div className="mt-4 text-center">
                    <Link 
                      to="/orders"
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Voir toutes les commandes →
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Produits Actifs */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Produits Actifs</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {products.length} produit{products.length > 1 ? 's' : ''} en cours
                </p>
              </div>
              <div className="p-3 sm:p-6">
                <div className="space-y-3">
                  {products.map((product) => {
                    const todayReport = todayReports.find(r => (r.productId?._id || r.productId)?.toString() === product._id?.toString());
                    return (
                      <div key={product._id} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Link to={`/products/${product._id}`} className="font-medium text-blue-600 hover:text-blue-800 hover:underline">{product.name}</Link>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(product.status)}`}>
                            {product.status}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Stock:</span>
                            <span className="ml-2 font-medium">{product.stock}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Prix:</span>
                            <span className="ml-2 font-medium">{product.sellingPrice} FCFA</span>
                          </div>
                        </div>

                        {todayReport && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Reçues:</span>
                                <span className="ml-2 font-medium">{todayReport.ordersReceived}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Livrées:</span>
                                <span className="ml-2 font-medium">{todayReport.ordersDelivered}</span>
                              </div>
                            </div>
                            {todayReport.notes && (
                              <p className="mt-2 text-xs text-gray-600 italic">
                                "{todayReport.notes}"
                              </p>
                            )}
                          </div>
                        )}

                        {!todayReport && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-500 italic">
                              Pas encore de rapport pour aujourd'hui
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Résumé de la journée */}
        {todayReports.length > 0 && (
          <div className="mt-4 sm:mt-8 bg-white rounded-lg shadow">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Résumé du Jour</h3>
            </div>
            <div className="p-3 sm:p-6">
              <div className="grid grid-cols-3 gap-3 sm:gap-6">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-blue-600">
                    {todayReports.reduce((sum, report) => sum + report.ordersReceived, 0)}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Commandes Reçues</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-green-600">
                    {todayReports.reduce((sum, report) => sum + report.ordersDelivered, 0)}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Commandes Livrées</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-purple-600">
                    {(() => {
                      const received = todayReports.reduce((sum, report) => sum + report.ordersReceived, 0);
                      const delivered = todayReports.reduce((sum, report) => sum + report.ordersDelivered, 0);
                      return received > 0 ? Math.round((delivered / received) * 100) : 0;
                    })()}%
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Taux de Livraison</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Guide rapide */}
        <div className="mt-4 sm:mt-8 bg-blue-50 rounded-lg p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-blue-900 mb-2 sm:mb-3">📋 Guide Quick Start</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>• <strong>1.</strong> Sélectionnez un produit dans la liste</p>
            <p>• <strong>2.</strong> Saisissez le nombre de commandes reçues aujourd'hui</p>
            <p>• <strong>3.</strong> Saisissez le nombre de commandes livrées aujourd'hui</p>
            <p>• <strong>4.</strong> Ajoutez des notes si nécessaire (problèmes, retards, etc.)</p>
            <p>• <strong>5.</strong> Cliquez sur "Enregistrer le rapport"</p>
          </div>
          <div className="mt-4 p-3 bg-blue-100 rounded text-xs text-blue-700">
            <strong>Important:</strong> Vous ne voyez pas les informations financières (dépenses pub, bénéfices) 
            pour vous concentrer uniquement sur la gestion des commandes.
          </div>
        </div>
    </div>
  );
};

export default CloseuseDashboard;
