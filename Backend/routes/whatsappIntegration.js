import express from 'express';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import Workspace from '../models/Workspace.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import { verifyWhatsAppConfig, sendWhatsAppMessageV2 } from '../services/whatsappIntegration.js';

const router = express.Router();

// POST /api/ecom/integrations/whatsapp/connect — Save + verify WhatsApp config
router.post('/connect', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  console.log("\n========== CONNECT WHATSAPP ==========");

  try {
    const { instanceName, instanceId, instanceToken, apiKey } = req.body;
    let token = instanceToken || apiKey;

    console.log("Workspace:", req.workspaceId);
    console.log("Instance Name:", instanceName);
    console.log("Instance ID:", instanceId);

    if (!instanceId) {
      return res.status(400).json({
        success: false,
        error: 'instanceId est requis'
      });
    }

    if (!token) {
      const storedInstance = await WhatsAppInstance.findOne({
        workspaceId: req.workspaceId,
        instanceId
      }).select('apiKey').lean();

      token = storedInstance?.apiKey || '';
    }

    // 2) Appeler API externe /instance/status (via service)
    await verifyWhatsAppConfig({ instanceId, apiKey: token });

    // 3) Si OK: enregistrer l'instance
    await Workspace.updateOne(
      { _id: req.workspaceId },
      {
        $set: {
          whatsapp: {
            instanceName: instanceName || instanceId,
            workspaceId: String(req.workspaceId),
            externalInstanceId: instanceId,
            externalToken: token || '',
            provider: 'evolution_api',
            status: 'connected',
            // Legacy compatibility
            instanceId,
            apiKey: token || '',
            connected: true,
            verifiedAt: new Date()
          }
        }
      }
    );

    console.log("✅ WhatsApp config saved");
    console.log("=====================================\n");

    res.json({ success: true, message: 'WhatsApp connecté avec succès' });

  } catch (err) {
    console.log("💥 ERROR:", err.message);

    let userMessage = 'Erreur de connexion WhatsApp';
    if (err.message === 'INVALID_TOKEN') userMessage = 'Clé API serveur invalide ou expirée';
    if (err.message === 'INVALID_TOKEN_FORMAT') userMessage = 'Le token configuré côté serveur est invalide.';
    if (err.message === 'INSTANCE_NOT_FOUND') userMessage = 'Instance non trouvée — vérifiez l\'Instance ID';
    if (err.message === 'MISSING_CREDENTIALS') userMessage = 'Configuration serveur incomplète (clé API manquante).';

    res.status(400).json({
      success: false,
      error: err.message,
      message: userMessage
    });
  }
});

// GET /api/ecom/integrations/whatsapp/status — Get current WhatsApp config status
router.get('/status', requireEcomAuth, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.workspaceId).select('whatsapp').lean();
    const wa = workspace?.whatsapp;
    const resolvedInstanceId = wa?.externalInstanceId || wa?.instanceId;
    const resolvedConnected = wa?.status === 'connected' || !!wa?.connected;

    if (!workspace || !resolvedInstanceId) {
      return res.json({
        success: true,
        connected: false,
        whatsapp: null
      });
    }

    res.json({
      success: true,
      connected: resolvedConnected,
      whatsapp: {
        instanceName: wa.instanceName,
        instanceId: resolvedInstanceId,
        externalInstanceId: wa.externalInstanceId || '',
        provider: wa.provider || 'evolution_api',
        status: wa.status || (resolvedConnected ? 'connected' : 'disconnected'),
        connected: resolvedConnected,
        verifiedAt: wa.verifiedAt,
        hasInstanceToken: !!(wa.externalToken || wa.apiKey)
      }
    });

  } catch (err) {
    console.error('Erreur status WhatsApp:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/integrations/whatsapp/disconnect — Remove WhatsApp config
router.post('/disconnect', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    await Workspace.updateOne(
      { _id: req.workspaceId },
      {
        $set: {
          whatsapp: {
            instanceName: '',
            workspaceId: '',
            externalInstanceId: '',
            externalToken: '',
            provider: 'evolution_api',
            status: 'disconnected',
            // Legacy compatibility
            instanceId: '',
            apiKey: '',
            connected: false,
            verifiedAt: null
          }
        }
      }
    );

    res.json({ success: true, message: 'WhatsApp déconnecté' });
  } catch (err) {
    console.error('Erreur disconnect WhatsApp:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/integrations/whatsapp/test — Send a test message
router.post('/test', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ success: false, message: 'Numéro et message requis' });
    }

    const workspace = await Workspace.findById(req.workspaceId).select('whatsapp').lean();
    const wa = workspace?.whatsapp;
    const resolvedInstanceId = wa?.externalInstanceId || wa?.instanceId;
    let resolvedToken = wa?.externalToken || wa?.apiKey;

    if (!resolvedInstanceId) {
      return res.status(400).json({ success: false, message: 'WhatsApp non configuré' });
    }

    if (!resolvedToken) {
      const storedInstance = await WhatsAppInstance.findOne({
        workspaceId: req.workspaceId,
        instanceId: resolvedInstanceId
      }).select('apiKey').lean();

      resolvedToken = storedInstance?.apiKey || '';
    }

    const result = await sendWhatsAppMessageV2(
      { instanceId: resolvedInstanceId, apiKey: resolvedToken },
      phone,
      message
    );

    res.json({ success: true, message: 'Message test envoyé', data: result });
  } catch (err) {
    console.error('Erreur test WhatsApp:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
