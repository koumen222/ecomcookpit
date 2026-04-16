import express from 'express';
import Agent from '../models/Agent.js';
import RitaConfig from '../models/RitaConfig.js';
import Workspace from '../models/Workspace.js';
import { requireEcomAuth, requireRitaAgentAccess } from '../middleware/ecomAuth.js';
import { PLAN_LIMITS } from './billing.js';

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

    // Enrich each agent with its own RitaConfig (per-agent)
    const agentIds = agents.map(a => String(a._id));
    const ritaConfigs = await RitaConfig.find({ agentId: { $in: agentIds } })
      .select('agentId instanceId productCatalog enabled').lean();
    const configByAgentId = {};
    for (const rc of ritaConfigs) {
      configByAgentId[rc.agentId] = rc;
    }

    const enrichedAgents = agents.map(a => {
      const obj = a.toObject();
      const rc = configByAgentId[String(a._id)];
      if (rc) {
        obj.instanceId = rc.instanceId || obj.instanceId || '';
        obj.productsCount = rc.productCatalog?.length ?? obj.productsCount ?? 0;
        obj.ritaEnabled = rc.enabled || false;
      }
      return obj;
    });

    console.log(`✅ [AGENTS] ${agents.length} agent(s) trouvé(s)`);
    res.json({
      success: true,
      agents: enrichedAgents,
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

    // ─── Plan limit check ────────────────────────────────────────────────────
    const wsId = req.workspaceId;
    if (wsId) {
      const workspace = await Workspace.findById(wsId).select('plan planExpiresAt trialEndsAt trialUsed').lean();
      if (workspace) {
        const now = new Date();
        const isPaidActive = (workspace.plan === 'starter' || workspace.plan === 'pro' || workspace.plan === 'ultra')
          && workspace.planExpiresAt && workspace.planExpiresAt > now;
        const trialActive = workspace.trialEndsAt && workspace.trialEndsAt > now;
        const effectivePlan = isPaidActive ? workspace.plan : trialActive ? 'starter' : 'free';
        const limits = PLAN_LIMITS[effectivePlan] || PLAN_LIMITS.free;

        if (limits.agents === 0) {
          return res.status(403).json({
            success: false,
            error: 'upgrade_required',
            message: `Votre plan ${PLAN_LIMITS[effectivePlan]?.label || effectivePlan} ne permet pas de créer d'agent. Passez à Scalor + IA pour créer jusqu'à 1 agent, ou Scalor IA Pro pour en créer 5.`,
            requiredPlan: 'pro',
          });
        }

        const existingCount = await Agent.countDocuments({ userId });
        if (existingCount >= limits.agents) {
          const nextPlan = limits.agents === 1 ? 'ultra' : 'ultra';
          const nextLimit = limits.agents === 1 ? 5 : 10;
          return res.status(403).json({
            success: false,
            error: 'limit_reached',
            message: `Votre plan ${PLAN_LIMITS[effectivePlan]?.label} est limité à ${limits.agents} agent(s). Passez à ${PLAN_LIMITS[nextPlan]?.label} pour en créer jusqu'à ${nextLimit}.`,
            requiredPlan: nextPlan,
            currentLimit: limits.agents,
            nextLimit: nextLimit,
          });
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    console.log(`🆕 [AGENTS] POST / - Création agent pour userId=${userId}`);
    console.log(`   name: ${name}, type: ${type}`);

    // Générer le message de bienvenue personnalisé
    const welcomeMessage = generateWelcomeMessage(name, niche, personality);

    // ─── Créer l'agent d'abord pour avoir son _id ────────────────────────────
    const agent = await Agent.create({
      userId,
      workspaceId: req.workspaceId,
      name,
      type,
      description,
      status: 'inactive',
      productsCount: 0,
    });

    // ─── Créer une RitaConfig propre à cet agent (best-effort) ─────────────
    try {
      const ritaConfig = await RitaConfig.create({
        userId,
        agentId: String(agent._id),
        enabled: false,
        instanceId: '',
        agentName: name,
        welcomeMessage,
        productCatalog: [],
        country,
        niche,
        productType,
        communicationStyle,
        tone,
        personality,
        bossPhone,
        bossNotifications,
        notifyOnOrder,
        onboardingCompleted,
      });
      agent.configId = ritaConfig._id;
      await agent.save();
      console.log(`✅ [AGENTS] Agent créé: ${agent._id} | RitaConfig: ${ritaConfig._id}`);
    } catch (configErr) {
      console.error(`⚠️ [AGENTS] Agent créé (${agent._id}) mais RitaConfig échouée:`, configErr.message);
    }

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

    // Supprimer l'agent et sa RitaConfig dédiée
    await Agent.findByIdAndDelete(agent._id);
    await RitaConfig.deleteOne({ agentId: String(agent._id) });

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
