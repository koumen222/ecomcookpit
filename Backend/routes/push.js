import express from 'express';
import Subscription from '../models/Subscription.js';
import { sendPushNotification } from '../services/pushService.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = express.Router();

/**
 * POST /api/ecom/push/subscribe - Ajouter un abonnement push
 */
router.post('/subscribe', requireEcomAuth, async (req, res) => {
  try {
    const { endpoint, keys, userAgent } = req.body;
    
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({
        success: false,
        message: 'Données d\'abonnement incomplètes'
      });
    }
    
    // Vérifier si l'abonnement existe déjà
    const existingSubscription = await Subscription.findOne({
      workspaceId: req.workspaceId,
      userId: req.ecomUser._id,
      endpoint
    });
    
    if (existingSubscription) {
      // Mettre à jour l'abonnement existant
      existingSubscription.keys = keys;
      existingSubscription.userAgent = userAgent || '';
      existingSubscription.lastUsed = new Date();
      existingSubscription.isActive = true;
      await existingSubscription.save();
      
      console.log('📱 Abonnement push mis à jour:', existingSubscription._id);
    } else {
      // Créer un nouvel abonnement
      const subscription = new Subscription({
        workspaceId: req.workspaceId,
        userId: req.ecomUser._id,
        endpoint,
        keys,
        userAgent: userAgent || '',
        lastUsed: new Date(),
        isActive: true
      });
      
      await subscription.save();
      console.log('📱 Nouvel abonnement push créé:', subscription._id);
    }
    
    res.json({
      success: true,
      message: 'Abonnement push enregistré avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur abonnement push:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'abonnement push'
    });
  }
});

/**
 * DELETE /api/ecom/push/unsubscribe - Supprimer un abonnement push
 */
router.delete('/unsubscribe', requireEcomAuth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Endpoint requis'
      });
    }
    
    const result = await Subscription.deleteOne({
      workspaceId: req.workspaceId,
      userId: req.ecomUser._id,
      endpoint
    });
    
    if (result.deletedCount > 0) {
      console.log('📱 Abonnement push supprimé');
      res.json({
        success: true,
        message: 'Abonnement push supprimé avec succès'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Abonnement non trouvé'
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur suppression abonnement push:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'abonnement'
    });
  }
});

/**
 * GET /api/ecom/push/vapid-public-key - Obtenir la clé publique VAPID
 */
router.get('/vapid-public-key', (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY || 'BL1HvKjXQh4jL8J9G2L3Q9R0T1Y2U3I4O5P6A7S8D9E0F1G2H3I4J5K6L7M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z1';
  
  res.json({
    publicKey
  });
});

/**
 * POST /api/ecom/push/test - Envoyer une notification de test
 */
router.post('/test', requireEcomAuth, async (req, res) => {
  try {
    const result = await sendPushNotification(req.workspaceId, {
      title: '📢 Notification de test',
      body: 'Ceci est une notification de test pour vérifier que les push notifications fonctionnent correctement!',
      icon: '/icons/test-notification.png',
      tag: 'test-notification',
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      },
      actions: [
        {
          action: 'view-orders',
          title: 'Voir les commandes'
        },
        {
          action: 'dismiss',
          title: 'Fermer'
        }
      ]
    });
    
    res.json({
      success: result.success,
      message: `Notification envoyée à ${result.successful}/${result.total} abonnés`,
      details: result
    });
    
  } catch (error) {
    console.error('❌ Erreur notification test:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi de la notification de test'
    });
  }
});

/**
 * POST /api/ecom/push/cleanup - Nettoyer les abonnements inactifs
 */
router.post('/cleanup', requireEcomAuth, async (req, res) => {
  try {
    const { daysOld = 30 } = req.body;
    
    if (!req.ecomUser.role || req.ecomUser.role !== 'ecom_admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Admin requis.'
      });
    }
    
    const deletedCount = await Subscription.cleanupInactive(daysOld);
    
    res.json({
      success: true,
      message: `${deletedCount} abonnements inactifs supprimés`,
      deletedCount
    });
    
  } catch (error) {
    console.error('❌ Erreur nettoyage abonnements:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du nettoyage des abonnements'
    });
  }
});

export default router;
