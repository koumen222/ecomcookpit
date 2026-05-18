import express from 'express';
import RitaConfig from '../models/RitaConfig.js';
import Workspace from '../models/Workspace.js';
import { requireEcomAuth, requireRitaAgentAccess } from '../middleware/ecomAuth.js';
import { sanitizeRitaConfigForResponse } from '../utils/ritaConfigResponse.js';

const router = express.Router();

/**
 * Résoudre le userId via le workspace owner
 * (La RitaConfig est toujours liée à l'owner du workspace, pas au membre qui la gère)
 */
async function resolveRitaUserId(req) {
  if (req.ecomUser?.role === 'super_admin') {
    return req.body?.userId || req.query?.userId || String(req.ecomUser._id);
  }

  // Résoudre via le workspace owner
  const wsId = req.workspaceId || req.ecomUser?.workspaceId;
  if (wsId) {
    try {
      const ws = await Workspace.findById(wsId).select('owner').lean();
      if (ws?.owner) return String(ws.owner);
    } catch (e) {
      console.warn('⚠️ resolveRitaUserId: workspace owner lookup failed:', e.message);
    }
  }

  return String(req.ecomUser?._id || '');
}

/**
 * GET /api/ecom/rita/config
 * Récupérer la configuration Rita de l'utilisateur
 */
router.get('/config', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const userId = await resolveRitaUserId(req);
    console.log(`📋 [RITA] GET /config pour userId=${userId}`);

    const config = await RitaConfig.findOne({ userId }).lean();

    if (!config) {
      console.log(`ℹ️ [RITA] Aucune config trouvée pour userId=${userId} - retour config vide`);
      return res.json({
        success: true,
        config: null, // Frontend créera une config par défaut
      });
    }

    console.log(`✅ [RITA] Config chargée - ${config.productCatalog?.length || 0} produits`);
    res.json({
      success: true,
      config: {
        // Identité
        enabled: config.enabled || false,
        instanceId: config.instanceId || '',
        agentName: config.agentName || 'Rita',
        agentRole: config.agentRole || 'Vendeuse WhatsApp IA',
        language: config.language || 'fr',
        personalityDescription: config.personality?.description || (typeof config.personality === 'string' ? config.personality : ''),
        welcomeMessage: config.welcomeMessage || `Bonjour 👋 J'espère que vous allez bien ! Je suis là pour vous aider — lequel de nos produits vous a intéressé ?`,
        // Autres champs (autres onglets)
        productCatalog: config.productCatalog || [],
        bossPhone: config.bossPhone || '',
        bossNotifications: config.bossNotifications || false,
        notifyOnOrder: config.notifyOnOrder !== false,
      },
    });
  } catch (error) {
    console.error('❌ [RITA] Erreur GET config:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
    });
  }
});

/**
 * POST /api/ecom/rita/config
 * Sauvegarder la configuration Rita (supporte userId et agentId)
 */
router.post('/config', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const { config, agentId, userId: bodyUserId } = req.body;

    // Utiliser agentId s'il est fourni, sinon userId
    let queryKey;
    let queryValue;

    if (agentId) {
      queryKey = 'agentId';
      queryValue = agentId;
    } else {
      queryKey = 'userId';
      queryValue = bodyUserId || (await resolveRitaUserId(req));
    }

    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'Configuration requise',
      });
    }

    console.log(`💾 [RITA] POST /config pour ${queryKey}=${queryValue}`);
    console.log(`   - Produits: ${config.productCatalog?.length || 0}`);

    // Champs identité acceptés (liste blanche — on n'écrase jamais les autres onglets)
    const identityFields = {};
    if (config.enabled         !== undefined) identityFields.enabled         = Boolean(config.enabled);
    if (config.instanceId      !== undefined) identityFields.instanceId      = config.instanceId || '';
    if (config.agentName       !== undefined) identityFields.agentName       = config.agentName || 'Rita';
    if (config.agentRole       !== undefined) identityFields.agentRole       = config.agentRole || '';
    if (config.language        !== undefined) identityFields.language        = config.language || 'fr';
    if (config.welcomeMessage  !== undefined) identityFields.welcomeMessage  = config.welcomeMessage || '';
    if (config.bossPhone       !== undefined) identityFields.bossPhone       = config.bossPhone || '';
    if (config.bossNotifications !== undefined) identityFields.bossNotifications = Boolean(config.bossNotifications);
    if (config.notifyOnOrder   !== undefined) identityFields.notifyOnOrder   = config.notifyOnOrder !== false;
    if (config.productCatalog  !== undefined) identityFields.productCatalog  = config.productCatalog || [];

    // Sauvegarder description de personnalité dans le champ personality.description
    if (config.personalityDescription !== undefined) {
      identityFields['personality.description'] = config.personalityDescription || '';
    }

    const updated = await RitaConfig.findOneAndUpdate(
      { [queryKey]: queryValue },
      { $set: { [queryKey]: queryValue, ...identityFields } },
      { upsert: true, new: true, runValidators: false }
    );

    console.log(`✅ [RITA] Config sauvegardée pour ${queryKey}=${queryValue}`);

    res.json({
      success: true,
      config: {
        enabled: updated.enabled,
        instanceId: updated.instanceId,
        agentName: updated.agentName,
        agentRole: updated.agentRole || '',
        language: updated.language || 'fr',
        personalityDescription: updated.personality?.description || '',
        welcomeMessage: updated.welcomeMessage,
        productCatalog: updated.productCatalog,
        bossPhone: updated.bossPhone,
        bossNotifications: updated.bossNotifications,
        notifyOnOrder: updated.notifyOnOrder,
      },
    });
  } catch (error) {
    console.error('❌ [RITA] Erreur POST config:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
    });
  }
});

/**
 * PUT /api/ecom/rita/config
 * Mettre à jour les champs du onboarding
 */
router.put('/config', requireEcomAuth, async (req, res) => {
  try {
    const userId = await resolveRitaUserId(req);
    const updateData = req.body;

    console.log(`📝 [RITA] PUT /config pour userId=${userId}`);

    const updated = await RitaConfig.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, runValidators: false }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Configuration non trouvée',
      });
    }

    console.log(`✅ [RITA] Config mise à jour pour userId=${userId}`);

    res.json({
      success: true,
      config: sanitizeRitaConfigForResponse(updated),
    });
  } catch (error) {
    console.error('❌ [RITA] Erreur PUT config:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
    });
  }
});

/**
 * GET /api/ecom/rita/config/:agentId
 * Récupérer la configuration Rita d'un agent spécifique
 */
router.get('/config/:agentId', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const { agentId } = req.params;
    console.log(`📋 [RITA] GET /config/${agentId} pour agentId=${agentId}`);

    const config = await RitaConfig.findOne({ agentId }).lean();

    if (!config) {
      console.log(`ℹ️ [RITA] Aucune config trouvée pour agentId=${agentId} - retour config vide`);
      return res.json({
        success: true,
        config: null, // Frontend créera une config par défaut
      });
    }

    console.log(`✅ [RITA] Config chargée pour agent - ${config.productCatalog?.length || 0} produits`);
    res.json({
      success: true,
      config: {
        enabled: config.enabled || false,
        instanceId: config.instanceId || '',
        agentName: config.agentName || 'Rita',
        agentRole: config.agentRole || 'Vendeuse WhatsApp IA',
        language: config.language || 'fr',
        personalityDescription: config.personality?.description || (typeof config.personality === 'string' ? config.personality : ''),
        welcomeMessage: config.welcomeMessage || `Bonjour 👋 J'espère que vous allez bien ! Je suis là pour vous aider — lequel de nos produits vous a intéressé ?`,
        productCatalog: config.productCatalog || [],
        bossPhone: config.bossPhone || '',
        bossNotifications: config.bossNotifications || false,
        notifyOnOrder: config.notifyOnOrder !== false,
      },
    });
  } catch (error) {
    console.error('❌ [RITA] Erreur GET config par agentId:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
    });
  }
});

export default router;
