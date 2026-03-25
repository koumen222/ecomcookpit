import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';
import { Bot, Settings, Package, CheckCircle, AlertCircle, ArrowRight, Plus, Trash2, X } from 'lucide-react';

export default function AgentIAList() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentDescription, setNewAgentDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const res = await ecomApi.get('/agents');
      if (res.data.success) {
        setAgents(res.data.agents || []);
      }
      setError(null);
    } catch (err) {
      console.error('Erreur chargement agents:', err);
      setError('Impossible de charger les agents');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) {
      setError('Le nom de l\'agent est requis');
      return;
    }

    try {
      setCreating(true);
      const res = await ecomApi.post('/agents', {
        name: newAgentName,
        type: 'whatsapp',
        description: newAgentDescription,
      });

      if (res.data.success) {
        setAgents([...agents, res.data.agent]);
        setShowCreateModal(false);
        setNewAgentName('');
        setNewAgentDescription('');
        setError(null);
      }
    } catch (err) {
      console.error('Erreur création agent:', err);
      setError('Impossible de créer l\'agent');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!window.confirm('Êtes-vous sûr ? Cela supprimera l\'agent et sa configuration.')) {
      return;
    }

    try {
      setDeleting(agentId);
      const res = await ecomApi.delete(`/agents/${agentId}`);

      if (res.data.success) {
        setAgents(agents.filter(a => a._id !== agentId));
        setError(null);
      }
    } catch (err) {
      console.error('Erreur suppression agent:', err);
      setError('Impossible de supprimer l\'agent');
    } finally {
      setDeleting(null);
    }
  };

  const handleConfigure = (agent) => {
    navigate('/ecom/whatsapp/agent-config', { state: { agent } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Bot className="w-12 h-12 text-emerald-600 mx-auto" />
          </div>
          <p className="text-gray-600">Chargement des agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="mb-12 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Bot className="w-8 h-8 text-emerald-600" />
            <h1 className="text-4xl font-bold text-gray-900">Agent IA</h1>
          </div>
          <p className="text-lg text-gray-600">Gère tes agents IA pour vendre et supporter automatiquement</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          Créer un agent
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8 text-red-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {agents.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center">
          <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-6">Aucun agent créé</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Créer ton premier agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {agents.map((agent) => (
            <div
              key={agent._id}
              className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all border border-gray-200 overflow-hidden"
            >
              {/* Header de la carte */}
              <div className={`h-2 ${agent.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'}`} />

              <div className="p-8">
                {/* Titre et statut */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <Bot className="w-8 h-8 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{agent.name}</h2>
                      <p className="text-sm text-gray-500">{agent.type === 'whatsapp' ? 'WhatsApp IA' : agent.type}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {agent.status === 'active' ? (
                      <div className="flex items-center gap-1 px-3 py-1 bg-emerald-50 rounded-full">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-700">Actif</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-3 py-1 bg-gray-50 rounded-full">
                        <AlertCircle className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-semibold text-gray-700">Inactif</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                {agent.description && (
                  <p className="text-gray-600 mb-6">{agent.description}</p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-emerald-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold mb-2">
                      <Package className="w-4 h-4" />
                      Produits
                    </div>
                    <p className="text-2xl font-bold text-emerald-900">{agent.productsCount || 0}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-blue-700 font-semibold mb-2">
                      <Bot className="w-4 h-4" />
                      Instance
                    </div>
                    <p className="text-sm text-blue-900">
                      {agent.instanceId ? '✅ Connectée' : '⚠️ À configurer'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleConfigure(agent)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Settings className="w-5 h-5" />
                    Configurer
                  </button>
                  <button
                    onClick={() => handleDeleteAgent(agent._id)}
                    disabled={deleting === agent._id}
                    className="px-4 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Création */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Créer un nouvel agent</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nom de l'agent *
                </label>
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="Ex: Rita, Maya, Assistant..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description (optionnel)
                </label>
                <textarea
                  value={newAgentDescription}
                  onChange={(e) => setNewAgentDescription(e.target.value)}
                  placeholder="Brève description du rôle de cet agent..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  disabled={creating}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateAgent}
                disabled={creating || !newAgentName.trim()}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? '⏳ Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer info */}
      {agents.length > 0 && (
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <p className="text-blue-900">
            💡 <strong>Astuce :</strong> Clique sur "Configurer" pour gérer les produits, messages et paramètres de ton agent IA.
          </p>
        </div>
      )}
    </div>
  );
}
