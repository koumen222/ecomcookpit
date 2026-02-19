import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  ExternalLink, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Filter,
  Download,
  Upload
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';
import ProductImport from '../components/ProductImport.jsx';

const ProductResearchList = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('researchDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [searchTerm, statusFilter, sortBy, sortOrder]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      params.append('limit', '100');
      
      const response = await ecomApi.get(`/products-research/research?${params.toString()}`);
      
      if (response.data.success) {
        setProducts(response.data.data);
      }
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      setError('Erreur lors du chargement des produits');
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (productId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;
    
    try {
      await ecomApi.delete(`/products-research/research/${productId}`);
      loadProducts();
    } catch (error) {
      console.error('Erreur suppression produit:', error);
      setError('Erreur lors de la suppression');
    }
  };

  const updateProductStatus = async (productId, newStatus) => {
    try {
      await ecomApi.put(`/products-research/research/${productId}/status`, { status: newStatus });
      loadProducts();
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
    }
  };

  const passToTest = async (researchProduct) => {
    if (!confirm(`Créer un produit de test pour "${researchProduct.name}" ?`)) return;
    
    try {
      // Créer le produit dans la plateforme
      const productData = {
        name: researchProduct.name,
        status: 'test',
        sellingPrice: researchProduct.sellingPrice || 0,
        productCost: researchProduct.sourcingPrice || 0,
        deliveryCost: researchProduct.shippingUnitCost || 0,
        avgAdsCost: 0,
        stock: 0,
        reorderThreshold: 10,
        isActive: true
      };
      
      await ecomApi.post('/products', productData);
      
      // Mettre à jour le statut du produit de recherche
      await updateProductStatus(researchProduct._id, 'testing');
      
      alert('Produit ajouté avec succès à la plateforme !');
      loadProducts();
    } catch (error) {
      console.error('Erreur création produit:', error);
      setError('Erreur lors de la création du produit');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR').format(amount);
  };

  const getMarginColor = (margin) => {
    if (margin >= 40) return 'text-green-600 font-semibold';
    if (margin >= 20) return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      research: { color: 'bg-blue-100 text-blue-800', label: 'Recherche' },
      testing: { color: 'bg-yellow-100 text-yellow-800', label: 'Test' },
      validated: { color: 'bg-green-100 text-green-800', label: 'Validé' },
      rejected: { color: 'bg-red-100 text-red-800', label: 'Rejeté' }
    };
    
    const config = statusConfig[status] || statusConfig.research;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getOpportunityIcon = (score) => {
    if (score >= 4) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (score <= 2) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-yellow-600" />;
  };

  const exportToCSV = () => {
    const headers = [
      'PRODUIT', 'IMAGE', 'CREATIVE', 'ALIBABA', 'RECHERCHE', 'SITE WEB',
      'PRIX SOURCING BRUT', 'POIDS (KG)', 'FRAIS DE LIVRAISON UNITAIRE', 
      'COÛT DE REVIENT (COGS)', 'PRIX DE VENTE', 'MARGE (%)', 'BÉNÉFICE (FCFA)',
      'SCORE OPPORTUNITÉ', 'STATUT', 'DATE RECHERCHE'
    ];
    
    const csvContent = [
      headers.join(','),
      ...products.map(product => [
        `"${product.name}"`,
        `"${product.imageUrl || ''}"`,
        `"${product.creative || ''}"`,
        `"${product.alibabaLink || ''}"`,
        `"${product.researchLink || ''}"`,
        `"${product.websiteUrl || ''}"`,
        product.sourcingPrice || 0,
        product.weight || 0,
        product.shippingUnitCost || 0,
        product.cogs || 0,
        product.sellingPrice || 0,
        `${(product.margin || 0).toFixed(1)}%`,
        product.profit || 0,
        `${product.opportunityScore || 3}/5`,
        product.status,
        new Date(product.researchDate).toLocaleDateString('fr-FR')
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `veille-produits-complet-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Veille Produits</h1>
          <p className="text-gray-600 mt-1">Tableau de bord de vos produits en recherche</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImport(!showImport)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Importer CSV
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </button>
          <button
            onClick={() => navigate('/ecom/product-finder')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter Produit
          </button>
        </div>
      </div>

      {/* Section Importation */}
      {showImport && (
        <div className="mb-6">
          <ProductImport onImportSuccess={() => {
            loadProducts();
            setShowImport(false);
          }} />
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tous les statuts</option>
              <option value="research">Recherche</option>
              <option value="testing">Test</option>
              <option value="validated">Validé</option>
              <option value="rejected">Rejeté</option>
            </select>
          </div>
          
          <div>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(order);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="researchDate-desc">Plus récents</option>
              <option value="researchDate-asc">Plus anciens</option>
              <option value="margin-desc">Marge décroissante</option>
              <option value="margin-asc">Marge croissante</option>
              <option value="opportunityScore-desc">Score décroissant</option>
              <option value="name-asc">Nom A-Z</option>
            </select>
          </div>
          
          <div className="flex items-center text-sm text-gray-600">
            {products.length} produit{products.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PRODUIT
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CREATIVE
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ALIBABA
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SITE WEB
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  POIDS
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  LIVRAISON
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  COGS
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  VENTE
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  MARGE
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SCORE
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  STATUT
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.length === 0 ? (
                <tr>
                  <td colSpan="12" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Search className="w-12 h-12 text-gray-300 mb-4" />
                      <p className="text-lg font-medium mb-2">Aucun produit trouvé</p>
                      <p className="text-sm mb-4">Commencez par ajouter un produit de veille</p>
                      <button
                        onClick={() => navigate('/ecom/product-finder')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Ajouter un produit
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product._id} className="hover:bg-gray-50">
                    <td className="px-2 py-2">
                      <div className="max-w-xs">
                        <div className="text-sm font-medium text-gray-900 truncate" title={product.name}>
                          {product.name}
                        </div>
                        {product.weight && (
                          <div className="text-xs text-gray-500">{product.weight} kg</div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      {product.creative ? (
                        <a
                          href={product.creative}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 truncate max-w-xs block"
                          title={product.creative}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {product.alibabaLink ? (
                        <a
                          href={product.alibabaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                          title="Voir sur Alibaba"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {product.websiteUrl ? (
                        <a
                          href={product.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 truncate max-w-xs block"
                          title={product.websiteUrl}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-sm text-gray-900">
                      {product.weight || '-'}
                    </td>
                    <td className="px-2 py-2 text-sm text-gray-900">
                      {formatCurrency(product.shippingUnitCost || 0)}
                    </td>
                    <td className="px-2 py-2 text-sm text-gray-900">
                      {formatCurrency(product.cogs || 0)}
                    </td>
                    <td className="px-2 py-2 text-sm font-medium text-gray-900">
                      {formatCurrency(product.sellingPrice || 0)}
                    </td>
                    <td className="px-2 py-2 text-sm">
                      <div className={getMarginColor(product.margin || 0)}>
                        {(product.margin || 0).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(product.profit || 0)}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center space-x-2">
                        {getOpportunityIcon(product.opportunityScore || 3)}
                        <span className="text-sm text-gray-900">
                          {product.opportunityScore || 3}/5
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      {getStatusBadge(product.status)}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col space-y-1">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => navigate(`/ecom/product-finder/${product._id}`)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteProduct(product._id)}
                            className="text-red-600 hover:text-red-800"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {product.status !== 'testing' && product.status !== 'validated' && (
                          <button
                            onClick={() => passToTest(product)}
                            className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded hover:bg-green-200 whitespace-nowrap"
                            title="Créer un produit de test dans la plateforme"
                          >
                            Passer en test
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductResearchList;
