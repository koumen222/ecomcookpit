import express from 'express';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import Workspace from '../models/Workspace.js';
import { verifyWhatsAppConfig, sendWhatsAppMessageV2 } from '../services/whatsappIntegration.js';

const router = express.Router();

// POST /api/ecom/integrations/whatsapp/connect — Save + verify WhatsApp config
router.post('/connect', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  console.log("\n========== CONNECT WHATSAPP ==========");

  try {
    const { instanceName, instanceId, apiKey } = req.body;

    console.log("Workspace:", req.workspaceId);
    console.log("Instance Name:", instanceName);
    console.log("Instance ID:", instanceId);

    if (!instanceId || !apiKey) {
      return res.status(400).json({
        success: false,
        error: 'instanceId et apiKey sont requis'
      });
    }

    // ✅ Test réel de connexion
    await verifyWhatsAppConfig({ instanceId, apiKey });

    // ✅ Sauvegarde sur le workspace
    await Workspace.updateOne(
      { _id: req.workspaceId },
      {
        $set: {
          whatsapp: {
            instanceName: instanceName || instanceId,
            instanceId,
            apiKey,
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
    if (err.message === 'INVALID_TOKEN') userMessage = 'Clé API invalide ou expirée';
    if (err.message === 'INSTANCE_NOT_FOUND') userMessage = 'Instance non trouvée — vérifiez l\'Instance ID';
    if (err.message === 'MISSING_CREDENTIALS') userMessage = 'Instance ID et clé API requis';

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

    if (!workspace || !workspace.whatsapp?.instanceId) {
      return res.json({
        success: true,
        connected: false,
        whatsapp: null
      });
    }

    res.json({
      success: true,
      connected: workspace.whatsapp.connected || false,
      whatsapp: {
        instanceName: workspace.whatsapp.instanceName,
        instanceId: workspace.whatsapp.instanceId,
        connected: workspace.whatsapp.connected,
        verifiedAt: workspace.whatsapp.verifiedAt,
        // Never expose apiKey to frontend
        hasApiKey: !!workspace.whatsapp.apiKey
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

    if (!workspace?.whatsapp?.instanceId || !workspace?.whatsapp?.apiKey) {
      return res.status(400).json({ success: false, message: 'WhatsApp non configuré' });
    }

    const result = await sendWhatsAppMessageV2(
      { instanceId: workspace.whatsapp.instanceId, apiKey: workspace.whatsapp.apiKey },
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
