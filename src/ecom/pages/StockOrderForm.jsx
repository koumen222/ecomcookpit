import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney';
import ecomApi from '../services/ecommApi.js';

const StockOrderForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useEcomAuth();
  const { fmt, symbol } = useMoney();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [products, setProducts] = useState([]);
  
  const [formData, setFormData] = useState({
    productId: '',
    productName: '',
    sourcing: 'local',
    quantity: '',
    weightKg: '',
    pricePerKg: '',
    purchasePrice: '',
    sellingPrice: '',
    transportCost: '',
    supplierName: '',
    expectedArrival: '',
    trackingNumber: '',
    notes: ''
  });

  useEffect(() => {
    loadProducts();
    if (id) {
      setIsEditing(true);
      loadOrder();
    }
  }, [id]);

  const loadProducts = async () => {
    try {
      const response = await ecomApi.get('/products', { params: { isActive: true } });
      const productsData = response.data?.data || [];
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    }
  };

  const loadOrder = async () => {
    try {
      setInitialLoading(true);
      const response = await ecomApi.get(`/stock/orders/${id}`);
      const order = response.data.data;
      setFormData({
        productId: order.productId?._id || order.productId || '',
        productName: order.productName || '',
        sourcing: order.sourcing || 'local',
        quantity: order.quantity?.toString() || '',
        weightKg: order.weightKg?.toString() || '',
        pricePerKg: order.pricePerKg?.toString() || '',
        purchasePrice: order.purchasePrice?.toString() || '',
        sellingPrice: order.sellingPrice?.toString() || '',
        transportCost: order.transportCost?.toString() || '',
        supplierName: order.supplierName || '',
        expectedArrival: order.expectedArrival ? new Date(order.expectedArrival).toISOString().split('T')[0] : '',
        trackingNumber: order.trackingNumber || '',
        notes: order.notes || ''
      });
    } catch (error) {
      setError('Erreur lors du chargement de la commande');
      console.error(error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Calculs automatiques
  const qty = parseInt(formData.quantity) || 0;
  const weightKg = parseFloat(formData.weightKg) || 0;
  const pricePerKg = parseFloat(formData.pricePerKg) || 0;
  const purchasePrice = parseFloat(formData.purchasePrice) || 0;
  const sellingPrice = parseFloat(formData.sellingPrice) || 0;
  const transportCost = weightKg * pricePerKg;
  const totalPurchaseCost = purchasePrice * qty;
  const totalCost = totalPurchaseCost + transportCost;
  const totalSellingValue = sellingPrice * qty;
  const estimatedProfit = totalSellingValue - totalCost;
  const profitPerUnit = qty > 0 ? estimatedProfit / qty : 0;

  // Supprimer la fonction formatCurrency locale car nous utilisons maintenant useMoney

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const orderData = {
        productId: formData.productId || undefined,
        productName: formData.productName,
        sourcing: formData.sourcing,
        quantity: qty,
        weightKg,
        pricePerKg,
        purchasePrice,
        sellingPrice,
        transportCost,
        supplierName: formData.supplierName,
        expectedArrival: formData.expectedArrival || undefined,
        trackingNumber: formData.trackingNumber,
        notes: formData.notes
      };

      if (isEditing) {
        await ecomApi.put(`/stock/orders/${id}`, orderData);
      } else {
        await ecomApi.post('/stock/orders', orderData);
      }
      navigate('/ecom/stock/orders');
    } catch (error) {
      setError(error.response?.data?.message || `Erreur lors de ${isEditing ? 'la modification' : 'la création'} de la commande`);
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
          {isEditing ? 'Modifier la commande de stock' : 'Nouvelle commande de stock'}
        </h1>
        <p className="text-gray-600 mt-2">
          {isEditing ? 'Modifiez les informations de la commande' : 'Enregistrez une nouvelle commande de stock'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations produit et sourcing */}
        <div className="bg-white shadow rounded-lg p-3 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Produit et sourcing</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Produit *
              </label>
              <select
                name="productId"
                required
                value={formData.productId}
                onChange={(e) => {
                  const selectedProduct = products.find(p => p._id === e.target.value);
                  setFormData(prev => ({
                    ...prev,
                    productId: e.target.value,
                    productName: selectedProduct?.name || prev.productName
                  }));
                }}
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
                Sourcing *
              </label>
              <select
                name="sourcing"
                required
                value={formData.sourcing}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="local">Local</option>
                <option value="chine">Chine</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantité *
              </label>
              <input
                type="number"
                name="quantity"
                required
                min="1"
                value={formData.quantity}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fournisseur
              </label>
              <input
                type="text"
                name="supplierName"
                value={formData.supplierName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Prix et poids */}
        <div className="bg-white shadow rounded-lg p-3 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Prix et poids</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Poids total (kg) *
              </label>
              <input
                type="number"
                name="weightKg"
                required
                min="0"
                step="0.01"
                value={formData.weightKg}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prix par kg ({symbol}) *
              </label>
              <input
                type="number"
                name="pricePerKg"
                required
                min="0"
                step="0.01"
                value={formData.pricePerKg}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prix d'achat unitaire ({symbol}) *
                {formData.sourcing === 'chine' && <span className="text-xs text-blue-600 ml-1">(en Chine)</span>}
              </label>
              <input
                type="number"
                name="purchasePrice"
                required
                min="0"
                step="0.01"
                value={formData.purchasePrice}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prix de vente unitaire ({symbol}) *
              </label>
              <input
                type="number"
                name="sellingPrice"
                required
                min="0"
                step="0.01"
                value={formData.sellingPrice}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Coût de transport ({symbol})
                <span className="text-xs text-gray-500 ml-1">(poids x prix/kg)</span>
              </label>
              <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-900 font-semibold">
                {fmt(transportCost)}
              </div>
            </div>
          </div>
        </div>

        {/* Livraison */}
        <div className="bg-white shadow rounded-lg p-3 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Livraison</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date d'arrivée prévue
              </label>
              <input
                type="date"
                name="expectedArrival"
                value={formData.expectedArrival}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Numéro de suivi
              </label>
              <input
                type="text"
                name="trackingNumber"
                value={formData.trackingNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              rows="3"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Notes supplémentaires..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Aperçu financier */}
        {(qty > 0 && purchasePrice > 0) && (
          <div className={`p-4 rounded-lg ${estimatedProfit > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <h3 className="text-sm font-medium mb-3">Aperçu financier</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 text-sm">
              <div>
                <span className="text-gray-600">Quantité:</span>
                <p className="font-semibold text-lg">{qty}</p>
              </div>
              <div>
                <span className="text-gray-600">Coût d'achat total:</span>
                <p className="font-semibold">{fmt(totalPurchaseCost)}</p>
              </div>
              <div>
                <span className="text-gray-600">Transport:</span>
                <p className="font-semibold">{fmt(transportCost)}</p>
              </div>
              <div>
                <span className="text-gray-600">Coût total:</span>
                <p className="font-bold text-red-600">{fmt(totalCost)}</p>
              </div>
              <div>
                <span className="text-gray-600">Valeur de vente:</span>
                <p className="font-semibold text-blue-600">{fmt(totalSellingValue)}</p>
              </div>
              <div>
                <span className="text-gray-600">Profit estimé:</span>
                <p className={`font-bold text-lg ${estimatedProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmt(estimatedProfit)}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Profit/unité:</span>
                <p className={`font-semibold ${profitPerUnit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmt(profitPerUnit)}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Poids total:</span>
                <p className="font-semibold">{weightKg} kg</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/ecom/stock/orders')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (isEditing ? 'Modification...' : 'Création...') : (isEditing ? 'Modifier la commande' : 'Créer la commande')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StockOrderForm;
