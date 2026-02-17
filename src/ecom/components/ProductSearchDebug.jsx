import React, { useState, useEffect } from 'react';

const ProductSearchDebug = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const testDirectApi = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Test direct avec fetch
      const API_BASE = window.location.origin.includes('localhost') 
        ? 'http://localhost:3001/api/ecom' 
        : '/api/ecom';
      
      console.log('🔍 Test API direct vers:', API_BASE);
      
      const response = await fetch(`${API_BASE}/products/search?search=${searchTerm}&limit=10`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 Status response:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📩 Response data:', data);
      setResults(data);
      
    } catch (error) {
      console.error('❌ Erreur API direct:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Debug Recherche Produits</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Terme de recherche:</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Entrez un terme de recherche..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        
        <button
          onClick={testDirectApi}
          disabled={loading || !searchTerm}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Recherche...' : 'Tester API'}
        </button>
        
        {error && (
          <div className="p-4 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-red-700">Erreur: {error}</p>
          </div>
        )}
        
        {results && (
          <div className="p-4 bg-green-100 border border-green-300 rounded-lg">
            <h3 className="font-semibold mb-2">Résultats:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
        
        <div className="p-4 bg-gray-100 rounded-lg">
          <h3 className="font-semibold mb-2">Informations de debug:</h3>
          <ul className="text-sm space-y-1">
            <li>Window origin: {window.location.origin}</li>
            <li>Is localhost: {window.location.origin.includes('localhost') ? 'Oui' : 'Non'}</li>
            <li>API Base: {window.location.origin.includes('localhost') ? 'http://localhost:3001/api/ecom' : '/api/ecom'}</li>
            <li>Search term: "{searchTerm}"</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ProductSearchDebug;
