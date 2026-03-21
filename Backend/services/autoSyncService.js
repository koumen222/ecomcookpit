/**
 * autoSyncService.js — Stub
 * Le service d'auto-sync Google Sheets a été remplacé par les webhooks.
 * Ce fichier empêche le crash de routes/autoSync.js au démarrage.
 */

const autoSyncService = {
  async getAutoSyncStatus(workspaceId) {
    return { enabled: false, interval: '2min', lastRunAt: null, message: 'Auto-sync désactivé — utilise les webhooks' };
  },

  async toggleAutoSync(workspaceId, enabled, interval) {
    console.warn('⚠️ [AutoSync] Service désactivé — utilise les webhooks');
    return false;
  },

  async syncWorkspace(workspaceId) {
    console.warn('⚠️ [AutoSync] Service désactivé — utilise les webhooks');
  },

  startAutoSyncService() {
    console.log('ℹ️ [AutoSync] Service désactivé — utilise les webhooks');
  }
};

export default autoSyncService;
