/**
 * Routes pour la configuration WhatsApp
 * Permet aux utilisateurs de configurer leur numéro WhatsApp avec ZeChat API
 */

import express from 'express';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';

const router = express.Router();

// Modèle pour stocker la configuration WhatsApp par workspace
const whatsappConfigs = new Map(); // En production, utiliser MongoDB/PostgreSQL

/**
 * GET /api/ecom/whatsapp-config
 * Récupère la configuration WhatsApp du workspace
 */
router.get('/', requireEcomAuth, validateEcomAccess, (req, res) => {
  try {
    const workspaceId = req.user.defaultWorkspace;
    const config = whatsappConfigs.get(workspaceId) || {};
    
    // Masquer les informations sensibles
    const safeConfig = {
      isConfigured: !!config.instanceId && !!config.apiKey,
      phoneNumber: config.phoneNumber || '',
      instanceId: config.instanceId ? config.instanceId.substring(0, 4) + '****' : '',
      status: config.status || 'inactive',
      lastVerified: config.lastVerified || null,
      messagesSent: config.messagesSent || 0,
      dailyLimit: config.dailyLimit || 100
    };
    
    res.json({ success: true, config: safeConfig });
  } catch (error) {
    console.error('Erreur récupération config WhatsApp:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération de la configuration' 
    });
  }
});

/**
 * POST /api/ecom/whatsapp-config
 * Configure ou met à jour la configuration WhatsApp
 */
router.post('/', requireEcomAuth, validateEcomAccess, async (req, res) => {
  try {
    const workspaceId = req.user.defaultWorkspace;
    const { phoneNumber, instanceId, apiKey, apiUrl } = req.body;
    
    // Validation des champs requis
    if (!phoneNumber || !instanceId || !apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Numéro de téléphone, Instance ID et clé API requis'
      });
    }
    
    // Valider le format du numéro
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    if (cleanedPhone.length < 8 || cleanedPhone.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Format de numéro de téléphone invalide (8-15 chiffres)'
      });
    }
    
    // Tester la configuration avec la nouvelle API
    let verificationStatus = 'pending';
    let verificationMessage = '';
    
    try {
      const testUrl = apiUrl || 'https://api.ecomcookpit.site';
      const endpoint = `${testUrl}/api/status`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          instanceId: instanceId.trim(),
          phone: cleanedPhone
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        verificationStatus = 'active';
        verificationMessage = 'API WhatsApp connectée et active';
      } else {
        verificationStatus = 'error';
        verificationMessage = 'Instance ID ou clé API invalide';
      }
    } catch (verifyError) {
      verificationStatus = 'error';
      verificationMessage = 'Erreur de connexion à l\'API WhatsApp';
    }
    
    // Sauvegarder la configuration
    const config = {
      workspaceId,
      phoneNumber: cleanedPhone,
      instanceId: instanceId.trim(),
      apiKey: apiKey.trim(),
      apiUrl: (apiUrl || 'https://api.ecomcookpit.site').trim(),
      status: verificationStatus,
      lastVerified: new Date(),
      messagesSent: whatsappConfigs.get(workspaceId)?.messagesSent || 0,
      dailyLimit: 100,
      createdAt: whatsappConfigs.get(workspaceId)?.createdAt || new Date(),
      updatedAt: new Date()
    };
    
    whatsappConfigs.set(workspaceId, config);
    
    // Configuration d'environnement pour le service WhatsApp
    if (verificationStatus === 'active') {
      process.env.WHATSAPP_INSTANCE_ID = instanceId;
      process.env.WHATSAPP_API_KEY = apiKey;
      process.env.WHATSAPP_API_URL = config.apiUrl;
      process.env.WHATSAPP_PHONE_NUMBER = cleanedPhone;
    }
    
    res.json({
      success: true,
      message: 'Configuration WhatsApp sauvegardée',
      status: verificationStatus,
      statusMessage: verificationMessage
    });
    
  } catch (error) {
    console.error('Erreur sauvegarde config WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la sauvegarde de la configuration'
    });
  }
});

/**
 * POST /api/ecom/whatsapp-config/test
 * Teste la configuration WhatsApp en envoyant un message au numéro configuré
 */
router.post('/test', requireEcomAuth, validateEcomAccess, async (req, res) => {
  try {
    const workspaceId = req.user.defaultWorkspace;
    const config = whatsappConfigs.get(workspaceId);
    
    if (!config || !config.apiKey || !config.instanceId) {
      return res.status(400).json({
        success: false,
        message: 'Configuration WhatsApp incomplète. Configurez d\'abord votre compte.'
      });
    }
    
    // Message de test
    const testMessage = `🧪 Test de configuration WhatsApp\n\nVotre intégration fonctionne parfaitement !\n\nEnvoyé le ${new Date().toLocaleString('fr-FR')}\n\n✅ Prêt pour vos campagnes marketing`;
    
    try {
      const endpoint = `${config.apiUrl}/api/send`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          instanceId: config.instanceId,
          phone: config.phoneNumber,
          message: testMessage
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Incrémenter le compteur de messages
        config.messagesSent = (config.messagesSent || 0) + 1;
        config.lastVerified = new Date();
        config.status = 'active';
        whatsappConfigs.set(workspaceId, config);
        
        res.json({
          success: true,
          message: 'Message de test envoyé avec succès !',
          messageId: data.id || data.messageId
        });
      } else {
        res.status(400).json({
          success: false,
          message: `Échec de l'envoi: ${data.error || 'Erreur inconnue'}`
        });
      }
      
    } catch (sendError) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi du message de test'
      });
    }
    
  } catch (error) {
    console.error('Erreur test WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du test de configuration'
    });
  }
});

/**
 * GET /api/ecom/whatsapp-config/qr-code
 * Récupère le QR Code pour l'authentification WhatsApp
 */
router.get('/qr-code', requireEcomAuth, validateEcomAccess, async (req, res) => {
  try {
    const workspaceId = req.user.defaultWorkspace;
    const config = whatsappConfigs.get(workspaceId);
    
    if (!config || !config.instanceId || !config.apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Configuration non trouvée'
      });
    }
    
    try {
      const qrUrl = `${config.apiUrl}/api/qr?instanceId=${config.instanceId}`;
      const response = await fetch(qrUrl, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        }
      });
      
      if (response.ok) {
        const qrData = await response.text();
        res.json({
          success: true,
          qrCode: qrData,
          qrUrl: qrUrl
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'QR Code non disponible (instance peut-être déjà connectée)'
        });
      }
    } catch (qrError) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du QR Code'
      });
    }
    
  } catch (error) {
    console.error('Erreur QR Code:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/ecom/whatsapp-config/send-message
 * Envoie un message WhatsApp personnalisé
 */
router.post('/send-message', requireEcomAuth, validateEcomAccess, async (req, res) => {
  try {
    const workspaceId = req.user.defaultWorkspace;
    const { phoneNumber, message, productData } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        message: 'Numéro de téléphone et message requis'
      });
    }
    
    const config = whatsappConfigs.get(workspaceId);
    if (!config || config.status !== 'active' || !config.instanceId) {
      return res.status(400).json({
        success: false,
        message: 'Configuration WhatsApp inactive ou incomplète. Configurez d\'abord votre compte.'
      });
    }
    
    // Nettoyer le numéro de téléphone
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    if (cleanedPhone.length < 8 || cleanedPhone.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Format de numéro invalide'
      });
    }
    
    // Personnaliser le message si des données produit sont fournies
    let finalMessage = message;
    if (productData) {
      // Remplacer les placeholders avec les données du produit
      finalMessage = finalMessage
        .replace(/\[PRODUIT\]/g, productData.name || '[PRODUIT]')
        .replace(/\[PRIX\]/g, productData.price ? `${productData.price} XAF` : '[PRIX]')
        .replace(/\[LIEN\]/g, productData.link || '[LIEN]');
    }
    
    try {
      const endpoint = `${config.apiUrl}/api/send`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          instanceId: config.instanceId,
          phone: cleanedPhone,
          message: finalMessage
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Incrémenter le compteur
        config.messagesSent = (config.messagesSent || 0) + 1;
        whatsappConfigs.set(workspaceId, config);
        
        res.json({
          success: true,
          message: 'Message envoyé avec succès',
          messageId: data.id || data.messageId,
          sentTo: cleanedPhone
        });
      } else {
        res.status(400).json({
          success: false,
          message: `Échec de l'envoi: ${data.error || 'Erreur inconnue'}`
        });
      }
      
    } catch (sendError) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi du message'
      });
    }
    
  } catch (error) {
    console.error('Erreur envoi message WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'envoi'
    });
  }
});

/**
 * DELETE /api/ecom/whatsapp-config
 * Supprime la configuration WhatsApp
 */
router.delete('/', requireEcomAuth, validateEcomAccess, (req, res) => {
  try {
    const workspaceId = req.user.defaultWorkspace;
    
    if (whatsappConfigs.has(workspaceId)) {
      whatsappConfigs.delete(workspaceId);
      
      // Nettoyer les variables d'environnement si c'était la config active
      if (process.env.WHATSAPP_INSTANCE_ID) {
        delete process.env.WHATSAPP_INSTANCE_ID;
        delete process.env.WHATSAPP_API_KEY;
        delete process.env.WHATSAPP_API_URL;
      }
      
      res.json({
        success: true,
        message: 'Configuration WhatsApp supprimée'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Aucune configuration trouvée'
      });
    }
    
  } catch (error) {
    console.error('Erreur suppression config WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression'
    });
  }
});

export default router;
