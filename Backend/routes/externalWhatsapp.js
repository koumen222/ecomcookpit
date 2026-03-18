import express from 'express';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import EcomUser from '../models/EcomUser.js';
import RitaConfig from '../models/RitaConfig.js';
import evolutionApiService from '../services/evolutionApiService.js';
import { processIncomingMessage, generateTestReply } from '../services/ritaAgentService.js';

const HARD_CODED_WEBHOOK_BASE_URL = 'https://api.scalor.net';

function resolveWebhookBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol || 'http';
  const host = req.get('host');
  const isLocalHost = host && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(host);

  if (isLocalHost) {
    return `${proto}://${host}`.replace(/\/$/, '');
  }

  return HARD_CODED_WEBHOOK_BASE_URL;
}
import { checkMessageLimit, incrementMessageCount, getInstanceUsage } from '../services/messageLimitService.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

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
router.post('/link', requireEcomAuth, async (req, res) => {
  try {
    const userId = req.ecomUser._id.toString();
    const workspaceId = req.workspaceId;
    const { instanceName, instanceToken, customName, defaultPart } = req.body;

    if (!instanceName || !instanceToken) {
      return res.status(400).json({
        success: false,
        error: "instanceName et instanceToken sont requis"
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
 * @route   DELETE /api/ecom/v1/  external/whatsapp/instances/:id
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
 * @route   POST /api/ecom/v1/external/whatsapp/instances/:id/webhook
 * @desc    Configurer le webhook Evolution API d'une instance
 * @access  Private
 */
router.post('/instances/:id/webhook', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, enabled, url, webhookByEvents, webhookBase64, events } = req.body;

    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });
    if (enabled && !url) return res.status(400).json({ success: false, error: 'URL requise pour activer le webhook' });
    if (enabled && (!events || events.length === 0)) return res.status(400).json({ success: false, error: 'Au moins un événement est requis' });

    const instance = await WhatsAppInstance.findOne({ _id: id, userId });
    if (!instance) return res.status(404).json({ success: false, error: 'Instance introuvable ou non autorisée' });

    const result = await evolutionApiService.setWebhook(instance.instanceName, instance.instanceToken, {
      enabled: !!enabled,
      url: url || '',
      webhookByEvents: !!webhookByEvents,
      webhookBase64: !!webhookBase64,
      events: events || []
    });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('❌ Erreur configuration webhook:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/instances/:id/webhook
 * @desc    Récupérer la config webhook actuelle d'une instance
 * @access  Private
 */
router.get('/instances/:id/webhook', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });

    const instance = await WhatsAppInstance.findOne({ _id: id, userId });
    if (!instance) return res.status(404).json({ success: false, error: 'Instance introuvable ou non autorisée' });

    const result = await evolutionApiService.getWebhook(instance.instanceName, instance.instanceToken);
    if (!result.success) {
      return res.status(200).json({ success: false, data: null, error: result.error });
    }

    res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('❌ Erreur récupération webhook:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/ecom/v1/external/whatsapp/activate
 * @desc    Active ou désactive le webhook Evolution API sur l'instance sélectionnée (ou toutes si pas d'instanceId).
 *          Appelé automatiquement quand Rita IA est activé/désactivé.
 */
router.post('/activate', async (req, res) => {
  try {
    const { userId, enabled, instanceId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });

    console.log(`\n🔧 ═══════════════════════════════════════════════════`);
    console.log(`🔧 [ACTIVATE] userId=${userId} enabled=${enabled} instanceId=${instanceId || 'ALL'}`);

    // Chercher l'instance spécifique OU toutes les instances actives
    let instances;
    if (instanceId) {
      const inst = await WhatsAppInstance.findOne({ _id: instanceId, userId, isActive: true });
      instances = inst ? [inst] : [];
      console.log(`🔧 [ACTIVATE] Instance ciblée: ${inst ? inst.instanceName : 'INTROUVABLE (id=' + instanceId + ')'}`);  
    } else {
      instances = await WhatsAppInstance.find({ userId, isActive: true });
      console.log(`🔧 [ACTIVATE] Toutes les instances: ${instances.map(i => i.instanceName).join(', ') || 'aucune'}`);
    }

    if (!instances.length) {
      console.log(`⚠️ [ACTIVATE] Aucune instance trouvée`);
      console.log(`🔧 ═══════════════════════════════════════════════════\n`);
      return res.status(200).json({ success: true, message: 'Aucune instance à configurer', configured: 0, results: [] });
    }

    const webhookBaseUrl = resolveWebhookBaseUrl(req);
    const webhookUrl = `${webhookBaseUrl}/api/ecom/v1/external/whatsapp/incoming`;
    const events = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];
    const isLocalWebhook = /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(webhookUrl);
    console.log(`🔧 [ACTIVATE] Webhook URL: ${webhookUrl}`);
    if (isLocalWebhook) {
      console.log('⚠️ [ACTIVATE] Webhook local détecté. Evolution API doit pouvoir joindre cette machine (même réseau, tunnel ngrok/cloudflared, ou Evolution local).');
    }
    console.log(`🔧 [ACTIVATE] Events: ${events.join(', ')}`);

    const results = await Promise.all(instances.map(async (inst) => {
      try {
        console.log(`📡 [ACTIVATE] Configuration webhook sur "${inst.instanceName}" (token: ${inst.instanceToken?.substring(0, 8)}...)`);
        const result = await evolutionApiService.setWebhook(
          inst.instanceName,
          inst.instanceToken,
          { enabled: !!enabled, url: webhookUrl, webhookByEvents: false, webhookBase64: false, events }
        );
        console.log(`${result.success ? '✅' : '❌'} [ACTIVATE] Webhook ${enabled ? 'activé' : 'désactivé'} sur ${inst.instanceName}`, result.success ? '' : result.error);
        return { instanceName: inst.customName || inst.instanceName, instanceId: inst._id, success: result.success, error: result.error || null };
      } catch (err) {
        console.error(`❌ [ACTIVATE] Erreur pour ${inst.instanceName}:`, err.message);
        return { instanceName: inst.customName || inst.instanceName, instanceId: inst._id, success: false, error: err.message };
      }
    }));

    const configured = results.filter(r => r.success).length;
    console.log(`📡 [ACTIVATE] Résultat: ${configured}/${instances.length} instances configurées (enabled=${enabled})`);

    // Envoyer un message WhatsApp de confirmation au propriétaire si activation réussie
    if (enabled && configured > 0) {
      try {
        const owner = await EcomUser.findById(userId).lean();
        const ownerPhone = owner?.phone?.replace(/\D/g, '');
        console.log(`📲 [ACTIVATE] Propriétaire: ${owner?.email || 'inconnu'}, téléphone: ${ownerPhone || 'NON RENSEIGNÉ'}`);
        if (ownerPhone) {
          const targetInst = instances[0];
          const ritaConfig = await RitaConfig.findOne({ userId }).lean();
          const agentName = ritaConfig?.agentName || 'Rita';
          const confirmMsg = `✅ *${agentName} IA est maintenant active !*\n\n` +
            `Instance: ${targetInst.customName || targetInst.instanceName}\n` +
            `Envoyez un message ici pour tester la réponse automatique en temps réel.\n\n` +
            `— ${agentName} 🤖`;
          const sendResult = await evolutionApiService.sendMessage(targetInst.instanceName, targetInst.instanceToken, ownerPhone, confirmMsg);
          console.log(`📲 [ACTIVATE] Message de confirmation envoyé à ${ownerPhone} via ${targetInst.instanceName}:`, sendResult.success ? '✅ OK' : `❌ ${sendResult.error}`);
        } else {
          console.log(`⚠️ [ACTIVATE] Pas de numéro de téléphone pour le propriétaire — message de confirmation non envoyé`);
        }
      } catch (confirmErr) {
        console.warn('⚠️ [ACTIVATE] Impossible d\'envoyer le message de confirmation:', confirmErr.message);
      }
    }

    console.log(`🔧 ═══════════════════════════════════════════════════\n`);
    res.status(200).json({ success: true, configured, total: instances.length, results, webhookUrl, webhookBaseUrl });
  } catch (error) {
    console.error('❌ Erreur activation webhooks:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/incoming
 * @desc    Endpoint de diagnostic pour vérifier que l'URL webhook est bien exposée.
 */
router.get('/incoming', async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Webhook WhatsApp Rita disponible',
    method: 'Utiliser POST pour les événements Evolution API',
    webhookUrl: 'https://api.scalor.net/api/ecom/v1/external/whatsapp/incoming'
  });
});

/**
 * @route   POST /api/ecom/v1/external/whatsapp/incoming
 * @desc    Reçoit les événements entrants d'Evolution API (MESSAGES_UPSERT, CONNECTION_UPDATE, etc.)
 *          Ce endpoint est configuré automatiquement comme webhook URL sur toutes les instances.
 */
router.post('/incoming', async (req, res) => {
  // Répondre immédiatement (Evolution API n'attend pas plus de 5 secondes)
  res.status(200).json({ success: true, received: true });

  const { event, instance, data } = req.body;
  if (!event) return;
  const normalizedEvent = String(event).toUpperCase().replace(/\./g, '_');

  console.log(`\n📩 ═══════════════════════════════════════════════════`);
  console.log(`📩 [WH INCOMING] event=${event} instance=${instance}`);
  console.log(`📩 [WH INCOMING] normalizedEvent=${normalizedEvent}`);
  console.log(`📩 [WH INCOMING] data keys: ${Object.keys(data || {}).join(', ')}`);

  // Traitement asynchrone
  setImmediate(async () => {
    try {
      if (normalizedEvent === 'MESSAGES_UPSERT') {
        const messages = Array.isArray(data?.messages)
          ? data.messages
          : (data?.key && data?.message ? [data] : []);
        console.log(`📩 [WH INCOMING] ${messages.length} message(s) reçu(s)`);

        // Trouver l'instance WhatsApp correspondante pour récupérer le userId
        const instanceDoc = instance
          ? await WhatsAppInstance.findOne({ instanceName: instance, isActive: true }).lean()
          : null;

        if (instanceDoc) {
          console.log(`📩 [WH INCOMING] Instance trouvée: ${instanceDoc.instanceName} (userId=${instanceDoc.userId})`);
        }

        for (const msg of messages) {
          const fromMe = msg.key?.fromMe;
          const from = msg.key?.remoteJid;
          const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption ||
            msg.message?.buttonsResponseMessage?.selectedButtonId ||
            msg.message?.listResponseMessage?.title ||
            '';
          const pushName = msg.pushName || data?.pushName || '';

          console.log(`📩 [WH INCOMING] Message — from=${from} fromMe=${fromMe} text="${(text || '').substring(0, 80)}"`);
          if (pushName) {
            console.log(`📩 [WH INCOMING] pushName=${pushName}`);
          }

          if (fromMe) {
            console.log(`⏩ [RITA] Message envoyé par le bot (fromMe=true), ignoré.`);
            continue;
          }
          // Ignorer les messages venant de groupes WhatsApp (JID se termine par @g.us)
          if (from && from.endsWith('@g.us')) {
            console.log(`⏩ [RITA] Message de groupe ignoré (${from}).`);
            continue;
          }
          if (!from || !text) {
            console.log(`⏩ [RITA] Message vide ou sans expéditeur, ignoré.`);
            continue;
          }

          console.log(`💬 [RITA] ══════════════════════════════════════`);
          console.log(`💬 [RITA] Message entrant de ${from}`);
          console.log(`💬 [RITA] Contenu: "${text.substring(0, 200)}"`);

          if (!instanceDoc) {
            console.warn(`⚠️ [RITA] Instance "${instance}" introuvable en base, message ignoré.`);
            continue;
          }

          const userId = instanceDoc.userId;
          console.log(`💬 [RITA] Traitement pour userId=${userId}...`);

          // Générer la réponse IA
          const startTime = Date.now();
          const reply = await processIncomingMessage(userId, from, text);
          const elapsed = Date.now() - startTime;

          if (!reply) {
            console.log(`ℹ️ [RITA] Rita désactivée ou pas de réponse pour userId=${userId} (${elapsed}ms)`);
            continue;
          }

          console.log(`🤖 [RITA] Réponse générée en ${elapsed}ms pour ${from}:`);
          console.log(`🤖 [RITA] "${reply.substring(0, 200)}"`);

          // Extraire le numéro propre depuis le JID WhatsApp (ex: 33612345678@s.whatsapp.net)
          const cleanFrom = from.replace(/@.*$/, '');

          // ─── Détecter tag [IMAGE:Nom du produit] pour envoi de photos ───
          const imageTagMatch = reply.match(/\[IMAGE:(.+?)\]/);
          let textToSend = reply;
          let imageUrl = null;

          if (imageTagMatch) {
            const productName = imageTagMatch[1].trim();
            textToSend = reply.replace(/\s*\[IMAGE:.+?\]/, '').trim();
            console.log(`📸 [RITA] Tag image détecté pour produit: "${productName}"`);

            // Chercher l'image dans le productCatalog
            const ritaCfg = await RitaConfig.findOne({ userId }).lean();
            const product = ritaCfg?.productCatalog?.find(
              p => p.name.toLowerCase() === productName.toLowerCase()
            );
            if (product?.images?.length) {
              imageUrl = product.images[0];
              console.log(`📸 [RITA] Image trouvée: ${imageUrl}`);
            } else {
              console.log(`📸 [RITA] Aucune image trouvée pour "${productName}"`);
            }
          }

          // Envoyer le texte
          if (textToSend) {
            console.log(`📤 [RITA] Envoi réponse texte à ${cleanFrom} via ${instanceDoc.instanceName}...`);
            const sendResult = await evolutionApiService.sendMessage(
              instanceDoc.instanceName,
              instanceDoc.instanceToken,
              cleanFrom,
              textToSend
            );
            if (sendResult.success) {
              console.log(`✅ [RITA] Réponse texte envoyée avec succès à ${cleanFrom}`);
            } else {
              console.error(`❌ [RITA] Échec envoi texte à ${cleanFrom}:`, sendResult.error);
            }
          }

          // Envoyer l'image si disponible
          if (imageUrl) {
            console.log(`📸 [RITA] Envoi image à ${cleanFrom}...`);
            const mediaResult = await evolutionApiService.sendMedia(
              instanceDoc.instanceName,
              instanceDoc.instanceToken,
              cleanFrom,
              imageUrl,
              '',
              'product.jpg'
            );
            if (mediaResult.success) {
              console.log(`✅ [RITA] Image envoyée avec succès à ${cleanFrom}`);
            } else {
              console.error(`❌ [RITA] Échec envoi image à ${cleanFrom}:`, mediaResult.error);
            }
          }
          console.log(`💬 [RITA] ══════════════════════════════════════`);
        }
      } else if (normalizedEvent === 'CONNECTION_UPDATE') {
        console.log(`🔌 [WH] Connexion mise à jour — instance: ${instance}, état: ${JSON.stringify(data?.state)}`);
      } else {
        console.log(`ℹ️ [WH INCOMING] Événement non traité: ${event}`);
      }
      console.log(`📩 ═══════════════════════════════════════════════════\n`);
    } catch (err) {
      console.error('❌ [WH INCOMING] Erreur traitement:', err.message);
      console.error(err.stack);
    }
  });
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

/**
 * @route   POST /api/ecom/v1/external/whatsapp/rita-config
 * @desc    Sauvegarder la configuration Rita IA d'un utilisateur
 */
router.post('/rita-config', async (req, res) => {
  try {
    const { userId, config } = req.body;
    if (!userId || !config) return res.status(400).json({ success: false, error: 'userId et config requis' });

    const updated = await RitaConfig.findOneAndUpdate(
      { userId },
      { userId, ...config },
      { upsert: true, new: true, runValidators: false }
    );

    res.status(200).json({ success: true, config: updated });
  } catch (error) {
    console.error('❌ Erreur sauvegarde rita-config:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/rita-config
 * @desc    Charger la configuration Rita IA d'un utilisateur
 */
router.get('/rita-config', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });

    const config = await RitaConfig.findOne({ userId }).lean();
    res.status(200).json({ success: true, config: config || null });
  } catch (error) {
    console.error('❌ Erreur chargement rita-config:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/ecom/v1/external/whatsapp/test-chat
 * @desc    Envoie un message au simulateur Rita et retourne la réponse IA (Groq)
 */
router.post('/test-chat', async (req, res) => {
  try {
    const { userId, messages } = req.body;
    if (!userId || !messages) return res.status(400).json({ success: false, error: 'userId et messages requis' });

    const config = await RitaConfig.findOne({ userId }).lean();
    if (!config) return res.status(404).json({ success: false, error: 'Configuration Rita introuvable. Enregistrez d\'abord.' });

    const reply = await generateTestReply(config, messages);
    res.status(200).json({ success: true, reply });
  } catch (error) {
    console.error('❌ Erreur test-chat:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
