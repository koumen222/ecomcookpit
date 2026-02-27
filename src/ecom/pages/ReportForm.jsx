import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';

const ReportForm = () => {
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
    productId: '',
    ordersReceived: '',
    ordersDelivered: '',
    adSpend: '0',
    notes: '',
    deliveries: [],
    priceExceptions: []
  });
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (id) {
      setIsEditing(true);
      loadReport();
    }
  }, [id]);

  const loadReport = async () => {
    try {
      setInitialLoading(true);
      const response = await ecomApi.get(`/reports/${id}`);
      const report = response.data.data;
      
      setFormData({
        date: new Date(report.date).toISOString().split('T')[0],
        productId: report.productId?._id || report.productId,
        ordersReceived: report.ordersReceived?.toString() || '',
        ordersDelivered: report.ordersDelivered?.toString() || '',
        adSpend: report.adSpend?.toString() || '0',
        notes: report.notes || '',
        deliveries: report.deliveries || [],
        priceExceptions: report.priceExceptions || []
      });
    } catch (error) {
      setError(getContextualError(error, 'load_stats'));
      console.error(error);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await ecomApi.get('/products', { params: { isActive: true } });
      // Correction: les produits sont directement dans response.data.data
      const productsData = response.data?.data || [];
      setProducts(Array.isArray(productsData) ? productsData : []);
      console.log('📦 Produits chargés pour rapports:', productsData.length);
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
    if (name === 'productId') {
      const p = products.find(p => p._id === value);
      setSelectedProduct(p || null);
    }
  };

  const addPriceException = () => {
    setFormData(prev => ({
      ...prev,
      priceExceptions: [...prev.priceExceptions, { quantity: '', unitPrice: '' }]
    }));
  };

  const removePriceException = (index) => {
    setFormData(prev => ({
      ...prev,
      priceExceptions: prev.priceExceptions.filter((_, i) => i !== index)
    }));
  };

  const handlePriceExceptionChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      priceExceptions: prev.priceExceptions.map((ex, i) =>
        i === index ? { ...ex, [field]: value } : ex
      )
    }));
  };

  // Calcul du CA avec exceptions
  const calcRevenue = () => {
    const delivered = parseInt(formData.ordersDelivered) || 0;
    const exceptions = formData.priceExceptions.filter(e => e.quantity && e.unitPrice);
    if (exceptions.length === 0) {
      return delivered * (selectedProduct?.sellingPrice || 0);
    }
    const exceptionQty = exceptions.reduce((s, e) => s + (parseInt(e.quantity) || 0), 0);
    const exceptionRevenue = exceptions.reduce((s, e) => s + (parseInt(e.quantity) || 0) * (parseFloat(e.unitPrice) || 0), 0);
    const normalQty = Math.max(0, delivered - exceptionQty);
    const normalRevenue = normalQty * (selectedProduct?.sellingPrice || 0);
    return normalRevenue + exceptionRevenue;
  };

  const calcBenefit = () => {
    const delivered = parseInt(formData.ordersDelivered) || 0;
    const productCost = selectedProduct?.productCost || 0;
    const deliveryCost = selectedProduct?.deliveryCost || 0;
    const totalCostPerUnit = productCost + deliveryCost;
    const revenue = calcRevenue();
    return revenue - (totalCostPerUnit * delivered) - (parseFloat(formData.adSpend) || 0);
  };

  const addDelivery = () => {
    setFormData(prev => ({
      ...prev,
      deliveries: [...prev.deliveries, { agencyName: '', ordersDelivered: '', deliveryCost: '' }]
    }));
  };

  const removeDelivery = (index) => {
    setFormData(prev => ({
      ...prev,
      deliveries: prev.deliveries.filter((_, i) => i !== index)
    }));
  };

  const handleDeliveryChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      deliveries: prev.deliveries.map((delivery, i) => 
        i === index ? { ...delivery, [field]: value } : delivery
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('📊 Soumission du rapport:', formData);
      
      const validExceptions = formData.priceExceptions
        .filter(e => e.quantity && e.unitPrice)
        .map(e => ({ quantity: parseInt(e.quantity), unitPrice: parseFloat(e.unitPrice) }));

      const reportData = {
        date: formData.date,
        productId: formData.productId,
        ordersReceived: parseInt(formData.ordersReceived),
        ordersDelivered: parseInt(formData.ordersDelivered),
        adSpend: parseFloat(formData.adSpend) || 0,
        notes: formData.notes,
        deliveries: formData.deliveries.map(d => ({
          agencyName: d.agencyName,
          ordersDelivered: parseInt(d.ordersDelivered) || 0,
          deliveryCost: parseFloat(d.deliveryCost) || 0
        })),
        priceExceptions: validExceptions
      };

      if (isEditing) {
        await ecomApi.put(`/reports/${id}`, reportData);
        console.log('✅ Rapport mis à jour avec succès');
      } else {
        reportData.reportedBy = user._id;
        await ecomApi.post('/reports', reportData);
        console.log('✅ Rapport créé avec succès');
      }
      
      navigate('/ecom/reports');
    } catch (error) {
      console.error('❌ Erreur:', error);
      setError(getContextualError(error, 'save_order'));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse mb-6" />
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i}>
            <div className="h-3 w-28 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
          {isEditing ? 'Modifier un rapport' : 'Nouveau rapport'}
        </h1>
        <p className="text-gray-600 mt-2">
          {isEditing ? 'Modifiez les données du rapport' : 'Enregistrez les données quotidiennes pour un produit'}
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
              Date *
            </label>
            <input
              type="date"
              name="date"
              required
              value={formData.date}
              onChange={handleChange}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-600 focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Produit *
            </label>
            <select
              name="productId"
              required
              value={formData.productId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-600 focus:border-emerald-600"
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
              Commandes reçues *
            </label>
            <input
              type="number"
              name="ordersReceived"
              required
              min="0"
              value={formData.ordersReceived}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-600 focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Commandes livrées *
            </label>
            <input
              type="number"
              name="ordersDelivered"
              required
              min="0"
              value={formData.ordersDelivered}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-600 focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Section Exceptions de prix */}
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-sm font-semibold text-amber-900">Exceptions de prix</h3>
              <p className="text-xs text-amber-700 mt-0.5">Certaines commandes livrées ù  un prix différent du prix standard ?</p>
            </div>
            <button
              type="button"
              onClick={addPriceException}
              className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition"
            >
              + Ajouter
            </button>
          </div>

          {formData.priceExceptions.length === 0 ? (
            <p className="text-xs text-amber-600 italic">Aucune exception — le prix standard du produit sera utilisé pour toutes les commandes livrées.</p>
          ) : (
            <div className="space-y-2">
              {formData.priceExceptions.map((ex, index) => (
                <div key={index} className="flex gap-2 items-center bg-white rounded-lg p-2 border border-amber-200">
                  <div className="flex-1">
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Quantité</label>
                    <input
                      type="number"
                      value={ex.quantity}
                      onChange={(e) => handlePriceExceptionChange(index, 'quantity', e.target.value)}
                      min="1"
                      placeholder="Ex: 2"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Prix unitaire (FCFA)</label>
                    <input
                      type="number"
                      value={ex.unitPrice}
                      onChange={(e) => handlePriceExceptionChange(index, 'unitPrice', e.target.value)}
                      min="0"
                      placeholder="Ex: 12000"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removePriceException(index)}
                    className="mt-4 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Résumé des exceptions */}
          {formData.priceExceptions.length > 0 && selectedProduct && formData.ordersDelivered && (
            <div className="mt-3 pt-3 border-t border-amber-200 text-xs text-amber-800 space-y-1">
              {(() => {
                const delivered = parseInt(formData.ordersDelivered) || 0;
                const exceptionQty = formData.priceExceptions.reduce((s, e) => s + (parseInt(e.quantity) || 0), 0);
                const normalQty = Math.max(0, delivered - exceptionQty);
                return (
                  <>
                    {normalQty > 0 && (
                      <p>• <strong>{normalQty}</strong> cmd au prix standard ({(selectedProduct.sellingPrice || 0).toLocaleString('fr-FR')} FCFA)</p>
                    )}
                    {formData.priceExceptions.filter(e => e.quantity && e.unitPrice).map((e, i) => (
                      <p key={i}>• <strong>{e.quantity}</strong> cmd à <strong>{parseFloat(e.unitPrice || 0).toLocaleString('fr-FR')} FCFA</strong></p>
                    ))}
                    <p className="font-semibold pt-1">CA estimé : {calcRevenue().toLocaleString('fr-FR')} FCFA</p>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Section Livraisons par agence */}
        <div className="border-t pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Livraisons par agence</h3>
            <button
              type="button"
              onClick={addDelivery}
              className="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
            >
              + Ajouter une agence
            </button>
          </div>

          {formData.deliveries.length === 0 ? (
            <p className="text-gray-500 text-sm italic">Aucune agence ajoutée. Cliquez sur "Ajouter une agence" pour commencer.</p>
          ) : (
            <div className="space-y-3">
              {formData.deliveries.map((delivery, index) => (
                <div key={index} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Nom de l'agence
                    </label>
                    <input
                      type="text"
                      value={delivery.agencyName}
                      onChange={(e) => handleDeliveryChange(index, 'agencyName', e.target.value)}
                      placeholder="Ex: DHL Express"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-600 focus:border-emerald-600"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Commandes
                    </label>
                    <input
                      type="number"
                      value={delivery.ordersDelivered}
                      onChange={(e) => handleDeliveryChange(index, 'ordersDelivered', e.target.value)}
                      min="0"
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-600 focus:border-emerald-600"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Coût livraison
                    </label>
                    <input
                      type="number"
                      value={delivery.deliveryCost}
                      onChange={(e) => handleDeliveryChange(index, 'deliveryCost', e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-600 focus:border-emerald-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDelivery(index)}
                    className="mt-6 px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                    title="Supprimer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
          {user?.role !== 'ecom_closeuse' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dépenses publicitaires (FCFA)
              </label>
              <input
                type="number"
                name="adSpend"
                min="0"
                step="0.01"
                value={formData.adSpend}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes
          </label>
          <textarea
            name="notes"
            rows="4"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Informations supplémentaires sur la journée..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-emerald-600 focus:border-emerald-600"
          />
        </div>

        {/* Calcul du taux de livraison */}
        {formData.ordersReceived && formData.ordersDelivered && (
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
            <h3 className="text-sm font-semibold text-emerald-900 mb-3">Statistiques calculées</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="bg-white rounded-lg p-2.5">
                <p className="text-xs text-gray-500 mb-0.5">Taux de livraison</p>
                <p className="font-bold text-gray-900">{((parseInt(formData.ordersDelivered) / parseInt(formData.ordersReceived)) * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-white rounded-lg p-2.5">
                <p className="text-xs text-gray-500 mb-0.5">En attente</p>
                <p className="font-bold text-gray-900">{parseInt(formData.ordersReceived) - parseInt(formData.ordersDelivered)}</p>
              </div>
              {selectedProduct && (
                <>
                  <div className="bg-white rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 mb-0.5">CA estimé</p>
                    <p className="font-bold text-emerald-600">{calcRevenue().toLocaleString('fr-FR')} FCFA</p>
                  </div>
                  <div className="bg-white rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 mb-0.5">Bénéfice estimé</p>
                    <p className={`font-bold ${calcBenefit() >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{calcBenefit().toLocaleString('fr-FR')} FCFA</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/ecom/reports')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? (isEditing ? 'Modification...' : 'Création...') : (isEditing ? 'Modifier le rapport' : 'Créer le rapport')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReportForm;
