import express from 'express';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';

const router = express.Router();

/**
 * GET /api/ecom/whatsapp-instances
 * Récupère toutes les instances WhatsApp du workspace
 */
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId || req.user.defaultWorkspace;
    
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
router.get('/:id', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId || req.user.defaultWorkspace;
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
router.post('/', requireEcomAuth, async (req, res) => {
  try {
    console.log('\n� === DÉBUT CRÉATION INSTANCE WHATSAPP ===');
    console.log('📱 Timestamp:', new Date().toISOString());
    console.log('📱 Request Headers:', {
      authorization: req.headers.authorization ? 'Bearer [HIDDEN]' : 'MISSING',
      'x-workspace-id': req.headers['x-workspace-id'],
      'content-type': req.headers['content-type']
    });
    console.log('📱 Request Body:', {
      name: req.body.name,
      instanceId: req.body.instanceId,
      apiKey: req.body.apiKey ? '[HIDDEN]' : 'MISSING'
    });
    console.log('📱 Request User:', {
      id: req.user?.id,
      email: req.ecomUser?.email,
      role: req.ecomUser?.role,
      userWorkspaceId: req.user?.defaultWorkspace,
      reqWorkspaceId: req.workspaceId
    });
    
    const workspaceId = req.workspaceId || req.user?.defaultWorkspace;
    const { name, instanceId, apiKey } = req.body;
    
    console.log('📱 Final workspaceId utilisé:', workspaceId);
    console.log('📱 WorkspaceId type:', typeof workspaceId);
    
    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'WorkspaceId manquant. Vérifiez votre configuration.'
      });
    }
    
    // Validation
    if (!name || !instanceId || !apiKey) {
      console.log('❌ Validation échouée - champs manquants');
      return res.status(400).json({
        success: false,
        message: 'Nom, Instance ID et Clé API requis'
      });
    }
    
    // Vérifier si l'instance existe déjà
    console.log('📱 Recherche instance existante...');
    const existingInstance = await WhatsAppInstance.findOne({
      workspaceId,
      instanceId
    });
    console.log('📱 Instance existante trouvée:', !!existingInstance);
    
    if (existingInstance) {
      console.log('❌ Instance déjà existante');
      return res.status(400).json({
        success: false,
        message: 'Une instance avec cet Instance ID existe déjà'
      });
    }
    
    // Tester la connexion à l'API (non bloquant, timeout 5s)
    console.log('📱 Test de connexion API...');
    let status = 'active';
    try {
      const fetchModule = await import('node-fetch');
      const fetch = fetchModule.default;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        console.log('⏰ Timeout API test atteint');
        controller.abort();
      }, 5000);
      
      const testResponse = await fetch('https://servicewhstapps.pages.dev/api/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ instanceId }),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      console.log('📱 API test response status:', testResponse.status);
      
      if (!testResponse.ok) {
        console.log('⚠️ API test failed, marking as inactive');
        status = 'inactive';
      } else {
        console.log('✅ API test successful');
      }
    } catch (err) {
      console.log('📱 Test API WhatsApp échoué (non bloquant):', err.message);
      status = 'inactive';
    }
    
    // Créer l'instance
    console.log('📱 Création de l\'instance en base de données...');
    const instance = new WhatsAppInstance({
      workspaceId,
      name,
      instanceId,
      apiKey,
      status
    });
    
    console.log('📱 Instance créée en mémoire, sauvegarde...');
    const savedInstance = await instance.save();
    console.log('✅ Instance sauvegardée avec succès:', savedInstance._id, 'Status:', savedInstance.status);
    
    // Retourner sans la clé API
    console.log('📱 Préparation de la réponse...');
    const instanceResponse = savedInstance.toObject();
    delete instanceResponse.apiKey;
    
    console.log('📱 Envoi de la réponse de succès');
    const response = {
      success: true,
      message: 'Instance WhatsApp créée avec succès',
      instance: instanceResponse
    };
    console.log('📱 Response à envoyer:', {
      success: response.success,
      message: response.message,
      instanceId: response.instance?._id,
      instanceName: response.instance?.name
    });
    
    res.json(response);
    console.log('✅ === CRÉATION INSTANCE TERMINÉE AVEC SUCCÈS ===\n');
  } catch (error) {
    console.error('\n💥 === ERREUR CRÉATION INSTANCE WHATSAPP ===');
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Request info:', {
      method: req.method,
      url: req.url,
      headers: Object.keys(req.headers),
      body: req.body ? Object.keys(req.body) : 'NO_BODY'
    });
    console.error('💥 === FIN ERREUR ===\n');
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'instance',
      debug: process.env.NODE_ENV !== 'production' ? {
        errorType: error.constructor.name,
        errorMessage: error.message
      } : undefined
    });
  }
});

/**
 * PUT /api/ecom/whatsapp-instances/:id
 * Met à jour une instance WhatsApp
 */
router.put('/:id', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId || req.user.defaultWorkspace;
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
router.delete('/:id', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId || req.user.defaultWorkspace;
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
