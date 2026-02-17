import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Save, 
  X, 
  TrendingUp, 
  DollarSign, 
  Package, 
  Target,
  AlertCircle,
  CheckCircle,
  ArrowLeft
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

const ProductFinderEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [originalProduct, setOriginalProduct] = useState(null);
  
  const [product, setProduct] = useState({
    // Informations de base
    name: '',
    imageUrl: '',
    creative: '',
    alibabaLink: '',
    researchLink: '',
    websiteUrl: '',
    
    // Prix et coûts (format Excel)
    sourcingType: 'local',
    sourcingPrice: '',
    weight: '',
    pricePerKg: '',
    shippingUnitCost: '',
    cogs: '',
    sellingPrice: '',
    
    // Champs additionnels pour analyse
    category: '',
    demand: 'medium',
    competition: 'medium',
    trend: 'stable',
    
    // Notes et observations
    notes: '',
    pros: [''],
    cons: [''],
    
    // Potentiel
    opportunityScore: 3,
    monthlyEstimate: '',
    
    // Statut
    status: 'research'
  });

  useEffect(() => {
    if (id) {
      loadProduct();
    }
  }, [id]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const response = await ecomApi.get(`/products-research/research/${id}`);
      
      if (response.data.success) {
        const productData = response.data.data;
        setProduct({
          ...productData,
          sourcingType: productData.sourcingType || 'local',
          sourcingPrice: productData.sourcingPrice?.toString() || '',
          weight: productData.weight?.toString() || '',
          pricePerKg: productData.pricePerKg?.toString() || '',
          shippingUnitCost: productData.shippingUnitCost?.toString() || '',
          cogs: productData.cogs?.toString() || '',
          sellingPrice: productData.sellingPrice?.toString() || '',
          opportunityScore: productData.opportunityScore || 3,
          monthlyEstimate: productData.monthlyEstimate?.toString() || ''
        });
        setOriginalProduct(productData);
      }
    } catch (error) {
      console.error('Erreur chargement produit:', error);
      setError('Erreur lors du chargement du produit');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setProduct(prev => {
      const next = { ...prev, [field]: value };

      if (field === 'sourcingType') {
        if (value === 'local') {
          next.weight = '';
          next.pricePerKg = '';
          next.shippingUnitCost = '0';
        }
        if (value === 'china') {
          next.shippingUnitCost = '';
        }
      }

      if (next.sourcingType === 'china') {
        const weight = parseFloat(next.weight) || 0;
        const pricePerKg = parseFloat(next.pricePerKg) || 0;
        if (weight > 0 && pricePerKg > 0) {
          next.shippingUnitCost = (weight * pricePerKg).toFixed(0);
        }
      } else {
        next.shippingUnitCost = '0';
      }

      if (
        field === 'sourcingPrice' ||
        field === 'weight' ||
        field === 'pricePerKg' ||
        field === 'sourcingType'
      ) {
        const sourcing = parseFloat(next.sourcingPrice) || 0;
        const shipping = parseFloat(next.shippingUnitCost) || 0;
        if (next.sourcingPrice !== '') {
          next.cogs = (sourcing + shipping).toFixed(0);
        }
      }

      return next;
    });
    setError('');
    setSuccess('');
  };

  const handleArrayChange = (field, index, value) => {
    const newArray = [...product[field]];
    newArray[index] = value;
    setProduct(prev => ({ ...prev, [field]: newArray }));
  };

  const addArrayItem = (field) => {
    setProduct(prev => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const removeArrayItem = (field, index) => {
    const newArray = product[field].filter((_, i) => i !== index);
    setProduct(prev => ({ ...prev, [field]: newArray }));
  };

  const calculateMargin = () => {
    const sourcing = parseFloat(product.sourcingPrice) || 0;
    const shipping = parseFloat(product.shippingUnitCost) || 0;
    const cogs = parseFloat(product.cogs) || 0;
    const sell = parseFloat(product.sellingPrice) || 0;
    
    if (sell === 0) return 0;
    
    // Marge = ((Prix vente - COGS) / Prix vente) * 100
    const margin = ((sell - cogs) / sell) * 100;
    return Math.max(0, margin).toFixed(1);
  };

  const calculateProfit = () => {
    const cogs = parseFloat(product.cogs) || 0;
    const sell = parseFloat(product.sellingPrice) || 0;
    
    // Bénéfice = Prix vente - COGS
    return Math.max(0, sell - cogs).toFixed(0);
  };

  const calculateCOGS = () => {
    const sourcing = parseFloat(product.sourcingPrice) || 0;
    const shipping = parseFloat(product.shippingUnitCost) || 0;
    
    // COGS = Prix sourcing + Frais livraison unitaire
    return (sourcing + shipping).toFixed(0);
  };

  // Calcul du prix suggéré
  const calculateSuggestedPrice = () => {
    const sourcingPrice = parseFloat(product.sourcingPrice) || 0;
    
    let suggestedPrice;
    
    if (sourcingPrice < 10000) {
      // Si < 10 000 : multiplier par 3
      suggestedPrice = sourcingPrice * 3;
    } else {
      // Si >= 10 000 : multiplier par 2,25
      suggestedPrice = sourcingPrice * 2.25;
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
    handleInputChange('sellingPrice', suggestedPrice);
  };

  const validateForm = () => {
    if (!product.name.trim()) {
      setError('Le nom du produit est requis');
      return false;
    }
    
    if (!product.sourcingPrice || parseFloat(product.sourcingPrice) <= 0) {
      setError('Le prix sourcing doit être supérieur à 0');
      return false;
    }

    if (product.sourcingType === 'china') {
      if (!product.weight || parseFloat(product.weight) <= 0) {
        setError('Le poids doit être supérieur à 0');
        return false;
      }
      if (!product.pricePerKg || parseFloat(product.pricePerKg) <= 0) {
        setError('Le prix du kilo doit être supérieur à 0');
        return false;
      }
    }
    
    if (!product.sellingPrice || parseFloat(product.sellingPrice) <= 0) {
      setError('Le prix de vente doit être supérieur à 0');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Préparer les données pour l'API
      const productData = {
        ...product,
        sourcingPrice: parseFloat(product.sourcingPrice),
        weight: parseFloat(product.weight) || 0,
        pricePerKg: parseFloat(product.pricePerKg) || 0,
        shippingUnitCost: parseFloat(product.shippingUnitCost) || 0,
        cogs: parseFloat(product.cogs) || 0,
        sellingPrice: parseFloat(product.sellingPrice),
        opportunityScore: parseInt(product.opportunityScore),
        monthlyEstimate: parseInt(product.monthlyEstimate) || 0,
        margin: parseFloat(calculateMargin()),
        profit: parseFloat(calculateProfit()),
        pros: product.pros.filter(p => p.trim()),
        cons: product.cons.filter(c => c.trim())
      };
      
      // Appeler l'API pour mettre à jour
      const response = await ecomApi.put(`/products-research/research/${id}`, productData);
      
      if (response.data.success) {
        setSuccess('Produit de recherche mis à jour avec succès!');
        
        // Rediriger vers la liste après 2 secondes
        setTimeout(() => {
          navigate('/ecom/product-research');
        }, 2000);
      }
    } catch (error) {
      console.error('Erreur mise à jour produit:', error);
      setError('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 4) return 'text-green-600';
    if (score >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score) => {
    if (score >= 4) return 'bg-green-100';
    if (score >= 3) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/ecom/product-research')}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Modifier Produit</h1>
                <p className="text-gray-600 mt-1">Mettre à jour les informations du produit</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="text-red-600 mr-3" size={20} />
            <span className="text-red-700">{error}</span>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="text-green-600 mr-3" size={20} />
            <span className="text-green-700">{success}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Informations de base - Format Excel */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Package className="mr-2" size={20} />
              Informations Produit (Format Veille)
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PRODUIT *
                </label>
                <input
                  type="text"
                  value={product.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Drain Stick, Correcteur Blancheur..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IMAGE APPARENTE
                </label>
                <input
                  type="url"
                  value={product.imageUrl}
                  onChange={(e) => handleInputChange('imageUrl', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://drive.google.com/file/d/..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CREATIVE (Ads/Video)
                </label>
                <input
                  type="url"
                  value={product.creative}
                  onChange={(e) => handleInputChange('creative', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Lien vers la publicité ou vidéo"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  LIEN ALIBABA
                </label>
                <input
                  type="url"
                  value={product.alibabaLink}
                  onChange={(e) => handleInputChange('alibabaLink', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://www.alibaba.com/product-detail/..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  LIEN RECHERCHE (Facebook Ads, TikTok...)
                </label>
                <input
                  type="url"
                  value={product.researchLink}
                  onChange={(e) => handleInputChange('researchLink', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://www.facebook.com/ads/library/?id=..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SITE WEB
                </label>
                <input
                  type="url"
                  value={product.websiteUrl}
                  onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/products/..."
                />
              </div>
            </div>
          </div>
          
          {/* Analyse financière - Format Excel */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <DollarSign className="mr-2" size={20} />
              Analyse Financière (Format Excel)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SOURCING
                </label>
                <select
                  value={product.sourcingType}
                  onChange={(e) => handleInputChange('sourcingType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="local">Local</option>
                  <option value="china">Chine</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PRIX SOURCING BRUT * (FCFA)
                </label>
                <input
                  type="number"
                  value={product.sourcingPrice}
                  onChange={(e) => handleInputChange('sourcingPrice', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="360"
                  min="0"
                  step="10"
                  required
                />
              </div>
              
              <div className={product.sourcingType === 'china' ? '' : 'opacity-50'}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  POIDS (KG)
                </label>
                <input
                  type="number"
                  value={product.weight}
                  onChange={(e) => handleInputChange('weight', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.10"
                  min="0"
                  step="0.01"
                  disabled={product.sourcingType !== 'china'}
                />
              </div>

              <div className={product.sourcingType === 'china' ? '' : 'opacity-50'}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PRIX DU KILO (FCFA)
                </label>
                <input
                  type="number"
                  value={product.pricePerKg}
                  onChange={(e) => handleInputChange('pricePerKg', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="12000"
                  min="0"
                  step="10"
                  disabled={product.sourcingType !== 'china'}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  COÛT D'ACHAT FINAL (FCFA)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={product.cogs}
                    onChange={(e) => handleInputChange('cogs', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={calculateCOGS()}
                    min="0"
                    step="10"
                  />
                  <button
                    type="button"
                    onClick={() => handleInputChange('cogs', calculateCOGS())}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200"
                  >
                    Auto
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PRIX DE VENTE * (FCFA)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={product.sellingPrice}
                    onChange={(e) => handleInputChange('sellingPrice', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1560"
                    min="0"
                    step="10"
                    required
                  />
                  <button
                    type="button"
                    onClick={applySuggestedPrice}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded hover:bg-green-200"
                    title="Calculer un prix de vente raisonnable (3x le prix d'achat)"
                  >
                    Suggérer
                  </button>
                </div>
                {product.sourcingPrice && parseFloat(product.sourcingPrice) > 0 ? (
                  <p className="mt-1 text-xs text-gray-500">
                    Prix suggéré: {calculateSuggestedPrice()} FCFA (3x le prix d'achat)
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">
                    Saisissez un prix sourcing pour voir le prix suggéré
                  </p>
                )}
              </div>
            </div>
            
            {/* Calculs automatiques */}
            {(product.sourcingPrice && product.sellingPrice) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Marge</p>
                  <p className={`text-lg font-semibold ${parseFloat(calculateMargin()) >= 30 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {calculateMargin()}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Bénéfice/unité</p>
                  <p className="text-lg font-semibold text-blue-600">
                    {calculateProfit()} FCFA
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">ROI</p>
                  <p className="text-lg font-semibold text-purple-600">
                    {product.cogs && calculateProfit() > 0 
                      ? ((calculateProfit() / parseFloat(product.cogs)) * 100).toFixed(1) 
                      : '0'}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Ventes/mois estimées</p>
                  <input
                    type="number"
                    value={product.monthlyEstimate}
                    onChange={(e) => handleInputChange('monthlyEstimate', e.target.value)}
                    className="w-full px-2 py-1 text-center border border-gray-300 rounded"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex justify-between space-x-4">
            <button
              type="button"
              onClick={() => navigate('/ecom/product-research')}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Mise à jour...
                </>
              ) : (
                <>
                  <Save size={20} className="mr-2" />
                  Sauvegarder les modifications
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductFinderEdit;
