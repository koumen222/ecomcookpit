import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const categoryLabels = {
  publicite: 'Publicité',
  produit: 'Achat produit',
  livraison: 'Frais de livraison',
  salaire: 'Salaire',
  abonnement: 'Abonnement / Outil',
  materiel: 'Matériel',
  transport: 'Transport',
  autre_depense: 'Autre dépense',
  vente: 'Vente',
  remboursement_client: 'Remboursement client',
  investissement: 'Investissement',
  autre_entree: 'Autre entrée'
};

const TransactionsList = () => {
  const { user } = useEcomAuth();
  const { fmt } = useMoney();
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    category: '',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.type) params.type = filters.type;
      if (filters.category) params.category = filters.category;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const [txRes, summaryRes] = await Promise.all([
        ecomApi.get('/transactions', { params }),
        ecomApi.get('/transactions/summary', { params: { startDate: filters.startDate, endDate: filters.endDate } })
      ]);

      setTransactions(txRes.data?.data?.transactions || []);
      setSummary(summaryRes.data?.data || {});
    } catch (e) {
      console.error('Erreur chargement transactions:', e);
      setError('Erreur lors du chargement des transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette transaction ?')) return;
    try {
      await ecomApi.delete(`/transactions/${id}`);
      loadData();
    } catch (e) {
      setError('Erreur lors de la suppression');
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

  const balance = (summary.totalIncome || 0) - (summary.totalExpense || 0);

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Transactions</h1>
        <Link to="/ecom/transactions/new"
          className="px-3 py-2 sm:px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium text-sm">
          + Nouvelle
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">{error}</div>
      )}

      {/* Bilan */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg shadow p-3 sm:p-5">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Entrées</p>
          <p className="text-lg sm:text-2xl font-bold text-green-600 mt-1">{fmt(summary.totalIncome)}</p>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-1">{summary.incomeCount || 0} tx</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-5">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Dépenses</p>
          <p className="text-lg sm:text-2xl font-bold text-red-600 mt-1">{fmt(summary.totalExpense)}</p>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-1">{summary.expenseCount || 0} tx</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-5">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Solde</p>
          <p className={`text-lg sm:text-2xl font-bold mt-1 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt(balance)}
          </p>
          <p className="text-xs text-gray-400 mt-1">{balance >= 0 ? 'Bénéfice' : 'Déficit'}</p>
        </div>
      </div>

      {/* Répartition par catégorie */}
      {summary.byCategory && summary.byCategory.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Dépenses par catégorie */}
          <div className="bg-white rounded-lg shadow p-3 sm:p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Dépenses par catégorie</h3>
            <div className="space-y-2">
              {summary.byCategory
                .filter(c => c._id.type === 'expense')
                .map((c, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{categoryLabels[c._id.category] || c._id.category}</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-red-600">{fmt(c.total)}</span>
                      <span className="text-xs text-gray-400 ml-2">({c.count})</span>
                    </div>
                  </div>
                ))}
              {summary.byCategory.filter(c => c._id.type === 'expense').length === 0 && (
                <p className="text-sm text-gray-400">Aucune dépense</p>
              )}
            </div>
          </div>
          {/* Entrées par catégorie */}
          <div className="bg-white rounded-lg shadow p-3 sm:p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Entrées par catégorie</h3>
            <div className="space-y-2">
              {summary.byCategory
                .filter(c => c._id.type === 'income')
                .map((c, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{categoryLabels[c._id.category] || c._id.category}</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-green-600">{fmt(c.total)}</span>
                      <span className="text-xs text-gray-400 ml-2">({c.count})</span>
                    </div>
                  </div>
                ))}
              {summary.byCategory.filter(c => c._id.type === 'income').length === 0 && (
                <p className="text-sm text-gray-400">Aucune entrée</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date début</label>
            <input type="date" value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date fin</label>
            <input type="date" value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select value={filters.type} onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent">
              <option value="">Tous</option>
              <option value="expense">Dépenses</option>
              <option value="income">Entrées</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => setFilters({ type: '', category: '', startDate: '', endDate: '' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Tableau des transactions */}
      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Catégorie</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Description</th>
              <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  Aucune transaction trouvée
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx._id} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <Link to={`/ecom/transactions/${tx._id}`} className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">
                      {new Date(tx.date).toLocaleDateString('fr-FR')}
                    </Link>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full ${
                      tx.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {tx.type === 'income' ? 'Entrée' : 'Dép.'}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 hidden sm:table-cell">
                    {categoryLabels[tx.category] || tx.category}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 max-w-xs truncate hidden md:table-cell">
                    {tx.description || '-'}
                    {tx.reference && <span className="text-xs text-gray-400 ml-1">({tx.reference})</span>}
                  </td>
                  <td className={`px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-semibold text-right ${
                    tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                    <Link to={`/ecom/transactions/${tx._id}/edit`}
                      className="text-blue-600 hover:text-blue-900 mr-2 sm:mr-3">
                      Modifier
                    </Link>
                    <button onClick={() => handleDelete(tx._id)}
                      className="text-red-600 hover:text-red-900">
                      Suppr.
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionsList;
