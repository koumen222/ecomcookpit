import ecomApi from './ecommApi.js';

export const marketingApi = {
  // Campaigns
  getCampaigns: (params = {}) => ecomApi.get('/marketing/campaigns', { params }),
  getCampaign: (id) => ecomApi.get(`/marketing/campaigns/${id}`),
  createCampaign: (data) => ecomApi.post('/marketing/campaigns', data),
  updateCampaign: (id, data) => ecomApi.put(`/marketing/campaigns/${id}`, data),
  deleteCampaign: (id) => ecomApi.delete(`/marketing/campaigns/${id}`),
  sendCampaign: (id) => ecomApi.post(`/marketing/campaigns/${id}/send`),
  testCampaign: (id, testEmail) => ecomApi.post(`/marketing/campaigns/${id}/test`, { testEmail }),
  duplicateCampaign: (id) => ecomApi.post(`/marketing/campaigns/${id}/duplicate`),
  getCampaignResults: (id) => ecomApi.get(`/marketing/campaigns/${id}/results`),

  // Stats
  getStats: () => ecomApi.get('/marketing/stats'),

  // Audience preview
  previewAudience: (data) => ecomApi.post('/marketing/audience-preview', data),
};
