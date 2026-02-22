import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Save, 
  X, 
  TrendingUp, 
  DollarSign, 
  Package, 
  Target,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

const ProductFinder = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const defaultProductState = {
    // Informations de base
    name: '',
    imageUrl: '', // Image apparente
    creative: '', // Creative/ads
    alibabaLink: '', // Lien Alibaba
    researchLink: '', // Lien recherche (Facebook Ads, TikTok, etc.)
    websiteUrl: '', // Site web
    
    // Sourcing
    sourcingType: 'local', // local | china
    
    // Prix et coûts (format Excel)
    sourcingPrice: '', // PRIX SOURCING BRUT
    weight: '', // POIDS (KG)
    pricePerKg: '', // PRIX DU KILO (si chine)
    shippingUnitCost: '', // FRAIS DE LIVRAISON UNITAIRE
    cogs: '', // COÛT DE REVIENT (COGS)
    sellingPrice: '', // PRIX DE VENTE
    
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
  };
  
  const [product, setProduct] = useState(defaultProductState);

  const categories = [
    'Électronique', 'Accessoires', 'Mode & Vêtements', 'Beauté & Cosmétiques',
    'Maison & Jardin', 'Sports & Loisirs', 'Santé & Bien-être', 'Livres & Médias',
    'Jouets & Jeux', 'Automobile', 'Alimentation', 'Services', 'Autre'
  ];

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
        cogs: parseFloat(product.cogs || calculateCOGS()) || 0,
        sellingPrice: parseFloat(product.sellingPrice),
        monthlyEstimate: parseInt(product.monthlyEstimate) || 0,
        margin: parseFloat(calculateMargin()),
        profit: parseFloat(calculateProfit()),
        pros: product.pros.filter(p => p.trim()),
        cons: product.cons.filter(c => c.trim()),
        researchDate: new Date().toISOString()
      };
      
      // Appeler l'API pour sauvegarder
      const response = await ecomApi.post('/products-research/research', productData);
      
      if (response.data.success) {
        setSuccess('Produit de recherche sauvegardé avec succès!');
        // Réinitialiser le formulaire
        setProduct(defaultProductState);
        
        // Rediriger vers la liste des produits de recherche après 2 secondes
        setTimeout(() => {
          navigate('/ecom/product-research-list');
        }, 2000);
      }
    } catch (error) {
      console.error('Erreur sauvegarde produit:', error);
      setError('Erreur lors de la sauvegarde. Veuillez réessayer.');
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Target className="mr-3" size={28} />
            Veille Produits
          </h1>
          <p className="text-gray-600 mt-1">Ajoutez un produit intéressant trouvé lors de votre recherche</p>
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
                    value={product.cogs || calculateCOGS()}
                    onChange={(e) => handleInputChange('cogs', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
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
                {product.sourcingPrice && (
                  <p className="mt-1 text-xs text-gray-500">
                    Calcul: {product.sourcingPrice} + {product.shippingUnitCost || 0} = {calculateCOGS()} FCFA
                  </p>
                )}
              </div>
              
              <div className="md:col-span-2 lg:col-span-1">
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
          
          {/* Analyse marché */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="mr-2" size={20} />
              Analyse marché
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Demande
                </label>
                <select
                  value={product.demand}
                  onChange={(e) => handleInputChange('demand', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Faible</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Élevée</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Concurrence
                </label>
                <select
                  value={product.competition}
                  onChange={(e) => handleInputChange('competition', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Faible</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Élevée</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tendance
                </label>
                <select
                  value={product.trend}
                  onChange={(e) => handleInputChange('trend', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="growing">Croissante 📈</option>
                  <option value="stable">Stable ➡️</option>
                  <option value="declining">En baisse 📉</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de fournisseurs
                </label>
                <input
                  type="number"
                  value={product.supplierCount}
                  onChange={(e) => handleInputChange('supplierCount', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fiabilité fournisseurs
                </label>
                <select
                  value={product.supplierReliability}
                  onChange={(e) => handleInputChange('supplierReliability', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Faible</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Élevée</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Score d'opportunité (1-5)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={product.opportunityScore}
                    onChange={(e) => handleInputChange('opportunityScore', parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${getScoreBg(product.opportunityScore)} ${getScoreColor(product.opportunityScore)}`}>
                    {product.opportunityScore}/5
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Avantages / Inconvénients */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Analyse SWOT</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Avantages (Forces)
                </label>
                {product.pros.map((pro, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={pro}
                      onChange={(e) => handleArrayChange('pros', index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Forte marge, demande élevée..."
                    />
                    {product.pros.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayItem('pros', index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayItem('pros')}
                  className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                >
                  + Ajouter un avantage
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Inconvénients (Faiblesses)
                </label>
                {product.cons.map((con, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={con}
                      onChange={(e) => handleArrayChange('cons', index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Forte concurrence, frais élevés..."
                    />
                    {product.cons.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayItem('cons', index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayItem('cons')}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                >
                  + Ajouter un inconvénient
                </button>
              </div>
            </div>
          </div>
          
          {/* Notes */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes et observations</h2>
            <textarea
              value={product.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              placeholder="Notes supplémentaires, idées de marketing, observations importantes..."
            />
          </div>
          
          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/ecom/product-research-list')}
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
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save size={20} className="mr-2" />
                  Sauvegarder le produit
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductFinder;
