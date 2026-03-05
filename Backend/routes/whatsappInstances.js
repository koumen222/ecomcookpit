import express from 'express';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';

const router = express.Router();

const WA_API_BASE = 'https://api.ecomcookpit.site';

/**
 * Vérifie le statut réel d'une instance via l'API WhatsApp
 * @returns {'active'|'inactive'|'error'}
 */
async function checkRealStatus(instanceId, apiKey) {
  try {
    const fetchModule = await import('node-fetch');
    const fetch = fetchModule.default;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${WA_API_BASE}/api/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ instanceId }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) return 'inactive';

    const data = await response.json().catch(() => null);
    if (!data) return 'inactive';

    // L'API peut retourner { status: 'connected' } ou { connected: true } etc.
    const connected = data.status === 'connected' || data.status === 'active' || data.connected === true || data.success === true;
    return connected ? 'active' : 'inactive';
  } catch (err) {
    console.log(`[WA Status] Check failed for ${instanceId}:`, err.message);
    return 'error';
  }
}

/**
 * GET /api/ecom/whatsapp-instances
 * Récupère toutes les instances WhatsApp du workspace
 * Query param: ?checkStatus=true pour vérifier le statut réel (plus lent)
 */
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId || req.user.defaultWorkspace;
    const shouldCheckStatus = req.query.checkStatus === 'true';

    const instances = await WhatsAppInstance.find({ workspaceId })
      .sort({ createdAt: -1 });

    // Vérifier le statut réel seulement si demandé explicitement
    if (shouldCheckStatus) {
      const instancesWithStatus = await Promise.all(
        instances.map(async (inst) => {
          const realStatus = await checkRealStatus(inst.instanceId, inst.apiKey);
          // Mettre à jour en DB si le statut a changé
          if (inst.status !== realStatus) {
            inst.status = realStatus;
            await inst.save();
          }
          const obj = inst.toObject();
          delete obj.apiKey;
          return obj;
        })
      );

      return res.json({
        success: true,
        instances: instancesWithStatus
      });
    }

    // Sinon, retourner les instances avec le statut en DB (rapide)
    const instancesData = instances.map(inst => {
      const obj = inst.toObject();
      delete obj.apiKey;
      return obj;
    });

    res.json({
      success: true,
      instances: instancesData
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
    
    // Tester la connexion à l'API (non bloquant, timeout 8s)
    console.log('📱 Test de connexion API via', WA_API_BASE);
    const status = await checkRealStatus(instanceId, apiKey);
    console.log('📱 Statut réel détecté:', status);
    
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
 * POST /api/ecom/whatsapp-instances/:id/check-status
 * Vérifie le statut réel d'une instance et met à jour en DB
 */
router.post('/:id/check-status', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId || req.user.defaultWorkspace;
    const { id } = req.params;

    const instance = await WhatsAppInstance.findOne({ _id: id, workspaceId });
    if (!instance) {
      return res.status(404).json({ success: false, message: 'Instance non trouvée' });
    }

    const realStatus = await checkRealStatus(instance.instanceId, instance.apiKey);
    instance.status = realStatus;
    await instance.save();

    const obj = instance.toObject();
    delete obj.apiKey;

    res.json({
      success: true,
      status: realStatus,
      instance: obj
    });
  } catch (error) {
    console.error('Erreur check-status:', error);
    res.status(500).json({ success: false, message: 'Erreur vérification statut' });
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
