import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';

const GlobalSearch = ({ isSuperAdmin = false, isMobile = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState({
    orders: [],
    products: [],
    clients: [],
    users: []
  });
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setResults({ orders: [], products: [], clients: [], users: [] });
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const performSearch = async (term) => {
    try {
      setLoading(true);
      const searchPromises = [];

      // Recherche dans les commandes (nom, téléphone, produit, ville, orderId)
      searchPromises.push(
        ecomApi.get(`/orders?search=${encodeURIComponent(term)}&limit=8`)
          .then(res => ({ orders: res.data?.data?.orders || [] }))
          .catch(() => ({ orders: [] }))
      );

      // Recherche dans les produits (nom, statut)
      searchPromises.push(
        ecomApi.get(`/products?search=${encodeURIComponent(term)}&limit=8`)
          .then(res => ({ products: res.data?.data || [] }))
          .catch(() => ({ products: [] }))
      );

      // Recherche dans les clients (nom, téléphone, email, ville, produits)
      searchPromises.push(
        ecomApi.get(`/clients?search=${encodeURIComponent(term)}&limit=8`)
          .then(res => ({ clients: res.data?.data || [] }))
          .catch(() => ({ clients: [] }))
      );

      // Recherche dans les utilisateurs (si admin)
      if (!isSuperAdmin) {
        searchPromises.push(
          ecomApi.get(`/users?search=${encodeURIComponent(term)}&limit=5`)
            .then(res => ({ users: res.data?.data || [] }))
            .catch(() => ({ users: [] }))
        );
      }

      const searchResults = await Promise.all(searchPromises);
      const combinedResults = searchResults.reduce((acc, curr) => ({ ...acc, ...curr }), {
        orders: [],
        products: [],
        clients: [],
        users: []
      });

      setResults(combinedResults);
      
      // Auto-redirection si seulement un résultat total
      const totalCombinedResults = combinedResults.orders.length + combinedResults.products.length + combinedResults.clients.length + combinedResults.users.length;
      
      // Cas 1: Un seul résultat total → redirection automatique
      if (totalCombinedResults === 1) {
        let resultType = null;
        let resultItem = null;
        
        if (combinedResults.orders.length === 1) {
          resultType = 'order';
          resultItem = combinedResults.orders[0];
        } else if (combinedResults.products.length === 1) {
          resultType = 'product';
          resultItem = combinedResults.products[0];
        } else if (combinedResults.clients.length === 1) {
          resultType = 'client';
          resultItem = combinedResults.clients[0];
        } else if (combinedResults.users.length === 1) {
          resultType = 'user';
          resultItem = combinedResults.users[0];
        }
        
        if (resultType && resultItem) {
          setIsOpen(false);
          setSearchTerm('');
          handleResultClick(resultType, resultItem);
          return;
        }
      }
      
      // Cas 2: Deux résultats ou plus → afficher les choix (pas de redirection automatique)
      // La logique existante gère déjà l'affichage des résultats
    } catch (error) {
      console.error('Erreur recherche globale:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (type, item) => {
    setIsOpen(false);
    setSearchTerm('');
    
    switch (type) {
      case 'order':
        navigate(`/ecom/orders/${item._id}`);
        break;
      case 'product':
        navigate(`/ecom/products/${item._id}`);
        break;
      case 'client':
        navigate(`/ecom/clients?search=${item.name || item.phone}`);
        break;
      case 'user':
        navigate(`/ecom/users`);
        break;
      default:
        break;
    }
  };

  const totalResults = results.orders.length + results.products.length + results.clients.length + results.users.length;

  if (isMobile) {
    return (
      <div ref={searchRef} className="relative">
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) {
              setTimeout(() => inputRef.current?.focus(), 100);
            }
          }}
          className="relative w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:bg-gray-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setIsOpen(false)} />
            <div className="fixed top-0 left-0 right-0 z-[70] bg-white shadow-lg">
              <div className="flex items-center gap-2 p-3 border-b border-gray-200">
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-gray-500 active:bg-gray-100 rounded-full"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="flex-1 relative">
                  <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher tout..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {searchTerm.trim().length >= 2 && (
                <div className="max-h-[70vh] overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : totalResults === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      Aucun résultat pour "{searchTerm}"
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {results.orders.length > 0 && (
                        <div className="p-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Commandes</p>
                          {results.orders.map(order => (
                            <button
                              key={order._id}
                              onClick={() => handleResultClick('order', order)}
                              className="w-full text-left p-3 hover:bg-gray-50 rounded-lg mb-1"
                            >
                              <p className="text-sm font-medium text-gray-900">{order.clientName}</p>
                              <p className="text-xs text-gray-500">{order.product} - {order.clientPhone}</p>
                            </button>
                          ))}
                        </div>
                      )}

                      {results.products.length > 0 && (
                        <div className="p-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Produits</p>
                          {results.products.map(product => (
                            <button
                              key={product._id}
                              onClick={() => handleResultClick('product', product)}
                              className="w-full text-left p-3 hover:bg-gray-50 rounded-lg mb-1"
                            >
                              <p className="text-sm font-medium text-gray-900">{product.name}</p>
                              <p className="text-xs text-gray-500">Stock: {product.stock} - {product.status}</p>
                            </button>
                          ))}
                        </div>
                      )}

                      {results.clients.length > 0 && (
                        <div className="p-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Clients</p>
                          {results.clients.map(client => (
                            <button
                              key={client._id}
                              onClick={() => handleResultClick('client', client)}
                              className="w-full text-left p-3 hover:bg-gray-50 rounded-lg mb-1"
                            >
                              <p className="text-sm font-medium text-gray-900">{client.name}</p>
                              <p className="text-xs text-gray-500">{client.phone} - {client.city}</p>
                            </button>
                          ))}
                        </div>
                      )}

                      {results.users.length > 0 && (
                        <div className="p-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Utilisateurs</p>
                          {results.users.map(user => (
                            <button
                              key={user._id}
                              onClick={() => handleResultClick('user', user)}
                              className="w-full text-left p-3 hover:bg-gray-50 rounded-lg mb-1"
                            >
                              <p className="text-sm font-medium text-gray-900">{user.name}</p>
                              <p className="text-xs text-gray-500">{user.email} - {user.role}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div ref={searchRef} className="relative w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className={`h-4 w-4 ${isSuperAdmin ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Rechercher tout..."
          className={`block w-full pl-9 pr-3 py-1.5 rounded-lg leading-5 text-sm focus:outline-none focus:ring-1 ${
            isSuperAdmin
              ? 'bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-500 focus:border-emerald-600 focus:ring-emerald-600'
              : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-emerald-600 focus:ring-emerald-600'
          }`}
        />
      </div>

      {isOpen && searchTerm.trim().length >= 2 && (
        <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl border overflow-hidden z-50 max-h-[500px] overflow-y-auto ${
          isSuperAdmin ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : totalResults === 0 ? (
            <div className={`text-center py-8 text-sm ${isSuperAdmin ? 'text-gray-400' : 'text-gray-500'}`}>
              Aucun résultat pour "{searchTerm}"
            </div>
          ) : (
            <div>
              {results.orders.length > 0 && (
                <div className={`p-3 border-b ${isSuperAdmin ? 'border-gray-800' : 'border-gray-100'}`}>
                  <p className={`text-xs font-semibold uppercase mb-2 ${isSuperAdmin ? 'text-gray-500' : 'text-gray-500'}`}>
                    Commandes ({results.orders.length})
                  </p>
                  {results.orders.map(order => (
                    <button
                      key={order._id}
                      onClick={() => handleResultClick('order', order)}
                      className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                        isSuperAdmin ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                      }`}
                    >
                      <p className={`text-sm font-medium ${isSuperAdmin ? 'text-gray-200' : 'text-gray-900'}`}>
                        {order.clientName}
                      </p>
                      <p className={`text-xs ${isSuperAdmin ? 'text-gray-500' : 'text-gray-500'}`}>
                        {order.product} - {order.clientPhone}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {results.products.length > 0 && (
                <div className={`p-3 border-b ${isSuperAdmin ? 'border-gray-800' : 'border-gray-100'}`}>
                  <p className={`text-xs font-semibold uppercase mb-2 ${isSuperAdmin ? 'text-gray-500' : 'text-gray-500'}`}>
                    Produits ({results.products.length})
                  </p>
                  {results.products.map(product => (
                    <button
                      key={product._id}
                      onClick={() => handleResultClick('product', product)}
                      className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                        isSuperAdmin ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                      }`}
                    >
                      <p className={`text-sm font-medium ${isSuperAdmin ? 'text-gray-200' : 'text-gray-900'}`}>
                        {product.name}
                      </p>
                      <p className={`text-xs ${isSuperAdmin ? 'text-gray-500' : 'text-gray-500'}`}>
                        Stock: {product.stock} - {product.status}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {results.clients.length > 0 && (
                <div className={`p-3 border-b ${isSuperAdmin ? 'border-gray-800' : 'border-gray-100'}`}>
                  <p className={`text-xs font-semibold uppercase mb-2 ${isSuperAdmin ? 'text-gray-500' : 'text-gray-500'}`}>
                    Clients ({results.clients.length})
                  </p>
                  {results.clients.map(client => (
                    <button
                      key={client._id}
                      onClick={() => handleResultClick('client', client)}
                      className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                        isSuperAdmin ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                      }`}
                    >
                      <p className={`text-sm font-medium ${isSuperAdmin ? 'text-gray-200' : 'text-gray-900'}`}>
                        {client.name}
                      </p>
                      <p className={`text-xs ${isSuperAdmin ? 'text-gray-500' : 'text-gray-500'}`}>
                        {client.phone} - {client.city}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {results.users.length > 0 && (
                <div className="p-3">
                  <p className={`text-xs font-semibold uppercase mb-2 ${isSuperAdmin ? 'text-gray-500' : 'text-gray-500'}`}>
                    Utilisateurs ({results.users.length})
                  </p>
                  {results.users.map(user => (
                    <button
                      key={user._id}
                      onClick={() => handleResultClick('user', user)}
                      className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                        isSuperAdmin ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                      }`}
                    >
                      <p className={`text-sm font-medium ${isSuperAdmin ? 'text-gray-200' : 'text-gray-900'}`}>
                        {user.name}
                      </p>
                      <p className={`text-xs ${isSuperAdmin ? 'text-gray-500' : 'text-gray-500'}`}>
                        {user.email} - {user.role}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
