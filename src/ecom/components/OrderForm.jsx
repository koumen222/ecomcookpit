import React, { useState, useEffect } from 'react';
import ecomApi from '../services/ecommApi.js';

const OrderForm = ({ productId, initialData = {}, onSubmit, onCancel }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    productId: productId || '',
    ordersReceived: '',
    ordersDelivered: '',
    adSpend: '0', // Par défaut 0 pour la closeuse
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!productId) {
      loadProducts();
    }
  }, [productId]);

  const loadProducts = async () => {
    try {
      const response = await ecomApi.get('/products?isActive=true');
      setProducts(response.data.data);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Effacer l'erreur quand l'utilisateur modifie le champ
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.productId) {
      newErrors.productId = 'Veuillez sélectionner un produit';
    }

    if (!formData.ordersReceived || formData.ordersReceived < 0) {
      newErrors.ordersReceived = 'Le nombre de commandes reçues doit être positif';
    }

    if (!formData.ordersDelivered || formData.ordersDelivered < 0) {
      newErrors.ordersDelivered = 'Le nombre de commandes livrées doit être positif';
    }

    if (parseInt(formData.ordersDelivered) > parseInt(formData.ordersReceived)) {
      newErrors.ordersDelivered = 'Le nombre de commandes livrées ne peut pas dépasser le nombre de commandes reçues';
    }

    if (formData.adSpend && (formData.adSpend < 0 || isNaN(formData.adSpend))) {
      newErrors.adSpend = 'Les dépenses publicitaires doivent être positives';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        ordersReceived: parseInt(formData.ordersReceived),
        ordersDelivered: parseInt(formData.ordersDelivered),
        adSpend: parseFloat(formData.adSpend) || 0
      };

      if (onSubmit) {
        await onSubmit(submitData);
      }
    } catch (error) {
      console.error('Erreur soumission formulaire:', error);
      setErrors({ 
        submit: error.response?.data?.message || 'Erreur lors de la soumission' 
      });
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  };

  const selectedProduct = products.find(p => p._id === formData.productId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Message d'erreur global */}
      {errors.submit && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {errors.submit}
        </div>
      )}

      {/* Sélection du produit */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Produit *
        </label>
        {productId ? (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="font-medium">{selectedProduct?.name || 'Chargement...'}</span>
          </div>
        ) : (
          <select
            name="productId"
            value={formData.productId}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.productId ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Sélectionner un produit</option>
            {products.map((product) => (
              <option key={product._id} value={product._id}>
                {product.name} (Stock: {product.stock})
              </option>
            ))}
          </select>
        )}
        {errors.productId && (
          <p className="mt-1 text-sm text-red-600">{errors.productId}</p>
        )}
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Date *
        </label>
        <input
          type="date"
          name="date"
          value={formData.date}
          onChange={handleInputChange}
          max={new Date().toISOString().split('T')[0]}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Commandes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Commandes Reçues *
          </label>
          <input
            type="number"
            name="ordersReceived"
            value={formData.ordersReceived}
            onChange={handleInputChange}
            min="0"
            placeholder="0"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.ordersReceived ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.ordersReceived && (
            <p className="mt-1 text-sm text-red-600">{errors.ordersReceived}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Commandes Livrées *
          </label>
          <input
            type="number"
            name="ordersDelivered"
            value={formData.ordersDelivered}
            onChange={handleInputChange}
            min="0"
            placeholder="0"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.ordersDelivered ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.ordersDelivered && (
            <p className="mt-1 text-sm text-red-600">{errors.ordersDelivered}</p>
          )}
        </div>
      </div>

      {/* Dépenses publicitaires (admin/compta seulement) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Dépenses Publicitaires (FCFA)
        </label>
        <input
          type="number"
          name="adSpend"
          value={formData.adSpend}
          onChange={handleInputChange}
          min="0"
          step="0.01"
          placeholder="0.00"
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            errors.adSpend ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.adSpend && (
          <p className="mt-1 text-sm text-red-600">{errors.adSpend}</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleInputChange}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Observations, problèmes rencontrés, retards de livraison..."
        />
      </div>

      {/* Informations du produit sélectionné */}
      {selectedProduct && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Informations produit</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Stock actuel:</span>
              <span className="ml-2 font-medium text-blue-900">{selectedProduct.stock}</span>
            </div>
            <div>
              <span className="text-blue-700">Prix vente:</span>
              <span className="ml-2 font-medium text-blue-900">{selectedProduct.sellingPrice} FCFA</span>
            </div>
            <div>
              <span className="text-blue-700">Coût produit:</span>
              <span className="ml-2 font-medium text-blue-900">{selectedProduct.productCost} FCFA</span>
            </div>
            <div>
              <span className="text-blue-700">Statut:</span>
              <span className="ml-2 font-medium text-blue-900 capitalize">{selectedProduct.status}</span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            Annuler
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Enregistrement...
            </div>
          ) : (
            'Enregistrer le rapport'
          )}
        </button>
      </div>
    </form>
  );
};

export default OrderForm;
