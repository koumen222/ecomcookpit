import express from 'express';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';

const router = express.Router();

// POST /api/ecom/integrations/whatsapp/send-message — Envoi de messages Service 3
router.post('/send-message', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { instanceName, instanceSecret, phoneNumber, message } = req.body;

    if (!instanceName || !instanceSecret || !phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: "Nom d'instance, secret, numéro de téléphone et message requis",
        sent: false
      });
    }

    console.log("=== SERVICE 3 - ENVOI MESSAGE ===")
    console.log("Nom de l'instance:", instanceName)
    console.log("Numéro de téléphone:", phoneNumber)
    console.log("Message:", message)
    console.log("API URL:", process.env.EVOLUTION_API_URL || process.env.WHATSAPP_API_URL || 'https://api.ecomcookpit.site')
    console.log("Envoi sans token (Service 3)")

    const apiUrl = process.env.EVOLUTION_API_URL || process.env.WHATSAPP_API_URL || 'https://api.ecomcookpit.site';

    const response = await fetch(
      `${apiUrl}/message/sendText/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
          // Pas de header apikey - envoi sans token
        },
        body: JSON.stringify({
          number: phoneNumber,
          text: message
        })
      }
    );

    if (!response.ok) {
      console.error("❌ Erreur HTTP:", response.status, response.statusText);
      return res.status(response.status).json({
        success: false,
        sent: false,
        error: `Erreur HTTP ${response.status}: ${response.statusText}`,
        details: await response.text()
      });
    }

    const data = await response.json();
    console.log("Réponse Evolution API:", JSON.stringify(data, null, 2));

    console.log("✅ MESSAGE ENVOYÉ AVEC SUCCÈS");

    res.json({
      success: true,
      sent: true,
      message: "✅ Message envoyé avec succès",
      phoneNumber: phoneNumber,
      instanceName: instanceName,
      fullData: data
    });

  } catch (error) {
    console.error("❌ ERREUR CRITIQUE:", error.message);
    console.error("Stack:", error.stack);
    
    res.status(500).json({
      success: false,
      sent: false,
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

export default router;
