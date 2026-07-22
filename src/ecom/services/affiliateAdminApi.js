import ecomApi from './ecommApi.js';

export const affiliateAdminApi = {
  getOverview: () => ecomApi.get('/affiliates/admin/overview'),
  getConfig: () => ecomApi.get('/affiliates/admin/config'),
  updateConfig: (payload) => ecomApi.put('/affiliates/admin/config', payload),
  getAffiliates: () => ecomApi.get('/affiliates/admin/affiliates'),
  createAffiliate: (payload) => ecomApi.post('/affiliates/admin/affiliates', payload),
  updateAffiliate: (id, payload) => ecomApi.put(`/affiliates/admin/affiliates/${id}`, payload),
  getConversions: (params = {}) => ecomApi.get('/affiliates/admin/conversions', { params }),
  updateConversionStatus: (id, payload) => ecomApi.put(`/affiliates/admin/conversions/${id}/status`, payload),
  // Retraits de commissions
  getPayouts: (params = {}) => ecomApi.get('/affiliates/admin/payouts', { params }),
  updatePayout: (id, payload) => ecomApi.put(`/affiliates/admin/payouts/${id}`, payload)
};
