import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const categoryLabels = {
  publicite: 'Publicité', produit: 'Produit', livraison: 'Livraison',
  salaire: 'Salaire', abonnement: 'Abonnement', materiel: 'Matériel',
  transport: 'Transport', autre_depense: 'Autre dépense',
  vente: 'Vente', investissement: 'Investissement', remboursement: 'Remboursement',
  autre_entree: 'Autre entrée'
};

const TransactionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fmt } = useMoney();
  const [tx, setTx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTransaction();
  }, [id]);

  const loadTransaction = async () => {
    try {
      setLoading(true);
      const res = await ecomApi.get(`/transactions/${id}`);
      setTx(res.data?.data || res.data);
    } catch (err) {
      setError('Erreur lors du chargement de la transaction');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="p-3 sm:p-4 lg:p-6">
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error || 'Transaction non trouvée'}
        </div>
        <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium">
          ← Retour
        </button>
      </div>
    );
  }

  const isIncome = tx.type === 'income';

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Détail transaction</h1>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${
              isIncome ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isIncome ? 'Entrée' : 'Dépense'}
            </span>
          </div>
        </div>
        <Link to={`/transactions/${id}/edit`}
          className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
          Modifier
        </Link>
      </div>

      {/* Montant */}
      <div className={`rounded-xl p-6 mb-4 sm:mb-6 text-center ${isIncome ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <p className="text-xs font-medium text-gray-500 uppercase mb-1">Montant</p>
        <p className={`text-3xl sm:text-4xl font-bold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
          {isIncome ? '+' : '-'}{fmt(tx.amount)}
        </p>
      </div>

      {/* Infos */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6">
        <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-4">Informations</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Date</span>
            <span className="text-sm font-medium text-gray-900">
              {new Date(tx.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Type</span>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${isIncome ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isIncome ? 'Entrée' : 'Dépense'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Catégorie</span>
            <span className="text-sm font-medium text-gray-900">{categoryLabels[tx.category] || tx.category}</span>
          </div>
          {tx.reference && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Référence</span>
              <span className="text-sm font-medium text-gray-900">{tx.reference}</span>
            </div>
          )}
          {tx.productId && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Produit lié</span>
              <Link to={`/products/${tx.productId._id || tx.productId}`}
                className="text-sm font-medium text-blue-600 hover:text-blue-800">
                {tx.productId.name || 'Voir le produit'}
              </Link>
            </div>
          )}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Créé par</span>
            <span className="text-sm text-gray-900">{tx.createdBy?.email || '-'}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-gray-600">Créé le</span>
            <span className="text-sm text-gray-900">
              {new Date(tx.createdAt).toLocaleDateString('fr-FR')} à {new Date(tx.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      {tx.description && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">Description</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{tx.description}</p>
        </div>
      )}
    </div>
  );
};

export default TransactionDetail;
