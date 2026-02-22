import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney';
import ecomApi from '../services/ecommApi.js';

const ProductForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useEcomAuth();
  const { fmt, symbol } = useMoney();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    status: 'test',
    sellingPrice: '',
    productCost: '',
    deliveryCost: '',
    avgAdsCost: '',
    stock: '',
    reorderThreshold: '',
    isActive: true
  });

  useEffect(() => {
    if (id) {
      setIsEditing(true);
      loadProduct();
    }
  }, [id]);

  const loadProduct = async () => {
    try {
      setInitialLoading(true);
      const response = await ecomApi.get(`/products/${id}`);
      const product = response.data.data;
      
      setFormData({
        name: product.name || '',
        status: product.status || 'test',
        sellingPrice: product.sellingPrice || '',
        productCost: product.productCost || '',
        deliveryCost: product.deliveryCost || '',
        avgAdsCost: product.avgAdsCost || '',
        stock: product.stock || '',
        reorderThreshold: product.reorderThreshold || '',
        isActive: product.isActive !== undefined ? product.isActive : true
      });
    } catch (error) {
      setError('Erreur lors du chargement du produit');
      console.error(error);
    } finally {
      setInitialLoading(false);
    }
  };

  // Calcul du bénéfice en temps réel (sans inclure avgAdsCost)
  const calculateBenefit = () => {
    const sellingPrice = parseFloat(formData.sellingPrice) || 0;
    const productCost = parseFloat(formData.productCost) || 0;
    const deliveryCost = parseFloat(formData.deliveryCost) || 0;
    const totalCost = productCost + deliveryCost;
    return sellingPrice - totalCost;
  };

  // Calcul du prix suggéré
  const calculateSuggestedPrice = () => {
    const productCost = parseFloat(formData.productCost) || 0;
    
    let suggestedPrice;
    
    if (productCost < 10000) {
      // Si < 10 000 : multiplier par 3
      suggestedPrice = productCost * 3;
    } else {
      // Si >= 10 000 : multiplier par 2,25
      suggestedPrice = productCost * 2.25;
    }
    
    // Le prix ne doit JAMAIS être inférieur à 10 000
    if (suggestedPrice < 10000) {
      suggestedPrice = 10000;
    }
    
    return Math.ceil(suggestedPrice / 50) * 50; // Arrondi au multiple de 50
  };

  // Appliquer le prix suggéré
  const applySuggestedPrice = () => {
    const suggestedPrice = calculateSuggestedPrice();
    setFormData(prev => ({
      ...prev,
      sellingPrice: suggestedPrice
    }));
  };

  // Supprimer la fonction formatCurrency locale car nous utilisons maintenant useMoney

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const productData = {
        ...formData,
        sellingPrice: parseFloat(formData.sellingPrice),
        productCost: parseFloat(formData.productCost),
        deliveryCost: parseFloat(formData.deliveryCost) || 0,
        avgAdsCost: parseFloat(formData.avgAdsCost) || 0,
        stock: parseInt(formData.stock, 10),
        reorderThreshold: parseInt(formData.reorderThreshold, 10)
      };

      if (isEditing) {
        await ecomApi.put(`/products/${id}`, productData);
      } else {
        await ecomApi.post('/products', productData);
      }
      
      navigate('/ecom/products');
    } catch (error) {
      setError(error.response?.data?.message || `Erreur lors de ${isEditing ? 'la modification' : 'la création'} du produit`);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
          {isEditing ? 'Modifier un produit' : 'Ajouter un produit'}
        </h1>
        <p className="text-gray-600 mt-2">
          {isEditing ? 'Modifiez les informations du produit' : 'Remplissez les informations pour ajouter un nouveau produit'}
        </p>
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
              Nom du produit *
            </label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statut
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="test">Test</option>
              <option value="stable">Stable</option>
              <option value="winner">Winner</option>
              <option value="pause">Pause</option>
              <option value="stop">Stop</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prix de vente ({symbol}) *
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                name="sellingPrice"
                required
                min="0"
                step="0.01"
                value={formData.sellingPrice}
                onChange={handleChange}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              {formData.productCost && (
                <button
                  type="button"
                  onClick={applySuggestedPrice}
                  className="px-3 py-2 bg-green-100 text-green-700 text-sm rounded-md hover:bg-green-200 transition-colors"
                  title="Calculer un prix de vente raisonnable (3x le prix d'achat)"
                >
                  Suggérer prix
                </button>
              )}
            </div>
            {formData.productCost && (
              <p className="mt-1 text-xs text-gray-500">
                Prix suggéré: {fmt(calculateSuggestedPrice())} (3x le prix d'achat)
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Coût du produit ({symbol}) *
            </label>
            <input
              type="number"
              name="productCost"
              required
              min="0"
              step="0.01"
              value={formData.productCost}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Coût de livraison ({symbol}) *
            </label>
            <input
              type="number"
              name="deliveryCost"
              required
              min="0"
              step="0.01"
              value={formData.deliveryCost}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Coût publicitaire moyen ({symbol})
            </label>
            <input
              type="number"
              name="avgAdsCost"
              min="0"
              step="0.01"
              value={formData.avgAdsCost}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantité en stock *
            </label>
            <input
              type="number"
              name="stock"
              required
              min="0"
              value={formData.stock}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seuil de réapprovisionnement *
            </label>
            <input
              type="number"
              name="reorderThreshold"
              required
              min="0"
              value={formData.reorderThreshold}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            name="isActive"
            checked={formData.isActive}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label className="ml-2 block text-sm text-gray-900">
            Produit actif
          </label>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/ecom/products')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (isEditing ? 'Modification...' : 'Création...') : (isEditing ? 'Modifier le produit' : 'Créer le produit')}
          </button>
        </div>

        {/* Aperçu du bénéfice */}
        {(formData.sellingPrice && formData.productCost) && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Aperçu financier</h3>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
              <div>
                <span className="text-blue-700">Prix de vente:</span>
                <span className="ml-2 font-semibold">{fmt(formData.sellingPrice)}</span>
              </div>
              <div>
                <span className="text-blue-700">Coût total:</span>
                <span className="ml-2 font-semibold">{fmt((parseFloat(formData.productCost) || 0) + (parseFloat(formData.deliveryCost) || 0))}</span>
              </div>
              <div className="col-span-2">
                <span className="text-blue-700">Bénéfice estimé:</span>
                <span className={`ml-2 font-bold text-lg ${
                  calculateBenefit() > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {fmt(calculateBenefit())}
                </span>
              </div>
            </div>
            {calculateBenefit() <= 0 && (
              <div className="mt-2 text-xs text-red-600">
                ⚠️ Attention: Ce produit n'est pas rentable selon les coûts actuels
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
};

export default ProductForm;
