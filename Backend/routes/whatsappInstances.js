import express from 'express';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';

const router = express.Router();

const WA_API_BASE = 'https://api.ecomcookpit.site';
// Evolution API: vérification désactivée - le statut sera vérifié lors de l'envoi
const SKIP_STATUS_CHECK = true;

/**
 * Vérifie le statut réel d'une instance via l'API WhatsApp
 * @returns {{ status: 'active'|'inactive'|'error', message: string, httpStatus?: number }}
 */
async function checkRealStatus(instanceId, apiKey) {
  if (!instanceId || !apiKey) {
    return { status: 'inactive', message: 'Instance ID ou clé API manquant' };
  }

  // Si la vérification est désactivée, marquer comme active par défaut
  if (SKIP_STATUS_CHECK) {
    console.log(`✅ [WA Status] Instance ${instanceId} marquée comme active (vérification désactivée)`);
    return { 
      status: 'active', 
      message: 'Instance configurée (statut non vérifié - sera testé lors de l\'envoi)' 
    };
  }

  // Evolution API: GET /instance/connectionState/{instanceId}
  try {
    const fetchModule = await import('node-fetch');
    const fetch = fetchModule.default;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const statusUrl = `${WA_API_BASE}/api/instance/connectionState/${instanceId}`;
    
    const globalKey = process.env.EVOLUTION_GLOBAL_API_KEY?.trim();
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': globalKey ? `Bearer ${globalKey}` : ''
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    const rawText = await response.text().catch(() => '');
    let data = null;
    try { data = rawText ? JSON.parse(rawText) : null; } catch (_) {}

    console.log(`\n🔍 [Evolution API Status] Instance: ${instanceId}`);
    console.log(`📡 API URL: ${statusUrl}`);
    console.log(`📊 HTTP Status: ${response.status} ${response.statusText}`);
    console.log(`📄 Response Body: ${rawText.substring(0, 500)}`);

    if (response.status === 401 || response.status === 403) {
      return { status: 'inactive', message: 'Clé API invalide ou non autorisée', httpStatus: response.status };
    }

    if (response.status === 404) {
      return { status: 'inactive', message: 'Instance ID introuvable sur le serveur', httpStatus: response.status };
    }

    if (response.ok) {
      // Evolution API retourne { instance: { state: 'open' | 'close' | 'connecting' } }
      const state = data?.instance?.state || data?.state;
      if (state === 'open') {
        return { status: 'active', message: 'Instance connectée et active', httpStatus: response.status };
      } else if (state === 'connecting') {
        return { status: 'inactive', message: 'Instance en cours de connexion...', httpStatus: response.status };
      } else {
        return { status: 'inactive', message: `Instance déconnectée (état: ${state || 'inconnu'})`, httpStatus: response.status };
      }
    }

    const apiMsg = data?.message || data?.error || `Erreur HTTP ${response.status}`;
    return { status: 'inactive', message: apiMsg, httpStatus: response.status };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { status: 'error', message: 'Timeout — API WhatsApp ne répond pas (>8s)' };
    }
    console.log(`[Evolution API Status] Check failed for ${instanceId}:`, err.message);
    return { status: 'error', message: `Erreur réseau: ${err.message}` };
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
          const result = await checkRealStatus(inst.instanceId, inst.apiKey);
          // Mettre à jour en DB si le statut a changé
          if (inst.status !== result.status) {
            inst.status = result.status;
            await inst.save();
          }
          const obj = inst.toObject();
          delete obj.apiKey;
          obj.statusMessage = result.message;
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
 * GET /api/ecom/whatsapp-instances/diagnose
 * Diagnostic: liste les instances disponibles sur l'API Evolution
 */
router.get('/diagnose', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId || req.user.defaultWorkspace;
    
    // Récupérer toutes les instances locales pour avoir les apiKeys
    const localInstances = await WhatsAppInstance.find({ workspaceId });
    
    if (localInstances.length === 0) {
      return res.json({ success: false, message: 'Aucune instance locale configurée' });
    }

    const fetchModule = await import('node-fetch');
    const fetch = fetchModule.default;
    
    const results = [];
    
    for (const inst of localInstances) {
      const diagResult = { 
        localName: inst.name, 
        localInstanceId: inst.instanceId,
        apiUrl: inst.apiUrl || WA_API_BASE
      };
      
      try {
        // Evolution API: GET /instance/fetchInstances pour lister toutes les instances
        const apiUrl = inst.apiUrl || WA_API_BASE;
        const listUrl = `${apiUrl}/api/instance/fetchInstances`;
        
        console.log(`\n🔍 [Diagnose] Fetching instances from: ${listUrl}`);
        
        const response = await fetch(listUrl, {
          method: 'GET',
          headers: { 'apikey': inst.apiKey }
        });
        
        const rawText = await response.text();
        console.log(`📊 HTTP ${response.status}: ${rawText.substring(0, 1000)}`);
        
        let data;
        try { data = JSON.parse(rawText); } catch(e) { data = rawText; }
        
        if (response.ok && Array.isArray(data)) {
          diagResult.apiInstances = data.map(i => ({
            instanceName: i.instance?.instanceName || i.instanceName,
            instanceId: i.instance?.instanceId || i.instanceId,
            status: i.instance?.status || i.status,
            state: i.instance?.state
          }));
          diagResult.success = true;
        } else {
          diagResult.success = false;
          diagResult.error = data?.message || data?.error || `HTTP ${response.status}`;
          diagResult.rawResponse = rawText.substring(0, 500);
        }
      } catch (err) {
        diagResult.success = false;
        diagResult.error = err.message;
      }
      
      results.push(diagResult);
    }
    
    res.json({ success: true, diagnostics: results });
  } catch (error) {
    console.error('Erreur diagnostic:', error);
    res.status(500).json({ success: false, message: error.message });
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
    const statusResult = await checkRealStatus(instanceId, apiKey);
    console.log('📱 Statut réel détecté:', statusResult);
    
    // Créer l'instance
    console.log('📱 Création de l\'instance en base de données...');
    const instance = new WhatsAppInstance({
      workspaceId,
      name,
      instanceId,
      apiKey,
      apiUrl: WA_API_BASE,
      status: statusResult.status
    });
    
    console.log('📱 Instance créée en mémoire, sauvegarde...');
    const savedInstance = await instance.save();
    console.log('✅ Instance sauvegardée avec succès:', savedInstance._id, 'Status:', savedInstance.status);
    
    // Retourner sans la clé API
    const instanceResponse = savedInstance.toObject();
    delete instanceResponse.apiKey;
    
    res.json({
      success: true,
      message: 'Instance WhatsApp créée avec succès',
      statusMessage: statusResult.message,
      instance: instanceResponse
    });
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

    const result = await checkRealStatus(instance.instanceId, instance.apiKey);
    instance.status = result.status;
    await instance.save();

    const obj = instance.toObject();
    delete obj.apiKey;

    res.json({
      success: true,
      status: result.status,
      statusMessage: result.message,
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
