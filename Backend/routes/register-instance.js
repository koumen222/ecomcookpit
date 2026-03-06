import express from 'express';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';

const router = express.Router();

// POST /api/ecom/integrations/whatsapp/register-instance — Enregistrer une instance
router.post('/register-instance', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { instanceName, instanceSecret } = req.body;

    if (!instanceName || !instanceSecret) {
      return res.status(400).json({
        success: false,
        error: "Nom d'instance et secret requis"
      });
    }

    console.log("=== ENREGISTREMENT INSTANCE WHATSAPP ===");
    console.log("Workspace:", req.workspaceId);
    console.log("Instance Name:", instanceName);

    // Vérifier si l'instance existe déjà pour ce workspace
    const existingInstance = await WhatsAppInstance.findOne({
      workspaceId: req.workspaceId,
      instanceId: instanceName
    });

    if (existingInstance) {
      return res.status(400).json({
        success: false,
        error: "Cette instance existe déjà pour ce workspace"
      });
    }

    // Créer l'instance
    const instance = new WhatsAppInstance({
      workspaceId: req.workspaceId,
      name: instanceName,
      instanceId: instanceName,
      apiKey: instanceSecret,
      apiUrl: process.env.EVOLUTION_API_URL || process.env.WHATSAPP_API_URL || 'https://api.ecomcookpit.site',
      status: 'active'
    });

    await instance.save();

    console.log("✅ Instance enregistrée avec succès:", instance._id);

    res.json({
      success: true,
      message: "Instance WhatsApp enregistrée avec succès",
      instance: {
        id: instance._id,
        name: instance.name,
        instanceId: instance.instanceId,
        status: instance.status,
        createdAt: instance.createdAt
      }
    });

  } catch (error) {
    console.error("❌ ERREUR ENREGISTREMENT INSTANCE:", error.message);
    res.status(500).json({
      success: false,
      error: "Erreur lors de l'enregistrement de l'instance"
    });
  }
});

export default router;
