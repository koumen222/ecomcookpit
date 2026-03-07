import ecomApi from './ecommApi.js';

export const marketingApi = {
  // Campaigns
  getCampaigns: (params = {}) => ecomApi.get('campaigns', { params }),
  getCampaign: (id) => ecomApi.get(`campaigns/${id}`),
  createCampaign: (data) => ecomApi.post('campaigns', data),
  updateCampaign: (id, data) => ecomApi.put(`campaigns/${id}`, data),
  deleteCampaign: (id) => ecomApi.delete(`campaigns/${id}`),
  sendCampaign: (id, data = {}) => ecomApi.post(`campaigns/${id}/send`, data),
  testCampaign: (id, testEmail) => ecomApi.post(`campaigns/${id}/test`, { testEmail }),
  duplicateCampaign: (id) => ecomApi.post(`campaigns/${id}/duplicate`),
  getCampaignResults: (id) => ecomApi.get(`campaigns/${id}/results`),

  // Stats
  getStats: () => ecomApi.get('campaigns/stats'),

  // Audience preview
  previewAudience: (data) => ecomApi.post('campaigns/audience-preview', data),

  // WhatsApp Instances (Proxy through external if needed, or direct)
  getWhatsAppInstances: (userId) => ecomApi.get('v1/external/whatsapp/instances', { params: { userId } }),
};
