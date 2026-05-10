import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export default function RitaPerformance() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [previewContacts, setPreviewContacts] = useState([]);

  // Formulaire de nouvelle campagne
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    followUpMessage: '',
    filters: {
      targetStatus: [],
      minInactiveDays: 3,
      maxInactiveDays: null,
      hasOrdered: null,
      specificProducts: [],
      tags: [],
      excludeRecentFollowUp: 7,
    },
    delayBetweenMessages: 15,
    maxMessagesPerDay: 50,
    useAI: false,
  });

  useEffect(() => {
    loadStats();
    loadCampaigns();
  }, []);

  const loadStats = async () => {
    try {
      const response = await api.get('/ecom/rita/performance', {
        params: { userId: user._id }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = async () => {
    try {
      const response = await api.get('/ecom/rita/followup/campaigns', {
        params: { userId: user._id }
      });
      setCampaigns(response.data);
    } catch (error) {
      console.error('Erreur chargement campagnes:', error);
    }
  };

  const previewCampaign = async () => {
    try {
      const response = await api.post('/ecom/rita/followup/preview', {
        userId: user._id,
        filters: campaignForm.filters
      });
      setPreviewContacts(response.data.contacts);
      alert(`${response.data.count} contacts seront ciblés par cette campagne`);
    } catch (error) {
      console.error('Erreur preview:', error);
      alert('Erreur lors de la prévisualisation');
    }
  };

  const createCampaign = async () => {
    if (!campaignForm.name || !campaignForm.followUpMessage) {
      alert('Nom et message de relance requis');
      return;
    }

    try {
      await api.post('/ecom/rita/followup/campaigns', {
        userId: user._id,
        ...campaignForm
      });
      alert('Campagne créée avec succès !');
      setShowNewCampaign(false);
      loadCampaigns();
      // Reset form
      setCampaignForm({
        name: '',
        followUpMessage: '',
        filters: {
          targetStatus: [],
          minInactiveDays: 3,
          maxInactiveDays: null,
          hasOrdered: null,
          specificProducts: [],
          tags: [],
          excludeRecentFollowUp: 7,
        },
        delayBetweenMessages: 15,
        maxMessagesPerDay: 50,
        useAI: false,
      });
    } catch (error) {
      console.error('Erreur création campagne:', error);
      alert('Erreur lors de la création de la campagne');
    }
  };

  const startCampaign = async (campaignId) => {
    if (!confirm('Êtes-vous sûr de vouloir démarrer cette campagne ?')) return;

    try {
      await api.post(`/ecom/rita/followup/campaigns/${campaignId}/start`);
      alert('Campagne démarrée !');
      loadCampaigns();
    } catch (error) {
      console.error('Erreur démarrage:', error);
      alert('Erreur lors du démarrage de la campagne');
    }
  };

  const pauseCampaign = async (campaignId) => {
    try {
      await api.post(`/ecom/rita/followup/campaigns/${campaignId}/pause`);
      alert('Campagne mise en pause');
      loadCampaigns();
    } catch (error) {
      console.error('Erreur pause:', error);
      alert('Erreur lors de la mise en pause');
    }
  };

  const deleteCampaign = async (campaignId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette campagne ?')) return;

    try {
      await api.delete(`/ecom/rita/followup/campaigns/${campaignId}`);
      alert('Campagne supprimée');
      loadCampaigns();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">📊 Performance Rita & Relances</h1>

      {/* Statistiques de performance */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">👥 Contacts</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total</span>
                <span className="font-bold">{stats.contacts.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Prospects</span>
                <span className="font-bold text-yellow-600">{stats.contacts.prospects}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Clients</span>
                <span className="font-bold text-green-600">{stats.contacts.clients}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Programmés</span>
                <span className="font-bold text-blue-600">{stats.contacts.scheduled}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">📦 Commandes</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total</span>
                <span className="font-bold">{stats.orders.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">En attente</span>
                <span className="font-bold text-orange-600">{stats.orders.pending}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Acceptées</span>
                <span className="font-bold text-blue-600">{stats.orders.accepted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Livrées</span>
                <span className="font-bold text-green-600">{stats.orders.delivered}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Programmées</span>
                <span className="font-bold text-purple-600">{stats.orders.scheduled}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">💰 Ventes</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total ventes</span>
                <span className="font-bold text-green-600">{stats.sales.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Revenu</span>
                <span className="font-bold">{stats.sales.revenue.toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Taux conversion</span>
                <span className="font-bold text-blue-600">{stats.sales.conversionRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Commande → Vente</span>
                <span className="font-bold text-purple-600">{stats.sales.orderToSaleRate}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campagnes de relance */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">📢 Campagnes de relance</h2>
          <button
            onClick={() => setShowNewCampaign(!showNewCampaign)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
          >
            {showNewCampaign ? 'Annuler' : '+ Nouvelle campagne'}
          </button>
        </div>

        {/* Formulaire nouvelle campagne */}
        {showNewCampaign && (
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">Créer une campagne de relance</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de la campagne *
                </label>
                <input
                  type="text"
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="Ex: Relance prospects inactifs mars 2026"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message de relance *
                </label>
                <textarea
                  value={campaignForm.followUpMessage}
                  onChange={(e) => setCampaignForm({ ...campaignForm, followUpMessage: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 h-32"
                  placeholder="Salut ! On a remarqué que tu n'as pas finalisé ta commande. Tu as besoin d'aide ?"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Variables disponibles: {'{nom}'}, {'{ville}'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cibler
                  </label>
                  <select
                    multiple
                    value={campaignForm.filters.targetStatus}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setCampaignForm({
                        ...campaignForm,
                        filters: { ...campaignForm.filters, targetStatus: selected }
                      });
                    }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  >
                    <option value="prospect">Prospects</option>
                    <option value="client">Clients</option>
                    <option value="scheduled">Programmés</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Inactivité (jours min)
                  </label>
                  <input
                    type="number"
                    value={campaignForm.filters.minInactiveDays}
                    onChange={(e) => setCampaignForm({
                      ...campaignForm,
                      filters: { ...campaignForm.filters, minInactiveDays: parseInt(e.target.value) }
                    })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Délai entre messages (minutes)
                  </label>
                  <input
                    type="number"
                    value={campaignForm.delayBetweenMessages}
                    onChange={(e) => setCampaignForm({ ...campaignForm, delayBetweenMessages: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    min="5"
                    max="60"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Messages max/jour
                  </label>
                  <input
                    type="number"
                    value={campaignForm.maxMessagesPerDay}
                    onChange={(e) => setCampaignForm({ ...campaignForm, maxMessagesPerDay: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    min="1"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={campaignForm.useAI}
                  onChange={(e) => setCampaignForm({ ...campaignForm, useAI: e.target.checked })}
                  className="rounded"
                />
                <label className="text-sm text-gray-700">
                  Personnaliser les messages avec l'IA
                </label>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={previewCampaign}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition"
                >
                  👁️ Prévisualiser
                </button>
                <button
                  onClick={createCampaign}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg transition"
                >
                  ✅ Créer la campagne
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Liste des campagnes */}
        <div className="space-y-4">
          {campaigns.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucune campagne pour le moment</p>
          ) : (
            campaigns.map((campaign) => (
              <div key={campaign._id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-lg">{campaign.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{campaign.followUpMessage.substring(0, 100)}...</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    campaign.status === 'active' ? 'bg-green-100 text-green-800' :
                    campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                    campaign.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {campaign.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
                  <div>
                    <span className="text-gray-600">Ciblés:</span>
                    <span className="font-bold ml-2">{campaign.targetedCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Envoyés:</span>
                    <span className="font-bold ml-2">{campaign.sentCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Réponses:</span>
                    <span className="font-bold ml-2">{campaign.respondedCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Délai:</span>
                    <span className="font-bold ml-2">{campaign.delayBetweenMessages}min</span>
                  </div>
                </div>

                <div className="flex space-x-2 mt-4">
                  {campaign.status === 'draft' && (
                    <button
                      onClick={() => startCampaign(campaign._id)}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm transition"
                    >
                      ▶️ Démarrer
                    </button>
                  )}
                  {campaign.status === 'paused' && (
                    <button
                      onClick={() => startCampaign(campaign._id)}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm transition"
                    >
                      ▶️ Reprendre
                    </button>
                  )}
                  {campaign.status === 'active' && (
                    <button
                      onClick={() => pauseCampaign(campaign._id)}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm transition"
                    >
                      ⏸️ Pause
                    </button>
                  )}
                  {campaign.status !== 'active' && (
                    <button
                      onClick={() => deleteCampaign(campaign._id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm transition"
                    >
                      🗑️ Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
