import React, { useState, useEffect } from 'react';
import ecomApi from '../services/ecommApi.js';

const AssignmentsManager = () => {
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState([]);
  const [closeuses, setCloseuses] = useState([]);
  const [products, setProducts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [googleSheetsData, setGoogleSheetsData] = useState({});
  const [showSheetsPreview, setShowSheetsPreview] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [sheetProducts, setSheetProducts] = useState({});
  const [loadingSheetProducts, setLoadingSheetProducts] = useState({});
  const [formData, setFormData] = useState({
    closeuseId: '',
    orderSources: [],
    productAssignments: [],
    notes: ''
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [sourcesRes, closeusesRes, productsRes, assignmentsRes] = await Promise.all([
        ecomApi.get('/assignments/sources'),
        ecomApi.get('/users?role=ecom_closeuse'),
        ecomApi.get('/products'),
        ecomApi.get('/assignments')
      ]);

      const sourcesData = sourcesRes?.data?.data;
      const closeusesData = closeusesRes?.data?.data?.users ?? closeusesRes?.data?.data;
      const productsData = productsRes?.data?.data;
      const assignmentsData = assignmentsRes?.data?.data;

      console.log('📊 Données brutes:', {
        sources: sourcesData,
        closeuses: closeusesData,
        products: productsData,
        assignments: assignmentsData
      });

      setSources(Array.isArray(sourcesData) ? sourcesData : []);
      setCloseuses(Array.isArray(closeusesData) ? closeusesData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
      
      // Check Google Sheets sources and load their data
      await loadGoogleSheetsInfo(Array.isArray(sourcesData) ? sourcesData : []);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      setMessage('Erreur lors du chargement des données');
      // Assurer que les états sont toujours des tableaux même en cas d'erreur
      setSources([]);
      setCloseuses([]);
      setProducts([]);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const loadGoogleSheetsInfo = async (sources) => {
    const googleSources = sources.filter(source => 
      source.metadata?.type === 'google_sheets' && source.metadata?.spreadsheetId
    );
    
    const sheetsData = {};
    
    for (const source of googleSources) {
      sheetsData[source._id] = {
        status: 'connected',
        lastChecked: new Date(),
        data: {
          spreadsheetId: source.metadata.spreadsheetId,
          sheetName: source.metadata.sheetName
        }
      };
    }
    
    setGoogleSheetsData(sheetsData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    
    try {
      if (editingAssignment) {
        await ecomApi.put(`/assignments/${editingAssignment._id}`, formData);
        setMessage('Affectation mise à jour avec succès');
      } else {
        await ecomApi.post('/assignments', formData);
        setMessage('Affectation créée avec succès');
      }
      
      setShowForm(false);
      setEditingAssignment(null);
      setFormData({
        closeuseId: '',
        orderSources: [],
        productAssignments: [],
        notes: ''
      });
      
      await loadData();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleEdit = (assignment) => {
    setEditingAssignment(assignment);
    // Garder dbIds et sheetNames séparés dans productIds
    // Le backend sépare lui-même les ObjectIds valides des noms sheets
    const productAssignments = Array.isArray(assignment.productAssignments) ? assignment.productAssignments.map(pa => {
      const dbIds = Array.isArray(pa.productIds)
        ? pa.productIds
            .filter(p => p)
            .map(p => (typeof p === 'object' ? p._id?.toString() : p))
            .filter(Boolean)
        : [];
      const sheetNames = Array.isArray(pa.sheetProductNames) ? pa.sheetProductNames : [];
      return {
        sourceId: pa.sourceId?._id?.toString() || pa.sourceId?.toString() || pa.sourceId,
        productIds: [...dbIds, ...sheetNames]
      };
    }) : [];

    setFormData({
      closeuseId: assignment.closeuseId?._id?.toString() || assignment.closeuseId,
      orderSources: Array.isArray(assignment.orderSources)
        ? assignment.orderSources.map(os => ({ sourceId: os.sourceId?._id?.toString() || os.sourceId }))
        : [],
      productAssignments,
      notes: assignment.notes || ''
    });

    // Charger les produits sheets pour chaque source
    productAssignments.forEach(pa => {
      if (pa.sourceId) loadSheetProducts(pa.sourceId);
    });

    setShowForm(true);
  };

  const handleDelete = async (assignmentId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette affectation ?')) return;
    
    try {
      await ecomApi.delete(`/assignments/${assignmentId}`);
      setMessage('Affectation supprimée avec succès');
      await loadData();
    } catch (error) {
      setMessage('Erreur lors de la suppression');
    }
  };

  const addOrderSource = () => {
    setFormData(prev => ({
      ...prev,
      orderSources: [...prev.orderSources, { sourceId: '' }]
    }));
  };

  const removeOrderSource = (index) => {
    setFormData(prev => ({
      ...prev,
      orderSources: prev.orderSources.filter((_, i) => i !== index)
    }));
  };

  const addProductAssignment = () => {
    setFormData(prev => ({
      ...prev,
      productAssignments: [...prev.productAssignments, { sourceId: '', productIds: [] }]
    }));
  };

  const removeProductAssignment = (index) => {
    setFormData(prev => ({
      ...prev,
      productAssignments: prev.productAssignments.filter((_, i) => i !== index)
    }));
  };

  const updateProductAssignment = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      productAssignments: Array.isArray(prev.productAssignments) ? prev.productAssignments.map((pa, i) => 
        i === index ? { ...pa, [field]: value } : pa
      ) : []
    }));
  };

  // Toggle source : coche/décoche une source et crée/supprime son productAssignment
  const toggleSource = (sourceId, isSheetSource) => {
    const isChecked = formData.orderSources.some(os => os.sourceId === sourceId);
    if (isChecked) {
      setFormData(prev => ({
        ...prev,
        orderSources: prev.orderSources.filter(os => os.sourceId !== sourceId),
        productAssignments: prev.productAssignments.filter(p => p.sourceId !== sourceId)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        orderSources: [...prev.orderSources, { sourceId }],
        productAssignments: [...prev.productAssignments, { sourceId, productIds: [] }]
      }));
      if (isSheetSource) loadSheetProducts(sourceId);
    }
  };

  // Toggle un produit dans une source
  const toggleProduct = (sourceId, productId) => {
    setFormData(prev => ({
      ...prev,
      productAssignments: prev.productAssignments.map(p =>
        p.sourceId === sourceId
          ? {
              ...p,
              productIds: p.productIds.includes(productId)
                ? p.productIds.filter(id => id !== productId)
                : [...p.productIds, productId]
            }
          : p
      )
    }));
  };

  // Sélectionner / désélectionner tous les produits d'une source
  const selectAllProducts = (sourceId, allIds) => {
    setFormData(prev => ({
      ...prev,
      productAssignments: prev.productAssignments.map(p =>
        p.sourceId === sourceId ? { ...p, productIds: allIds } : p
      )
    }));
  };

  const handleSyncGoogleSheets = async () => {
    setSyncing(true);
    setMessage('');
    
    try {
      const response = await ecomApi.post('/assignments/sync-sources');
      
      setMessage(`✅ ${response.data.message}`);
      await loadData(); // Reload data to show new sources
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Erreur lors de la synchronisation';
      setMessage(`❌ ${errorMsg}`);
    } finally {
      setSyncing(false);
    }
  };

  const handlePreviewSheetsData = async (source) => {
    if (!source.metadata?.spreadsheetId) return;
    
    setSelectedSource(source);
    setShowSheetsPreview(true);
    
    try {
      const response = await ecomApi.post('/assignments/preview-sheets', {
        spreadsheetId: source.metadata.spreadsheetId,
        sheetName: source.metadata.sheetName,
        maxRows: 10
      });
      
      setGoogleSheetsData(prev => ({
        ...prev,
        [source._id]: {
          ...prev[source._id],
          preview: response.data.data || response.data
        }
      }));
    } catch (error) {
      console.error('Erreur preview sheets:', error);
      setMessage('Erreur lors de la prévisualisation des données');
    }
  };

  const loadSheetProducts = async (sourceId) => {
    const source = sources.find(s => s._id === sourceId);
    if (!source?.metadata?.spreadsheetId) return;
    if (sheetProducts[sourceId]?.products?.length > 0) return; // Already loaded successfully

    setLoadingSheetProducts(prev => ({ ...prev, [sourceId]: true }));
    try {
      const response = await ecomApi.post('/assignments/sheet-products', {
        spreadsheetId: source.metadata.spreadsheetId,
        sheetName: source.metadata.sheetName
      });
      setSheetProducts(prev => ({
        ...prev,
        [sourceId]: { products: response.data.data?.products || [], error: null }
      }));
    } catch (error) {
      console.error('Erreur chargement produits sheet:', error);
      const errorMsg = error.response?.data?.message || 'Erreur de connexion au Google Sheet';
      setSheetProducts(prev => ({ ...prev, [sourceId]: { error: errorMsg, products: [] } }));
    } finally {
      setLoadingSheetProducts(prev => ({ ...prev, [sourceId]: false }));
    }
  };

  const isGoogleSheetsSource = (source) => {
    return source.metadata?.type === 'google_sheets';
  };

  const getGoogleSheetsStatus = (sourceId) => {
    return googleSheetsData[sourceId];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-full overflow-x-hidden">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">Affectations</h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5 hidden sm:block">Affectez des sources et produits aux closeuses</p>
          </div>
          <button
            onClick={() => {
              setEditingAssignment(null);
              setFormData({ closeuseId: '', orderSources: [], productAssignments: [], notes: '' });
              setShowForm(true);
            }}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium active:bg-blue-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span className="hidden sm:inline">Nouvelle </span>Affectation
          </button>
        </div>
        <button
          onClick={handleSyncGoogleSheets}
          disabled={syncing}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 active:bg-green-700"
        >
          {syncing ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Synchronisation...</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Sync Google Sheets</>
          )}
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Sources Google Sheets */}
      {sources.filter(isGoogleSheetsSource).length > 0 && (
        <div className="mb-6 bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v1a1 1 0 001 1h4a1 1 0 001-1v-1m3-2V8a2 2 0 00-2-2H8a2 2 0 00-2 2v6m9 4h.01" />
              </svg>
              Sources Google Sheets
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sources.filter(isGoogleSheetsSource).map((source) => {
                const sheetsInfo = getGoogleSheetsStatus(source._id);
                return (
                  <div key={source._id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{source.icon}</span>
                        <h3 className="font-medium text-gray-900">{source.name}</h3>
                      </div>
                      {sheetsInfo?.status === 'connected' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <circle cx="10" cy="10" r="6" />
                          </svg>
                          Connecté
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <circle cx="10" cy="10" r="6" />
                          </svg>
                          Erreur
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <span className="text-xs font-mono truncate">
                          {source.metadata?.spreadsheetId?.slice(0, 12)}...
                        </span>
                      </div>
                      
                      {source.metadata?.sheetName && (
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-xs">{source.metadata.sheetName}</span>
                        </div>
                      )}
                      
                      {sheetsInfo?.rowCount && (
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <span className="text-xs">{sheetsInfo.rowCount} lignes</span>
                        </div>
                      )}
                      
                      {sheetsInfo?.error && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                          {sheetsInfo.error}
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => handlePreviewSheetsData(source)}
                        className="w-full px-3 py-1.5 bg-blue-50 text-blue-700 rounded text-xs font-medium hover:bg-blue-100 transition"
                      >
                        Aperçu des données
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Modal preview Google Sheets */}
      {showSheetsPreview && selectedSource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Aperçu: {selectedSource.icon} {selectedSource.name}
                </h2>
                <button
                  onClick={() => {
                    setShowSheetsPreview(false);
                    setSelectedSource(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {selectedSource.metadata?.spreadsheetId && (
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                    {selectedSource.metadata.spreadsheetId}
                  </span>
                )}
                {selectedSource.metadata?.sheetName && (
                  <span className="ml-2">Sheet: {selectedSource.metadata.sheetName}</span>
                )}
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {googleSheetsData[selectedSource._id]?.preview ? (
                <div>
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Aperçu des données</h3>
                    <div className="text-xs text-gray-600">
                      {googleSheetsData[selectedSource._id].preview.metadata?.parsedRows || 0} lignes chargées
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {Array.isArray(googleSheetsData[selectedSource._id]?.preview?.headers) && googleSheetsData[selectedSource._id].preview.headers.map((header, index) => (
                            <th key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Array.isArray(googleSheetsData[selectedSource._id]?.preview?.preview) && googleSheetsData[selectedSource._id].preview.preview.map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-gray-50">
                            {Array.isArray(googleSheetsData[selectedSource._id]?.preview?.headers) && googleSheetsData[selectedSource._id].preview.headers.map((header, colIndex) => (
                              <td key={colIndex} className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                                {row[header] || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {Array.isArray(googleSheetsData[selectedSource._id]?.preview?.recommendations) && googleSheetsData[selectedSource._id].preview.recommendations.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Recommandations</h4>
                      <div className="space-y-2">
                        {googleSheetsData[selectedSource._id].preview.recommendations.map((rec, index) => (
                          <div key={index} className={`p-3 rounded-lg text-sm ${
                            rec.type === 'error' ? 'bg-red-50 text-red-800' :
                            rec.type === 'warning' ? 'bg-yellow-50 text-yellow-800' :
                            'bg-blue-50 text-blue-800'
                          }`}>
                            <div className="font-medium">{rec.message}</div>
                            {rec.action && <div className="text-xs mt-1 opacity-75">{rec.action}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Liste des affectations — cards sur mobile, table sur desktop */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Affectations existantes</h2>
        </div>

        {/* Mobile : cards */}
        <div className="sm:hidden divide-y divide-gray-100">
          {Array.isArray(assignments) && assignments.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">Aucune affectation trouvée</div>
          )}
          {Array.isArray(assignments) && assignments.map((assignment) => (
            <div key={assignment._id} className="p-4 space-y-3">
              {/* Closeuse */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                    {assignment.closeuseId?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{assignment.closeuseId?.name}</div>
                    <div className="text-xs text-gray-400 truncate">{assignment.closeuseId?.email}</div>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(assignment)}
                    className="p-2 rounded-lg bg-blue-50 text-blue-600 active:bg-blue-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button
                    onClick={() => handleDelete(assignment._id)}
                    className="p-2 rounded-lg bg-red-50 text-red-500 active:bg-red-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              {/* Sources */}
              {Array.isArray(assignment.orderSources) && assignment.orderSources.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Sources</p>
                  <div className="flex flex-wrap gap-1">
                    {assignment.orderSources.map((os) => (
                      <span
                        key={os.sourceId?._id || os.sourceId}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: (os.sourceId?.color || '#000') + '20', color: os.sourceId?.color || '#374151' }}
                      >
                        {os.sourceId?.icon || ''} {os.sourceId?.name || 'Source'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Produits */}
              {Array.isArray(assignment.productAssignments) && assignment.productAssignments.some(pa =>
                (pa.sheetProductNames?.length || 0) + (pa.productIds?.length || 0) > 0
              ) && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Produits</p>
                  <div className="space-y-1">
                    {assignment.productAssignments.map((pa, paIdx) => (
                      <div key={paIdx}>
                        {(pa.sheetProductNames?.length > 0 || pa.productIds?.length > 0) && (
                          <div className="flex flex-wrap gap-1">
                            {(pa.sheetProductNames || []).map((name, nIdx) => (
                              <span key={nIdx} className="inline-flex px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs">{name}</span>
                            ))}
                            {pa.productIds?.length > 0 && (
                              <span className="inline-flex px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{pa.productIds.length} produit(s) DB</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Notes */}
              {assignment.notes && (
                <p className="text-xs text-gray-500 italic">{assignment.notes}</p>
              )}
            </div>
          ))}
        </div>

        {/* Desktop : table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Closeuse</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sources</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produits</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Array.isArray(assignments) && assignments.map((assignment) => (
                <tr key={assignment._id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{assignment.closeuseId?.name}</div>
                    <div className="text-sm text-gray-500">{assignment.closeuseId?.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(assignment.orderSources) && assignment.orderSources.map((os) => (
                        <span key={os.sourceId?._id || os.sourceId} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                          style={{ backgroundColor: (os.sourceId?.color || '#000') + '20', color: os.sourceId?.color || '#000' }}>
                          {os.sourceId?.icon || ''} {os.sourceId?.name || 'Source inconnue'}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {Array.isArray(assignment.productAssignments) && assignment.productAssignments.map((pa, paIdx) => (
                        <div key={paIdx} className="text-xs">
                          <span className="font-medium">{pa.sourceId?.name || 'Source'}:</span>
                          {Array.isArray(pa.sheetProductNames) && pa.sheetProductNames.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {pa.sheetProductNames.map((name, nIdx) => (
                                <span key={nIdx} className="inline-flex px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs">{name}</span>
                              ))}
                            </div>
                          )}
                          {Array.isArray(pa.productIds) && pa.productIds.length > 0 && (
                            <span className="ml-1">{pa.productIds.length} produit(s) DB</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{assignment.notes || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onClick={() => handleEdit(assignment)} className="text-blue-600 hover:text-blue-900 mr-3">Modifier</button>
                    <button onClick={() => handleDelete(assignment._id)} className="text-red-600 hover:text-red-900">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {assignments.length === 0 && (
            <div className="text-center py-8 text-gray-500">Aucune affectation trouvée</div>
          )}
        </div>
      </div>

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end sm:items-center justify-center sm:p-4 z-50">
          <div className="bg-white sm:rounded-xl w-full sm:max-w-3xl max-h-[95vh] sm:max-h-[92vh] flex flex-col shadow-2xl rounded-t-2xl">
            {/* Handle iOS sheet */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            {/* Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900">
                  {editingAssignment ? 'Modifier l\'affectation' : 'Nouvelle affectation'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">Sélectionnez une closeuse, ses sources et ses produits</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingAssignment(null); setFormData({ closeuseId: '', orderSources: [], productAssignments: [], notes: '' }); }}
                className="p-2 rounded-full bg-gray-100 text-gray-500 active:bg-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-5">

                {/* ÉTAPE 1 — Closeuse */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">1</span>
                    <h3 className="text-sm font-semibold text-gray-800">Choisir la closeuse</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Array.isArray(closeuses) && closeuses.map((closeuse) => (
                      <label
                        key={closeuse._id}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          formData.closeuseId === closeuse._id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="closeuse"
                          value={closeuse._id}
                          checked={formData.closeuseId === closeuse._id}
                          onChange={(e) => setFormData(prev => ({ ...prev, closeuseId: e.target.value }))}
                          className="sr-only"
                        />
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                          {closeuse.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{closeuse.name}</div>
                          <div className="text-xs text-gray-500 truncate">{closeuse.email}</div>
                        </div>
                        {formData.closeuseId === closeuse._id && (
                          <svg className="w-4 h-4 text-blue-600 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </label>
                    ))}
                    {closeuses.length === 0 && (
                      <p className="text-sm text-gray-400 col-span-2">Aucune closeuse disponible</p>
                    )}
                  </div>
                </div>

                {/* ÉTAPE 2 — Sources + Produits par source */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">2</span>
                    <h3 className="text-sm font-semibold text-gray-800">Sources & Produits assignés</h3>
                    <span className="text-xs text-gray-400">— Cochez les sources puis sélectionnez les produits</span>
                  </div>

                  <div className="space-y-3">
                    {Array.isArray(sources) && sources.map((source) => {
                      const isSourceChecked = formData.orderSources.some(os => os.sourceId === source._id);
                      const pa = formData.productAssignments.find(p => p.sourceId === source._id);
                      const selectedProductIds = pa?.productIds || [];
                      const isSheetSource = source.metadata?.type === 'google_sheets';
                      const srcProducts = sheetProducts[source._id];
                      const isLoadingProds = loadingSheetProducts[source._id];
                      const dbProducts = products;

                      const availableProducts = isSheetSource
                        ? (srcProducts?.products || [])
                        : dbProducts.map(p => p._id);

                      return (
                        <div
                          key={source._id}
                          className={`rounded-lg border-2 transition-all ${
                            isSourceChecked ? 'border-blue-400 bg-blue-50/40' : 'border-gray-200 bg-white'
                          }`}
                        >
                          {/* Header source */}
                          <label className="flex items-center gap-3 p-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isSourceChecked}
                              onChange={() => toggleSource(source._id, isSheetSource)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                            />
                            <span className="text-base">{source.icon}</span>
                            <span className="text-sm font-medium text-gray-800 flex-1">{source.name}</span>
                            {isSheetSource && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Google Sheets</span>
                            )}
                            {isSourceChecked && selectedProductIds.length > 0 && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                                {selectedProductIds.length} produit{selectedProductIds.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </label>

                          {/* Produits (visible si source cochée) */}
                          {isSourceChecked && (
                            <div className="px-4 pb-4 border-t border-blue-100">
                              {isLoadingProds ? (
                                <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
                                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                  Chargement des produits...
                                </div>
                              ) : srcProducts?.error ? (
                                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                  {srcProducts.error}
                                </div>
                              ) : (
                                <div className="mt-3">
                                  {/* Boutons tout sélectionner / désélectionner */}
                                  <div className="flex gap-2 mb-2">
                                    <button
                                      type="button"
                                      onClick={() => selectAllProducts(source._id, availableProducts)}
                                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                    >
                                      Tout sélectionner ({availableProducts.length})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => selectAllProducts(source._id, [])}
                                      className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                                    >
                                      Tout désélectionner
                                    </button>
                                  </div>

                                  {/* Liste produits */}
                                  {availableProducts.length === 0 ? (
                                    <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
                                      {isSheetSource ? 'Aucun produit trouvé dans ce Google Sheet.' : 'Aucun produit disponible.'}
                                    </p>
                                  ) : (
                                    <div className="max-h-44 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1 pr-1">
                                      {isSheetSource
                                        ? availableProducts.map((productName, idx) => (
                                            <label key={idx} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                                              selectedProductIds.includes(productName) ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100 text-gray-700'
                                            }`}>
                                              <input
                                                type="checkbox"
                                                checked={selectedProductIds.includes(productName)}
                                                onChange={() => toggleProduct(source._id, productName)}
                                                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                                              />
                                              <span className="truncate">{productName}</span>
                                            </label>
                                          ))
                                        : dbProducts.map((product) => (
                                            <label key={product._id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                                              selectedProductIds.includes(product._id) ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100 text-gray-700'
                                            }`}>
                                              <input
                                                type="checkbox"
                                                checked={selectedProductIds.includes(product._id)}
                                                onChange={() => toggleProduct(source._id, product._id)}
                                                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                                              />
                                              <span className="truncate">{product.name}</span>
                                            </label>
                                          ))
                                      }
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {sources.length === 0 && (
                      <p className="text-sm text-gray-400">Aucune source disponible</p>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optionnel)</span></label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Notes optionnelles..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex-shrink-0 bg-gray-50 sm:rounded-b-xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
                {formData.closeuseId && (
                  <p className="text-xs text-gray-400 mb-2 truncate">
                    {closeuses.find(c => c._id === formData.closeuseId)?.name} — {formData.orderSources.length} source{formData.orderSources.length > 1 ? 's' : ''}, {formData.productAssignments.reduce((acc, pa) => acc + pa.productIds.length, 0)} produit(s)
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setEditingAssignment(null); setFormData({ closeuseId: '', orderSources: [], productAssignments: [], notes: '' }); }}
                    className="flex-1 sm:flex-none px-4 py-2.5 text-sm border border-gray-300 text-gray-700 rounded-lg active:bg-gray-100 font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={!formData.closeuseId}
                    className="flex-1 sm:flex-none px-5 py-2.5 text-sm bg-blue-600 text-white rounded-lg active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    {editingAssignment ? 'Mettre à jour' : 'Créer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentsManager;
