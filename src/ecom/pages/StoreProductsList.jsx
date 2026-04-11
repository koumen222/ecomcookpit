import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Package, Plus, Search, Edit, Trash2, Eye, EyeOff, ChevronLeft, ChevronRight, Loader2, AlertCircle, Image, Sparkles, ExternalLink, Zap, Layers, Copy } from 'lucide-react';
import { storeProductsApi, storeManageApi } from '../services/storeApi.js';
import ecomApi from '../services/ecommApi.js';
import { formatMoney } from '../utils/currency.js';

const PRODUCT_VIEWS = {
  catalog: {
    title: 'Produits Boutique',
    description: (total) => `${total} produit${total !== 1 ? 's' : ''} dans votre catalogue boutique`,
    searchPlaceholder: 'Rechercher un produit...',
  },
  categories: {
    title: 'Catégories Produits',
    description: (total, categoriesCount) => `${categoriesCount} catégorie${categoriesCount !== 1 ? 's' : ''} pour ${total} produit${total !== 1 ? 's' : ''}`,
    searchPlaceholder: 'Rechercher une catégorie ou un produit...',
  },
  stock: {
    title: 'Stock Produits',
    description: (total) => `Suivi du stock sur ${total} produit${total !== 1 ? 's' : ''}`,
    searchPlaceholder: 'Rechercher un produit par nom ou stock...',
  },
};

const emptyCategoryDialog = {
  open: false,
  mode: 'create',
  originalName: '',
  name: '',
  selectedProductIds: [],
  productSearch: '',
};

const STOCK_FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'out', label: 'Rupture' },
  { key: 'low', label: 'Faible' },
  { key: 'available', label: 'Disponible' },
];

/**
 * StoreProductsList — Dashboard page listing all store catalog products.
 * Features: pagination, search, publish/unpublish toggle, delete.
 */
const StoreProductsList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/ecom/boutique') ? '/ecom/boutique' : '/ecom/store';
  const viewMode = location.pathname.endsWith('/products/categories')
    ? 'categories'
    : location.pathname.endsWith('/products/stock')
      ? 'stock'
      : 'catalog';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [storeSubdomain, setStoreSubdomain] = useState(null);
  const [generationsInfo, setGenerationsInfo] = useState(null);
  const [categoryRegistry, setCategoryRegistry] = useState([]);
  const [categoryDialog, setCategoryDialog] = useState(emptyCategoryDialog);
  const [categorySaving, setCategorySaving] = useState(false);
  const [stockFilter, setStockFilter] = useState('all');
  const [selectedStockIds, setSelectedStockIds] = useState([]);
  const [stockDrafts, setStockDrafts] = useState({});
  const [stockSaving, setStockSaving] = useState(false);

  // Récupérer le subdomain du store pour l'aperçu
  useEffect(() => {
    storeManageApi.getStoreConfig()
      .then((res) => {
        setStoreSubdomain(res.data?.data?.subdomain);
        setCategoryRegistry(res.data?.data?.storeSettings?.categoryRegistry || []);
      })
      .catch(() => {});
  }, []);

  // Récupérer les infos de générations
  const fetchGenerationsInfo = useCallback(async () => {
    try {
      const response = await ecomApi.get('/billing/generations-info');
      if (response.data?.success && response.data?.generations) {
        setGenerationsInfo(response.data.generations);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des infos de générations:', err);
    }
  }, []);

  useEffect(() => {
    fetchGenerationsInfo();
  }, [fetchGenerationsInfo]);

  const handleViewProduct = (product) => {
    if (!storeSubdomain || !product.slug) return;
    const url = `https://${storeSubdomain}.scalor.net/product/${product.slug}`;
    window.open(url, '_blank');
  };

  const handleOpenPageGenerator = () => {
    navigate(`${basePath}/products/generator`, {
      state: {
        from: `${basePath}/products`,
      },
    });
  };

  const fetchProducts = useCallback(async (page = 1, searchTerm = '') => {
    setLoading(true);
    try {
      if (viewMode === 'catalog') {
        const params = { page, limit: 20 };
        if (searchTerm) params.search = searchTerm;
        const res = await storeProductsApi.getProducts(params);
        const data = res.data?.data;
        setProducts(data?.products || []);
        setPagination(data?.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
        return;
      }

      const firstResponse = await storeProductsApi.getProducts({ page: 1, limit: 100 });
      const firstData = firstResponse.data?.data;
      const firstProducts = firstData?.products || [];
      const totalPages = firstData?.pagination?.pages || 1;

      if (totalPages <= 1) {
        setProducts(firstProducts);
        setPagination({ page: 1, limit: firstProducts.length || 100, total: firstProducts.length, pages: 1 });
        return;
      }

      const responses = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          storeProductsApi.getProducts({ page: index + 2, limit: 100 })
        )
      );
      const allProducts = [
        ...firstProducts,
        ...responses.flatMap((response) => response.data?.data?.products || []),
      ];
      setProducts(allProducts);
      setPagination({ page: 1, limit: allProducts.length || 100, total: allProducts.length, pages: 1 });
    } catch (err) {
      setError('Impossible de charger les produits');
    } finally {
      setLoading(false);
    }
  }, [viewMode]);

  useEffect(() => {
    fetchProducts(1, '');
  }, [fetchProducts, viewMode]);

  // Debounced search
  useEffect(() => {
    if (viewMode !== 'catalog') return undefined;
    const timer = setTimeout(() => {
      fetchProducts(1, search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, fetchProducts, viewMode]);

  const handleTogglePublish = async (product) => {
    try {
      await storeProductsApi.updateProduct(product._id, { isPublished: !product.isPublished });
      setProducts(prev => prev.map(p =>
        p._id === product._id ? { ...p, isPublished: !p.isPublished } : p
      ));
    } catch (err) {
      setError('Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce produit de la boutique ?')) return;
    try {
      await storeProductsApi.deleteProduct(id);
      setProducts(prev => prev.filter(p => p._id !== id));
      setPagination(prev => ({ ...prev, total: prev.total - 1 }));
    } catch (err) {
      setError('Erreur lors de la suppression');
    }
  };

  const handleDuplicate = async (product) => {
    try {
      const res = await storeProductsApi.duplicateProduct(product._id);
      const cloned = res.data?.data;
      if (cloned) {
        setProducts(prev => [cloned, ...prev]);
        setPagination(prev => ({ ...prev, total: prev.total + 1 }));
      }
    } catch (err) {
      setError('Erreur lors de la duplication');
    }
  };

  const formatPrice = (price, currency = 'XAF') => formatMoney(price, currency);

  const getStockBadge = (stock) => {
    if (stock <= 0) {
      return { label: 'Rupture', className: 'bg-red-50 text-red-700 ring-red-100' };
    }
    if (stock <= 5) {
      return { label: 'Faible', className: 'bg-amber-50 text-amber-700 ring-amber-100' };
    }
    return { label: 'Disponible', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' };
  };

  const normalizedSearch = search.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    if (!normalizedSearch) return true;

    const haystack = [
      product.name,
      product.slug,
      product.category,
      String(product.stock ?? ''),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });

  const sortedProducts = [...filteredProducts].sort((left, right) => {
    if (viewMode !== 'stock') return 0;
    return (left.stock ?? 0) - (right.stock ?? 0);
  });

  const stockFilteredProducts = sortedProducts.filter((product) => {
    const stock = Number(product.stock || 0);
    if (stockFilter === 'out') return stock <= 0;
    if (stockFilter === 'low') return stock > 0 && stock <= 5;
    if (stockFilter === 'available') return stock > 5;
    return true;
  });

  const getDraftStockValue = (product) => {
    const draftValue = stockDrafts[product._id];
    return draftValue === undefined ? Number(product.stock || 0) : Number(draftValue || 0);
  };

  const hasStockDraft = (product) => {
    const draftValue = stockDrafts[product._id];
    return draftValue !== undefined && Number(draftValue) !== Number(product.stock || 0);
  };

  const normalizedCategoryRegistry = Array.from(
    new Set(
      (categoryRegistry || [])
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right, 'fr', { sensitivity: 'base' }));

  const categorySummaries = Object.values(
    products.reduce((accumulator, product) => {
      const categoryName = (product.category || 'Non classé').trim() || 'Non classé';
      if (!accumulator[categoryName]) {
        accumulator[categoryName] = {
          name: categoryName,
          productCount: 0,
          publishedCount: 0,
          totalStock: 0,
          valueCount: 0,
          totalPrice: 0,
          productNames: [],
        };
      }

      accumulator[categoryName].productCount += 1;
      accumulator[categoryName].publishedCount += product.isPublished ? 1 : 0;
      accumulator[categoryName].totalStock += Number(product.stock || 0);
      accumulator[categoryName].totalPrice += Number(product.price || 0);
      accumulator[categoryName].valueCount += 1;
      accumulator[categoryName].productNames.push(product.name || '');
      return accumulator;
    }, normalizedCategoryRegistry.reduce((accumulator, categoryName) => {
      accumulator[categoryName] = {
        name: categoryName,
        productCount: 0,
        publishedCount: 0,
        totalStock: 0,
        valueCount: 0,
        totalPrice: 0,
        productNames: [],
      };
      return accumulator;
    }, {}))
  )
    .map((category) => ({
      ...category,
      averagePrice: category.valueCount ? category.totalPrice / category.valueCount : 0,
    }))
    .filter((category) => {
      if (!normalizedSearch) return true;
      return category.name.toLowerCase().includes(normalizedSearch)
        || category.productNames.some((productName) => productName.toLowerCase().includes(normalizedSearch));
    })
    .sort((left, right) => right.productCount - left.productCount || left.name.localeCompare(right.name));

  const stockSummary = filteredProducts.reduce((summary, product) => {
    const stock = Number(product.stock || 0);
    summary.totalUnits += stock;
    if (stock <= 0) summary.outOfStock += 1;
    else if (stock <= 5) summary.lowStock += 1;
    else summary.available += 1;
    return summary;
  }, { totalUnits: 0, outOfStock: 0, lowStock: 0, available: 0 });

  const stockValue = filteredProducts.reduce(
    (total, product) => total + (Number(product.stock || 0) * Number(product.price || 0)),
    0
  );
  const urgentStockProducts = sortedProducts.filter((product) => Number(product.stock || 0) <= 5).slice(0, 6);

  const updateCategoryRegistry = async (nextRegistry) => {
    const normalized = Array.from(
      new Set(
        nextRegistry
          .map((entry) => String(entry || '').trim())
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right, 'fr', { sensitivity: 'base' }));

    await storeManageApi.updateStoreConfig({ categoryRegistry: normalized });
    setCategoryRegistry(normalized);
  };

  const openCreateCategoryDialog = () => {
    setCategoryDialog({ open: true, mode: 'create', originalName: '', name: '', selectedProductIds: [], productSearch: '' });
  };

  const openRenameCategoryDialog = (categoryName) => {
    const linkedProductIds = products
      .filter((product) => (product.category || '').trim() === categoryName)
      .map((product) => product._id);
    setCategoryDialog({
      open: true,
      mode: 'edit',
      originalName: categoryName,
      name: categoryName,
      selectedProductIds: linkedProductIds,
      productSearch: '',
    });
  };

  const closeCategoryDialog = () => {
    if (categorySaving) return;
    setCategoryDialog(emptyCategoryDialog);
  };

  const handleSaveCategory = async () => {
    const nextName = categoryDialog.name.trim();
    if (!nextName) {
      setError('Le nom de catégorie est obligatoire');
      return;
    }

    const duplicateExists = categorySummaries.some(
      (category) => category.name.toLowerCase() === nextName.toLowerCase() && category.name !== categoryDialog.originalName
    );
    if (duplicateExists) {
      setError('Cette catégorie existe déjà');
      return;
    }

    setCategorySaving(true);
    setError('');
    try {
      const selectedProductIds = new Set(categoryDialog.selectedProductIds || []);
      const productUpdates = [];

      products.forEach((product) => {
        const currentCategory = (product.category || '').trim();
        const isSelected = selectedProductIds.has(product._id);
        const belongsToEditedCategory = categoryDialog.mode === 'edit' && currentCategory === categoryDialog.originalName;

        if (isSelected && currentCategory !== nextName) {
          productUpdates.push({ productId: product._id, nextCategory: nextName });
          return;
        }

        if (!isSelected && belongsToEditedCategory) {
          productUpdates.push({ productId: product._id, nextCategory: '' });
        }
      });

      if (categoryDialog.mode === 'create') {
        await updateCategoryRegistry([...normalizedCategoryRegistry, nextName]);
      } else {
        await updateCategoryRegistry(
          normalizedCategoryRegistry.map((categoryName) =>
            categoryName === categoryDialog.originalName ? nextName : categoryName
          )
        );
      }

      if (productUpdates.length > 0) {
        await Promise.all(
          productUpdates.map(({ productId, nextCategory }) =>
            storeProductsApi.updateProduct(productId, { category: nextCategory })
          )
        );

        const updatesById = Object.fromEntries(
          productUpdates.map(({ productId, nextCategory }) => [productId, nextCategory])
        );

        setProducts((previous) => previous.map((product) => (
          updatesById[product._id] !== undefined
            ? { ...product, category: updatesById[product._id] }
            : product
        )));
      }

      setCategoryDialog(emptyCategoryDialog);
    } catch (err) {
      setError('Impossible de sauvegarder la catégorie');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleDeleteCategory = async (categoryName) => {
    const linkedProducts = products.filter((product) => (product.category || '').trim() === categoryName);
    const confirmed = window.confirm(
      linkedProducts.length > 0
        ? `Supprimer la catégorie "${categoryName}" et retirer cette catégorie de ${linkedProducts.length} produit(s) ?`
        : `Supprimer la catégorie "${categoryName}" ?`
    );
    if (!confirmed) return;

    setCategorySaving(true);
    setError('');
    try {
      await Promise.all(
        linkedProducts.map((product) => storeProductsApi.updateProduct(product._id, { category: '' }))
      );
      await updateCategoryRegistry(normalizedCategoryRegistry.filter((entry) => entry !== categoryName));
      setProducts((previous) => previous.map((product) => (
        (product.category || '').trim() === categoryName
          ? { ...product, category: '' }
          : product
      )));
    } catch (err) {
      setError('Impossible de supprimer la catégorie');
    } finally {
      setCategorySaving(false);
    }
  };

  const toggleStockSelection = (productId) => {
    setSelectedStockIds((previous) => (
      previous.includes(productId)
        ? previous.filter((id) => id !== productId)
        : [...previous, productId]
    ));
  };

  const toggleSelectAllStock = () => {
    const visibleIds = stockFilteredProducts.map((product) => product._id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedStockIds.includes(id));
    setSelectedStockIds(allSelected ? [] : visibleIds);
  };

  const handleStockDraftChange = (productId, value) => {
    const sanitized = value === '' ? '' : Math.max(0, Number(value));
    setStockDrafts((previous) => ({
      ...previous,
      [productId]: sanitized,
    }));
  };

  const handleSubmitStockChanges = async () => {
    const productsToSubmit = stockFilteredProducts.filter((product) => {
      if (selectedStockIds.length > 0 && !selectedStockIds.includes(product._id)) return false;
      return hasStockDraft(product);
    });

    if (productsToSubmit.length === 0) {
      setError('Aucune modification de stock à soumettre');
      return;
    }

    const hasInvalidValue = productsToSubmit.some((product) => {
      const value = Number(stockDrafts[product._id]);
      return !Number.isFinite(value) || value < 0;
    });
    if (hasInvalidValue) {
      setError('Chaque stock doit être un nombre positif');
      return;
    }

    setStockSaving(true);
    setError('');
    try {
      await Promise.all(
        productsToSubmit.map((product) => storeProductsApi.updateProduct(product._id, { stock: Number(stockDrafts[product._id]) }))
      );
      const updatedById = Object.fromEntries(productsToSubmit.map((product) => [product._id, Number(stockDrafts[product._id])]));
      setProducts((previous) => previous.map((product) => (
        updatedById[product._id] !== undefined
          ? { ...product, stock: updatedById[product._id] }
          : product
      )));
      setStockDrafts((previous) => {
        const next = { ...previous };
        productsToSubmit.forEach((product) => {
          delete next[product._id];
        });
        return next;
      });
      setSelectedStockIds([]);
    } catch (err) {
      setError('Impossible de mettre à jour le stock');
    } finally {
      setStockSaving(false);
    }
  };

  const currentView = PRODUCT_VIEWS[viewMode];
  const normalizedCategoryProductSearch = (categoryDialog.productSearch || '').trim().toLowerCase();
  const categoryDialogProducts = products
    .filter((product) => {
      if (!normalizedCategoryProductSearch) return true;

      const haystack = [product.name, product.slug, product.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedCategoryProductSearch);
    })
    .sort((left, right) => {
      const leftSelected = (categoryDialog.selectedProductIds || []).includes(left._id);
      const rightSelected = (categoryDialog.selectedProductIds || []).includes(right._id);

      if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
      return String(left.name || '').localeCompare(String(right.name || ''), 'fr', { sensitivity: 'base' });
    });

  const toggleCategoryProductSelection = (productId) => {
    setCategoryDialog((previous) => {
      const selected = previous.selectedProductIds || [];
      const exists = selected.includes(productId);
      return {
        ...previous,
        selectedProductIds: exists
          ? selected.filter((id) => id !== productId)
          : [...selected, productId],
      };
    });
  };

  const renderOverview = () => {
    if (viewMode === 'categories') {
      return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Catégories</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{categorySummaries.length}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Produits classés</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{filteredProducts.filter((product) => product.category).length}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Non classés</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{filteredProducts.filter((product) => !product.category).length}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Catégorie principale</p>
            <p className="mt-2 text-base font-semibold text-gray-900">{categorySummaries[0]?.name || 'Aucune'}</p>
            <p className="mt-1 text-sm text-gray-500">{categorySummaries[0]?.productCount || 0} produit{categorySummaries[0]?.productCount > 1 ? 's' : ''}</p>
          </div>
        </div>
      );
    }

    if (viewMode === 'stock') {
      return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Unités en stock</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{stockSummary.totalUnits}</p>
          </div>
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-500">Rupture</p>
            <p className="mt-2 text-2xl font-bold text-red-700">{stockSummary.outOfStock}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-600">Stock faible</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">{stockSummary.lowStock}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">Disponibles</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{stockSummary.available}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm sm:col-span-2 xl:col-span-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Valeur du stock</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{formatPrice(stockValue)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {STOCK_FILTERS.map((filter) => {
                  const active = stockFilter === filter.key;
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setStockFilter(filter.key)}
                      className={`rounded-full px-3 py-2 text-sm font-medium transition ${active ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="rounded-[28px] border border-gray-200 bg-white px-5 py-5 shadow-[0_24px_50px_-32px_rgba(15,23,42,0.2)] sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50">
              <Package className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900">{currentView.title}</h1>
              <p className="mt-1 text-sm text-gray-500">{currentView.description(pagination.total, categorySummaries.length)}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {viewMode !== 'categories' && (
              <button
                onClick={handleOpenPageGenerator}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white transition hover:from-violet-600 hover:to-purple-700 shadow-sm"
              >
                <Sparkles className="h-4 w-4" />
                <span>Générer Page IA</span>
                {generationsInfo && (generationsInfo.freeRemaining + generationsInfo.paidRemaining) > 0 && (
                  <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
                    <Zap className="h-3 w-3" />
                    {generationsInfo.freeRemaining + generationsInfo.paidRemaining}
                  </span>
                )}
              </button>
            )}
            {viewMode === 'categories' && (
              <button
                type="button"
                onClick={openCreateCategoryDialog}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Ajouter une catégorie
              </button>
            )}
            {viewMode === 'stock' && (
              <button
                type="button"
                onClick={handleSubmitStockChanges}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 shadow-sm"
                disabled={stockSaving}
              >
                {stockSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            )}
            <button
              onClick={() => navigate(`${basePath}/products/new`)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Ajouter un produit
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-2xl flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={currentView.searchPlaceholder}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50/80 py-3 pl-11 pr-4 text-sm text-gray-700 transition placeholder:text-gray-400 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="rounded-full bg-gray-100 px-3 py-1.5 font-medium text-gray-600">
              {(viewMode === 'stock' ? stockFilteredProducts.length : filteredProducts.length)} affiché{(viewMode === 'stock' ? stockFilteredProducts.length : filteredProducts.length) > 1 ? 's' : ''}
            </span>
            {search && (
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
                Filtre actif
              </span>
            )}
          </div>
        </div>
      </div>

      {renderOverview()}

      {viewMode === 'categories' && !loading && categorySummaries.length > 0 && (
        <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_24px_50px_-34px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700">Toutes</span>
              <span className="text-sm text-gray-500">{categorySummaries.length} catégorie{categorySummaries.length > 1 ? 's' : ''}</span>
            </div>
            <button
              type="button"
              onClick={openCreateCategoryDialog}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              Nouvelle catégorie
            </button>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Titre</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Produits</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Stock</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Prix moyen</th>
                  <th className="px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categorySummaries.map((category) => (
                  <tr key={category.name} className="transition hover:bg-gray-50/70">
                    <td className="px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{category.name}</p>
                        <p className="mt-1 text-xs text-gray-500">{category.publishedCount} publié{category.publishedCount > 1 ? 's' : ''}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-gray-900">{category.productCount}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{category.totalStock}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatPrice(category.averagePrice)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`${basePath}/products/new`, { state: { category: category.name } })}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                          Ajouter produit
                        </button>
                        <button
                          type="button"
                          onClick={() => openRenameCategoryDialog(category.name)}
                          className="rounded-xl border border-transparent p-2 text-gray-400 transition hover:border-emerald-100 hover:bg-emerald-50 hover:text-emerald-600"
                          title="Modifier"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(category.name)}
                          className="rounded-xl border border-transparent p-2 text-gray-400 transition hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-gray-100 md:hidden">
            {categorySummaries.map((category) => (
              <div key={category.name} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{category.name}</p>
                    <p className="mt-1 text-xs text-gray-500">{category.productCount} produit{category.productCount > 1 ? 's' : ''}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {category.totalStock} stock
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`${basePath}/products/new`, { state: { category: category.name } })}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700"
                  >
                    Ajouter produit
                  </button>
                  <button
                    type="button"
                    onClick={() => openRenameCategoryDialog(category.name)}
                    className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(category.name)}
                    className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {categoryDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {categoryDialog.mode === 'create' ? 'Ajouter une catégorie' : 'Modifier la catégorie'}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {categoryDialog.mode === 'create'
                    ? 'Créez la catégorie et sélectionnez directement les produits existants à y rattacher.'
                    : 'Renommez la catégorie et ajustez les produits rattachés depuis la liste ci-dessous.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCategoryDialog}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Nom de la catégorie</label>
                <input
                  type="text"
                  value={categoryDialog.name}
                  onChange={(event) => setCategoryDialog((previous) => ({ ...previous, name: event.target.value }))}
                  placeholder="Ex: Nouveautés"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                />
              </div>
              <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Produits existants</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Sélectionnez les produits à rattacher à cette catégorie.
                    </p>
                  </div>
                  <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                    {(categoryDialog.selectedProductIds || []).length} sélectionné{(categoryDialog.selectedProductIds || []).length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="mt-4">
                  <input
                    type="text"
                    value={categoryDialog.productSearch}
                    onChange={(event) => setCategoryDialog((previous) => ({ ...previous, productSearch: event.target.value }))}
                    placeholder="Rechercher un produit existant..."
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>
                <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                  {categoryDialogProducts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-5 text-center text-sm text-gray-500">
                      Aucun produit trouvé.
                    </div>
                  ) : categoryDialogProducts.map((product) => {
                    const currentCategory = (product.category || '').trim();
                    const selected = (categoryDialog.selectedProductIds || []).includes(product._id);
                    const isLinkedElsewhere = currentCategory && currentCategory !== categoryDialog.originalName && currentCategory !== categoryDialog.name.trim();

                    return (
                      <label
                        key={product._id}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${selected ? 'border-emerald-200 bg-emerald-50/70' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCategoryProductSelection(product._id)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{product.name || 'Produit sans nom'}</p>
                            {currentCategory ? (
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${isLinkedElsewhere ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
                                {isLinkedElsewhere ? `Actuel: ${currentCategory}` : currentCategory}
                              </span>
                            ) : (
                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">Non classé</span>
                            )}
                          </div>
                          {product.slug && (
                            <p className="mt-1 text-xs text-gray-500">/{product.slug}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCategoryDialog}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveCategory}
                  disabled={categorySaving}
                  className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {categorySaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'stock' && !loading && urgentStockProducts.length > 0 && (
        <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_24px_50px_-34px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700">Tous</span>
              <button type="button" className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">Créer une nouvelle vue</button>
            </div>
            <button type="button" onClick={handleSubmitStockChanges} disabled={stockSaving} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60">{stockSaving ? 'Enregistrement...' : 'Enregistrer'}</button>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={stockFilteredProducts.length > 0 && stockFilteredProducts.every((product) => selectedStockIds.includes(product._id))} onChange={toggleSelectAllStock} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                      <span>Sélectionner la totalité des stock</span>
                    </label>
                  </th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Image</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Produit</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">SKU</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Indisponible</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Réservé</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Disponible</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">En stock</th>
                  <th className="px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {urgentStockProducts.map((product) => {
                  const stockBadge = getStockBadge(product.stock || 0);
                  const draftStock = getDraftStockValue(product);
                  return (
                    <tr key={product._id} className="transition hover:bg-gray-50/70">
                      <td className="px-5 py-4">
                        <input type="checkbox" checked={selectedStockIds.includes(product._id)} onChange={() => toggleStockSelection(product._id)} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                      </td>
                      <td className="px-4 py-4">
                        {product.images?.[0]?.url ? (
                          <img src={product.images[0].url} alt={product.name} className="h-12 w-12 rounded-2xl border border-gray-200 object-cover shadow-sm" loading="lazy" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                            <Image className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-0">
                          <p className="max-w-[260px] truncate text-sm font-semibold text-gray-900">{product.name}</p>
                          <p className="mt-1 text-xs text-gray-500">{product.category || 'Non classé'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">Aucun SKU</td>
                      <td className="px-4 py-4 text-sm text-gray-700">0</td>
                      <td className="px-4 py-4 text-sm text-gray-700">0</td>
                      <td className="px-4 py-4">
                        <label className="block text-xs text-gray-500">Quantité Disponible</label>
                        <input
                          type="number"
                          min="0"
                          value={draftStock}
                          onChange={(event) => handleStockDraftChange(product._id, event.target.value)}
                          className="mt-2 w-28 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <label className="block text-xs text-gray-500">Quantité En stock</label>
                        <input
                          type="number"
                          min="0"
                          value={draftStock}
                          onChange={(event) => handleStockDraftChange(product._id, event.target.value)}
                          className="mt-2 w-28 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                        />
                        <div className="mt-2">
                          <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${stockBadge.className}`}>{stockBadge.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`${basePath}/products/${product._id}/edit`)}
                            className="rounded-xl border border-transparent p-2 text-gray-400 transition hover:border-emerald-100 hover:bg-emerald-50 hover:text-emerald-600"
                            title="Modifier"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-gray-100 md:hidden">
            {urgentStockProducts.map((product) => {
              const stockBadge = getStockBadge(product.stock || 0);
              const draftStock = getDraftStockValue(product);
              return (
                <div key={product._id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                      <p className="mt-1 text-xs text-gray-500">Aucun SKU</p>
                    </div>
                    <input type="checkbox" checked={selectedStockIds.includes(product._id)} onChange={() => toggleStockSelection(product._id)} className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500">Disponible</label>
                      <input type="number" min="0" value={draftStock} onChange={(event) => handleStockDraftChange(product._id, event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">En stock</label>
                      <input type="number" min="0" value={draftStock} onChange={(event) => handleStockDraftChange(product._id, event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${stockBadge.className}`}>{stockBadge.label}</span>
                    <button type="button" onClick={() => navigate(`${basePath}/products/${product._id}/edit`)} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Modifier</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Products Table / List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
        </div>
      ) : viewMode === 'categories' ? null : (viewMode === 'stock' ? stockFilteredProducts.length === 0 : filteredProducts.length === 0) ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-gray-500 mt-3 text-sm">Aucun résultat pour cette vue</p>
          <button
            onClick={() => navigate(`${basePath}/products/new`)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
          >
            <Plus className="w-4 h-4" />
            Créer le premier produit
          </button>
        </div>
      ) : viewMode === 'stock' ? (
        <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_24px_50px_-34px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700">Tous</span>
              <button type="button" className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">Créer une nouvelle vue</button>
            </div>
            <button type="button" onClick={handleSubmitStockChanges} disabled={stockSaving} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60">{stockSaving ? 'Enregistrement...' : 'Enregistrer'}</button>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={stockFilteredProducts.length > 0 && stockFilteredProducts.every((product) => selectedStockIds.includes(product._id))} onChange={toggleSelectAllStock} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                      <span>Sélectionner la totalité des stock</span>
                    </label>
                  </th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Image</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Produit</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">SKU</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Indisponible</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Réservé</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Disponible</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">En stock</th>
                  <th className="px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stockFilteredProducts.map((product) => {
                  const stockBadge = getStockBadge(product.stock || 0);
                  const draftStock = getDraftStockValue(product);
                  return (
                    <tr key={product._id} className="transition hover:bg-gray-50/70">
                      <td className="px-5 py-4">
                        <input type="checkbox" checked={selectedStockIds.includes(product._id)} onChange={() => toggleStockSelection(product._id)} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                      </td>
                      <td className="px-4 py-4">
                        {product.images?.[0]?.url ? (
                          <img src={product.images[0].url} alt={product.name} className="h-12 w-12 rounded-2xl border border-gray-200 object-cover shadow-sm" loading="lazy" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                            <Image className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900 max-w-[260px]">{product.name}</p>
                          <p className="mt-1 text-xs text-gray-500">{product.category || 'Non classé'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">Aucun SKU</td>
                      <td className="px-4 py-4 text-sm text-gray-700">0</td>
                      <td className="px-4 py-4 text-sm text-gray-700">0</td>
                      <td className="px-4 py-4">
                        <label className="block text-xs text-gray-500">Quantité Disponible</label>
                        <input type="number" min="0" value={draftStock} onChange={(event) => handleStockDraftChange(product._id, event.target.value)} className="mt-2 w-28 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" />
                      </td>
                      <td className="px-4 py-4">
                        <label className="block text-xs text-gray-500">Quantité En stock</label>
                        <input type="number" min="0" value={draftStock} onChange={(event) => handleStockDraftChange(product._id, event.target.value)} className="mt-2 w-28 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" />
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${stockBadge.className}`}>{stockBadge.label}</span>
                          {hasStockDraft(product) && <span className="text-xs font-medium text-amber-600">Modifié</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" onClick={() => handleTogglePublish(product)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50">{product.isPublished ? 'Masquer' : 'Publier'}</button>
                          <button
                            type="button"
                            onClick={() => navigate(`${basePath}/products/${product._id}/edit`)}
                            className="rounded-xl border border-transparent p-2 text-gray-400 transition hover:border-emerald-100 hover:bg-emerald-50 hover:text-emerald-600"
                            title="Modifier"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-gray-100 md:hidden">
            {stockFilteredProducts.map((product) => {
              const stockBadge = getStockBadge(product.stock || 0);
              const draftStock = getDraftStockValue(product);
              return (
                <div key={product._id} className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    {product.images?.[0]?.url ? (
                      <img src={product.images[0].url} alt={product.name} className="h-14 w-14 rounded-2xl border border-gray-200 object-cover shadow-sm" loading="lazy" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                        <Image className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{product.name}</p>
                      <p className="mt-1 text-xs text-gray-500">Aucun SKU</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${stockBadge.className}`}>{stockBadge.label}</span>
                        {hasStockDraft(product) && <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">Modifié</span>}
                      </div>
                    </div>
                    <input type="checkbox" checked={selectedStockIds.includes(product._id)} onChange={() => toggleStockSelection(product._id)} className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500">Disponible</label>
                      <input type="number" min="0" value={draftStock} onChange={(event) => handleStockDraftChange(product._id, event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">En stock</label>
                      <input type="number" min="0" value={draftStock} onChange={(event) => handleStockDraftChange(product._id, event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => handleTogglePublish(product)} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700">{product.isPublished ? 'Masquer' : 'Publier'}</button>
                    <button type="button" onClick={() => navigate(`${basePath}/products/${product._id}/edit`)} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Modifier</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_24px_50px_-34px_rgba(15,23,42,0.18)]">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Produit</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Prix</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Stock</th>
                  <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Catégorie</th>
                  <th className="px-4 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Statut</th>
                  <th className="px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(viewMode === 'stock' ? stockFilteredProducts : sortedProducts).map((product) => {
                  const stockBadge = getStockBadge(product.stock || 0);
                  return (
                  <tr key={product._id} className="transition hover:bg-gray-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {product.images?.[0]?.url ? (
                          <img
                            src={product.images[0].url}
                            alt={product.name}
                            className="h-14 w-14 rounded-2xl border border-gray-200 object-cover shadow-sm"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                            <Image className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900 max-w-[260px]">{product.name}</p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                            <span className="truncate max-w-[220px]">/{product.slug || 'sans-slug'}</span>
                            {product.pageBuilder?.enabled && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
                                <Layers className="h-3 w-3" /> Builder
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-semibold text-gray-900">{formatPrice(product.price, product.currency)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-sm font-semibold text-gray-900">{product.stock ?? 0}</span>
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${stockBadge.className}`}>
                          {stockBadge.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {product.category ? (
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {product.category}
                        </span>
                      ) : (
                        <span className="text-gray-400">Non classé</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleTogglePublish(product)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition ${
                          product.isPublished
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {product.isPublished ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {product.isPublished ? 'Publié' : 'Brouillon'}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewProduct(product)}
                          disabled={!storeSubdomain || !product.slug}
                          className="rounded-xl border border-transparent p-2 text-gray-400 transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"
                          title="Voir le produit"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`${basePath}/products/${product._id}/builder`)}
                          className={`rounded-xl border p-2 transition ${product.pageBuilder?.enabled ? 'border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'border-transparent text-gray-400 hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-600'}`}
                          title="Page Builder"
                        >
                          <Layers className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(product)}
                          className="rounded-xl border border-transparent p-2 text-gray-400 transition hover:border-amber-100 hover:bg-amber-50 hover:text-amber-600"
                          title="Dupliquer"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`${basePath}/products/${product._id}/edit`)}
                          className="rounded-xl border border-transparent p-2 text-gray-400 transition hover:border-emerald-100 hover:bg-emerald-50 hover:text-emerald-600"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product._id)}
                          className="rounded-xl border border-transparent p-2 text-gray-400 transition hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {(viewMode === 'stock' ? stockFilteredProducts : sortedProducts).map((product) => {
              const stockBadge = getStockBadge(product.stock || 0);
              return (
              <div key={product._id} className="space-y-4 p-4">
                <div className="flex items-start gap-3">
                  {product.images?.[0]?.url ? (
                    <img src={product.images[0].url} alt={product.name} className="h-14 w-14 rounded-2xl border border-gray-200 object-cover shadow-sm" loading="lazy" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                      <Image className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{product.name}</p>
                    <p className="mt-1 text-sm text-gray-500">{formatPrice(product.price, product.currency)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${stockBadge.className}`}>
                        Stock: {product.stock ?? 0}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${product.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {product.isPublished ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {product.isPublished ? 'Publié' : 'Brouillon'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleTogglePublish(product)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium ${product.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {product.isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {product.isPublished ? 'Dépublier' : 'Publier'}
                  </button>
                  <button 
                    onClick={() => handleViewProduct(product)} 
                    disabled={!storeSubdomain || !product.slug}
                    className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 disabled:opacity-40"
                  >
                    Voir
                  </button>
                  <button onClick={() => navigate(`${basePath}/products/${product._id}/builder`)} className={`rounded-xl px-3 py-2 text-xs font-medium ${product.pageBuilder?.enabled ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>Builder</button>
                  <button onClick={() => handleDuplicate(product)} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">Copier</button>
                  <button onClick={() => navigate(`${basePath}/products/${product._id}/edit`)} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Modifier</button>
                  <button onClick={() => handleDelete(product._id)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">Supprimer</button>
                </div>
              </div>
            )})}
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm text-gray-500">
            Page {pagination.page} sur {pagination.pages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchProducts(pagination.page - 1, search)}
              disabled={pagination.page <= 1}
              className="rounded-xl border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchProducts(pagination.page + 1, search)}
              disabled={pagination.page >= pagination.pages}
              className="rounded-xl border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreProductsList;
