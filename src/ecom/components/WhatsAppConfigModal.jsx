import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Smartphone, Globe, CheckCircle, AlertCircle, Loader2,
  MessageCircle, Send, QrCode, RefreshCw, ExternalLink, Copy,
  Shield, Clock, BarChart3, Key
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://ecomcookpit-production-7a08.up.railway.app';

const WhatsAppConfigModal = ({ onClose, onConfigSaved }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState('config'); // 'config' | 'test' | 'success'
  const [config, setConfig] = useState({
    instanceName: '',
    instanceSecret: ''
  });
  const [currentConfig, setCurrentConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');

  // Charger la configuration existante au montage
  useEffect(() => {
    loadCurrentConfig();
  }, []);

  const getHeaders = () => {
    const token = localStorage.getItem('ecomToken');
    const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Workspace-Id': workspace?._id || workspace?.id
    };
  };

  const loadCurrentConfig = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/ecom/integrations/whatsapp/status`, {
        headers: getHeaders()
      });
      
      const data = await response.json();
      if (data.success && data.connected) {
        setCurrentConfig(data.whatsapp);
      }
    } catch (err) {
      console.error('Erreur chargement config:', err);
    }
  };

  const handleRegisterInstance = async () => {
    if (!config.instanceName || !config.instanceSecret) {
      setError('Nom d\'instance et secret obligatoires');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/ecom/integrations/whatsapp/register-instance`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          instanceName: config.instanceName,
          instanceSecret: config.instanceSecret
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
        setConfig({ instanceName: '', instanceSecret: '' });
        
        setTimeout(() => {
          if (onConfigSaved) onConfigSaved();
          if (onClose) onClose();
        }, 2000);
      } else {
        setError(data.error || 'Erreur lors de l\'enregistrement');
      }
    } catch (err) {
      setError('Erreur réseau lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    // Sauvegarder la configuration dans le workspace (sans secret pour sécurité)
    try {
      await fetch(`${BACKEND_URL}/api/ecom/integrations/whatsapp/connect`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          instanceName: config.instanceName,
          instanceId: config.instanceName, // Pour compatibilité avec le schéma existant
          apiKey: '' // On ne stocke plus le secret côté frontend
        })
      });
      
      if (onConfigSaved) onConfigSaved();
      if (onClose) onClose();
    } catch (err) {
      console.error('Erreur sauvegarde config:', err);
    }
  };

  const handleTestMessage = async () => {
    if (!testPhone.trim() || !testMessage.trim()) {
      setError('Numéro et message requis');
      return;
    }
    
    if (!config.instanceName || !config.instanceSecret) {
      setError('Configuration WhatsApp requise');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/ecom/integrations/whatsapp/send-message`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          instanceName: config.instanceName,
          instanceSecret: config.instanceSecret,
          phoneNumber: testPhone,
          message: testMessage
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Message test envoyé avec succès !');
        setStep('success');
      } else {
        setError(data.error || 'Erreur lors de l\'envoi');
      }
    } catch (err) {
      setError('Erreur lors de l\'envoi du message test');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Déconnecter WhatsApp de ce workspace ?')) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/ecom/integrations/whatsapp/disconnect`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setCurrentConfig(null);
        setSuccess('WhatsApp déconnecté');
      }
    } catch (err) {
      setError('Erreur déconnexion');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Connexion d'une instance WhatsApp</h2>
              <p className="text-xs text-gray-500">Connectez une instance WhatsApp créée sur Evolution API</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4">
          
          {/* Étape: Configuration */}
          {step === 'config' && (
            <div className="space-y-4">
              {/* Statut actuel */}
              {currentConfig && (
                <div className="p-3 rounded-lg border bg-green-50 border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      <span className="text-xs font-semibold text-green-800">
                        WhatsApp connecté — {currentConfig.instanceName || currentConfig.instanceId}
                      </span>
                    </div>
                    <button onClick={handleDisconnect} className="text-[10px] text-red-500 hover:text-red-700 underline">
                      Déconnecter
                    </button>
                  </div>
                </div>
              )}

              {/* Formulaire de configuration */}
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    Connectez votre instance WhatsApp avec son nom et son Instance ID.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    <MessageCircle className="w-3 h-3 inline mr-1" />
                    Nom de l'instance
                  </label>
                  <input
                    type="text"
                    value={config.instanceName}
                    onChange={(e) => setConfig(prev => ({ ...prev, instanceName: e.target.value }))}
                    placeholder="ALDI, Support, Marketing..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Nom de votre instance Evolution API</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    <Key className="w-3 h-3 inline mr-1" />
                    Secret de l'instance
                  </label>
                  <input
                    type="password"
                    value={config.instanceSecret}
                    onChange={(e) => setConfig(prev => ({ ...prev, instanceSecret: e.target.value }))}
                    placeholder="Clé API secrète de l'instance"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Secret unique de votre instance (non stocké)</p>
                </div>

              </div>

              {/* Guide compact ZeChat */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-xs font-bold text-blue-900 mb-2">
                  📱 Configuration Evolution API
                </h4>
                <div className="text-xs text-blue-700 space-y-1">
                  <p>1. Créez un compte sur <a href="https://api.ecomcookpit.site" target="_blank" rel="noopener noreferrer" className="underline font-semibold">api.ecomcookpit.site</a></p>
                  <p>2. Créez une instance</p>
                  <p>3. Récupérez le <strong>Nom de l'instance</strong></p>
                  <p>4. Copiez le <strong>Secret de l'instance</strong></p>
                  <p>5. Enregistrez ici pour l'utiliser dans les campagnes</p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  {success}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleRegisterInstance}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
                >
                  {loading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3 h-3" />
                  )}
                  Enregistrer l'instance
                </button>
                {currentConfig && (
                  <button
                    onClick={() => setStep('test')}
                    className="px-4 py-2 border border-green-300 text-green-700 font-medium rounded-lg hover:bg-green-50 transition text-sm"
                  >
                    Tester
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Étape: Test */}
          {step === 'test' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <Send className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Tester la connexion</h3>
                <p className="text-gray-600 text-xs">
                  Envoyez un message test pour vérifier que tout fonctionne
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Numéro de téléphone</label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="237675500956"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <p className="text-[10px] text-gray-500 mt-1">Format international sans + (ex: 237675500956)</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Message</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Bonjour, ceci est un test !"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                  rows={3}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  {success}
                </div>
              )}

              <button
                onClick={handleTestMessage}
                disabled={loading || !testPhone.trim() || !testMessage.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Envoyer message test
              </button>

              <button
                onClick={() => { setStep('config'); setError(''); setSuccess(''); }}
                className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                Retour
              </button>
            </div>
          )}

          {/* Étape: Succès */}
          {step === 'success' && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">WhatsApp connecté !</h3>
                <p className="text-gray-600 text-xs">
                  Votre instance est prête pour envoyer des campagnes.
                </p>
              </div>

              {currentConfig && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="block text-green-600 font-semibold">Instance</span>
                      <span className="text-green-800">{currentConfig.instanceName || currentConfig.instanceId}</span>
                    </div>
                    <div>
                      <span className="block text-green-600 font-semibold">Statut</span>
                      <span className="text-green-800">Connecté</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-2 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition text-sm"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConfigModal;
