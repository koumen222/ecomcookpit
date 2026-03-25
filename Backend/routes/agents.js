import express from 'express';
import Agent from '../models/Agent.js';
import RitaConfig from '../models/RitaConfig.js';
import Workspace from '../models/Workspace.js';
import { requireEcomAuth, requireRitaAgentAccess } from '../middleware/ecomAuth.js';

const router = express.Router();

/**
 * Générer un message de bienvenue personnalisé basé sur la niche et la personnalité
 */
function generateWelcomeMessage(agentName, niche, personality) {
  const nicheGreetings = {
    'Mode & Vêtements': 'Bienvenue dans mon univers fashion !',
    'Électronique & Informatique': 'Bienvenue chez ton expert tech !',
    'Alimentation & Restauration': 'Bienvenue à ta table !',
    'Beauté & Cosmétiques': 'Bienvenue dans mon salon beauté !',
    'Santé & Bien-être': 'Bienvenue chez ton conseiller bien-être !',
    'Maison & Décoration': 'Bienvenue chez toi !',
    'Automobile & Accessoires': 'Bienvenue dans mon garage !',
    'Sports & Loisirs': 'Bienvenue chez ton coach sportif !',
    'Éducation': 'Bienvenue dans mon école !',
    'Services professionnels': 'Bienvenue chez moi !',
    'Immobilier': 'Bienvenue chez ton agent immobilier !',
  };

  const personalityMessages = {
    'Experte en son domaine': 'Je suis là pour te conseiller avec expertise.',
    'Conseillère amicale': 'Je suis là comme une amie qui t\'aide.',
    'Spécialiste technique': 'Je suis prête à répondre à tous tes questions tech.',
    'Coach motivant': 'Ensemble, on va atteindre tes objectifs !',
    'Assistant discret': 'Je suis là quand tu en as besoin.',
    'Reine du shopping': 'Prépare-toi pour l\'expérience shopping ultime !',
    'Expert en tendances': 'Je suis au courant des dernières tendances !',
    'Mécanicienne passionnée': 'Je suis passionnée par ce que je fais.',
    'Professeure patiente': 'On apprend ensemble à ton rythme.',
    'Entrepreneur visionnaire': 'Ensemble, créons quelque chose d\'extraordinaire.',
  };

  const greeting = nicheGreetings[niche] || `Bienvenue chez ${agentName} 👋`;
  const personalityLine = personalityMessages[personality] || 'Comment puis-je t\'aider ?';

  return `${greeting}\n${personalityLine}`;
}

/**
 * Résoudre userId via workspace owner
 */
async function resolveUserId(req) {
  if (req.ecomUser?.role === 'super_admin') {
    return req.body?.userId || req.query?.userId || String(req.ecomUser._id);
  }

  const wsId = req.workspaceId || req.ecomUser?.workspaceId;
  if (wsId) {
    try {
      const ws = await Workspace.findById(wsId).select('owner').lean();
      if (ws?.owner) return String(ws.owner);
    } catch (e) {
      console.warn('⚠️ resolveUserId: workspace owner lookup failed:', e.message);
    }
  }

  return String(req.ecomUser?._id || '');
}

/**
 * GET /api/ecom/agents
 * Récupérer tous les agents de l'utilisateur
 */
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    console.log(`📋 [AGENTS] GET / pour userId=${userId}`);

    const agents = await Agent.find({ userId }).sort({ createdAt: -1 });

    console.log(`✅ [AGENTS] ${agents.length} agent(s) trouvé(s)`);
    res.json({
      success: true,
      agents,
    });
  } catch (error) {
    console.error('❌ [AGENTS] Erreur GET agents:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
    });
  }
});

/**
 * POST /api/ecom/agents
 * Créer un nouvel agent
 */
router.post('/', requireEcomAuth, async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    const {
      name,
      type = 'whatsapp',
      description = '',
      country = '',
      niche = '',
      productType = '',
      communicationStyle = 'friendly',
      tone = '',
      personality = '',
      bossPhone = '',
      bossNotifications = false,
      notifyOnOrder = true,
      onboardingCompleted = false,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Le nom de l\'agent est requis',
      });
    }

    console.log(`🆕 [AGENTS] POST / - Création agent pour userId=${userId}`);
    console.log(`   name: ${name}, type: ${type}`);

    // Générer le message de bienvenue personnalisé
    const welcomeMessage = generateWelcomeMessage(name, niche, personality);

    // Créer ou récupérer la RitaConfig (une seule par userId)
    let ritaConfig = await RitaConfig.findOne({ userId });
    if (!ritaConfig) {
      // Nouvelle configuration complète avec tous les paramètres du onboarding
      ritaConfig = await RitaConfig.create({
        userId,
        enabled: false,
        instanceId: '',
        agentName: name,
        welcomeMessage,
        productCatalog: [],
        // Profil business
        country,
        niche,
        productType,
        // Style de communication
        communicationStyle,
        tone,
        personality,
        // Contact et notifications
        bossPhone,
        bossNotifications,
        notifyOnOrder,
        // Statut
        onboardingCompleted,
      });
      console.log(`   ✅ RitaConfig créée avec config complète: ${ritaConfig._id}`);
    } else {
      // Mettre à jour les champs du onboarding si RitaConfig existe
      ritaConfig.agentName = name;
      ritaConfig.welcomeMessage = welcomeMessage;
      ritaConfig.country = country;
      ritaConfig.niche = niche;
      ritaConfig.productType = productType;
      ritaConfig.communicationStyle = communicationStyle;
      ritaConfig.tone = tone;
      ritaConfig.personality = personality;
      ritaConfig.bossPhone = bossPhone;
      ritaConfig.bossNotifications = bossNotifications;
      ritaConfig.notifyOnOrder = notifyOnOrder;
      ritaConfig.onboardingCompleted = onboardingCompleted;
      await ritaConfig.save();
      console.log(`   ✅ RitaConfig mise à jour avec config complète: ${ritaConfig._id}`);
    }

    // Créer l'agent
    const agent = await Agent.create({
      userId,
      workspaceId: req.workspaceId,
      name,
      type,
      description,
      configId: ritaConfig._id,
      status: 'inactive',
      productsCount: 0,
    });

    console.log(`✅ [AGENTS] Agent créé: ${agent._id}`);

    res.status(201).json({
      success: true,
      agent,
    });
  } catch (error) {
    console.error('❌ [AGENTS] Erreur POST agent:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
    });
  }
});

/**
 * GET /api/ecom/agents/:id
 * Récupérer un agent spécifique
 */
router.get('/:id', requireEcomAuth, async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    const agent = await Agent.findOne({ _id: req.params.id, userId });

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent non trouvé',
      });
    }

    res.json({
      success: true,
      agent,
    });
  } catch (error) {
    console.error('❌ [AGENTS] Erreur GET agent:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
    });
  }
});

/**
 * PUT /api/ecom/agents/:id
 * Mettre à jour un agent
 */
router.put('/:id', requireEcomAuth, async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    const { name, description, status } = req.body;

    const agent = await Agent.findOne({ _id: req.params.id, userId });

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent non trouvé',
      });
    }

    if (name) agent.name = name;
    if (description !== undefined) agent.description = description;
    if (status) agent.status = status;

    await agent.save();

    console.log(`✅ [AGENTS] Agent mis à jour: ${agent._id}`);

    res.json({
      success: true,
      agent,
    });
  } catch (error) {
    console.error('❌ [AGENTS] Erreur PUT agent:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
    });
  }
});

/**
 * DELETE /api/ecom/agents/:id
 * Supprimer un agent
 */
router.delete('/:id', requireEcomAuth, async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    const agent = await Agent.findOne({ _id: req.params.id, userId });

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent non trouvé',
      });
    }

    // Supprimer l'agent (la RitaConfig est partagée, ne pas la supprimer)
    await Agent.findByIdAndDelete(agent._id);

    console.log(`✅ [AGENTS] Agent supprimé: ${agent._id}`);

    res.json({
      success: true,
      message: 'Agent supprimé',
    });
  } catch (error) {
    console.error('❌ [AGENTS] Erreur DELETE agent:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
    });
  }
});

export default router;
