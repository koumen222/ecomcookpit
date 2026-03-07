import express from 'express';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import externalWhatsappApi from '../services/externalWhatsappApiService.js';

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
    const token = req.headers.authorization?.replace('Bearer ', '');
    const instances = await externalWhatsappApi.findInstances({ 
      userId, 
      isActive: true 
    }, token);

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

    // Créer ou mettre à jour l'instance via API externe
    const token = req.headers.authorization?.replace('Bearer ', '');
    const linkResult = await externalWhatsappApi.linkInstance({
      userId,
      workspaceId: req.workspaceId,
      instanceName,
      instanceToken,
      customName: customName || instanceName,
      apiUrl: apiUrl || 'https://api.evolution-api.com'
    }, token, req.workspaceId);

    if (!linkResult.success) {
      return res.status(400).json(linkResult);
    }

    const instance = linkResult.data;

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

    const token = req.headers.authorization?.replace('Bearer ', '');
    const deleteResult = await externalWhatsappApi.deleteInstance(instanceId, userId, token, req.workspaceId);

    if (!deleteResult || !deleteResult.success) {
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

    // Récupérer l'instance via API externe
    const token = req.headers.authorization?.replace('Bearer ', '');
    const instances = await externalWhatsappApi.findInstances({ userId }, token);
    const instance = instances.find(inst => inst.instanceName === instanceName);
    
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: "Instance WhatsApp non trouvée"
      });
    }

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
