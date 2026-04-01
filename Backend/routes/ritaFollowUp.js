import express from 'express';
import { 
  createFollowUpCampaign, 
  startFollowUpCampaign, 
  pauseFollowUpCampaign,
  getEligibleContactsForCampaign,
  getRitaPerformanceStats 
} from '../services/ritaFollowUpService.js';
import {
  getAllActiveConversations,
  generateRelanceMessage,
  markRelanced,
  addRelanceToHistory,
} from '../services/ritaAgentService.js';
import RitaFollowUpCampaign from '../models/RitaFollowUpCampaign.js';
import RitaContact from '../models/RitaContact.js';
import RitaConfig from '../models/RitaConfig.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import evolutionApiService from '../services/evolutionApiService.js';

const router = express.Router();

/**
 * GET /api/rita/performance
 * Obtenir les statistiques de performance du chatbot
 */
router.get('/performance', async (req, res) => {
  try {
    const { userId } = req.query;
    const { startDate, endDate } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    const stats = await getRitaPerformanceStats(userId, startDate, endDate);
    res.json(stats);
  } catch (error) {
    console.error('Erreur récupération stats performance:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/rita/contacts
 * Obtenir la liste des contacts avec filtres
 */
router.get('/contacts', async (req, res) => {
  try {
    const { userId, status, hasOrdered, limit = 50, skip = 0 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    const query = { userId };
    if (status) query.status = status;
    if (hasOrdered !== undefined) query.hasOrdered = hasOrdered === 'true';

    const contacts = await RitaContact.find(query)
      .sort({ lastMessageAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await RitaContact.countDocuments(query);

    res.json({ contacts, total });
  } catch (error) {
    console.error('Erreur récupération contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/rita/followup/campaigns
 * Créer une nouvelle campagne de relance
 */
router.post('/followup/campaigns', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    const campaign = await createFollowUpCampaign(userId, req.body);
    res.json(campaign);
  } catch (error) {
    console.error('Erreur création campagne:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/rita/followup/campaigns
 * Obtenir les campagnes de relance
 */
router.get('/followup/campaigns', async (req, res) => {
  try {
    const { userId, status } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    const query = { userId };
    if (status) query.status = status;

    const campaigns = await RitaFollowUpCampaign.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json(campaigns);
  } catch (error) {
    console.error('Erreur récupération campagnes:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/rita/followup/campaigns/:id
 * Obtenir une campagne spécifique
 */
router.get('/followup/campaigns/:id', async (req, res) => {
  try {
    const campaign = await RitaFollowUpCampaign.findById(req.params.id).lean();
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campagne introuvable' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Erreur récupération campagne:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/rita/followup/campaigns/:id/start
 * Démarrer une campagne de relance
 */
router.post('/followup/campaigns/:id/start', async (req, res) => {
  try {
    const campaign = await startFollowUpCampaign(req.params.id);
    res.json(campaign);
  } catch (error) {
    console.error('Erreur démarrage campagne:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/rita/followup/campaigns/:id/pause
 * Mettre en pause une campagne de relance
 */
router.post('/followup/campaigns/:id/pause', async (req, res) => {
  try {
    const campaign = await pauseFollowUpCampaign(req.params.id);
    res.json(campaign);
  } catch (error) {
    console.error('Erreur pause campagne:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/rita/followup/campaigns/:id
 * Supprimer une campagne
 */
router.delete('/followup/campaigns/:id', async (req, res) => {
  try {
    const campaign = await RitaFollowUpCampaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campagne introuvable' });
    }

    if (campaign.status === 'active') {
      return res.status(400).json({ error: 'Impossible de supprimer une campagne active. Mettez-la en pause d\'abord.' });
    }

    await RitaFollowUpCampaign.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression campagne:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/rita/followup/preview
 * Prévisualiser les contacts qui seront ciblés par une campagne
 */
router.post('/followup/preview', async (req, res) => {
  try {
    const { userId, filters } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    const contacts = await getEligibleContactsForCampaign(userId, filters);
    res.json({ 
      count: contacts.length,
      contacts: contacts.slice(0, 10) // Retourner seulement les 10 premiers pour preview
    });
  } catch (error) {
    console.error('Erreur preview campagne:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/rita/contacts/:phone/status
 * Mettre à jour le statut d'un contact manuellement
 */
router.put('/contacts/:phone/status', async (req, res) => {
  try {
    const { userId, status } = req.body;
    const { phone } = req.params;

    if (!userId || !status) {
      return res.status(400).json({ error: 'userId et status requis' });
    }

    const contact = await RitaContact.findOneAndUpdate(
      { userId, phone },
      { status },
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({ error: 'Contact introuvable' });
    }

    res.json(contact);
  } catch (error) {
    console.error('Erreur mise à jour statut contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// RELANCES EN UN CLIC
// ══════════════════════════════════════════════════════════════════

/**
 * GET /api/rita/conversations/active
 * Obtenir toutes les conversations actives avec leur statut
 */
router.get('/conversations/active', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    const conversations = getAllActiveConversations(userId);
    
    // Statistiques rapides
    const stats = {
      total: conversations.length,
      waitingResponse: conversations.filter(c => c.status === 'waiting_response').length,
      needRelance: conversations.filter(c => c.status === 'need_relance').length,
      abandoned: conversations.filter(c => c.status === 'abandoned').length,
      ordered: conversations.filter(c => c.ordered).length,
    };

    res.json({ conversations, stats });
  } catch (error) {
    console.error('Erreur récupération conversations actives:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/rita/relance/single
 * Relancer un client spécifique en un clic
 */
router.post('/relance/single', async (req, res) => {
  try {
    const { userId, clientPhone, customMessage } = req.body;

    if (!userId || !clientPhone) {
      return res.status(400).json({ error: 'userId et clientPhone requis' });
    }

    // Récupérer la config Rita et l'instance WhatsApp
    const ritaConfig = await RitaConfig.findOne({ userId }).lean();
    if (!ritaConfig || !ritaConfig.enabled) {
      return res.status(400).json({ error: 'Rita non configurée ou désactivée' });
    }

    const instance = await WhatsAppInstance.findById(ritaConfig.instanceId).lean();
    if (!instance || !instance.isActive) {
      return res.status(400).json({ error: 'Instance WhatsApp non trouvée ou inactive' });
    }

    // Récupérer la conversation
    const conversations = getAllActiveConversations(userId);
    const conversation = conversations.find(c => c.from.replace(/@.*$/, '') === clientPhone.replace(/\D/g, ''));

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation introuvable' });
    }

    // Générer ou utiliser le message personnalisé
    const message = customMessage || generateRelanceMessage(
      conversation.history,
      ritaConfig,
      conversation.relanceCount
    );

    // Envoyer le message via WhatsApp
    const result = await evolutionApiService.sendMessage(
      instance.instanceName,
      instance.instanceToken,
      clientPhone.replace(/\D/g, ''),
      message
    );

    if (!result || !result.success) {
      throw new Error('Échec envoi message WhatsApp');
    }

    // Marquer comme relancé
    markRelanced(userId, conversation.from);
    addRelanceToHistory(userId, conversation.from, message);

    res.json({
      success: true,
      message,
      clientPhone,
      relanceCount: conversation.relanceCount + 1,
    });
  } catch (error) {
    console.error('Erreur relance client:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/rita/relance/bulk
 * Relancer TOUS les clients en attente en un clic
 */
router.post('/relance/bulk', async (req, res) => {
  try {
    const { userId, status = 'need_relance', maxRelance = 3 } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    // Récupérer la config Rita et l'instance WhatsApp
    const ritaConfig = await RitaConfig.findOne({ userId }).lean();
    if (!ritaConfig || !ritaConfig.enabled) {
      return res.status(400).json({ error: 'Rita non configurée ou désactivée' });
    }

    const instance = await WhatsAppInstance.findById(ritaConfig.instanceId).lean();
    if (!instance || !instance.isActive) {
      return res.status(400).json({ error: 'Instance WhatsApp non trouvée ou inactive' });
    }

    // Récupérer toutes les conversations à relancer
    const conversations = getAllActiveConversations(userId);
    const toRelance = conversations.filter(c => 
      c.status === status && 
      !c.ordered && 
      c.relanceCount < maxRelance
    );

    if (toRelance.length === 0) {
      return res.json({
        success: true,
        message: 'Aucune conversation à relancer',
        count: 0,
        results: [],
      });
    }

    // Relancer chaque client (avec délai pour ne pas spam)
    const results = [];
    const delay = 2000; // 2 secondes entre chaque message

    for (let i = 0; i < toRelance.length; i++) {
      const conversation = toRelance[i];
      const clientPhone = conversation.from.replace(/@.*$/, '');

      try {
        // Générer le message de relance
        const message = generateRelanceMessage(
          conversation.history,
          ritaConfig,
          conversation.relanceCount
        );

        // Envoyer le message
        const result = await evolutionApiService.sendMessage(
          instance.instanceName,
          instance.instanceToken,
          clientPhone,
          message
        );

        if (result && result.success) {
          // Marquer comme relancé
          markRelanced(userId, conversation.from);
          addRelanceToHistory(userId, conversation.from, message);

          results.push({
            clientPhone,
            success: true,
            message,
          });
        } else {
          results.push({
            clientPhone,
            success: false,
            error: 'Échec envoi message',
          });
        }

        // Attendre avant le prochain message (sauf le dernier)
        if (i < toRelance.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (err) {
        results.push({
          clientPhone,
          success: false,
          error: err.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      message: `${successCount}/${toRelance.length} clients relancés avec succès`,
      count: toRelance.length,
      successCount,
      results,
    });
  } catch (error) {
    console.error('Erreur relance bulk:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
