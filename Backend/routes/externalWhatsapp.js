import express from 'express';
import EcomUser from '../models/EcomUser.js';
import evolutionApiService from '../services/evolutionApiService.js';
import externalWhatsappApi from '../services/externalWhatsappApiService.js';

const router = express.Router();

/**
 * @route   POST /api/v1/external/whatsapp/link
 * @desc    Enregistrer une instance WhatsApp pour un utilisateur
 * @access  Public (Public selon spécification, sécurisé par userId/instanceToken)
 */
router.post('/link', async (req, res) => {
  try {
    const { userId, instanceName, instanceToken, customName, defaultPart } = req.body;

    if (!userId || !instanceName || !instanceToken) {
      return res.status(400).json({
        success: false,
        error: "userId, instanceName et instanceToken sont requis"
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ÉTAPE 1 : Vérifier l'instance auprès d'Evolution API EXTERNE
    // L'instance ne sera PAS créée si la vérification échoue
    // ═══════════════════════════════════════════════════════════════
    console.log(`🔍 [LINK] Vérification Evolution API pour : ${instanceName}`);
    console.log(`🔍 [LINK] URL Evolution API : ${evolutionApiService.baseUrl}`);

    const apiStatus = await evolutionApiService.getInstanceStatus(instanceName, instanceToken);

    console.log(`🔍 [LINK] Réponse Evolution API :`, JSON.stringify(apiStatus));

    // Si aucune réponse ou instance introuvable → REFUSER la création
    if (!apiStatus || !apiStatus.instance) {
      console.warn(`❌ [LINK] REFUSÉ : Instance "${instanceName}" introuvable sur Evolution API`);
      return res.status(400).json({
        success: false,
        error: `Instance "${instanceName}" introuvable sur Evolution API. Vérifiez le nom de l'instance et le token, puis réessayez.`,
        verified: false
      });
    }

    const state = apiStatus.instance.state;
    let status;

    if (state === 'open') {
      status = 'connected';
      console.log(`✅ [LINK] Instance "${instanceName}" connectée à WhatsApp (state: open)`);
    } else if (state === 'close') {
      status = 'disconnected';
      console.log(`⚠️ [LINK] Instance "${instanceName}" trouvée mais déconnectée (state: close)`);
    } else if (state === 'connecting') {
      status = 'disconnected';
      console.log(`⚠️ [LINK] Instance "${instanceName}" en cours de connexion (state: connecting)`);
    } else {
      console.warn(`❌ [LINK] REFUSÉ : Instance "${instanceName}" état inconnu : ${state}`);
      return res.status(400).json({
        success: false,
        error: `Instance "${instanceName}" retourne un état inconnu ("${state}"). Vérifiez la configuration sur Evolution API.`,
        verified: false
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ÉTAPE 2 : Instance confirmée par Evolution → l'enregistrer via API externe
    // ═══════════════════════════════════════════════════════════════
    // Extraire workspaceId du token si disponible
    const user = await EcomUser.findById(userId);
    const workspaceId = user?.workspaceId || req.body.workspaceId;

    const token = req.headers.authorization?.replace('Bearer ', '');
    const linkResult = await externalWhatsappApi.linkInstance({
      userId,
      workspaceId,
      instanceName,
      instanceToken,
      customName: customName || instanceName,
      defaultPart
    }, token, workspaceId);

    if (!linkResult.success) {
      return res.status(400).json(linkResult);
    }

    const instance = linkResult.data;

    const verificationMessage = status === 'connected'
      ? 'Instance vérifiée et connectée à WhatsApp ✅'
      : 'Instance trouvée sur Evolution API mais non connectée à WhatsApp. Scannez le QR code dans Evolution.';

    console.log(`✅ [LINK] Instance enregistrée via API externe:`);
    console.log(`   - ID: ${instance.id}`);
    console.log(`   - Nom: ${instance.instanceName}`);
    console.log(`   - Status: ${instance.status}`);

    res.status(200).json({
      success: true,
      message: "Instance WhatsApp enregistrée",
      verified: true,
      verificationMessage,
      data: instance
    });
  } catch (error) {
    console.error('❌ [LINK] Erreur lors du link WhatsApp:', error.message);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la vérification avec Evolution API. Vérifiez que le serveur Evolution est accessible."
    });
  }
});

/**
 * @route   POST /api/ecom/v1/external/whatsapp/verify-instance
 * @desc    Tester la connexion réelle d'une instance via Evolution API externe
 * @access  Public
 */
router.post('/verify-instance', async (req, res) => {
  try {
    const { instanceId } = req.body;

    if (!instanceId) {
      return res.status(400).json({ success: false, error: "instanceId est requis" });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    const workspaceId = req.headers['x-workspace-id'];
    const verifyResult = await externalWhatsappApi.verifyInstance(instanceId, token, workspaceId);
    if (!verifyResult) {
      return res.status(404).json({ success: false, error: "Instance introuvable" });
    }
    
    return res.status(200).json(verifyResult);

  } catch (error) {
    console.error('❌ [VERIFY] Erreur:', error.message);
    res.status(500).json({ success: false, error: "Erreur lors de la vérification Evolution API" });
  }
});

/**
 * @route   DELETE /api/ecom/v1/external/whatsapp/instances/:id
 * @desc    Supprimer une instance WhatsApp
 * @access  Public (Sécurisé par userId)
 */
router.delete('/instances/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId est requis" });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    const workspaceId = req.headers['x-workspace-id'];
    const deleteResult = await externalWhatsappApi.deleteInstance(id, userId, token, workspaceId);
    
    if (!deleteResult || !deleteResult.success) {
      return res.status(404).json({ success: false, error: "Instance introuvable ou non autorisée" });
    }

    console.log(`🗑️ Instance WhatsApp supprimée via API externe (user: ${userId})`);

    res.status(200).json(deleteResult);
  } catch (error) {
    console.error('❌ Erreur suppression instance:', error.message);
    res.status(500).json({ success: false, error: "Erreur lors de la suppression" });
  }
});

/**
 * @route   POST /api/v1/external/whatsapp/send
 * @desc    Envoyer un message WhatsApp via Evolution API
 * @access  Public (Sécurisé par le instanceToken passé dans le body)
 */
router.post('/send', async (req, res) => {
  try {
    const { instanceName, instanceToken, number, message } = req.body;

    if (!instanceName || !instanceToken || !number || !message) {
      return res.status(400).json({
        success: false,
        error: "instanceName, instanceToken, number et message sont requis"
      });
    }

    // On pourrait vérifier si l'instance existe en base, mais la spécification dit :
    // "Sécurisé par le instanceToken passé dans le corps"
    // On appelle directement le service Evolution API
    const result = await evolutionApiService.sendMessage(
      instanceName,
      instanceToken,
      number,
      message
    );

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: "Message envoyé avec succès",
        data: result.data
      });
    } else {
      return res.status(500).json({
        success: false,
        error: "Échec de l'envoi du message via Evolution API",
        details: result.error
      });
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi WhatsApp:', error.message);
    res.status(500).json({
      success: false,
      error: "Erreur interne lors de l'envoi du message"
    });
  }
});

/**
 * @route   GET /api/v1/external/whatsapp/instances
 * @desc    Lister les instances WhatsApp d'un utilisateur
 * @access  Public (Sécurisé par userId)
 */
router.get('/instances', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId est requis"
      });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    const workspaceId = req.headers['x-workspace-id'];
    const result = await externalWhatsappApi.getInstances(userId, token, workspaceId);
    
    if (result.success && result.instances) {
      console.log(`📋 [INSTANCES] Trouvé ${result.instances.length} instance(s) pour userId: ${userId}`);
      result.instances.forEach(inst => {
        console.log(`   - ${inst.instanceName} | status: ${inst.status} | workspaceId: ${inst.workspaceId || 'N/A'}`);
      });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Erreur lors du listage WhatsApp:', error.message);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des instances"
    });
  }
});

/**
 * @route   GET /api/v1/external/whatsapp/instances/all
 * @desc    DIAGNOSTIC - Lister TOUTES les instances dans la DB
 * @access  Public
 */
router.get('/instances/all', async (req, res) => {
  try {
    // Note: Cette route diagnostic nécessiterait un endpoint spécifique sur l'API externe
    // Pour l'instant, on retourne une erreur indiquant que cette fonctionnalité n'est pas disponible
    return res.status(501).json({
      success: false,
      error: "Cette route de diagnostic n'est pas disponible via l'API externe"
    });
    
    // const allInstances = [];
    
    console.log(`🔍 [DIAGNOSTIC] Total instances dans DB: ${allInstances.length}`);
    allInstances.forEach(inst => {
      console.log(`   - ${inst.instanceName} | userId: ${inst.userId} | workspaceId: ${inst.workspaceId || 'N/A'} | status: ${inst.status} | isActive: ${inst.isActive}`);
    });

    res.status(200).json({
      success: true,
      total: allInstances.length,
      instances: allInstances
    });
  } catch (error) {
    console.error('❌ Erreur diagnostic:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/ecom/v1/external/whatsapp/refresh-status
 * @desc    Rafraîchir le statut des instances via Evolution API
 * @access  Public (Sécurisé par userId)
 */
router.post('/refresh-status', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId est requis"
      });
    }

    const instances = await WhatsappInstance.find({ userId, isActive: true });

    const updated = await Promise.all(instances.map(async (inst) => {
      try {
        const apiStatus = await evolutionApiService.getInstanceStatus(
          inst.instanceName,
          inst.instanceToken
        );

        let newStatus = inst.status;
        if (apiStatus?.instance?.state === 'open') {
          newStatus = 'connected';
        } else if (apiStatus?.instance?.state === 'close' || apiStatus?.instance?.state === 'connecting') {
          newStatus = 'disconnected';
        }

        if (newStatus !== inst.status) {
          await WhatsappInstance.findByIdAndUpdate(inst._id, { status: newStatus, lastSeen: new Date() });
        }

        return { ...inst.toObject(), status: newStatus };
      } catch {
        return inst.toObject();
      }
    }));

    res.status(200).json({
      success: true,
      instances: updated
    });
  } catch (error) {
    console.error('❌ Erreur refresh-status WhatsApp:', error.message);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la mise à jour des statuts"
    });
  }
});

export default router;
