import React, { useState, useEffect } from 'react';
import {
  X, Send, MessageCircle, User, Smartphone, Copy, CheckCircle,
  AlertCircle, Loader2, Settings, RotateCcw, Eye
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://ecomcookpit-production-7a08.up.railway.app';

const WhatsAppSendModal = ({ 
  onClose, 
  initialMessage = '', 
  initialPhone = '', 
  productData = null,
  onConfigNeeded 
}) => {
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [message, setMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [whatsappConfig, setWhatsappConfig] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Charger la configuration WhatsApp
  useEffect(() => {
    loadWhatsAppConfig();
  }, []);

  const loadWhatsAppConfig = async () => {
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
        setWhatsappConfig(data.config);
      }
    } catch (err) {
      console.error('Erreur chargement config WhatsApp:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!phoneNumber.trim() || !message.trim()) {
      setError('Numéro de téléphone et message requis');
      return;
    }

    if (!whatsappConfig?.isConfigured || whatsappConfig?.status !== 'active') {
      setError('Configuration WhatsApp requise');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

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
          phoneNumber: phoneNumber.trim(),
          message: message.trim(),
          productData
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Message envoyé avec succès à ${data.sentTo}`);
        // Réinitialiser le formulaire après succès
        setTimeout(() => {
          setPhoneNumber('');
          setMessage('');
          setSuccess('');
        }, 3000);
      } else {
        setError(data.message || 'Erreur lors de l\'envoi');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(message);
  };

  const formatMessage = () => {
    if (!productData) return message;
    
    return message
      .replace(/\[PRODUIT\]/g, productData.name || '[PRODUIT]')
      .replace(/\[PRIX\]/g, productData.price ? `${productData.price} XAF` : '[PRIX]')
      .replace(/\[LIEN\]/g, productData.link || '[LIEN]');
  };

  const previewMessage = formatMessage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Envoyer WhatsApp</h2>
              <p className="text-sm text-gray-500">Message marketing personnalisé</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Statut de configuration */}
          {whatsappConfig && (
            <div className={`p-4 rounded-xl border ${
              whatsappConfig.isConfigured && whatsappConfig.status === 'active'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {whatsappConfig.isConfigured && whatsappConfig.status === 'active' ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-800">
                        WhatsApp connecté ({whatsappConfig.phoneNumber})
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-semibold text-red-800">
                        Configuration requise
                      </span>
                    </>
                  )}
                </div>
                {(!whatsappConfig.isConfigured || whatsappConfig.status !== 'active') && (
                  <button
                    onClick={onConfigNeeded}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Settings className="w-3 h-3" />
                    Configurer
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Numéro de téléphone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Smartphone className="w-4 h-4 inline mr-1" />
              Numéro du destinataire
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="237123456789"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Format international sans + (ex: 237123456789)
            </p>
          </div>

          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">
                <MessageCircle className="w-4 h-4 inline mr-1" />
                Message WhatsApp
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  {previewMode ? 'Éditer' : 'Aperçu'}
                </button>
                <button
                  onClick={copyMessage}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  Copier
                </button>
              </div>
            </div>
            
            {previewMode ? (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl min-h-[120px] text-sm text-gray-800 whitespace-pre-wrap">
                {previewMessage || 'Aperçu du message...'}
              </div>
            ) : (
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Saisissez votre message WhatsApp..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                rows={6}
              />
            )}
            
            {productData && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-semibold text-blue-800 mb-1">Variables disponibles:</p>
                <div className="text-xs text-blue-700 space-y-1">
                  <p><code className="bg-blue-100 px-1 rounded">[PRODUIT]</code> → {productData.name || 'Non défini'}</p>
                  <p><code className="bg-blue-100 px-1 rounded">[PRIX]</code> → {productData.price ? `${productData.price} XAF` : 'Non défini'}</p>
                  <p><code className="bg-blue-100 px-1 rounded">[LIEN]</code> → {productData.link ? 'Lien défini' : 'Non défini'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Messages d'état */}
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

          {/* Boutons d'action */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              onClick={handleSendMessage}
              disabled={loading || !phoneNumber.trim() || !message.trim() || !whatsappConfig?.isConfigured}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Envoyer
            </button>
          </div>

          {/* Info */}
          <div className="text-xs text-gray-500 text-center">
            Le message sera envoyé depuis votre numéro WhatsApp configuré
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppSendModal;
