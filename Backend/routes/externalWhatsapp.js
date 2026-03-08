import express from 'express';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import EcomUser from '../models/EcomUser.js';
import evolutionApiService from '../services/evolutionApiService.js';
import { checkMessageLimit, incrementMessageCount, getInstanceUsage } from '../services/messageLimitService.js';

const router = express.Router();

/**
 * @route   GET /api/ecom/v1/external/whatsapp/
 * @desc    Test route to verify router is loaded
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp External Router is loaded',
    availableRoutes: [
      'GET /instances?userId=xxx',
      'POST /link',
      'POST /verify-instance',
      'POST /send',
      'DELETE /instances/:id?userId=xxx'
    ]
  });
});

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
    // ÉTAPE 2 : Instance confirmée par Evolution → l'enregistrer en DB
    // ═══════════════════════════════════════════════════════════════
    // Extraire workspaceId du token si disponible
    const user = await EcomUser.findById(userId);
    const workspaceId = user?.workspaceId || req.body.workspaceId;

    const instance = await WhatsAppInstance.findOneAndUpdate(
      { instanceName },
      { 
        userId, 
        workspaceId,
        instanceToken, 
        customName: customName || instanceName,
        lastSeen: new Date(),
        isActive: true,
        status,
        ...(defaultPart !== undefined && { defaultPart })
      },
      { new: true, upsert: true }
    );

    const verificationMessage = status === 'connected'
      ? 'Instance vérifiée et connectée à WhatsApp ✅'
      : 'Instance trouvée sur Evolution API mais non connectée à WhatsApp. Scannez le QR code dans Evolution.';

    console.log(`✅ [LINK] Instance SAUVEGARDÉE dans MongoDB:`);
    console.log(`   - ID: ${instance._id}`);
    console.log(`   - Nom: ${instance.instanceName}`);
    console.log(`   - userId: ${instance.userId}`);
    console.log(`   - workspaceId: ${instance.workspaceId || 'N/A'}`);
    console.log(`   - Status: ${instance.status}`);
    console.log(`   - isActive: ${instance.isActive}`);
    console.log(`   - defaultPart: ${instance.defaultPart}%`);

    res.status(200).json({
      success: true,
      message: "Instance WhatsApp enregistrée",
      verified: true,
      verificationMessage,
      data: {
        id: instance._id,
        instanceName: instance.instanceName,
        customName: instance.customName,
        status
      }
    });
  } catch (error) {
    console.error('❌ [LINK] Erreur lors du link WhatsApp:', error.message);
    
    // Messages d'erreur clairs selon le type d'erreur
    let errorMessage = "Erreur lors de la liaison de l'instance";
    
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      errorMessage = "Impossible de contacter le serveur Evolution API. Vérifiez votre connexion internet.";
    } else if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
      errorMessage = "Le serveur Evolution API ne répond pas (timeout). Réessayez dans quelques instants.";
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      errorMessage = "Token d'accès invalide ou expiré. Vérifiez votre token ZenChat.";
    } else if (error.response?.status === 404) {
      errorMessage = "Instance non trouvée sur Evolution API. Vérifiez le nom de l'instance.";
    } else if (error.message?.includes('instance') && error.message?.includes('not found')) {
      errorMessage = "Instance non disponible. Cette instance n'existe pas sur Evolution API.";
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message
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

    const instance = await WhatsAppInstance.findById(instanceId);
    if (!instance) {
      return res.status(404).json({ success: false, error: "Instance introuvable en base de données" });
    }

    console.log(`🔍 [VERIFY] Test Evolution API pour : ${instance.instanceName}`);
    console.log(`🔍 [VERIFY] URL : ${evolutionApiService.baseUrl}/instance/connectionState/${instance.instanceName}`);

    const apiStatus = await evolutionApiService.getInstanceStatus(instance.instanceName, instance.instanceToken);

    console.log(`🔍 [VERIFY] Réponse :`, JSON.stringify(apiStatus));

    if (!apiStatus || !apiStatus.instance) {
      await WhatsAppInstance.findByIdAndUpdate(instanceId, { status: 'disconnected', lastSeen: new Date() });
      return res.status(200).json({
        success: false,
        error: `Impossible de joindre l'instance "${instance.instanceName}" sur Evolution API. Elle n'existe peut-être plus.`,
        status: 'disconnected'
      });
    }

    const state = apiStatus.instance.state;
    let newStatus = 'disconnected';
    let message = '';

    if (state === 'open') {
      newStatus = 'connected';
      message = `Instance "${instance.customName || instance.instanceName}" connectée à WhatsApp ✅`;
    } else if (state === 'close') {
      newStatus = 'disconnected';
      message = `Instance trouvée mais déconnectée de WhatsApp. Scannez le QR code dans Evolution.`;
    } else if (state === 'connecting') {
      newStatus = 'disconnected';
      message = `Instance en cours de connexion à WhatsApp. Patientez ou scannez le QR code.`;
    } else {
      message = `État inconnu : "${state}"`;
    }

    await WhatsAppInstance.findByIdAndUpdate(instanceId, { status: newStatus, lastSeen: new Date() });

    res.status(200).json({
      success: newStatus === 'connected',
      message,
      status: newStatus,
      evolutionState: state
    });
  } catch (error) {
    console.error('❌ [VERIFY] Erreur:', error.message);
    
    // Messages d'erreur clairs
    let errorMessage = "Erreur lors de la vérification";
    
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      errorMessage = "Serveur Evolution API injoignable. Vérifiez votre connexion.";
    } else if (error.message?.includes('timeout')) {
      errorMessage = "Timeout - Le serveur met trop de temps à répondre.";
    } else if (error.message?.includes('token') || error.message?.includes('auth')) {
      errorMessage = "Token d'accès erroné. Vérifiez votre configuration.";
    } else if (error.message?.includes('instance')) {
      errorMessage = "Instance non disponible actuellement.";
    }
    
    res.status(500).json({ success: false, error: errorMessage, details: error.message });
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

    const instance = await WhatsAppInstance.findOne({ _id: id, userId });
    if (!instance) {
      return res.status(404).json({ success: false, error: "Instance introuvable ou non autorisée" });
    }

    await WhatsAppInstance.findByIdAndDelete(id);

    console.log(`🗑️ Instance WhatsApp supprimée : ${instance.instanceName} (user: ${userId})`);

    res.status(200).json({
      success: true,
      message: `Instance "${instance.customName || instance.instanceName}" supprimée avec succès`
    });
  } catch (error) {
    console.error('❌ Erreur suppression instance:', error.message);
    
    let errorMessage = "Erreur lors de la suppression";
    if (error.message?.includes('CastError') || error.message?.includes('ObjectId')) {
      errorMessage = "ID d'instance invalide.";
    } else if (error.message?.includes('not found')) {
      errorMessage = "Instance introuvable. Elle a peut-être déjà été supprimée.";
    }
    
    res.status(500).json({ success: false, error: errorMessage, details: error.message });
  }
});

/**
 * @route   POST /api/v1/external/whatsapp/send
 * @desc    Envoyer un message WhatsApp via ZenChat API
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

    // Récupérer l'instance pour vérifier les limites
    const instance = await WhatsAppInstance.findOne({ instanceName, instanceToken });
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: "Instance introuvable. Vérifiez le nom et le token."
      });
    }

    // Vérifier les limites de messages
    const limitCheck = await checkMessageLimit(instance);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: limitCheck.reason,
        usage: limitCheck.usage,
        upgradeUrl: 'https://zechat.site/pricing'
      });
    }

    // Envoyer le message via ZenChat API
    const result = await evolutionApiService.sendMessage(
      instanceName,
      instanceToken,
      number,
      message
    );

    if (result.success) {
      // Incrémenter les compteurs de messages
      await incrementMessageCount(instance._id, 1);

      // Mettre à jour le statut de l'instance
      await WhatsAppInstance.findByIdAndUpdate(
        instance._id,
        { lastSeen: new Date(), status: 'connected' }
      );

      return res.status(200).json({
        success: true,
        message: "Message envoyé avec succès",
        data: result.data,
        usage: limitCheck.usage
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
    
    // Messages d'erreur clairs
    let errorMessage = "Erreur lors de l'envoi du message";
    
    if (error.message?.includes('token') || error.message?.includes('auth') || error.message?.includes('401')) {
      errorMessage = "Token d'accès erroné ou expiré. Vérifiez votre token.";
    } else if (error.message?.includes('instance') || error.message?.includes('404')) {
      errorMessage = "Instance non disponible. Vérifiez que l'instance existe et est connectée.";
    } else if (error.message?.includes('number') || error.message?.includes('phone')) {
      errorMessage = "Numéro de téléphone invalide. Vérifiez le format.";
    } else if (error.message?.includes('ECONNREFUSED')) {
      errorMessage = "Serveur WhatsApp injoignable. Vérifiez votre connexion.";
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message
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

    const instances = await WhatsAppInstance.find({ userId, isActive: true });
    
    console.log(`📋 [INSTANCES] Trouvé ${instances.length} instance(s) pour userId: ${userId}`);
    instances.forEach(inst => {
      console.log(`   - ${inst.instanceName} | status: ${inst.status} | workspaceId: ${inst.workspaceId || 'N/A'}`);
    });

    res.status(200).json({
      success: true,
      instances
    });
  } catch (error) {
    console.error('❌ Erreur lors du listage WhatsApp:', error.message);
    
    let errorMessage = "Erreur lors de la récupération des instances";
    if (error.message?.includes('Mongo') || error.message?.includes('connection')) {
      errorMessage = "Erreur de base de données. Réessayez dans quelques instants.";
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message
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
    const allInstances = await WhatsAppInstance.find({});
    
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

    const instances = await WhatsAppInstance.find({ userId, isActive: true });

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
          await WhatsAppInstance.findByIdAndUpdate(inst._id, { status: newStatus, lastSeen: new Date() });
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

/**
 * @route   GET /api/ecom/v1/external/whatsapp/instances/:id/usage
 * @desc    Consulter la consommation de messages d'une instance
 * @access  Public (Sécurisé par userId)
 */
router.get('/instances/:id/usage', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId est requis" });
    }

    const instance = await WhatsAppInstance.findOne({ _id: id, userId });
    if (!instance) {
      return res.status(404).json({ success: false, error: "Instance introuvable ou non autorisée" });
    }

    const usage = await getInstanceUsage(id);

    res.status(200).json({
      success: true,
      instanceName: instance.customName || instance.instanceName,
      usage
    });
  } catch (error) {
    console.error('❌ Erreur récupération usage:', error.message);
    res.status(500).json({ success: false, error: "Erreur lors de la récupération des statistiques" });
  }
});

export default router;
