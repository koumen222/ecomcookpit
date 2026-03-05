import React, { useState, useEffect } from 'react';
import {
  X, Smartphone, Key, Globe, CheckCircle, AlertCircle, Loader2,
  MessageCircle, Send, QrCode, RefreshCw, ExternalLink, Copy,
  Shield, Clock, BarChart3
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://ecomcookpit-production-7a08.up.railway.app';

const WhatsAppConfigModal = ({ onClose, onConfigSaved }) => {
  const [step, setStep] = useState('config'); // 'config' | 'qr' | 'test' | 'success'
  const [config, setConfig] = useState({
    name: '',
    instanceId: '',
    apiKey: ''
  });
  const [currentConfig, setCurrentConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [testMessage, setTestMessage] = useState('');

  // Charger la configuration existante au montage
  useEffect(() => {
    loadCurrentConfig();
  }, []);

  const loadCurrentConfig = async () => {
    try {
      const token = localStorage.getItem('ecomToken');
      const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
      
      const response = await fetch(`${BACKEND_URL}/api/ecom/whatsapp-config`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Workspace-Id': workspace?._id || workspace?.id
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setCurrentConfig(data.config);
        if (data.config.isConfigured) {
          setConfig(prev => ({
            ...prev,
            phoneNumber: data.config.phoneNumber || ''
          }));
        }
      }
    } catch (err) {
      console.error('Erreur chargement config:', err);
    }
  };

  const handleSaveConfig = async () => {
    if (!config.name || !config.instanceId || !config.apiKey) {
      setError('Nom, Instance ID et clé API obligatoires');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const token = localStorage.getItem('ecomToken');
      const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
      
      const response = await fetch(`${BACKEND_URL}/api/ecom/whatsapp-instances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Workspace-Id': workspace?._id || workspace?.id
        },
        body: JSON.stringify(config)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
        setStep('success');
        
        // Réinitialiser le formulaire
        setConfig({ name: '', instanceId: '', apiKey: '' });
        
        if (onConfigSaved) {
          setTimeout(() => onConfigSaved(), 1500);
        }
      } else {
        setError(data.message || 'Erreur lors de la sauvegarde');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleTestMessage = async () => {
    if (!testMessage.trim()) {
      setError('Veuillez saisir un message de test');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('ecomToken');
      const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
      
      const response = await fetch(`${BACKEND_URL}/api/ecom/whatsapp-config/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Workspace-Id': workspace?._id || workspace?.id
        },
        body: JSON.stringify({
          phoneNumber: config.phoneNumber,
          message: testMessage
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Message envoyé avec succès !');
        setStep('success');
        await loadCurrentConfig();
      } else {
        setError(data.message || 'Erreur lors de l\'envoi');
      }
    } catch (err) {
      setError('Erreur lors de l\'envoi du message');
    } finally {
      setLoading(false);
    }
  };

  const handleRunTest = async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('ecomToken');
      const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
      
      const response = await fetch(`${BACKEND_URL}/api/ecom/whatsapp-config/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Workspace-Id': workspace?._id || workspace?.id
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Test réussi ! Votre WhatsApp est bien configuré.');
        setStep('success');
        await loadCurrentConfig();
      } else {
        setError(data.message || 'Échec du test');
      }
    } catch (err) {
      setError('Erreur lors du test');
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
              <h2 className="font-bold text-gray-900">ZeChat WhatsApp</h2>
              <p className="text-xs text-gray-500">Configuration rapide</p>
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
                <div className={`p-3 rounded-lg border ${
                  currentConfig.isConfigured && currentConfig.status === 'active'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {currentConfig.isConfigured && currentConfig.status === 'active' ? (
                      <CheckCircle className="w-3 h-3 text-green-600" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                    )}
                    <span className="text-xs font-semibold">
                      {currentConfig.isConfigured && currentConfig.status === 'active'
                        ? 'ZeChat connecté'
                        : 'Configuration requise'
                      }
                    </span>
                  </div>
                </div>
              )}

              {/* Formulaire de configuration */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    <MessageCircle className="w-3 h-3 inline mr-1" />
                    Nom de l'instance
                  </label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Mon WhatsApp Business"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    <Shield className="w-3 h-3 inline mr-1" />
                    Instance ID
                  </label>
                  <input
                    type="text"
                    value={config.instanceId}
                    onChange={(e) => setConfig(prev => ({ ...prev, instanceId: e.target.value }))}
                    placeholder="7103123456"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    <Key className="w-3 h-3 inline mr-1" />
                    Clé API
                  </label>
                  <input
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="Votre clé API..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Guide compact ZeChat */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-xs font-bold text-blue-900 mb-2">
                  📱 Configuration ZeChat
                </h4>
                <div className="text-xs text-blue-700 space-y-1">
                  <p>1. Compte sur <a href="https://servicewhstapps.pages.dev/dashboard/instances" target="_blank" rel="noopener noreferrer" className="underline font-semibold">servicewhstapps.pages.dev</a></p>
                  <p>2. Instance ID + Clé API → Prêt !</p>
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

              <button
                onClick={handleSaveConfig}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
              >
                {loading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCircle className="w-3 h-3" />
                )}
                Configurer ZeChat
              </button>
            </div>
          )}

          {/* Étape: QR Code */}
          {step === 'qr' && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto">
                <QrCode className="w-8 h-8 text-green-600" />
              </div>
              
              <div>
                <h3 className="font-bold text-lg text-gray-900 mb-2">Scannez le QR Code</h3>
                <p className="text-gray-600 text-sm">
                  Ouvrez WhatsApp sur votre téléphone et scannez ce QR Code pour connecter votre numéro
                </p>
              </div>

              {qrCodeUrl && (
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code WhatsApp"
                    className="w-48 h-48 mx-auto border border-gray-200 rounded-lg"
                    onError={() => setError('QR Code non disponible. Vérifiez votre configuration.')}
                  />
                  <button
                    onClick={() => window.open(qrCodeUrl, '_blank')}
                    className="mt-4 text-sm text-green-600 hover:text-green-700 flex items-center gap-1 mx-auto"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ouvrir dans un nouvel onglet
                  </button>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('config')}
                  className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition"
                >
                  Retour
                </button>
                <button
                  onClick={() => setStep('test')}
                  className="flex-1 py-2.5 px-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition"
                >
                  Continuer
                </button>
              </div>
            </div>
          )}

          {/* Étape: Test */}
          {step === 'test' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <Send className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Test ZeChat</h3>
                <p className="text-gray-600 text-xs">
                  Testez votre configuration
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Message de test
                </label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Saisissez votre message de test..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ce message sera envoyé à votre numéro WhatsApp configuré
                </p>
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

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleRunTest}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Test auto
                </button>
                <button
                  onClick={handleTestMessage}
                  disabled={loading || !testMessage.trim()}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Envoyer test
                </button>
              </div>

              <button
                onClick={() => setStep('config')}
                className="w-full py-2.5 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition"
              >
                Retour à la configuration
              </button>
            </div>
          )}

          {/* Étape: Succès */}
          {step === 'success' && (
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">ZeChat configuré !</h3>
                <p className="text-gray-600 text-xs">
                  Prêt pour vos campagnes marketing
                </p>
              </div>

              {currentConfig && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="block text-green-600 font-semibold">Numéro</span>
                      <span className="text-green-800">{currentConfig.phoneNumber}</span>
                    </div>
                    <div>
                      <span className="block text-green-600 font-semibold">Statut</span>
                      <span className="text-green-800">Actif</span>
                    </div>
                    <div>
                      <span className="block text-green-600 font-semibold">Messages</span>
                      <span className="text-green-800">{currentConfig.messagesSent}</span>
                    </div>
                    <div>
                      <span className="block text-green-600 font-semibold">Limite/jour</span>
                      <span className="text-green-800">{currentConfig.dailyLimit}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-2 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition text-sm"
              >
                Terminer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConfigModal;
