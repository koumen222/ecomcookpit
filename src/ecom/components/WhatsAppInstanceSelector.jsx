import React, { useState, useEffect } from 'react';
import { Smartphone, Check, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import ecomApi from '../services/ecommApi.js';
// WhatsAppConfigModal supprimé

const WhatsAppInstanceSelector = ({ onInstanceSelected, selectedInstanceId }) => {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(false); // États config WhatsApp
  const [waConfig, setWaConfig] = useState(null);
  const [showWhatsAppConfig, setShowWhatsAppConfig] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [showInstanceSelector, setShowInstanceSelector] = useState(false);
  const [error, setError] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const loadInstances = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('ecomUser') || '{}');
      const userId = user._id || user.id;
      
      const response = await ecomApi.get(`/v1/external/whatsapp/instances?userId=${userId}`);
      if (response.data.success) {
        setInstances(response.data.instances);
      }
    } catch (err) {
      setError('Erreur chargement des instances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
  }, []);

  const handleInstanceSelect = (instance) => {
    onInstanceSelected(instance);
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-4 h-4 animate-spin text-gray-400 mr-2" />
          <span className="text-sm text-gray-500">Chargement...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-4">
        <div className="flex items-center text-red-600">
          <AlertCircle className="w-4 h-4 mr-2" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4" data-instance-selector>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
          <Smartphone className="w-4 h-4 mr-2" />
          Instance WhatsApp
        </h3>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition flex items-center"
        >
          <Plus className="w-3 h-3 mr-1" />
          Nouvelle
        </button>
      </div>

      {instances.length === 0 ? (
        <div className="text-center py-6">
          <Smartphone className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-3">Aucune instance enregistrée</p>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="text-xs bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition"
          >
            Enregistrer une instance
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {instances.map((instance) => (
            <div
              key={instance._id}
              onClick={() => handleInstanceSelect(instance)}
              className={`p-3 border rounded-lg cursor-pointer transition ${
                selectedInstanceId === instance._id
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Smartphone className="w-4 h-4 text-gray-400 mr-2" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{instance.name}</div>
                    <div className="text-xs text-gray-500">{instance.instanceId}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    instance.status === 'active' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {instance.status === 'active' ? 'Actif' : 'Inactif'}
                  </span>
                  {selectedInstanceId === instance._id && (
                    <Check className="w-4 h-4 text-green-600" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal d'enregistrement supprimé - rediriger vers la page de connexion */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-bold mb-4">Configuration requise</h2>
            <p className="text-gray-600 mb-6 text-sm">Veuillez configurer vos instances dans la page "Connexion WhatsApp" de la barre latérale.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowRegisterModal(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg">Fermer</button>
              <a href="/ecom/whatsapp/connexion" className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-center">Y aller</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppInstanceSelector;
