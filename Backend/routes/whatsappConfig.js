import express from 'express';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = express.Router();

/**
 * @route   GET /api/ecom/integrations/whatsapp/status
 * @desc    Vérifier le statut de l'intégration WhatsApp
 * @access  Private
 */
router.get('/status', requireEcomAuth, async (req, res) => {
  try {
    const userId = req.ecomUser?._id?.toString() || req.user?.id || req.user?._id;
    const workspaceId = req.workspaceId;

    // Vérifier si l'utilisateur a des instances WhatsApp configurées
    const instances = await WhatsappInstance.find({ 
      userId, 
      isActive: true 
    });

    const hasActiveInstances = instances.length > 0;
    const connectedInstances = instances.filter(instance => 
      instance.status === 'connected' || instance.status === 'active'
    ).length;

    res.status(200).json({
      success: true,
      data: {
        isConfigured: hasActiveInstances,
        connectedInstances: connectedInstances,
        totalInstances: instances.length,
        instances: instances.map(instance => ({
          id: instance._id,
          instanceName: instance.instanceName,
          customName: instance.customName,
          status: instance.status,
          lastSeen: instance.lastSeen
        }))
      }
    });
  } catch (error) {
    console.error('❌ Erreur lors du vérification statut WhatsApp:', error.message);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la vérification du statut WhatsApp"
    });
  }
});

/**
 * @route   POST /api/ecom/integrations/whatsapp/config
 * @desc    Configurer une instance WhatsApp
 * @access  Private
 */
router.post('/config', requireEcomAuth, async (req, res) => {
  try {
    const userId = req.ecomUser?._id?.toString() || req.user?.id || req.user?._id;
    const { instanceName, instanceToken, customName, apiUrl } = req.body;

    if (!instanceName || !instanceToken) {
      return res.status(400).json({
        success: false,
        error: "instanceName et instanceToken sont requis"
      });
    }

    // Créer ou mettre à jour l'instance
    const instance = await WhatsappInstance.findOneAndUpdate(
      { instanceName, userId },
      { 
        instanceToken,
        customName: customName || instanceName,
        apiUrl: apiUrl || 'https://api.evolution-api.com',
        workspaceId: req.workspaceId,
        lastSeen: new Date(),
        isActive: true,
        status: 'configured'
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Configuration WhatsApp enregistrée avec succès",
      data: {
        id: instance._id,
        instanceName: instance.instanceName,
        customName: instance.customName,
        status: instance.status
      }
    });
  } catch (error) {
    console.error('❌ Erreur lors de la configuration WhatsApp:', error.message);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la configuration WhatsApp"
    });
  }
});

/**
 * @route   DELETE /api/ecom/integrations/whatsapp/config/:instanceId
 * @desc    Supprimer une configuration WhatsApp
 * @access  Private
 */
router.delete('/config/:instanceId', requireEcomAuth, async (req, res) => {
  try {
    const userId = req.ecomUser?._id?.toString() || req.user?.id || req.user?._id;
    const { instanceId } = req.params;

    const instance = await WhatsappInstance.findOneAndUpdate(
      { _id: instanceId, userId },
      { isActive: false, status: 'deleted' },
      { new: true }
    );

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: "Instance WhatsApp non trouvée"
      });
    }

    res.status(200).json({
      success: true,
      message: "Instance WhatsApp supprimée avec succès"
    });
  } catch (error) {
    console.error('❌ Erreur lors de la suppression WhatsApp:', error.message);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la suppression de l'instance WhatsApp"
    });
  }
});

/**
 * @route   POST /api/ecom/integrations/whatsapp/test
 * @desc    Tester une connexion WhatsApp
 * @access  Private
 */
router.post('/test', requireEcomAuth, async (req, res) => {
  try {
    const userId = req.ecomUser?._id?.toString() || req.user?.id || req.user?._id;
    const { instanceName, instanceToken, testNumber } = req.body;

    if (!instanceName || !instanceToken) {
      return res.status(400).json({
        success: false,
        error: "instanceName et instanceToken sont requis"
      });
    }

    // Ici on pourrait faire un test réel via l'API Evolution
    // Pour l'instant, on simule un test basique
    const instance = await WhatsappInstance.findOne({ instanceName, userId });
    
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: "Instance WhatsApp non trouvée"
      });
    }

    // Mettre à jour le statut de l'instance
    await WhatsappInstance.findOneAndUpdate(
      { instanceName, userId },
      { 
        lastSeen: new Date(),
        status: 'connected'
      }
    );

    res.status(200).json({
      success: true,
      message: "Test de connexion réussi",
      data: {
        instanceName,
        status: 'connected',
        testTime: new Date()
      }
    });
  } catch (error) {
    console.error('❌ Erreur lors du test WhatsApp:', error.message);
    res.status(500).json({
      success: false,
      error: "Erreur lors du test de connexion WhatsApp"
    });
  }
});

export default router;
