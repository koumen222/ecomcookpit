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
    const productAssignments = Array.isArray(assignment.productAssignments) ? assignment.productAssignments.map(pa => {
      const dbIds = Array.isArray(pa.productIds) ? pa.productIds.filter(p => p && (typeof p === 'object' ? p._id : typeof p === 'string')).map(p => p._id || p) : [];
      const sheetNames = Array.isArray(pa.sheetProductNames) ? pa.sheetProductNames : [];
      return {
        sourceId: pa.sourceId?._id || pa.sourceId,
        productIds: [...dbIds, ...sheetNames]
      };
    }) : [];

    setFormData({
      closeuseId: assignment.closeuseId._id,
      orderSources: Array.isArray(assignment.orderSources) ? assignment.orderSources.map(os => ({ sourceId: os.sourceId._id })) : [],
      productAssignments,
      notes: assignment.notes
    });

    // Load sheet products for each source in the assignment
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
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Affectations</h1>
          <p className="text-gray-600 mt-1">Affectez des sources de commandes et des produits aux closeuses</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSyncGoogleSheets}
            disabled={syncing}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {syncing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Synchronisation...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Google Sheets
              </>
            )}
          </button>
          <button
            onClick={() => {
              setEditingAssignment(null);
              setFormData({
                closeuseId: '',
                orderSources: [{ sourceId: '' }],
                productAssignments: [{ sourceId: '', productIds: [] }],
                notes: ''
              });
              setShowForm(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Nouvelle Affectation
          </button>
        </div>
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

      {/* Liste des affectations */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Affectations existantes</h2>
        </div>
        <div className="overflow-x-auto">
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
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {assignment.closeuseId.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {assignment.closeuseId.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(assignment.orderSources) && assignment.orderSources.map((os) => (
                        <span
                          key={os.sourceId?._id || os.sourceId}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                          style={{ backgroundColor: os.sourceId?.color + '20' || '#00000020', color: os.sourceId?.color || '#000000' }}
                        >
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
                                <span key={nIdx} className="inline-flex px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                                  {name}
                                </span>
                              ))}
                            </div>
                          )}
                          {Array.isArray(pa.productIds) && pa.productIds.length > 0 && (
                            <span className="ml-1">{pa.productIds.length} produit(s) DB</span>
                          )}
                          {(!Array.isArray(pa.sheetProductNames) || pa.sheetProductNames.length === 0) && (!Array.isArray(pa.productIds) || pa.productIds.length === 0) && (
                            <span className="ml-1 text-gray-400">Aucun produit</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {assignment.notes || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(assignment)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(assignment._id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {assignments.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Aucune affectation trouvée
            </div>
          )}
        </div>
      </div>

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingAssignment ? 'Modifier l\'affectation' : 'Nouvelle affectation'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Sélection de la closeuse */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Closeuse *
                  </label>
                  <select
                    value={formData.closeuseId}
                    onChange={(e) => setFormData(prev => ({ ...prev, closeuseId: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Sélectionner une closeuse</option>
                    {Array.isArray(closeuses) && closeuses.map((closeuse) => (
                      <option key={closeuse._id} value={closeuse._id}>
                        {closeuse.name} ({closeuse.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sources de commandes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sources de commandes
                  </label>
                  {formData.orderSources.map((os, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <select
                        value={os.sourceId}
                        onChange={(e) => {
                          const newOrderSources = [...formData.orderSources];
                          newOrderSources[index] = { sourceId: e.target.value };
                          setFormData(prev => ({ ...prev, orderSources: newOrderSources }));
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Sélectionner une source</option>
                        {Array.isArray(sources) && sources.map((source) => (
                          <option key={source._id} value={source._id}>
                            {source.icon} {source.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeOrderSource(index)}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Supprimer
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addOrderSource}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Ajouter une source
                  </button>
                </div>

                {/* Affectations de produits par source */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Produits par source (depuis Google Sheets)
                  </label>
                  {formData.productAssignments.map((pa, index) => {
                    const selectedSrc = sources.find(s => s._id === pa.sourceId);
                    const isSheetSource = selectedSrc?.metadata?.type === 'google_sheets';
                    const sourceProducts = sheetProducts[pa.sourceId] || [];
                    const isLoadingProducts = loadingSheetProducts[pa.sourceId];

                    return (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
                        <div className="flex gap-2 mb-3">
                          <select
                            value={pa.sourceId}
                            onChange={(e) => {
                              updateProductAssignment(index, 'sourceId', e.target.value);
                              updateProductAssignment(index, 'productIds', []);
                              if (e.target.value) {
                                loadSheetProducts(e.target.value);
                              }
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            <option value="">Sélectionner une source</option>
                            {Array.isArray(sources) && sources.map((source) => (
                              <option key={source._id} value={source._id}>
                                {source.icon} {source.name} {source.metadata?.type === 'google_sheets' ? '(Google Sheets)' : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeProductAssignment(index)}
                            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                          >
                            Supprimer
                          </button>
                        </div>

                        {pa.sourceId && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-sm font-medium text-gray-700">
                                Produits {isSheetSource ? 'du Google Sheet' : 'disponibles'}
                              </label>
                              {isSheetSource && Array.isArray(sourceProducts.products) && sourceProducts.products.length > 0 && (
                                <span className="text-xs text-green-600 font-medium">
                                  {sourceProducts.products.length} produits trouvés
                                </span>
                              )}
                            </div>

                            {isLoadingProducts ? (
                              <div className="flex items-center gap-2 p-4 border border-gray-200 rounded-lg">
                                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-sm text-gray-500">Chargement des produits depuis Google Sheets...</span>
                              </div>
                            ) : sourceProducts.error ? (
                              <div className="p-3 border border-red-200 bg-red-50 rounded-lg text-sm text-red-700">
                                <div className="font-medium">Erreur d'accès</div>
                                <div>{sourceProducts.error}</div>
                              </div>
                            ) : isSheetSource && Array.isArray(sourceProducts.products) && sourceProducts.products.length > 0 ? (
                              <div>
                                <div className="flex gap-2 mb-2">
                                  <button
                                    type="button"
                                    onClick={() => updateProductAssignment(index, 'productIds', Array.isArray(sourceProducts.products) ? [...sourceProducts.products] : [])}
                                    className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                                  >
                                    Tout sélectionner ({Array.isArray(sourceProducts.products) ? sourceProducts.products.length : 0})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateProductAssignment(index, 'productIds', [])}
                                    className="px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded hover:bg-gray-100"
                                  >
                                    Tout désélectionner
                                  </button>
                                </div>
                                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                                  {Array.isArray(sourceProducts.products) && sourceProducts.products.map((productName, pIdx) => (
                                    <label key={pIdx} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={Array.isArray(pa.productIds) && (pa.productIds || []).includes(productName)}
                                        onChange={(e) => {
                                          const currentProductIds = Array.isArray(pa.productIds) ? pa.productIds : [];
                                          const newProductIds = e.target.checked
                                            ? [...currentProductIds, productName]
                                            : currentProductIds.filter(id => id !== productName);
                                          updateProductAssignment(index, 'productIds', newProductIds);
                                        }}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                                      />
                                      <span className="text-sm text-gray-800">{productName}</span>
                                    </label>
                                  ))}
                                </div>
                                {Array.isArray(pa.productIds) && pa.productIds.length > 0 && !sourceProducts.error && (
                                  <div className="mt-2 text-xs text-indigo-600 font-medium">
                                    {pa.productIds.length} produit(s) sélectionné(s)
                                  </div>
                                )}
                              </div>
                            ) : isSheetSource ? (
                              <div className="p-3 border border-yellow-200 bg-yellow-50 rounded-lg text-sm text-yellow-700">
                                Aucun produit trouvé dans ce Google Sheet. Vérifiez que la colonne "Produit" existe.
                              </div>
                            ) : (
                              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                                {Array.isArray(products) && products.map((product) => (
                                  <label key={product._id} className="flex items-center mb-1">
                                    <input
                                      type="checkbox"
                                      checked={(pa.productIds || []).includes(product._id)}
                                      onChange={(e) => {
                                        const newProductIds = e.target.checked
                                          ? [...(pa.productIds || []), product._id]
                                          : (pa.productIds || []).filter(id => id !== product._id);
                                        updateProductAssignment(index, 'productIds', newProductIds);
                                      }}
                                      className="mr-2"
                                    />
                                    <span className="text-sm">{product.name} ({product.sellingPrice} FCFA)</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={addProductAssignment}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Ajouter une affectation de produits
                  </button>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Notes optionnelles..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingAssignment ? 'Mettre à jour' : 'Créer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingAssignment(null);
                      setFormData({
                        closeuseId: '',
                        orderSources: [],
                        productAssignments: [],
                        notes: ''
                      });
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentsManager;
