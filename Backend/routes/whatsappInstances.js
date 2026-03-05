import express from 'express';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';

const router = express.Router();

/**
 * GET /api/ecom/whatsapp-instances
 * Récupère toutes les instances WhatsApp du workspace
 */
router.get('/', requireEcomAuth, validateEcomAccess, async (req, res) => {
  try {
    const workspaceId = req.user.defaultWorkspace;
    
    const instances = await WhatsAppInstance.find({ workspaceId })
      .select('-apiKey') // Ne pas exposer la clé API dans la liste
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      instances
    });
  } catch (error) {
    console.error('Erreur récupération instances WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des instances'
    });
  }
});

/**
 * GET /api/ecom/whatsapp-instances/:id
 * Récupère une instance WhatsApp spécifique
 */
router.get('/:id', requireEcomAuth, validateEcomAccess, async (req, res) => {
  try {
    const workspaceId = req.user.defaultWorkspace;
    const { id } = req.params;
    
    const instance = await WhatsAppInstance.findOne({ 
      _id: id, 
      workspaceId 
    });
    
    if (!instance) {
      return res.status(404).json({
        success: false,
        message: 'Instance non trouvée'
      });
    }
    
    res.json({
      success: true,
      instance
    });
  } catch (error) {
    console.error('Erreur récupération instance WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'instance'
    });
  }
});

/**
 * POST /api/ecom/whatsapp-instances
 * Crée une nouvelle instance WhatsApp
 */
router.post('/', requireEcomAuth, validateEcomAccess, async (req, res) => {
  try {
    const workspaceId = req.user.defaultWorkspace;
    const { name, instanceId, apiKey } = req.body;
    
    // Validation
    if (!name || !instanceId || !apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Nom, Instance ID et Clé API requis'
      });
    }
    
    // Vérifier si l'instance existe déjà
    const existingInstance = await WhatsAppInstance.findOne({
      workspaceId,
      instanceId
    });
    
    if (existingInstance) {
      return res.status(400).json({
        success: false,
        message: 'Une instance avec cet Instance ID existe déjà'
      });
    }
    
    // Tester la connexion à l'API
    let status = 'active';
    try {
      const fetchModule = await import('node-fetch');
      const fetch = fetchModule.default;
      
      const testResponse = await fetch('https://servicewhstapps.pages.dev/api/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ instanceId })
      });
      
      if (!testResponse.ok) {
        status = 'error';
      }
    } catch (err) {
      status = 'error';
    }
    
    // Créer l'instance
    const instance = new WhatsAppInstance({
      workspaceId,
      name,
      instanceId,
      apiKey,
      status
    });
    
    await instance.save();
    
    // Retourner sans la clé API
    const instanceResponse = instance.toObject();
    delete instanceResponse.apiKey;
    
    res.json({
      success: true,
      message: 'Instance WhatsApp créée avec succès',
      instance: instanceResponse
    });
  } catch (error) {
    console.error('Erreur création instance WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'instance'
    });
  }
});

/**
 * PUT /api/ecom/whatsapp-instances/:id
 * Met à jour une instance WhatsApp
 */
router.put('/:id', requireEcomAuth, validateEcomAccess, async (req, res) => {
  try {
    const workspaceId = req.user.defaultWorkspace;
    const { id } = req.params;
    const { name, instanceId, apiKey } = req.body;
    
    const instance = await WhatsAppInstance.findOne({ 
      _id: id, 
      workspaceId 
    });
    
    if (!instance) {
      return res.status(404).json({
        success: false,
        message: 'Instance non trouvée'
      });
    }
    
    // Mettre à jour les champs
    if (name) instance.name = name;
    if (instanceId) instance.instanceId = instanceId;
    if (apiKey) instance.apiKey = apiKey;
    
    await instance.save();
    
    // Retourner sans la clé API
    const instanceResponse = instance.toObject();
    delete instanceResponse.apiKey;
    
    res.json({
      success: true,
      message: 'Instance mise à jour avec succès',
      instance: instanceResponse
    });
  } catch (error) {
    console.error('Erreur mise à jour instance WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'instance'
    });
  }
});

/**
 * DELETE /api/ecom/whatsapp-instances/:id
 * Supprime une instance WhatsApp
 */
router.delete('/:id', requireEcomAuth, validateEcomAccess, async (req, res) => {
  try {
    const workspaceId = req.user.defaultWorkspace;
    const { id } = req.params;
    
    const instance = await WhatsAppInstance.findOneAndDelete({ 
      _id: id, 
      workspaceId 
    });
    
    if (!instance) {
      return res.status(404).json({
        success: false,
        message: 'Instance non trouvée'
      });
    }
    
    res.json({
      success: true,
      message: 'Instance supprimée avec succès'
    });
  } catch (error) {
    console.error('Erreur suppression instance WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'instance'
    });
  }
});

export default router;
