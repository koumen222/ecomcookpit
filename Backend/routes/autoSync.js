/**
 * Routes pour la gestion de la synchronisation automatique
 */

import express from 'express';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import autoSyncService from '../../services/autoSyncService.js';
import WorkspaceSettings from '../models/WorkspaceSettings.js';

const router = express.Router();

// GET /api/ecom/auto-sync/status - Obtenir le statut de l'auto-sync
router.get('/status', requireEcomAuth, async (req, res) => {
  try {
    const status = await autoSyncService.getAutoSyncStatus(req.workspaceId);
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Erreur get auto-sync status:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/auto-sync/toggle - Activer/désactiver l'auto-sync
router.post('/toggle', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { enabled, interval = '5min' } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ 
        success: false, 
        message: 'Le paramètre "enabled" doit être un booléen' 
      });
    }

    const validIntervals = ['1min', '5min', '15min', '30min', '1hour'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({ 
        success: false, 
        message: `Intervalle invalide. Valeurs acceptées: ${validIntervals.join(', ')}` 
      });
    }

    const success = await autoSyncService.toggleAutoSync(req.workspaceId, enabled, interval);
    
    if (success) {
      res.json({ 
        success: true, 
        message: `Auto-synchronisation ${enabled ? 'activée' : 'désactivée'}`,
        data: { enabled, interval }
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la modification de l\'auto-sync' 
      });
    }
  } catch (error) {
    console.error('Erreur toggle auto-sync:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/auto-sync/sync-now - Forcer une synchronisation immédiate
router.post('/sync-now', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    // Déclencher une synchronisation immédiate pour ce workspace
    autoSyncService.syncWorkspace(req.workspaceId.toString()).catch(error => {
      console.error('Erreur sync immédiate:', error);
    });

    res.json({ 
      success: true, 
      message: 'Synchronisation immédiate déclenchée en arrière-plan' 
    });
  } catch (error) {
    console.error('Erreur sync-now:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/auto-sync/settings - Obtenir les paramètres détaillés
router.get('/settings', requireEcomAuth, async (req, res) => {
  try {
    const settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
    const status = await autoSyncService.getAutoSyncStatus(req.workspaceId);
    
    const response = {
      autoSync: {
        enabled: settings?.autoSync?.enabled !== false,
        interval: settings?.autoSync?.interval || '5min',
        lastUpdate: settings?.autoSync?.updatedAt,
        isRunning: status.isRunning
      },
      sources: {
        legacy: settings?.googleSheets?.spreadsheetId ? {
          name: 'Commandes Zendo',
          spreadsheetId: settings.googleSheets.spreadsheetId,
          sheetName: settings.googleSheets.sheetName || 'Sheet1',
          lastSyncAt: settings.googleSheets.lastSyncAt
        } : null,
        custom: (settings?.sources || []).filter(s => s.isActive).map(s => ({
          id: s._id,
          name: s.name,
          spreadsheetId: s.spreadsheetId,
          sheetName: s.sheetName,
          lastSyncAt: s.lastSyncAt,
          isActive: s.isActive
        }))
      },
      intervals: [
        { value: '1min', label: 'Toutes les minutes', description: 'Synchronisation très fréquente (recommandé pour les tests)' },
        { value: '5min', label: 'Toutes les 5 minutes', description: 'Synchronisation fréquente (recommandé)' },
        { value: '15min', label: 'Toutes les 15 minutes', description: 'Synchronisation modérée' },
        { value: '30min', label: 'Toutes les 30 minutes', description: 'Synchronisation espacée' },
        { value: '1hour', label: 'Toutes les heures', description: 'Synchronisation peu fréquente' }
      ]
    };

    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Erreur get auto-sync settings:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
