/**
 * Routes API — Rita Flows (qualification, groupes, animation)
 * Mount: /api/ecom/v1/rita-flows
 */

import express from 'express';
import RitaFlow from '../models/RitaFlow.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import evolutionApiService from '../services/evolutionApiService.js';
import { autoCreateGroupForProduct } from '../services/ritaFlowEngine.js';
import { requireEcomAuth, requireRitaAgentAccess } from '../middleware/ecomAuth.js';
import Workspace from '../models/Workspace.js';

const router = express.Router();

async function resolveRitaFlowUserId(req) {
  if (req.ecomUser?.role === 'super_admin') {
    return req.body?.userId || req.query?.userId || String(req.ecomUser._id);
  }

  // Résoudre via le owner du workspace
  const wsId = req.workspaceId || req.ecomUser?.workspaceId;
  if (wsId) {
    try {
      const ws = await Workspace.findById(wsId).select('owner').lean();
      if (ws?.owner) return String(ws.owner);
    } catch (e) {
      console.warn('⚠️ resolveRitaFlowUserId: workspace owner lookup failed:', e.message);
    }
  }

  return String(req.ecomUser?._id || '');
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION FLOWS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /config?userId=xxx
 * Charger la configuration complète (flows + groupes)
 */
router.get('/config', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const userId = await resolveRitaFlowUserId(req);
    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });

    let config = await RitaFlow.findOne({ userId }).lean();
    if (!config) {
      // Créer une config par défaut
      config = await RitaFlow.create({
        userId,
        enabled: false,
        flows: [],
        groups: [],
        settings: {
          defaultInactivitySeconds: 3600,
          autoCreateGroupPerProduct: false,
          groupNameTemplate: '🛒 {productName} — Clients',
        },
      });
    }
    res.json({ success: true, config });
  } catch (err) {
    console.error('❌ [RitaFlows] GET /config:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /config
 * Sauvegarder la configuration (flows + groupes + settings)
 */
router.post('/config', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const { config } = req.body;
    const userId = await resolveRitaFlowUserId(req);
    if (!userId || !config) return res.status(400).json({ success: false, error: 'userId et config requis' });

    const updated = await RitaFlow.findOneAndUpdate(
      { userId },
      {
        userId,
        enabled: config.enabled ?? false,
        flows: config.flows || [],
        groups: config.groups || [],
        settings: config.settings || {},
      },
      { upsert: true, new: true, runValidators: false }
    );

    res.json({ success: true, config: updated });
  } catch (err) {
    console.error('❌ [RitaFlows] POST /config:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GESTION DES GROUPES WHATSAPP
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /groups/list?userId=xxx
 * Liste les groupes WhatsApp de l'instance connectée
 */
router.get('/groups/list', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const userId = await resolveRitaFlowUserId(req);
    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });

    const inst = await WhatsAppInstance.findOne({ userId, isActive: true }).lean();
    if (!inst) return res.json({ success: true, groups: [], message: 'Aucune instance active' });

    const result = await evolutionApiService.listGroups(inst.instanceName, inst.instanceToken);
    const groups = (result.groups || []).map(g => ({
      id: g.id || g.jid,
      name: g.subject || g.name || g.id,
      participants: g.size || g.participants?.length || 0,
      creation: g.creation,
    }));

    res.json({ success: true, groups });
  } catch (err) {
    console.error('❌ [RitaFlows] GET /groups/list:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /groups/create
 * Crée un nouveau groupe WhatsApp
 */
router.post('/groups/create', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = await resolveRitaFlowUserId(req);
    if (!userId || !name) return res.status(400).json({ success: false, error: 'userId et name requis' });

    const inst = await WhatsAppInstance.findOne({ userId, isActive: true }).lean();
    if (!inst) return res.status(400).json({ success: false, error: 'Aucune instance WhatsApp active' });

    const result = await evolutionApiService.createGroup(inst.instanceName, inst.instanceToken, name, [], description || '');
    if (!result.success) return res.status(500).json({ success: false, error: result.error });

    const groupJid = result.data?.id || result.data?.groupId || result.data?.jid;

    // Récupérer le lien d'invitation
    let inviteUrl = '';
    if (groupJid) {
      const inv = await evolutionApiService.getGroupInviteCode(inst.instanceName, inst.instanceToken, groupJid);
      if (inv.success) inviteUrl = inv.inviteUrl;
    }

    // Ajouter aux groupes gérés
    await RitaFlow.findOneAndUpdate(
      { userId },
      {
        $push: {
          groups: { groupJid, name, inviteUrl, role: 'custom', autoCreated: false, scheduledPosts: [] }
        }
      },
      { upsert: true }
    );

    res.json({ success: true, group: { groupJid, name, inviteUrl } });
  } catch (err) {
    console.error('❌ [RitaFlows] POST /groups/create:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /groups/invite-link
 * Génère (ou régénère) le lien d'invitation d'un groupe
 */
router.post('/groups/invite-link', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const { groupJid } = req.body;
    const userId = await resolveRitaFlowUserId(req);
    if (!userId || !groupJid) return res.status(400).json({ success: false, error: 'userId et groupJid requis' });

    const inst = await WhatsAppInstance.findOne({ userId, isActive: true }).lean();
    if (!inst) return res.status(400).json({ success: false, error: 'Aucune instance active' });

    const result = await evolutionApiService.getGroupInviteCode(inst.instanceName, inst.instanceToken, groupJid);
    if (!result.success) return res.status(500).json({ success: false, error: result.error });

    // Mettre à jour en base
    await RitaFlow.updateOne(
      { userId, 'groups.groupJid': groupJid },
      { $set: { 'groups.$.inviteUrl': result.inviteUrl } }
    );

    res.json({ success: true, inviteUrl: result.inviteUrl, inviteCode: result.inviteCode });
  } catch (err) {
    console.error('❌ [RitaFlows] POST /groups/invite-link:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /groups/join
 * Rejoint un groupe WhatsApp existant via lien d'invitation
 */
router.post('/groups/join', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const { inviteLink } = req.body;
    const userId = await resolveRitaFlowUserId(req);
    if (!userId || !inviteLink) return res.status(400).json({ success: false, error: 'userId et inviteLink requis' });

    // Extraire le code d'invitation du lien
    const codeMatch = inviteLink.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/);
    if (!codeMatch) return res.status(400).json({ success: false, error: 'Lien d\'invitation WhatsApp invalide' });
    const inviteCode = codeMatch[1];

    const inst = await WhatsAppInstance.findOne({ userId, isActive: true }).lean();
    if (!inst) return res.status(400).json({ success: false, error: 'Aucune instance WhatsApp active' });

    const result = await evolutionApiService.acceptGroupInvite(inst.instanceName, inst.instanceToken, inviteCode);
    if (!result.success) return res.status(500).json({ success: false, error: result.error || 'Impossible de rejoindre le groupe' });

    const groupJid = result.groupJid;

    // Essayer de récupérer les infos du groupe
    let groupName = 'Groupe rejoint';
    try {
      const allGroups = await evolutionApiService.listGroups(inst.instanceName, inst.instanceToken);
      const found = (allGroups.groups || []).find(g => (g.id || g.jid) === groupJid);
      if (found) groupName = found.subject || found.name || groupName;
    } catch (_) { /* ignore */ }

    // Ajouter aux groupes gérés
    await RitaFlow.findOneAndUpdate(
      { userId },
      {
        $push: {
          groups: { groupJid, name: groupName, inviteUrl: inviteLink, role: 'custom', autoCreated: false, scheduledPosts: [] }
        }
      },
      { upsert: true }
    );

    res.json({ success: true, group: { groupJid, name: groupName, inviteUrl: inviteLink } });
  } catch (err) {
    console.error('❌ [RitaFlows] POST /groups/join:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /groups/auto-create-product
 * Crée un groupe automatiquement pour un produit
 */
router.post('/groups/auto-create-product', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const { productName } = req.body;
    const userId = await resolveRitaFlowUserId(req);
    if (!userId || !productName) return res.status(400).json({ success: false, error: 'userId et productName requis' });

    const group = await autoCreateGroupForProduct(userId, productName);
    if (!group) return res.status(500).json({ success: false, error: 'Impossible de créer le groupe' });

    res.json({ success: true, group });
  } catch (err) {
    console.error('❌ [RitaFlows] POST /groups/auto-create-product:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POSTS PLANIFIÉS (ANIMATION DE GROUPE)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /groups/scheduled-post
 * Ajouter un post planifié à un groupe
 */
router.post('/groups/scheduled-post', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const { groupJid, post } = req.body;
    const userId = await resolveRitaFlowUserId(req);
    if (!userId || !groupJid || !post) return res.status(400).json({ success: false, error: 'userId, groupJid et post requis' });

    const result = await RitaFlow.findOneAndUpdate(
      { userId, 'groups.groupJid': groupJid },
      {
        $push: { 'groups.$.scheduledPosts': post }
      },
      { new: true }
    );

    if (!result) return res.status(404).json({ success: false, error: 'Groupe non trouvé dans la config' });

    res.json({ success: true, config: result });
  } catch (err) {
    console.error('❌ [RitaFlows] POST /groups/scheduled-post:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /groups/scheduled-post
 * Supprimer un post planifié
 */
router.delete('/groups/scheduled-post', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const { groupJid, postIndex } = req.body;
    const userId = await resolveRitaFlowUserId(req);
    if (!userId || !groupJid || postIndex === undefined) {
      return res.status(400).json({ success: false, error: 'userId, groupJid et postIndex requis' });
    }

    const flowConfig = await RitaFlow.findOne({ userId });
    if (!flowConfig) return res.status(404).json({ success: false, error: 'Config non trouvée' });

    const group = flowConfig.groups.find(g => g.groupJid === groupJid);
    if (!group) return res.status(404).json({ success: false, error: 'Groupe non trouvé' });

    group.scheduledPosts.splice(postIndex, 1);
    await flowConfig.save();

    res.json({ success: true, config: flowConfig });
  } catch (err) {
    console.error('❌ [RitaFlows] DELETE /groups/scheduled-post:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
