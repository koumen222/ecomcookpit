import React, { useState, useEffect } from 'react';
import ecomApi from '../services/ecommApi.js';

const CampaignCountryModal = ({ campaign, isOpen, onClose, onSend }) => {
  const [activeTab, setActiveTab] = useState('analyze');
  const [loading, setLoading] = useState(false);
  const [countryAnalysis, setCountryAnalysis] = useState(null);
  const [includeCountries, setIncludeCountries] = useState([]);
  const [excludeCountries, setExcludeCountries] = useState([]);
  const [sendStrategy, setSendStrategy] = useState('all');
  const [priorityCountries, setPriorityCountries] = useState([]);
  const [delayBetweenCountries, setDelayBetweenCountries] = useState(5);
  const [whatsappInstances, setWhatsappInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [sending, setSending] = useState(false);

  // Liste des pays africains prioritaires
  const priorityCountryOptions = [
    { code: 'CM', name: 'Cameroun', prefix: '+237' },
    { code: 'CI', name: 'Côte d\'Ivoire', prefix: '+225' },
    { code: 'SN', name: 'Sénégal', prefix: '+221' },
    { code: 'ML', name: 'Mali', prefix: '+223' },
    { code: 'BF', name: 'Burkina Faso', prefix: '+226' },
    { code: 'NE', name: 'Niger', prefix: '+227' },
    { code: 'TG', name: 'Togo', prefix: '+228' },
    { code: 'BJ', name: 'Bénin', prefix: '+229' },
    { code: 'GA', name: 'Gabon', prefix: '+241' },
    { code: 'CG', name: 'Congo', prefix: '+242' },
    { code: 'CD', name: 'RDC', prefix: '+243' },
    { code: 'FR', name: 'France', prefix: '+33' },
    { code: 'BE', name: 'Belgique', prefix: '+32' },
    { code: 'CH', name: 'Suisse', prefix: '+41' },
    { code: 'MA', name: 'Maroc', prefix: '+212' },
    { code: 'DZ', name: 'Algérie', prefix: '+213' },
    { code: 'TN', name: 'Tunisie', prefix: '+216' },
    { code: 'US', name: 'États-Unis', prefix: '+1' }
  ];

  useEffect(() => {
    if (isOpen && campaign) {
      fetchCountryAnalysis();
      fetchWhatsappInstances();
    }
  }, [isOpen, campaign]);

  const fetchCountryAnalysis = async () => {
    setLoading(true);
    try {
      const res = await ecomApi.post(`/campaigns/${campaign._id}/analyze-countries`, {
        includeCountries: includeCountries.length > 0 ? includeCountries : undefined,
        excludeCountries: excludeCountries.length > 0 ? excludeCountries : undefined
      });
      setCountryAnalysis(res.data.data);
    } catch (error) {
      console.error('Erreur analyse pays:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWhatsappInstances = async () => {
    try {
      const res = await ecomApi.get('/orders/whatsapp-instances');
      const instances = (res.data.data || []).filter(i => i.isConnected || i.status === 'connected' || i.status === 'active');
      setWhatsappInstances(instances);
      if (instances.length > 0) {
        setSelectedInstance(instances[0]._id);
      }
    } catch (error) {
      console.error('Erreur instances WhatsApp:', error);
    }
  };

  const handleCountryToggle = (countryCode, type) => {
    if (type === 'include') {
      setIncludeCountries(prev => 
        prev.includes(countryCode) 
          ? prev.filter(c => c !== countryCode)
          : [...prev, countryCode]
      );
    } else {
      setExcludeCountries(prev => 
        prev.includes(countryCode) 
          ? prev.filter(c => c !== countryCode)
          : [...prev, countryCode]
      );
    }
  };

  const handlePriorityToggle = (countryCode) => {
    setPriorityCountries(prev => 
      prev.includes(countryCode) 
        ? prev.filter(c => c !== countryCode)
        : [...prev, countryCode]
    );
  };

  const handleSendByCountry = async () => {
    if (!selectedInstance) {
      alert('Veuillez sélectionner une instance WhatsApp');
      return;
    }

    setSending(true);
    try {
      const res = await ecomApi.post(`/campaigns/${campaign._id}/send-by-country`, {
        whatsappInstanceId: selectedInstance,
        includeCountries: includeCountries.length > 0 ? includeCountries : undefined,
        excludeCountries: excludeCountries.length > 0 ? excludeCountries : undefined,
        sendStrategy,
        priorityCountries: sendStrategy === 'priority' ? priorityCountries : undefined,
        delayBetweenCountries
      });

      alert(`Campagne envoyée avec succès ! ${res.data.data.totalSent} messages envoyés, ${res.data.data.totalFailed} échecs.`);
      onClose();
      if (onSend) onSend(res.data.data);
    } catch (error) {
      console.error('Erreur envoi par pays:', error);
      alert(error.response?.data?.message || 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  const getCountryStats = () => {
    if (!countryAnalysis?.countries) return [];
    
    return Object.entries(countryAnalysis.countries).map(([code, data]) => ({
      code,
      ...data,
      included: includeCountries.includes(code),
      excluded: excludeCountries.includes(code),
      priority: priorityCountries.includes(code)
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Envoi par pays - {campaign?.name}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Analysez et envoyez votre campagne en fonction des indicatifs pays
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('analyze')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'analyze'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📊 Analyse par pays
            </button>
            <button
              onClick={() => setActiveTab('configure')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'configure'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              ⚙️ Configuration
            </button>
            <button
              onClick={() => setActiveTab('send')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'send'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🚀 Envoyer
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          ) : (
            <>
              {activeTab === 'analyze' && (
                <div className="space-y-6">
                  {/* Résumé */}
                  {countryAnalysis?.overview && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <h3 className="font-medium text-emerald-900 mb-3">Résumé de l'analyse</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-2xl font-bold text-emerald-600">
                            {countryAnalysis.overview.totalRecipients}
                          </div>
                          <div className="text-sm text-emerald-700">Total destinataires</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-emerald-600">
                            {countryAnalysis.overview.validRecipients}
                          </div>
                          <div className="text-sm text-emerald-700">Numéros valides</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-emerald-600">
                            {countryAnalysis.overview.countryCount}
                          </div>
                          <div className="text-sm text-emerald-700">Pays concernés</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-emerald-600">
                            {Math.round((countryAnalysis.overview.validRecipients / countryAnalysis.overview.totalRecipients) * 100)}%
                          </div>
                          <div className="text-sm text-emerald-700">Taux de validité</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pays */}
                  {getCountryStats().length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-900 mb-3">Répartition par pays</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pays</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destinataires</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pourcentage</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inclure</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exclure</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {getCountryStats().map((country) => (
                              <tr key={country.code}>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <span className="font-medium">{country.countryName}</span>
                                    <span className="ml-2 text-sm text-gray-500">({country.prefix})</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm font-medium">{country.recipientCount}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm text-gray-500">{country.percentage}%</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <input
                                    type="checkbox"
                                    checked={country.included}
                                    onChange={() => handleCountryToggle(country.code, 'include')}
                                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <input
                                    type="checkbox"
                                    checked={country.excluded}
                                    onChange={() => handleCountryToggle(country.code, 'exclude')}
                                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Recommandations */}
                  {countryAnalysis?.recommendations?.length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-900 mb-3">Recommandations</h3>
                      <div className="space-y-2">
                        {countryAnalysis.recommendations.map((rec, index) => (
                          <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm text-blue-800">💡 {rec}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'configure' && (
                <div className="space-y-6">
                  {/* Instance WhatsApp */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Instance WhatsApp
                    </label>
                    <select
                      value={selectedInstance}
                      onChange={(e) => setSelectedInstance(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">Sélectionner une instance</option>
                      {whatsappInstances.map((instance) => (
                        <option key={instance._id} value={instance._id}>
                          {instance.customName || instance.instanceName} - {instance.status}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Stratégie d'envoi */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stratégie d'envoi
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="all"
                          checked={sendStrategy === 'all'}
                          onChange={(e) => setSendStrategy(e.target.value)}
                          className="mr-2"
                        />
                        <span className="text-sm">Envoyer à tous les pays (ordre par nombre décroissant)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="priority"
                          checked={sendStrategy === 'priority'}
                          onChange={(e) => setSendStrategy(e.target.value)}
                          className="mr-2"
                        />
                        <span className="text-sm">Ordre prioritaire (sélectionner les pays ci-dessous)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="sequential"
                          checked={sendStrategy === 'sequential'}
                          onChange={(e) => setSendStrategy(e.target.value)}
                          className="mr-2"
                        />
                        <span className="text-sm">Séquentiel (un par un dans l'ordre)</span>
                      </label>
                    </div>
                  </div>

                  {/* Pays prioritaires */}
                  {sendStrategy === 'priority' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ordre prioritaire des pays
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {priorityCountryOptions.map((country) => (
                          <label key={country.code} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={priorityCountries.includes(country.code)}
                              onChange={() => handlePriorityToggle(country.code)}
                              className="mr-2 h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                            />
                            <span className="text-sm">
                              {country.name} ({country.prefix})
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Délai entre pays */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Délai entre les pays (secondes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={delayBetweenCountries}
                      onChange={(e) => setDelayBetweenCountries(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Pause recommandée pour éviter les limitations anti-spam (5-30s)
                    </p>
                  </div>

                  {/* Filtres actifs */}
                  {(includeCountries.length > 0 || excludeCountries.length > 0) && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Filtres actifs</h4>
                      {includeCountries.length > 0 && (
                        <div className="mb-2">
                          <span className="text-sm font-medium text-emerald-600">Pays inclus ({includeCountries.length}):</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {includeCountries.map(code => {
                              const country = priorityCountryOptions.find(c => c.code === code);
                              return (
                                <span key={code} className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded">
                                  {country?.name || code}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {excludeCountries.length > 0 && (
                        <div>
                          <span className="text-sm font-medium text-red-600">Pays exclus ({excludeCountries.length}):</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {excludeCountries.map(code => {
                              const country = priorityCountryOptions.find(c => c.code === code);
                              return (
                                <span key={code} className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                                  {country?.name || code}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'send' && (
                <div className="space-y-6">
                  {/* Résumé de l'envoi */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="font-medium text-yellow-900 mb-3">Résumé de l'envoi</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-yellow-800">Instance WhatsApp:</span>
                        <span className="text-sm font-medium">
                          {whatsappInstances.find(i => i._id === selectedInstance)?.customName || 'Non sélectionnée'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-yellow-800">Stratégie:</span>
                        <span className="text-sm font-medium">
                          {sendStrategy === 'all' ? 'Tous les pays' : 
                           sendStrategy === 'priority' ? 'Ordre prioritaire' : 'Séquentiel'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-yellow-800">Délai entre pays:</span>
                        <span className="text-sm font-medium">{delayBetweenCountries}s</span>
                      </div>
                      {countryAnalysis?.filteredSummary && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm text-yellow-800">Destinataires filtrés:</span>
                            <span className="text-sm font-medium">{countryAnalysis.filteredSummary.validRecipients}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-yellow-800">Pays concernés:</span>
                            <span className="text-sm font-medium">{Object.keys(countryAnalysis.filteredCountries || {}).length}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Confirmation */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-medium text-red-900 mb-2">⚠️ Confirmation requise</h3>
                    <p className="text-sm text-red-800 mb-3">
                      Vous allez envoyer cette campagne à {countryAnalysis?.filteredSummary?.validRecipients || countryAnalysis?.overview?.validRecipients} destinataires 
                      répartis dans {Object.keys(countryAnalysis?.filteredCountries || countryAnalysis?.countries || {}).length} pays.
                    </p>
                    <p className="text-sm text-red-800">
                      Cette action est irréversible. Les messages seront envoyés immédiatement.
                    </p>
                  </div>

                  {/* Bouton d'envoi */}
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSendByCountry}
                      disabled={sending || !selectedInstance}
                      className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? (
                        <>
                          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Envoi en cours...
                        </>
                      ) : (
                        '🚀 Envoyer par pays'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignCountryModal;
