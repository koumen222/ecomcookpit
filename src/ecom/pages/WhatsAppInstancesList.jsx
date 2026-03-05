import React, { useState, useEffect } from 'react';
import {
  MessageCircle, Plus, Edit, Trash2, Eye, EyeOff,
  Shield, Globe, Clock, CheckCircle, AlertCircle,
  RefreshCw, Settings, ExternalLink
} from 'lucide-react';
import WhatsAppConfigModal from '../components/WhatsAppConfigModal.jsx';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://ecomcookpit-production-7a08.up.railway.app';

const WhatsAppInstancesList = () => {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showApiKey, setShowApiKey] = useState({});

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('ecomToken');
      const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
      
      const response = await fetch(`${BACKEND_URL}/api/ecom/whatsapp-instances`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Workspace-Id': workspace?._id || workspace?.id
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setInstances(data.instances || []);
      } else {
        setError(data.message || 'Erreur lors du chargement');
      }
    } catch (err) {
      console.error('Erreur chargement instances:', err);
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInstance = async (instanceId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette instance WhatsApp ?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('ecomToken');
      const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
      
      const response = await fetch(`${BACKEND_URL}/api/ecom/whatsapp-instances/${instanceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Workspace-Id': workspace?._id || workspace?.id
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadInstances(); // Recharger la liste
      } else {
        setError(data.message || 'Erreur lors de la suppression');
      }
    } catch (err) {
      console.error('Erreur suppression instance:', err);
      setError('Erreur de connexion au serveur');
    }
  };

  const toggleApiKeyVisibility = (instanceId) => {
    setShowApiKey(prev => ({
      ...prev,
      [instanceId]: !prev[instanceId]
    }));
  };

  const handleInstanceCreated = () => {
    setShowCreateModal(false);
    loadInstances(); // Recharger la liste après création
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'inactive':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-3" />
            <span className="text-gray-500">Chargement des instances...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Instances WhatsApp</h1>
              <p className="text-gray-600">Gérez vos connexions WhatsApp Business</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nouvelle instance
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total instances</p>
                <p className="text-2xl font-bold text-gray-900">{instances.length}</p>
              </div>
              <Settings className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Actives</p>
                <p className="text-2xl font-bold text-green-600">
                  {instances.filter(i => i.status === 'active').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Messages envoyés</p>
                <p className="text-2xl font-bold text-blue-600">
                  {instances.reduce((acc, i) => acc + (i.messagesSent || 0), 0)}
                </p>
              </div>
              <MessageCircle className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Instances List */}
        {instances.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border">
            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucune instance WhatsApp
            </h3>
            <p className="text-gray-600 mb-6">
              Créez votre première instance WhatsApp pour commencer à envoyer des messages
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Plus className="w-4 h-4" />
              Créer une instance
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {instances.map((instance) => (
              <div key={instance._id} className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition">
                
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{instance.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusIcon(instance.status)}
                        <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(instance.status)}`}>
                          {instance.status === 'active' ? 'Actif' : 
                           instance.status === 'inactive' ? 'Inactif' : 'Erreur'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteInstance(instance._id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Shield className="w-4 h-4" />
                      <span>Instance ID</span>
                    </div>
                    <span className="font-mono text-gray-900">{instance.instanceId}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Globe className="w-4 h-4" />
                      <span>API URL</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900">{instance.apiUrl || 'servicewhstapps.pages.dev'}</span>
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <MessageCircle className="w-4 h-4" />
                      <span>Messages envoyés</span>
                    </div>
                    <span className="font-semibold text-gray-900">{instance.messagesSent || 0}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>Créé le</span>
                    </div>
                    <span className="text-gray-900">{formatDate(instance.createdAt)}</span>
                  </div>

                  {instance.lastUsed && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>Dernière utilisation</span>
                      </div>
                      <span className="text-gray-900">{formatDate(instance.lastUsed)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de création */}
      {showCreateModal && (
        <WhatsAppConfigModal
          onClose={() => setShowCreateModal(false)}
          onConfigSaved={handleInstanceCreated}
        />
      )}
    </div>
  );
};

export default WhatsAppInstancesList;
