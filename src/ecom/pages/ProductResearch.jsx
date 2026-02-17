import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Star, 
  MessageSquare, 
  Store, 
  CheckCircle, 
  AlertTriangle,
  X,
  Filter
} from 'lucide-react';

const ProductResearch = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('margin');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    minMargin: 0,
    maxPrice: 100000,
    competition: '',
    demand: ''
  });

  // Simuler une recherche de produits
  const searchProducts = async () => {
    if (!searchTerm.trim()) {
      return;
    }

    setLoading(true);
    
    // Simuler une recherche API
    setTimeout(() => {
      const mockProducts = [
        {
          id: 1,
          name: `Produit ${searchTerm} Premium`,
          category: 'Électronique',
          buyPrice: 15000,
          sellPrice: 25000,
          margin: 40,
          demand: 'Élevée',
          competition: 'Moyenne',
          niche: 'Bonne',
          suppliers: 3,
          monthlySales: 150,
          rating: 4.5,
          reviews: 89,
          description: 'Produit de haute qualité avec forte demande',
          pros: ['Forte marge', 'Demande élevée', 'Plusieurs fournisseurs'],
          cons: ['Compétition moyenne', 'Nécessite stock'],
          opportunity: 4,
          trend: 'stable',
          seasonality: 'non'
        },
        {
          id: 2,
          name: `Accessoire ${searchTerm} Pro`,
          category: 'Accessoires',
          buyPrice: 5000,
          sellPrice: 12000,
          margin: 58,
          demand: 'Très élevée',
          competition: 'Faible',
          niche: 'Excellente',
          suppliers: 5,
          monthlySales: 280,
          rating: 4.2,
          reviews: 156,
          description: 'Accessoire tendance avec faible concurrence',
          pros: ['Excellente marge', 'Faible concurrence', 'Tendance'],
          cons: ['Qualité variable', 'Saisonnier'],
          opportunity: 5,
          trend: 'growing',
          seasonality: 'yes'
        },
        {
          id: 3,
          name: `Service ${searchTerm} Plus`,
          category: 'Services',
          buyPrice: 8000,
          sellPrice: 15000,
          margin: 47,
          demand: 'Moyenne',
          competition: 'Élevée',
          niche: 'Moyenne',
          suppliers: 2,
          monthlySales: 95,
          rating: 3.8,
          reviews: 67,
          description: 'Service numérique avec marché saturé',
          pros: ['Pas de stock', 'Marge correcte'],
          cons: ['Forte concurrence', 'Service client'],
          opportunity: 2,
          trend: 'declining',
          seasonality: 'non'
        },
        {
          id: 4,
          name: `Kit ${searchTerm} Starter`,
          category: 'Kits',
          buyPrice: 12000,
          sellPrice: 22000,
          margin: 45,
          demand: 'Élevée',
          competition: 'Faible',
          niche: 'Très bonne',
          suppliers: 4,
          monthlySales: 180,
          rating: 4.7,
          reviews: 234,
          description: 'Kit complet pour débutants avec excellent potentiel',
          pros: ['Très bonne niche', 'Forte demande', 'Faible concurrence'],
          cons: ['Assemblage requis', 'Formation client'],
          opportunity: 5,
          trend: 'growing',
          seasonality: 'non'
        },
        {
          id: 5,
          name: `Premium ${searchTerm} Elite`,
          category: 'Luxe',
          buyPrice: 35000,
          sellPrice: 65000,
          margin: 46,
          demand: 'Faible',
          competition: 'Très faible',
          niche: 'Excellente',
          suppliers: 1,
          monthlySales: 45,
          rating: 4.9,
          reviews: 45,
          description: 'Produit luxe pour clientèle premium',
          pros: ['Marge élevée', 'Clientèle fidèle', 'Exclusivité'],
          cons: ['Faible volume', 'Investissement élevé'],
          opportunity: 4,
          trend: 'stable',
          seasonality: 'yes'
        },
        {
          id: 6,
          name: `Smart ${searchTerm} 2024`,
          category: 'Électronique',
          buyPrice: 18000,
          sellPrice: 35000,
          margin: 49,
          demand: 'Très élevée',
          competition: 'Moyenne',
          niche: 'Bonne',
          suppliers: 6,
          monthlySales: 320,
          rating: 4.3,
          reviews: 412,
          description: 'Version mise à jour avec fonctionnalités améliorées',
          pros: ['Très forte demande', 'Bonne marge', 'Plusieurs modèles'],
          cons: ['Compétition forte', 'Mises à jour fréquentes'],
          opportunity: 4,
          trend: 'growing',
          seasonality: 'non'
        },
        {
          id: 7,
          name: `Eco ${searchTerm} Green`,
          category: 'Écologique',
          buyPrice: 9000,
          sellPrice: 18000,
          margin: 50,
          demand: 'Élevée',
          competition: 'Faible',
          niche: 'Excellente',
          suppliers: 3,
          monthlySales: 195,
          rating: 4.6,
          reviews: 178,
          description: 'Produit écologique avec forte tendance',
          pros: ['Excellente niche', 'Marge élevée', 'Tendance durable'],
          cons: ['Coût production', 'Certifications'],
          opportunity: 5,
          trend: 'growing',
          seasonality: 'non'
        }
      ];

      // Appliquer les filtres
      const filteredProducts = mockProducts.filter(product => {
        if (filters.category && product.category !== filters.category) return false;
        if (filters.minMargin && product.margin < filters.minMargin) return false;
        if (filters.maxPrice && product.sellPrice > filters.maxPrice) return false;
        if (filters.competition && product.competition !== filters.competition) return false;
        if (filters.demand && product.demand !== filters.demand) return false;
        return true;
      });

      setProducts(filteredProducts);
      setLoading(false);
    }, 1500);
  };

  const sortProducts = (products) => {
    return [...products].sort((a, b) => {
      switch (sortBy) {
        case 'margin':
          return b.margin - a.margin;
        case 'revenue':
          return (b.sellPrice * b.monthlySales) - (a.sellPrice * a.monthlySales);
        case 'competition':
          return a.competition === 'Faible' ? 1 : a.competition === 'Moyenne' ? 0 : -1;
        case 'demand':
          return b.monthlySales - a.monthlySales;
        case 'rating':
          return b.rating - a.rating;
        case 'reviews':
          return b.reviews - a.reviews;
        default:
          return 0;
      }
    });
  };

  const getOpportunityColor = (opportunity) => {
    if (opportunity >= 4) return 'text-green-600';
    if (opportunity >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getOpportunityBg = (opportunity) => {
    if (opportunity >= 4) return 'bg-green-100';
    if (opportunity >= 3) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getCompetitionColor = (competition) => {
    switch (competition) {
      case 'Faible': return 'text-green-600';
      case 'Moyenne': return 'text-yellow-600';
      case 'Élevée': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getDemandColor = (demand) => {
    switch (demand) {
      case 'Très élevée':
      case 'Élevée': return 'text-green-600';
      case 'Moyenne': return 'text-yellow-600';
      case 'Faible': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'growing': return '📈';
      case 'declining': return '📉';
      case 'stable': return '➡️';
      default: return '➡️';
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={14}
        className={i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}
      />
    ));
  };

  const renderProductCard = (product) => (
    <div
      key={product.id}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => setSelectedProduct(product)}
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex-1 mr-4">{product.name}</h3>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${getOpportunityBg(product.opportunity)} ${getOpportunityColor(product.opportunity)}`}>
          {'★'.repeat(product.opportunity)} {'☆'.repeat(5 - product.opportunity)}
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Achat</p>
          <p className="text-sm font-semibold text-red-600">{product.buyPrice.toLocaleString()} FCFA</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Vente</p>
          <p className="text-sm font-semibold text-green-600">{product.sellPrice.toLocaleString()} FCFA</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Marge</p>
          <p className={`text-sm font-semibold ${product.margin >= 40 ? 'text-green-600' : 'text-yellow-600'}`}>
            {product.margin}%
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Demande</p>
          <p className={`text-sm font-medium ${getDemandColor(product.demand)}`}>{product.demand}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Compétition</p>
          <p className={`text-sm font-medium ${getCompetitionColor(product.competition)}`}>{product.competition}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Ventes/mois</p>
          <p className="text-sm font-medium text-gray-900">{product.monthlySales}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            {renderStars(product.rating)}
            <span className="ml-1 text-sm text-gray-600">({product.rating})</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <MessageSquare size={14} className="mr-1" />
            {product.reviews}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Store size={14} className="mr-1" />
            {product.suppliers}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">{getTrendIcon(product.trend)}</span>
          <span className="text-xs text-gray-500">{product.seasonality === 'oui' ? 'Saisonnier' : 'Permanent'}</span>
        </div>
      </div>
    </div>
  );

  const renderProductDetail = () => {
    if (!selectedProduct) return null;

    const monthlyRevenue = selectedProduct.sellPrice * selectedProduct.monthlySales;
    const monthlyProfit = monthlyRevenue * (selectedProduct.margin / 100);
    const yearlyRevenue = monthlyRevenue * 12;
    const yearlyProfit = monthlyProfit * 12;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedProduct.name}</h2>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getOpportunityBg(selectedProduct.opportunity)} ${getOpportunityColor(selectedProduct.opportunity)}`}>
                  {'★'.repeat(selectedProduct.opportunity)} {'☆'.repeat(5 - selectedProduct.opportunity)} Opportunité
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
          </div>
          
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Analyse Financière */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <DollarSign className="mr-2" size={20} />
                Analyse Financière
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Prix d'achat</p>
                  <p className="text-lg font-semibold text-red-600">{selectedProduct.buyPrice.toLocaleString()} FCFA</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Prix de vente</p>
                  <p className="text-lg font-semibold text-green-600">{selectedProduct.sellPrice.toLocaleString()} FCFA</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Marge</p>
                  <p className={`text-lg font-semibold ${selectedProduct.margin >= 40 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {selectedProduct.margin}%
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Bénéfice/unité</p>
                  <p className="text-lg font-semibold text-blue-600">
                    {(selectedProduct.sellPrice - selectedProduct.buyPrice).toLocaleString()} FCFA
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Revenu mensuel</p>
                  <p className="text-lg font-semibold text-gray-900">{monthlyRevenue.toLocaleString()} FCFA</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Bénéfice mensuel</p>
                  <p className="text-lg font-semibold text-green-600">{monthlyProfit.toLocaleString()} FCFA</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Revenu annuel</p>
                  <p className="text-lg font-semibold text-gray-900">{yearlyRevenue.toLocaleString()} FCFA</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Bénéfice annuel</p>
                  <p className="text-lg font-semibold text-green-600">{yearlyProfit.toLocaleString()} FCFA</p>
                </div>
              </div>
            </div>
            
            {/* Analyse Marché */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <TrendingUp className="mr-2" size={20} />
                Analyse Marché
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Catégorie</p>
                  <p className="text-base font-medium text-gray-900">{selectedProduct.category}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Demande</p>
                  <p className={`text-base font-medium ${getDemandColor(selectedProduct.demand)}`}>{selectedProduct.demand}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Compétition</p>
                  <p className={`text-base font-medium ${getCompetitionColor(selectedProduct.competition)}`}>{selectedProduct.competition}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Niche</p>
                  <p className={`text-base font-medium ${getOpportunityColor(selectedProduct.opportunity)}`}>{selectedProduct.niche}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Ventes/mois</p>
                  <p className="text-base font-medium text-gray-900">{selectedProduct.monthlySales}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Fournisseurs</p>
                  <p className="text-base font-medium text-gray-900">{selectedProduct.suppliers}</p>
                </div>
              </div>
            </div>
            
            {/* Avis Clients */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Star className="mr-2" size={20} />
                Avis Clients
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    {renderStars(selectedProduct.rating)}
                    <span className="ml-2 text-base font-medium text-gray-900">{selectedProduct.rating} / 5.0</span>
                  </div>
                  <span className="text-gray-600">({selectedProduct.reviews} avis)</span>
                </div>
              </div>
            </div>
            
            {/* Avantages */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <CheckCircle className="mr-2" size={20} />
                Avantages
              </h3>
              <div className="space-y-2">
                {selectedProduct.pros.map((pro, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <CheckCircle size={16} className="text-green-600" />
                    <span className="text-gray-700">{pro}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Inconvénients */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <AlertTriangle className="mr-2" size={20} />
                Inconvénients
              </h3>
              <div className="space-y-2">
                {selectedProduct.cons.map((con, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <AlertTriangle size={16} className="text-yellow-600" />
                    <span className="text-gray-700">{con}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Description */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Description</h3>
              <p className="text-gray-700 leading-relaxed">{selectedProduct.description}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Search className="mr-3" size={28} />
            Recherche Produits
          </h1>
          <p className="text-gray-600 mt-1">Analysez les opportunités de marché</p>
        </div>
      </div>
      
      {/* Search Section */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher un produit (ex: téléphone, ordinateur, écologique...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchProducts()}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={searchProducts}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Recherche...
                </>
              ) : (
                <>
                  <Search size={20} className="mr-2" />
                  Rechercher
                </>
              )}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
            >
              <Filter size={20} className="mr-2" />
              Filtres
            </button>
          </div>
          
          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({...filters, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Toutes</option>
                  <option value="Électronique">Électronique</option>
                  <option value="Accessoires">Accessoires</option>
                  <option value="Services">Services</option>
                  <option value="Kits">Kits</option>
                  <option value="Luxe">Luxe</option>
                  <option value="Écologique">Écologique</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Marge minimale (%)</label>
                <input
                  type="number"
                  value={filters.minMargin}
                  onChange={(e) => setFilters({...filters, minMargin: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix maximum (FCFA)</label>
                <input
                  type="number"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters({...filters, maxPrice: parseInt(e.target.value) || 100000})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Compétition</label>
                <select
                  value={filters.competition}
                  onChange={(e) => setFilters({...filters, competition: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Toutes</option>
                  <option value="Faible">Faible</option>
                  <option value="Moyenne">Moyenne</option>
                  <option value="Élevée">Élevée</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Demande</label>
                <select
                  value={filters.demand}
                  onChange={(e) => setFilters({...filters, demand: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Toutes</option>
                  <option value="Très élevée">Très élevée</option>
                  <option value="Élevée">Élevée</option>
                  <option value="Moyenne">Moyenne</option>
                  <option value="Faible">Faible</option>
                </select>
              </div>
            </div>
          )}
          
          {/* Sort Options */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Trier par:</span>
            <div className="flex space-x-2">
              {[
                { key: 'margin', label: 'Marge', icon: TrendingUp },
                { key: 'revenue', label: 'Revenu', icon: DollarSign },
                { key: 'competition', label: 'Compétition', icon: Users },
                { key: 'demand', label: 'Demande', icon: TrendingUp },
                { key: 'rating', label: 'Note', icon: Star },
                { key: 'reviews', label: 'Avis', icon: MessageSquare }
              ].map((sort) => (
                <button
                  key={sort.key}
                  onClick={() => setSortBy(sort.key)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    sortBy === sort.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {sort.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Results */}
      <div className="max-w-7xl mx-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Recherche en cours...</p>
          </div>
        ) : products.length > 0 ? (
          <div>
            <div className="mb-4 flex justify-between items-center">
              <p className="text-gray-700">
                {products.length} produit{products.length > 1 ? 's' : ''} trouvé{products.length > 1 ? 's' : ''}
              </p>
              <div className="text-sm text-gray-500">
                Trié par: <span className="font-medium text-gray-700">
                  {sortBy === 'margin' ? 'Marge' : 
                   sortBy === 'revenue' ? 'Revenu' : 
                   sortBy === 'competition' ? 'Compétition' : 
                   sortBy === 'demand' ? 'Demande' :
                   sortBy === 'rating' ? 'Note' : 'Avis'}
                </span>
              </div>
            </div>
            <div className="space-y-4">
              {sortProducts(products).map(renderProductCard)}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <Search size={48} className="text-gray-400 mb-4" />
            <p className="text-gray-600 text-center">
              Recherchez des produits pour analyser les opportunités de marché
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Essayez: "téléphone", "ordinateur", "écologique", "accessoires"...
            </p>
          </div>
        )}
      </div>
      
      {/* Product Detail Modal */}
      {selectedProduct && renderProductDetail()}
    </div>
  );
};

export default ProductResearch;
