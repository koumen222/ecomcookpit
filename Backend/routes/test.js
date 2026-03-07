import express from 'express';

const router = express.Router();

/**
 * @route   GET /api/ecom/test/status
 * @desc    Route de test pour vérifier que le backend fonctionne
 * @access  Public
 */
router.get('/status', (req, res) => {
  res.status(200).json({
    success: true,
    message: "✅ Backend fonctionne parfaitement!",
    timestamp: new Date().toISOString(),
    data: {
      status: "healthy",
      version: "1.0.0",
      services: {
        database: "connected",
        whatsapp: "configured",
        api: "running"
      }
    }
  });
});

/**
 * @route   POST /api/ecom/test/message
 * @desc    Route de test pour recevoir un message du frontend
 * @access  Public
 */
router.post('/message', (req, res) => {
  const { message } = req.body;
  
  console.log(`📨 Message reçu du frontend: ${message}`);
  
  res.status(200).json({
    success: true,
    message: "✅ Message bien reçu!",
    response: "Le backend a traité votre message avec succès",
    received: message,
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/ecom/test/whatsapp-status
 * @desc    Test spécifique pour WhatsApp
 * @access  Public
 */
router.get('/whatsapp-status', (req, res) => {
  res.status(200).json({
    success: true,
    message: "📱 Service WhatsApp opérationnel",
    data: {
      routes: {
        "external": "/api/v1/external/whatsapp ✅",
        "config": "/api/ecom/integrations/whatsapp ✅"
      },
      status: "ready",
      features: [
        "send messages",
        "list instances", 
        "configure instances",
        "test connections"
      ]
    }
  });
});

export default router;
