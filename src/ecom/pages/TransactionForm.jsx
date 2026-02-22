import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
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

const categoriesByType = {
  expense: ['publicite', 'produit', 'livraison', 'salaire', 'abonnement', 'materiel', 'transport', 'autre_depense'],
  income: ['vente', 'remboursement_client', 'investissement', 'autre_entree']
};

const TransactionForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useEcomAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState('');
  const [products, setProducts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'expense',
    category: '',
    amount: '',
    description: '',
    reference: '',
    productId: ''
  });

  useEffect(() => {
    loadProducts();
    if (id) {
      setIsEditing(true);
      loadTransaction();
    }
  }, [id]);

  const loadProducts = async () => {
    try {
      const res = await ecomApi.get('/products?isActive=true');
      setProducts(res.data?.data || []);
    } catch (e) {
      console.error('Erreur chargement produits:', e);
    }
  };

  const loadTransaction = async () => {
    try {
      setInitialLoading(true);
      const res = await ecomApi.get(`/transactions/${id}`);
      const t = res.data.data;
      setFormData({
        date: new Date(t.date).toISOString().split('T')[0],
        type: t.type,
        category: t.category,
        amount: t.amount?.toString() || '',
        description: t.description || '',
        reference: t.reference || '',
        productId: t.productId?._id || t.productId || ''
      });
    } catch (e) {
      setError('Erreur lors du chargement');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'type') {
      setFormData(prev => ({ ...prev, type: value, category: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = {
        ...formData,
        amount: parseFloat(formData.amount),
        productId: formData.productId || undefined
      };
      if (isEditing) {
        await ecomApi.put(`/transactions/${id}`, data);
      } else {
        await ecomApi.post('/transactions', data);
      }
      navigate('/ecom/transactions');
    } catch (e) {
      setError(e.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const availableCategories = categoriesByType[formData.type] || [];

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          {isEditing ? 'Modifier la transaction' : 'Nouvelle transaction'}
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-3 sm:p-6 space-y-4 sm:space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" name="date" required value={formData.date} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
            <div className="flex gap-4 mt-1">
              <label className={`flex-1 text-center py-2 rounded-lg border-2 cursor-pointer transition ${
                formData.type === 'expense' ? 'border-red-500 bg-red-50 text-red-700 font-semibold' : 'border-gray-200 text-gray-500'
              }`}>
                <input type="radio" name="type" value="expense" checked={formData.type === 'expense'} onChange={handleChange} className="sr-only" />
                Dépense
              </label>
              <label className={`flex-1 text-center py-2 rounded-lg border-2 cursor-pointer transition ${
                formData.type === 'income' ? 'border-green-500 bg-green-50 text-green-700 font-semibold' : 'border-gray-200 text-gray-500'
              }`}>
                <input type="radio" name="type" value="income" checked={formData.type === 'income'} onChange={handleChange} className="sr-only" />
                Entrée
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
            <select name="category" required value={formData.category} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
              <option value="">Sélectionner une catégorie</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{categoryLabels[cat]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA) *</label>
            <input type="number" name="amount" required min="0" step="0.01" value={formData.amount} onChange={handleChange}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Produit lié (optionnel)</label>
            <select name="productId" value={formData.productId} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
              <option value="">Aucun</option>
              {products.map(p => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Référence (optionnel)</label>
            <input type="text" name="reference" value={formData.reference} onChange={handleChange}
              placeholder="N° facture, reçu..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea name="description" rows="3" value={formData.description} onChange={handleChange}
            placeholder="Détails de la transaction..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
        </div>

        <div className="flex justify-end space-x-4 pt-2">
          <button type="button" onClick={() => navigate('/ecom/transactions')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Annuler
          </button>
          <button type="submit" disabled={loading}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
            {loading ? 'Enregistrement...' : (isEditing ? 'Modifier' : 'Enregistrer')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TransactionForm;
