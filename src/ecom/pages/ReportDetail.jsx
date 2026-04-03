import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';

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
      setError(getContextualError(error, 'load_stats'));
      console.error(error);
    } finally {
      setLoading(false);
    }
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
      setError(getContextualError(error, 'delete_order'));
      console.error(error);
    }
  };

  if (loading) return (
    <div className="p-4 sm:p-6">
      <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />)}
      </div>
    </div>
  );

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
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Détails du rapport</h1>
            <p className="text-gray-600 mt-2">
              Rapport du {formatDate(report.date)} pour {report.productId?.name || 'Produit inconnu'}
            </p>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => navigate(`/ecom/reports/${id}/edit`)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Modifier
            </button>
            {report.whatsappNumber && (
              <button
                onClick={() => {
                  const r = report;
                  const product = r.productId?.name || 'Produit';
                  const date = formatDate(r.date);
                  const profit = r.metrics?.profit || 0;
                  const revenue = r.metrics?.revenue || 0;
                  const returned = r.ordersReturned || 0;
                  const lines = [
                    `📊 *Rapport du ${date}*`,
                    `📦 Produit: *${product}*`,
                    ``,
                    `📥 Reçues: ${r.ordersReceived || 0}`,
                    `✅ Livrées: ${r.ordersDelivered || 0}`,
                    ...(returned > 0 ? [`🔴 Retours: -${returned}`] : []),
                    `📈 Taux livraison: ${r.ordersReceived > 0 ? ((r.ordersDelivered / r.ordersReceived) * 100).toFixed(1) : 0}%`,
                    ``,
                    `💰 CA: ${revenue.toLocaleString('fr-FR')} FCFA`,
                    `📢 Pub: ${(r.adSpend || 0).toLocaleString('fr-FR')} FCFA`,
                    `${profit >= 0 ? '✅' : '🔴'} Profit: ${profit.toLocaleString('fr-FR')} FCFA`,
                    ...(r.notes ? [``, `📝 ${r.notes}`] : [])
                  ];
                  const text = encodeURIComponent(lines.join('\n'));
                  const phone = r.whatsappNumber.replace(/[^0-9]/g, '');
                  window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.594-.822-6.34-2.2l-.442-.352-3.2 1.073 1.073-3.2-.352-.442A9.935 9.935 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
                </svg>
                Envoyer via WhatsApp
              </button>
            )}
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
                  <Link to={`/products/${report.productId._id}`} className="text-lg text-emerald-600 hover:text-emerald-800 hover:underline">{report.productId.name}</Link>
                ) : (
                  <p className="text-lg text-gray-900">N/A</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Rapporté par</label>
                <p className="text-lg text-gray-900">{report.reportedBy?.email || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">WhatsApp</label>
                <p className="text-lg text-gray-900">{report.whatsappNumber || 'Non renseigné'}</p>
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
                <p className="text-2xl font-bold text-emerald-600">{report.ordersReceived || 0}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Commandes livrées</label>
                <p className="text-2xl font-bold text-green-600">{report.ordersDelivered || 0}</p>
              </div>
              {(report.ordersReturned || 0) > 0 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Retours / Remboursements</label>
                    <p className="text-2xl font-bold text-red-600">-{report.ordersReturned}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Taux de retour</label>
                    <p className="text-2xl font-bold text-red-600">
                      {report.ordersDelivered > 0 ? ((report.ordersReturned / report.ordersDelivered) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </>
              )}
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
                <p className={`text-lg font-bold ${(report.metrics?.revenue || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
                <p className="text-lg font-semibold text-emerald-600">
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
