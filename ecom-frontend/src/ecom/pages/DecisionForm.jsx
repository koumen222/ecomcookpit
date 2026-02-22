import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const DecisionForm = () => {
  const navigate = useNavigate();
  const { user } = useEcomAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [products, setProducts] = useState([]);
  
  const [formData, setFormData] = useState({
    productId: '',
    type: 'continue',
    priority: 'medium',
    reason: '',
    assignedTo: '',
    notes: ''
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await ecomApi.get('/products', { params: { isActive: true } });
      // Correction: les produits sont directement dans response.data.data
      const productsData = response.data?.data || [];
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      setProducts([]);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const decisionData = {
        ...formData,
        createdBy: user._id
      };

      await ecomApi.post('/decisions', decisionData);
      navigate('/ecom/decisions');
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la création de la décision');
    } finally {
      setLoading(false);
    }
  };

  const getTypeDescription = () => {
    switch (formData.type) {
      case 'scale':
        return 'Augmenter le budget publicitaire et la production';
      case 'stop':
        return 'Arrêter la production et les dépenses publicitaires';
      case 'continue':
        return 'Maintenir le statu quo actuel';
      default:
        return '';
    }
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Nouvelle décision</h1>
        <p className="text-gray-600 mt-2">Prenez une décision stratégique pour un produit</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Produit concerné *
            </label>
            <select
              name="productId"
              required
              value={formData.productId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Sélectionnez un produit</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de décision *
            </label>
            <select
              name="type"
              required
              value={formData.type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="continue">Continuer</option>
              <option value="scale">Scaler</option>
              <option value="stop">Arrêter</option>
            </select>
            {formData.type && (
              <p className="mt-1 text-sm text-gray-500">{getTypeDescription()}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priorité *
            </label>
            <select
              name="priority"
              required
              value={formData.priority}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assigné à
            </label>
            <input
              type="text"
              name="assignedTo"
              value={formData.assignedTo}
              onChange={handleChange}
              placeholder="Nom de la personne assignée"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Raison de la décision *
          </label>
          <textarea
            name="reason"
            required
            rows="4"
            value={formData.reason}
            onChange={handleChange}
            placeholder="Expliquez pourquoi vous prenez cette décision..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes supplémentaires
          </label>
          <textarea
            name="notes"
            rows="3"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Informations complémentaires, actions à prendre, etc..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Aperçu de la décision */}
        {formData.productId && formData.type && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Aperçu de la décision</h3>
            <div className="text-sm text-blue-700">
              <p><strong>Produit:</strong> {products.find(p => p._id === formData.productId)?.name}</p>
              <p><strong>Action:</strong> {formData.type === 'scale' ? 'Scaler le produit' : formData.type === 'stop' ? 'Arrêter le produit' : 'Continuer le produit'}</p>
              <p><strong>Priorité:</strong> {formData.priority === 'high' ? 'Haute' : formData.priority === 'medium' ? 'Moyenne' : 'Basse'}</p>
              {formData.assignedTo && <p><strong>Assigné à:</strong> {formData.assignedTo}</p>}
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/ecom/decisions')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer la décision'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DecisionForm;
