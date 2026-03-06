import express from 'express';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';

const router = express.Router();

// POST /api/ecom/integrations/whatsapp/test-connection — Test de connexion Service 3
router.post('/test-connection', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { instanceName, instanceSecret } = req.body;

    if (!instanceName || !instanceSecret) {
      return res.status(400).json({
        success: false,
        error: "Nom d'instance et secret requis",
        connected: false
      });
    }

    console.log("=== SERVICE 3 - TEST DE CONNEXION ===");
    console.log("Nom de l'instance:", instanceName);
    console.log("API URL:", process.env.EVOLUTION_API_URL || process.env.WHATSAPP_API_URL || 'https://api.ecomcookpit.site');
    console.log("Utilise le secret de l'instance (caché)");

    const apiUrl = process.env.EVOLUTION_API_URL || process.env.WHATSAPP_API_URL || 'https://api.ecomcookpit.site';
    
    const response = await fetch(
      `${apiUrl}/instance/connectionState/${instanceName}`,
      {
        method: "GET",
        headers: {
          "apikey": instanceSecret
        }
      }
    );

    if (!response.ok) {
      console.error("❌ Erreur HTTP:", response.status, response.statusText);
      return res.status(response.status).json({
        success: false,
        connected: false,
        error: `Erreur HTTP ${response.status}: ${response.statusText}`,
        details: await response.text()
      });
    }

    const data = await response.json();
    console.log("Réponse Evolution API:", JSON.stringify(data, null, 2));

    const isConnected = data.instance?.state === "open";
    
    if (isConnected) {
      console.log("✅ CONNEXION RÉUSSIE - Instance connectée");
    } else {
      console.log("⚠️ CONNEXION ÉCHOUÉE - Instance non connectée");
      console.log("Status actuel:", data.instance?.state);
    }

    res.json({
      success: true,
      connected: isConnected,
      status: data.instance?.state,
      instanceId: instanceName,
      message: isConnected 
        ? "✅ Instance connectée - Prêt à envoyer des messages" 
        : "⚠️ Instance non connectée - Scanner le QR code d'abord",
      fullData: data
    });

  } catch (error) {
    console.error("❌ ERREUR CRITIQUE:", error.message);
    console.error("Stack:", error.stack);
    
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

export default router;
