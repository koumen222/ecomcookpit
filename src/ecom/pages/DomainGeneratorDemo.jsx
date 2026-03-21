import React, { useState } from 'react';
import { Zap, Globe, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../lib/api';

/**
 * DemoPage - Page de démonstration pour la génération de noms de domaine
 * Montre comment la fonctionnalité de génération automatique fonctionne
 */
const DemoPage = () => {
  const [storeName, setStoreName] = useState('');
  const [generatedDomain, setGeneratedDomain] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [examples] = useState([
    'Ma Belle Boutique',
    'Café du Coin',
    'Fashion Store',
    'Électronique Plus',
    'Librairie Paris'
  ]);

  const generateDomain = async (name) => {
    if (!name || name.trim().length === 0) {
      setError('Veuillez entrer un nom de boutique');
      return;
    }

    setLoading(true);
    setError('');
    setGeneratedDomain(null);

    try {
      const res = await api.post('/store-manage/generate-subdomain', { 
        storeName: name.trim() 
      });
      
      if (res.data?.success) {
        setGeneratedDomain(res.data.data);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors de la génération du domaine');
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (example) => {
    setStoreName(example);
    generateDomain(example);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
            <Globe className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Générateur de Noms de Domaine
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Transformez automatiquement le nom de votre boutique en un domaine web professionnel au format 
            <span className="font-semibold text-emerald-600"> nom-boutique.scalor.net</span>
          </p>
        </div>

        {/* Main Generator */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="mb-6">
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              Nom de votre boutique
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Ex: Ma Belle Boutique"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && generateDomain(storeName)}
              />
              <button
                onClick={() => generateDomain(storeName)}
                disabled={loading || !storeName.trim()}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Générer
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {/* Result Display */}
          {generatedDomain && (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
                <h3 className="text-lg font-semibold text-emerald-900">Domaine généré avec succès!</h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <span className="text-sm text-gray-600">Sous-domaine:</span>
                  <span className="font-mono font-semibold text-gray-900">{generatedDomain.subdomain}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <span className="text-sm text-gray-600">Domaine complet:</span>
                  <span className="font-mono font-semibold text-gray-900">{generatedDomain.fullDomain}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <span className="text-sm text-gray-600">URL de la boutique:</span>
                  <a 
                    href={generatedDomain.storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                  >
                    {generatedDomain.storeUrl}
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Examples */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Exemples à tester</h2>
          <p className="text-gray-600 mb-6">
            Cliquez sur ces exemples pour voir comment la génération fonctionne avec différents types de noms:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {examples.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className="p-3 text-left border border-gray-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              >
                <div className="font-medium text-gray-900">{example}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {example.toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9\s]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '')
                    .substring(0, 30)}.scalor.net
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Génération Instantanée</h3>
            <p className="text-gray-600 text-sm">
              Transformez automatiquement votre nom en domaine URL-friendly en quelques secondes.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Vérification Disponibilité</h3>
            <p className="text-gray-600 text-sm">
              Le système vérifie automatiquement si le domaine est disponible et ajoute des suffixes si nécessaire.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Format Professionnel</h3>
            <p className="text-gray-600 text-sm">
              Obtenez un domaine au format nom-boutique.scalor.net, professionnel et mémorisable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoPage;
