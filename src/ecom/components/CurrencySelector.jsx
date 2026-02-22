import React, { useState } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';
import { currencies, formatMoney } from '../utils/currency.js';

const CurrencySelector = ({ compact = false }) => {
  const { user, changeCurrency } = useEcomAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentCurrency = user?.currency || 'XAF';
  const currentInfo = currencies[currentCurrency];

  // Group currencies by region
  const groupedCurrencies = Object.values(currencies).reduce((acc, currency) => {
    if (!acc[currency.region]) acc[currency.region] = [];
    acc[currency.region].push(currency);
    return acc;
  }, {});

  const regionOrder = ['Afrique Centrale', 'Afrique de l\'Ouest', 'Afrique du Nord', 'Afrique de l\'Est', 'Afrique Australe', 'International'];

  const handleChange = async (currencyCode) => {
    if (currencyCode === currentCurrency) {
      setIsOpen(false);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await changeCurrency(currencyCode);
      setSuccess('Devise mise à jour !');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.message || 'Erreur lors du changement de devise');
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  // Compact version - just a dropdown button
  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm hover:border-blue-400 transition disabled:opacity-50"
        >
          <span className="text-base">{currentInfo.flag}</span>
          <span className="font-medium text-gray-700">{currentInfo.code}</span>
          <svg className={`w-4 h-4 text-gray-400 transition ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-80 overflow-y-auto">
              {regionOrder.map(region => {
                const regionCurrencies = groupedCurrencies[region];
                if (!regionCurrencies || regionCurrencies.length === 0) return null;
                return (
                  <div key={region}>
                    <div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50">{region}</div>
                    {regionCurrencies.map((currency) => (
                      <button
                        key={currency.code}
                        onClick={() => handleChange(currency.code)}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3 ${
                          currentCurrency === currency.code ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <span className="text-base">{currency.flag}</span>
                        <div className="flex-1">
                          <div className="font-medium">{currency.code}</div>
                          <div className="text-xs text-gray-500">{currency.name}</div>
                        </div>
                        {currentCurrency === currency.code && (
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {error && (
          <div className="absolute top-full mt-2 right-0 bg-red-50 text-red-600 text-xs px-2 py-1 rounded whitespace-nowrap">
            {error}
          </div>
        )}
        {success && (
          <div className="absolute top-full mt-2 right-0 bg-green-50 text-green-600 text-xs px-2 py-1 rounded whitespace-nowrap">
            {success}
          </div>
        )}
      </div>
    );
  }

  // Full version with preview
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Ma devise</h3>
      
      {error && (
        <div className="mb-3 bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 bg-green-50 text-green-600 text-sm px-3 py-2 rounded-lg">
          {success}
        </div>
      )}

      <div className="space-y-4">
        {regionOrder.map(region => {
          const regionCurrencies = groupedCurrencies[region];
          if (!regionCurrencies || regionCurrencies.length === 0) return null;
          return (
            <div key={region}>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{region}</h4>
              <div className="space-y-1">
                {regionCurrencies.map((currency) => (
                  <button
                    key={currency.code}
                    onClick={() => handleChange(currency.code)}
                    disabled={loading}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg border transition text-left ${
                      currentCurrency === currency.code
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl">{currency.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium text-sm ${currentCurrency === currency.code ? 'text-blue-900' : 'text-gray-900'}`}>
                        {currency.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {currency.code} · Exemple: {formatMoney(12345.67, currency.code)}
                      </div>
                    </div>
                    {currentCurrency === currency.code && (
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-gray-500">
        La devise choisie s'appliquera à toutes vos transactions et rapports.
      </p>
    </div>
  );
};

export default CurrencySelector;
