import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, Plus, Trash2, RefreshCw, 
  CheckCircle, AlertCircle, Loader2, ExternalLink,
  Shield, Copy, Check
} from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

const WhatsAppConnexion = () => {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [testResults, setTestResults] = useState({}); // Store test results per instance
  const [usageStats, setUsageStats] = useState({}); // Store usage stats per instance

  // Form state
  const [formData, setFormData] = useState({
    instanceName: '',
    instanceToken: '',
    customName: '',
    defaultPart: 50
  });
  const [submitting, setSubmitting] = useState(false);
  const [linkResult, setLinkResult] = useState(null); // { verified, message, status }

  const user = JSON.parse(localStorage.getItem('ecomUser') || '{}');
  const userId = user._id || user.id;

  useEffect(() => {
    loadInstances();
  }, []);

  useEffect(() => {
    // Charger les stats d'utilisation pour toutes les instances
    instances.forEach(instance => {
      fetchUsageStats(instance._id);
    });
  }, [instances.length]);

  const loadInstances = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await ecomApi.get(`/v1/external/whatsapp/instances?userId=${userId}`);
      const data = response.data;
      
      if (data.success) {
        setInstances(data.instances || []);
      } else {
        setInstances([]);
      }
    } catch (err) {
      console.error('Erreur chargement instances:', err);
      setInstances([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshAllStatuses = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await ecomApi.post('/v1/external/whatsapp/refresh-status', { userId });
      const data = response.data;
      
      if (data.success) {
        setInstances(data.instances || []);
      }
    } catch (err) {
      console.error('Erreur refresh statuts:', err);
      setError('Erreur lors de la mise à jour des statuts');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const waStatusLabel = (status) => {
    if (status === 'connected') return { label: 'Connecté', dot: 'bg-green-500', text: 'text-green-700' };
    if (status === 'active') return { label: 'Actif', dot: 'bg-green-500', text: 'text-green-700' };
    if (status === 'configured') return { label: 'Configuré', dot: 'bg-blue-400', text: 'text-blue-600' };
    if (status === 'disconnected') return { label: 'Déconnecté', dot: 'bg-red-400', text: 'text-red-600' };
    return { label: 'Non vérifié', dot: 'bg-gray-300', text: 'text-gray-500' };
  };

  const handleLinkInstance = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setLinkResult(null);

    try {
      const response = await ecomApi.post('/v1/external/whatsapp/link', { userId, ...formData });
      const data = response.data;

      if (data.success) {
        setFormData({ instanceName: '', instanceToken: '', customName: '', defaultPart: 50 });
        setShowAddForm(false);
        setLinkResult({
          verified: data.verified,
          message: data.verificationMessage,
          status: data.data?.status
        });
        loadInstances();
      } else {
        setError(data.error || "Erreur lors de la liaison de l'instance");
      }
    } catch (err) {
      // Afficher les messages d'erreur clairs du backend
      const errorMessage = err.response?.data?.error || err.message || "Erreur de connexion au serveur";
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchUsageStats = async (instanceId) => {
    try {
      const response = await ecomApi.get(`/v1/external/whatsapp/instances/${instanceId}/usage?userId=${userId}`);
      const data = response.data;
      
      if (data.success) {
        setUsageStats(prev => ({
          ...prev,
          [instanceId]: data.usage
        }));
      }
    } catch (error) {
      console.error('Erreur récupération usage:', error);
    }
  };

  const testConnection = async (instance) => {
    setTestResults(prev => ({
      ...prev,
      [instance._id]: { loading: true, success: null, message: '' }
    }));

    try {
      // Appel réel à ZenChat API via le backend
      const response = await ecomApi.post('/v1/external/whatsapp/verify-instance', { instanceId: instance._id });
      const data = response.data;

      setTestResults(prev => ({
        ...prev,
        [instance._id]: {
          loading: false,
          success: data.success,
          message: data.success ? '✅ Connectée à WhatsApp via ZenChat API' : '❌ ' + (data.error || data.message),
          details: data.evolutionState ? `État ZenChat : ${data.evolutionState}` : null
        }
      }));

      // Mettre à jour le statut affiché localement
      if (data.status) {
        setInstances(prev => prev.map(inst =>
          inst._id === instance._id ? { ...inst, status: data.status } : inst
        ));
      }
      
      // Récupérer les stats d'utilisation après le test
      await fetchUsageStats(instance._id);
    } catch (error) {
      console.error('❌ Erreur test ZenChat API:', error);
      setTestResults(prev => ({
        ...prev,
        [instance._id]: {
          loading: false,
          success: false,
          message: '❌ Impossible de joindre le serveur',
          details: error.message
        }
      }));
    }
  };

  const deleteInstance = async (instance) => {
    if (!confirm(`Supprimer l'instance "${instance.customName || instance.instanceName}" ? Cette action est irréversible.`)) return;

    try {
      const response = await ecomApi.delete(`/v1/external/whatsapp/instances/${instance._id}?userId=${userId}`);
      const data = response.data;

      if (data.success) {
        setInstances(prev => prev.filter(i => i._id !== instance._id));
      } else {
        setError(data.error || 'Erreur lors de la suppression');
      }
    } catch (err) {
      // Afficher les messages d'erreur clairs du backend
      const errorMessage = err.response?.data?.error || err.message || "Erreur de connexion au serveur";
      setError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-green-600 flex items-center justify-center shadow-lg shadow-green-200">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Connexion WhatsApp</h1>
              <p className="text-gray-500 text-sm">Gérez vos instances ZenChat API</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-all shadow-md shadow-green-100 active:scale-95"
          >
            {showAddForm ? 'Annuler' : (
              <>
                <Plus className="w-5 h-5" />
                Lier une instance
              </>
            )}
          </button>
          
          <button
            onClick={refreshAllStatuses}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Sync...' : 'Rafraîchir'}
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nouvelle Instance ZenChat API</h2>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                Vous n'avez pas encore de compte ZenChat ? {' '}
                <a 
                  href="https://zechat.site/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-semibold underline hover:text-blue-900 inline-flex items-center gap-1"
                >
                  Inscrivez-vous gratuitement
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
            <form onSubmit={handleLinkInstance} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Nom de l'instance</label>
                <input
                  type="text"
                  name="instanceName"
                  value={formData.instanceName}
                  onChange={handleInputChange}
                  placeholder="ex: ma_boutique_wa"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Token ZenChat</label>
                <input
                  type="password"
                  name="instanceToken"
                  value={formData.instanceToken}
                  onChange={handleInputChange}
                  placeholder="Votre token secret"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Nom d'affichage (Optionnel)</label>
                <input
                  type="text"
                  name="customName"
                  value={formData.customName}
                  onChange={handleInputChange}
                  placeholder="ex: Support Client"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Part par défaut (%)</label>
                <input
                  type="number"
                  name="defaultPart"
                  value={formData.defaultPart}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none"
                />
                <p className="text-xs text-gray-500">Pourcentage de messages envoyés via cette instance (0-100)</p>
              </div>
              
              <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2.5 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {linkResult && (
          <div className={`mb-6 p-4 rounded-2xl flex items-start gap-3 border ${
            linkResult.verified && linkResult.status === 'connected'
              ? 'bg-green-50 border-green-100 text-green-700'
              : linkResult.verified
                ? 'bg-blue-50 border-blue-100 text-blue-700'
                : 'bg-amber-50 border-amber-100 text-amber-700'
          }`}>
            {linkResult.verified && linkResult.status === 'connected'
              ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            }
            <div>
              <p className="text-sm font-semibold">
                {linkResult.verified && linkResult.status === 'connected' ? 'Instance connectée !' : 'Instance enregistrée'}
              </p>
              <p className="text-xs mt-0.5 opacity-80">{linkResult.message}</p>
            </div>
            <button onClick={() => setLinkResult(null)} className="ml-auto text-current opacity-50 hover:opacity-100">×</button>
          </div>
        )}

        {/* Instances List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-green-600 animate-spin mb-4" />
            <p className="text-gray-500 font-medium">Chargement de vos instances...</p>
          </div>
        ) : instances.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-200">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Aucune instance connectée</h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-8">
              Connectez votre compte WhatsApp via ZenChat API pour commencer à envoyer des messages automatisés.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-8 py-3 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition-all shadow-lg shadow-green-100"
            >
              Lier ma première instance
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {instances.map((instance) => (
              <div key={instance._id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
                      <MessageCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{instance.customName || instance.instanceName}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2 h-2 rounded-full ${waStatusLabel(instance.status).dot}`}></span>
                        <span className={`text-xs font-bold uppercase tracking-wider ${waStatusLabel(instance.status).text}`}>
                          {waStatusLabel(instance.status).label}
                        </span>
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                          {instance.defaultPart || 50}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => deleteInstance(instance)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Supprimer cette instance"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                      <span>Nom technique</span>
                      <button 
                        onClick={() => copyToClipboard(instance.instanceName, instance._id + 'name')}
                        className="hover:text-green-600 transition-colors"
                      >
                        {copiedId === instance._id + 'name' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <p className="text-sm font-mono text-gray-700 truncate">{instance.instanceName}</p>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                      <span>Token d'accès</span>
                      <button 
                        onClick={() => copyToClipboard(instance.instanceToken, instance._id + 'token')}
                        className="hover:text-green-600 transition-colors"
                      >
                        {copiedId === instance._id + 'token' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <p className="text-sm font-mono text-gray-700 truncate">••••••••••••••••</p>
                  </div>

                  {/* Usage Statistics - HIDDEN */}
                  {false && usageStats[instance._id] && (
                    <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl space-y-3 border border-blue-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-900 uppercase tracking-widest">Consommation</span>
                        <span className="text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full font-bold">
                          {usageStats[instance._id].plan === 'free' ? 'Gratuit' : usageStats[instance._id].plan === 'premium' ? 'Premium' : 'Illimité'}
                        </span>
                      </div>
                      
                      {/* Daily Usage */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 font-medium">Aujourd'hui</span>
                          <span className="font-bold text-gray-900">
                            {usageStats[instance._id].dailyUsed} / {usageStats[instance._id].dailyLimit}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              usageStats[instance._id].dailyUsed >= usageStats[instance._id].dailyLimit 
                                ? 'bg-red-500' 
                                : usageStats[instance._id].dailyUsed / usageStats[instance._id].dailyLimit > 0.8 
                                  ? 'bg-orange-500' 
                                  : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, (usageStats[instance._id].dailyUsed / usageStats[instance._id].dailyLimit) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Monthly Usage */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 font-medium">Ce mois</span>
                          <span className="font-bold text-gray-900">
                            {usageStats[instance._id].monthlyUsed} / {usageStats[instance._id].monthlyLimit}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              usageStats[instance._id].monthlyUsed >= usageStats[instance._id].monthlyLimit 
                                ? 'bg-red-500' 
                                : usageStats[instance._id].monthlyUsed / usageStats[instance._id].monthlyLimit > 0.8 
                                  ? 'bg-orange-500' 
                                  : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, (usageStats[instance._id].monthlyUsed / usageStats[instance._id].monthlyLimit) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {usageStats[instance._id].limitExceeded && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-xs text-red-800 font-medium">
                            ⚠️ Limite atteinte. <a href="https://zechat.site/" target="_blank" rel="noopener noreferrer" className="underline font-bold">Passer au Premium</a>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                  <div className="text-xs text-gray-400">
                    Mis à jour {new Date(instance.updatedAt).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => testConnection(instance)}
                      disabled={testResults[instance._id]?.loading}
                      className="px-4 py-2 text-xs font-bold text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {testResults[instance._id]?.loading ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Test...
                        </>
                      ) : (
                        'Tester'
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Test Results */}
                {testResults[instance._id] && !testResults[instance._id]?.loading && (
                  <div className={`mt-3 p-3 rounded-lg text-xs ${
                    testResults[instance._id]?.success 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {testResults[instance._id]?.success ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <AlertCircle className="w-3 h-3" />
                      )}
                      <span className="font-medium">{testResults[instance._id]?.message}</span>
                    </div>
                    {testResults[instance._id]?.details && (
                      <p className="mt-1 text-xs opacity-80">{testResults[instance._id]?.details}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppConnexion;
