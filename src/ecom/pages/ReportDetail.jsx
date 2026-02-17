import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const ReportDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useEcomAuth();
  const { fmt } = useMoney();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReport();
  }, [id]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const response = await ecomApi.get(`/reports/${id}`);
      setReport(response.data.data);
    } catch (error) {
      setError('Erreur lors du chargement du rapport');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `${amount?.toLocaleString('fr-FR') || 0} FCFA`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const deleteReport = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce rapport ?')) return;
    
    try {
      await ecomApi.delete(`/reports/${id}`);
      navigate('/ecom/reports');
    } catch (error) {
      setError('Erreur lors de la suppression du rapport');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-3 sm:p-4 lg:p-6">
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          Rapport non trouvé
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="mb-4 sm:mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Détails du rapport</h1>
            <p className="text-gray-600 mt-2">
              Rapport du {formatDate(report.date)} pour {report.productId?.name || 'Produit inconnu'}
            </p>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => navigate(`/reports/${id}/edit`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Modifier
            </button>
            {(user.role === 'ecom_admin' || user.role === 'ecom_closeuse') && (
              <button
                onClick={deleteReport}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Supprimer
              </button>
            )}
            <button
              onClick={() => navigate('/ecom/reports')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Retour
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Informations principales */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg p-3 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Informations principales</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Date</label>
                <p className="text-lg text-gray-900">{formatDate(report.date)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Produit</label>
                {report.productId?._id ? (
                  <Link to={`/products/${report.productId._id}`} className="text-lg text-blue-600 hover:text-blue-800 hover:underline">{report.productId.name}</Link>
                ) : (
                  <p className="text-lg text-gray-900">N/A</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Rapporté par</label>
                <p className="text-lg text-gray-900">{report.reportedBy?.email || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Date de création</label>
                <p className="text-lg text-gray-900">{formatDate(report.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* Commandes */}
          <div className="bg-white shadow rounded-lg p-3 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Commandes</h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Commandes reçues</label>
                <p className="text-2xl font-bold text-blue-600">{report.ordersReceived || 0}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Commandes livrées</label>
                <p className="text-2xl font-bold text-green-600">{report.ordersDelivered || 0}</p>
              </div>
            </div>
            {report.ordersReceived > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-500">Taux de livraison</label>
                <div className="mt-1">
                  <div className="flex items-center">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${((report.ordersDelivered || 0) / report.ordersReceived * 100).toFixed(1)}%` }}
                      ></div>
                    </div>
                    <span className="ml-3 text-sm font-medium text-gray-900">
                      {((report.ordersDelivered || 0) / report.ordersReceived * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Livraisons par agence */}
            {report.deliveries && report.deliveries.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">Livraisons par agence</label>
                <div className="space-y-2">
                  {report.deliveries.map((delivery, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        <span className="font-medium text-gray-900">{delivery.agencyName}</span>
                      </div>
                      <span className="text-lg font-bold text-green-600">{delivery.ordersDelivered} commandes</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {report.notes && (
            <div className="bg-white shadow rounded-lg p-3 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Notes</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{report.notes}</p>
            </div>
          )}
        </div>

        {/* Métriques financières */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-3 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Métriques financières</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Revenu total</label>
                <p className="text-lg font-bold text-green-600">
                  {fmt(report.metrics?.revenue || 0)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Dépenses publicitaires</label>
                <p className="text-lg font-bold text-red-600">{fmt(report.adSpend || 0)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Coût produit total</label>
                <p className="text-lg font-bold text-red-600">
                  {fmt(report.metrics?.productCostTotal || 0)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Coût livraison total</label>
                <p className="text-lg font-bold text-red-600">
                  {fmt(report.metrics?.deliveryCostTotal || 0)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Coût total</label>
                <p className="text-lg font-bold text-red-600">
                  {fmt(report.metrics?.totalCost || 0)}
                </p>
              </div>
              <hr className="border-gray-200" />
              <div>
                <label className="block text-sm font-medium text-gray-500">Profit net</label>
                <p className={`text-xl font-bold ${(report.metrics?.profit || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmt(report.metrics?.profit || 0)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Profit par commande</label>
                <p className={`text-lg font-bold ${(report.metrics?.profitPerOrder || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmt(report.metrics?.profitPerOrder || 0)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">ROAS</label>
                <p className="text-lg font-semibold text-blue-600">
                  {report.metrics?.roas ? report.metrics.roas.toFixed(2) : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Informations sur le produit */}
          {report.productId && (
            <div className="bg-white shadow rounded-lg p-3 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Informations sur le produit</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Prix de vente</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {fmt(report.productId.sellingPrice || 0)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Coût du produit</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {fmt(report.productId.productCost || 0)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Coût de livraison</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {fmt(report.productId.deliveryCost || 0)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Coût publicitaire moyen</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {fmt(report.productId.avgAdsCost || 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportDetail;
