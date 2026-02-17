import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const StockOrdersList = () => {
  const { user } = useEcomAuth();
  const { fmt } = useMoney();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await ecomApi.get('/stock/orders');
      const ordersData = response.data?.data?.orders || response.data?.data || [];
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (error) {
      setError('Erreur lors du chargement des commandes fournisseurs');
      console.error(error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, action) => {
    try {
      await ecomApi.put(`/stock/orders/${orderId}/${action}`);
      loadOrders();
    } catch (error) {
      setError('Erreur lors de la mise à jour de la commande');
      console.error(error);
    }
  };

  const formatCurrency = (amount) => {
    return `${amount?.toLocaleString('fr-FR') || 0} FCFA`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Gestion des fournisseurs</h1>
        <Link
          to="/ecom/stock/orders/new"
          className="bg-blue-600 text-white px-3 py-2 sm:px-4 rounded-lg hover:bg-blue-700 text-sm"
        >
          + Commande fournisseur
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Produit
              </th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                Sourcing
              </th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Qté
              </th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                Achat
              </th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                Vente
              </th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                Transport
              </th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.length === 0 ? (
              <tr>
                <td colSpan="9" className="px-4 py-4 text-center text-gray-500">
                  Aucune commande fournisseur trouvée
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const totalPurchase = (order.purchasePrice || 0) * (order.quantity || 0);
                const totalCostCalc = totalPurchase + (order.transportCost || 0);

                return (
                  <tr key={order._id}>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                      <Link to={`/stock/orders/${order._id}/edit`} className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">{order.productName || 'N/A'}</Link>
                      {order.supplierName && (
                        <div className="text-[10px] sm:text-xs text-gray-500">{order.supplierName}</div>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        order.sourcing === 'chine' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {order.sourcing === 'chine' ? 'Chine' : 'Local'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-bold text-gray-900">{order.quantity || 0}</div>
                      {order.weightKg > 0 && (
                        <div className="text-[10px] sm:text-xs text-gray-500">{order.weightKg} kg</div>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell">
                      <div className="text-xs sm:text-sm text-gray-900">{fmt(order.purchasePrice)}</div>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell">
                      <div className="text-xs sm:text-sm text-gray-900">{fmt(order.sellingPrice)}</div>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap hidden lg:table-cell">
                      <div className="text-xs sm:text-sm text-gray-900">{fmt(order.transportCost)}</div>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-semibold text-gray-900">{fmt(totalCostCalc)}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        order.status === 'received' 
                          ? 'bg-green-100 text-green-800'
                          : order.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status === 'received' ? 'Reçue' : 
                         order.status === 'cancelled' ? 'Annulée' : 'En transit'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        to={`/stock/orders/${order._id}/edit`}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Modifier
                      </Link>
                      {order.status === 'in_transit' && (
                        <>
                          <button
                            onClick={() => updateOrderStatus(order._id, 'receive')}
                            className="text-green-600 hover:text-green-900 mr-3"
                          >
                            Recevoir
                          </button>
                          <button
                            onClick={() => updateOrderStatus(order._id, 'cancel')}
                            className="text-red-600 hover:text-red-900"
                          >
                            Annuler
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StockOrdersList;
