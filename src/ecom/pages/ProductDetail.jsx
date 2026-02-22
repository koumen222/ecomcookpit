import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useEcomAuth();
  const { fmt } = useMoney(); // 🆕 Hook pour formater les montants
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const res = await ecomApi.get(`/products/${id}`);
      setProduct(res.data?.data || res.data);
    } catch (err) {
      setError('Erreur lors du chargement du produit');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `${(amount || 0).toLocaleString('fr-FR')} FCFA`;
  };

  const getStatusColor = (status) => {
    const colors = {
      test: 'bg-yellow-100 text-yellow-800',
      stable: 'bg-blue-100 text-blue-800',
      winner: 'bg-green-100 text-green-800',
      pause: 'bg-orange-100 text-orange-800',
      stop: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-3 sm:p-4 lg:p-6">
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error || 'Produit non trouvé'}
        </div>
        <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium">
          ← Retour
        </button>
      </div>
    );
  }

  const totalCost = (product.productCost || 0) + (product.deliveryCost || 0) + (product.avgAdsCost || 0);
  const margin = (product.sellingPrice || 0) - totalCost;
  const marginPercent = product.sellingPrice > 0 ? ((margin / product.sellingPrice) * 100).toFixed(1) : 0;

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{product.name}</h1>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(product.status)}`}>
              {product.status}
            </span>
          </div>
        </div>
        {user?.role === 'ecom_admin' && (
          <Link to={`/products/${id}/edit`}
            className="ecom-mobile-button px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
            Modifier
          </Link>
        )}
      </div>

      {/* KPIs */}
      <div className="ecom-mobile-grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="ecom-mobile-card bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Prix de vente</p>
          <p className="ecom-mobile-text text-lg sm:text-xl font-bold text-gray-900 mt-1">{fmt(product?.sellingPrice || 0)}</p>
        </div>
        <div className="ecom-mobile-card bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Coût total</p>
          <p className="ecom-mobile-text text-lg sm:text-xl font-bold text-red-600 mt-1">{fmt(totalCost)}</p>
        </div>
        <div className="ecom-mobile-card bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Marge</p>
          <p className={`ecom-mobile-text text-lg sm:text-xl font-bold mt-1 ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt(margin)}
          </p>
          <p className="text-[10px] text-gray-400">{marginPercent}%</p>
        </div>
        <div className="ecom-mobile-card bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Stock</p>
          <p className={`ecom-mobile-text text-lg sm:text-xl font-bold mt-1 ${
            product.stock === 0 ? 'text-red-600' : product.stock <= product.reorderThreshold ? 'text-yellow-600' : 'text-green-600'
          }`}>
            {product.stock}
          </p>
          <p className="text-[10px] text-gray-400">Seuil: {product.reorderThreshold}</p>
        </div>
      </div>

      {/* Détails des coûts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">Détail des coûts</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Coût produit</span>
              <span className="text-sm font-semibold">{fmt(product?.productCost || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Frais de livraison</span>
              <span className="text-sm font-semibold">{fmt(product?.deliveryCost || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Coût pub moyen</span>
              <span className="text-sm font-semibold">{fmt(product?.avgAdsCost || 0)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-900">Total</span>
              <span className="text-sm font-bold text-red-600">{fmt(totalCost)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">Informations</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Statut</span>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(product.status)}`}>
                {product.status}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Actif</span>
              <span className={`text-sm font-semibold ${product.isActive ? 'text-green-600' : 'text-red-600'}`}>
                {product.isActive ? 'Oui' : 'Non'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Créé le</span>
              <span className="text-sm text-gray-900">
                {new Date(product.createdAt).toLocaleDateString('fr-FR')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Mis à jour</span>
              <span className="text-sm text-gray-900">
                {new Date(product.updatedAt).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Barre de rentabilité */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">Répartition du prix de vente</h3>
        {product.sellingPrice > 0 && (
          <>
            <div className="flex h-6 rounded-full overflow-hidden bg-gray-200 mb-3">
              <div className="bg-red-400" style={{ width: `${(product?.productCost || 0) / (product?.sellingPrice || 1) * 100}%` }}
                title={`Produit: ${fmt(product?.productCost || 0)}`}></div>
              <div className="bg-yellow-400" style={{ width: `${(product?.deliveryCost || 0) / (product?.sellingPrice || 1) * 100}%` }}
                title={`Livraison: ${fmt(product?.deliveryCost || 0)}`}></div>
              <div className="bg-purple-400" style={{ width: `${(product?.avgAdsCost || 0) / (product?.sellingPrice || 1) * 100}%` }}
                title={`Pub: ${fmt(product?.avgAdsCost || 0)}`}></div>
              <div className={`${margin >= 0 ? 'bg-green-400' : 'bg-red-600'}`}
                style={{ width: `${Math.max(0, margin / (product?.sellingPrice || 1) * 100)}%` }}
                title={`Marge: ${fmt(margin)}`}></div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-gray-600">
              <span className="flex items-center"><span className="w-2.5 h-2.5 bg-red-400 rounded-full mr-1.5"></span>Produit</span>
              <span className="flex items-center"><span className="w-2.5 h-2.5 bg-yellow-400 rounded-full mr-1.5"></span>Livraison</span>
              <span className="flex items-center"><span className="w-2.5 h-2.5 bg-purple-400 rounded-full mr-1.5"></span>Pub</span>
              <span className="flex items-center"><span className="w-2.5 h-2.5 bg-green-400 rounded-full mr-1.5"></span>Marge</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
