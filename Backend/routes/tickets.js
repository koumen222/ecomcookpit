/**
 * Tickets de service client interne — CRUD + workflow patch.
 *
 * Monté sur /api/ecom/tickets (convention des routes workspace authentifiées).
 * Les chemins indiqués dans les sections ci-dessous sont relatifs à cette base
 * (ex: "POST /" = POST /api/ecom/tickets).
 *
 * Phase 1 (cette version) : création avec auto-enrichissement du contexte,
 * liste filtrable, détail, changement de statut, approve/reject patch (workflow
 * de statut ; le merge git réel arrive avec le job d'analyse en phase 2).
 *
 * Règle absolue : approve-patch merge fix/ticket-{id} → dev UNIQUEMENT,
 * jamais vers main, et jamais automatiquement.
 */

import express from 'express';
import mongoose from 'mongoose';
import Ticket from '../models/Ticket.js';
import Client from '../models/Client.js';
import Order from '../models/Order.js';
import { requireEcomAuth, requireWorkspace } from '../middleware/ecomAuth.js';
import { dispatchTicketToClaude } from '../services/ticketDispatchService.js';
// NB : FeatureUsageLog est importé dynamiquement dans enrichTicketContext.
// Ce modèle existe sur `main` mais pas (encore) sur `dev` ; un import statique
// casserait le chargement de toute la route sur dev. Import dynamique + garde.

const router = express.Router();

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const historyEntry = (action, by, note = '') => ({ action, by: String(by || 'system'), at: new Date(), note });

// Rôle effectif : req.ecomUserRole (rôle dans CE workspace) sinon rôle global du token.
// Le fondateur est super_admin ; un ecom_admin gère son propre workspace — les deux approuvent.
const ADMIN_ROLES = ['ecom_admin', 'super_admin'];
const isAdmin = (req) => ADMIN_ROLES.includes(req.ecomUserRole || req.user?.role);

// Transitions de statut autorisées via PATCH /:id/status (manuel).
// approve/reject ont leurs propres endpoints — pas de bypass par ici.
const MANUAL_TRANSITIONS = {
  nouveau: ['analyse_en_cours', 'en_review', 'escalade', 'ferme'],
  analyse_en_cours: ['escalade', 'ferme'],
  patch_propose: ['en_review', 'escalade', 'ferme'],
  en_review: ['escalade', 'ferme'],
  deploye: ['ferme'],
  escalade: ['en_review', 'ferme'],
  ferme: [],
};

/**
 * Auto-enrichissement du contexte à la création :
 *  - lookup Client par téléphone/email (workspace-scoped)
 *  - 5 dernières commandes du client
 *  - 10 dernières actions plateforme (FeatureUsageLog) du workspace
 *  - relatedSentryIssues : Sentry n'est pas intégré au projet à ce jour —
 *    le champ accepte des entrées manuelles ({issueId, title, url}) et sera
 *    branché sur l'API Sentry quand un DSN existera.
 */
async function enrichTicketContext(workspaceId, { customerPhone, customerEmail, screenshotUrl, sentryIssues }) {
  const context = {
    userId: null,
    userSnapshot: null,
    relatedSentryIssues: Array.isArray(sentryIssues) ? sentryIssues.slice(0, 10) : [],
    recentUserActions: [],
    screenshotUrl: typeof screenshotUrl === 'string' ? screenshotUrl.slice(0, 2000) : '',
  };

  try {
    // ── Lookup client ────────────────────────────────────────────────────────
    let client = null;
    const phoneNorm = String(customerPhone || '').replace(/[^0-9]/g, '');
    if (phoneNorm) {
      client = await Client.findOne({
        workspaceId,
        $or: [{ phoneNormalized: phoneNorm }, { phone: { $regex: phoneNorm.slice(-8) + '$' } }],
      }).lean();
    }
    if (!client && customerEmail) {
      client = await Client.findOne({ workspaceId, email: String(customerEmail).trim().toLowerCase() }).lean();
    }

    if (client) {
      context.userId = client._id;
      context.userSnapshot = {
        name: `${client.firstName || ''} ${client.lastName || ''}`.trim(),
        phone: client.phone || '',
        email: client.email || '',
        city: client.city || '',
        ordersCount: client.totalOrders ?? null,   // Client.totalOrders (pas ordersCount)
        totalSpent: client.totalSpent ?? null,
      };

      // ── 5 dernières commandes du client ────────────────────────────────────
      const phoneKeys = [client.phoneNormalized, phoneNorm].filter(Boolean);
      // Champs réels du modèle Order : orderId, product, price, currency, date (pas orderNumber/total/productName)
      const orders = await Order.find({
        workspaceId,
        ...(phoneKeys.length ? { clientPhoneNormalized: { $in: phoneKeys } } : { _id: null }),
      })
        .sort({ date: -1 })
        .limit(5)
        .select('orderId status price currency date product')
        .lean();

      context.recentUserActions.push(...orders.map((o) => ({
        type: 'order',
        at: o.date,
        summary: `Commande ${o.orderId || o._id} — ${o.product || ''} — ${o.status} — ${o.price ?? '?'} ${o.currency || ''}`.replace(/\s+—\s+—/g, ' —').trim(),
      })));
    }

    // ── 10 dernières actions plateforme du workspace ─────────────────────────
    // Import dynamique + garde : si FeatureUsageLog est absent de la branche
    // courante (cas de `dev`), on saute proprement cette source sans casser le reste.
    try {
      const { default: FeatureUsageLog } = await import('../models/FeatureUsageLog.js');
      const usageLogs = await FeatureUsageLog.find({ workspaceId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('feature userId createdAt meta.success')
        .lean();
      context.recentUserActions.push(...usageLogs.map((l) => ({
        type: 'feature_usage',
        at: l.createdAt,
        summary: `${l.feature}${l.meta?.success === false ? ' (échec)' : ''}`,
        userId: l.userId || null,
      })));
    } catch (e) {
      // Modèle absent sur cette branche (dev) ou erreur requête → contexte partiel, on continue.
    }

    // Tri antichronologique global
    context.recentUserActions.sort((a, b) => new Date(b.at) - new Date(a.at));
    context.recentUserActions = context.recentUserActions.slice(0, 15);
  } catch (err) {
    console.warn('⚠️ [Tickets] Enrichissement contexte partiel:', err.message);
  }

  return context;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tickets — création + auto-enrichissement
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const {
      title, description, category, priority,
      customerPhone, customerEmail, screenshotUrl, sentryIssues,
    } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Titre requis' });
    }
    if (!description || String(description).trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Description requise (10 caractères minimum)' });
    }
    if (!Ticket.CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: `Catégorie invalide (${Ticket.CATEGORIES.join(', ')})` });
    }
    if (priority && !Ticket.PRIORITIES.includes(priority)) {
      return res.status(400).json({ success: false, message: `Priorité invalide (${Ticket.PRIORITIES.join(', ')})` });
    }

    const userId = req.user._id || req.user.id;
    const context = await enrichTicketContext(req.workspaceId, {
      customerPhone, customerEmail, screenshotUrl, sentryIssues,
    });

    const ticket = await Ticket.create({
      workspaceId: req.workspaceId,
      createdBy: userId,
      title: String(title).trim(),
      description: String(description).trim(),
      category,
      priority: priority || 'medium',
      context,
      status: 'nouveau',
      claudeAnalysis: { status: category === 'bug_technique' ? 'pending' : 'skipped' },
      history: [historyEntry('creation', userId, `Ticket créé (${category})`)],
    });

    // Phase 2 : ici, enqueue du job d'analyse Claude pour category === 'bug_technique'.
    // (Aucun système de queue Redis dans le projet → le job sera un worker in-process
    //  déclenché à la création + reprise au boot des tickets 'pending'.)

    console.log(`🎫 [Tickets] Créé ${ticket._id} — ${category}/${ticket.priority} — ws=${req.workspaceId}`);

    // Bug technique → envoi automatique à « ton Claude » (Claude Code via GitHub Actions).
    // Fire-and-forget : un échec de dispatch ne doit jamais faire échouer la création.
    if (category === 'bug_technique') {
      dispatchTicketToClaude(ticket)
        .then(async () => {
          ticket.status = 'analyse_en_cours';
          ticket.claudeAnalysis.status = 'running';
          ticket.history.push(historyEntry('analyse_lancee', 'system', 'Envoyé à Claude Code (GitHub Actions)'));
          await ticket.save();
        })
        .catch((e) => console.warn(`⚠️ [Tickets] dispatch Claude échoué (${ticket._id}):`, e.message));
    }

    return res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    console.error('❌ POST /api/tickets:', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets — liste filtrable (status, category, priority, riskLevel)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const { status, category, priority, riskLevel, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const filter = { workspaceId: req.workspaceId };
    if (status && Ticket.STATUSES.includes(status)) filter.status = status;
    if (category && Ticket.CATEGORIES.includes(category)) filter.category = category;
    if (priority && Ticket.PRIORITIES.includes(priority)) filter.priority = priority;
    if (riskLevel && Ticket.RISK_LEVELS.includes(riskLevel)) filter['claudeAnalysis.riskLevel'] = riskLevel;

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        // liste allégée : pas le diff complet ni l'historique
        .select('-claudeAnalysis.proposedFix.diff -history -context.recentUserActions')
        .lean(),
      Ticket.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: { tickets, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } },
    });
  } catch (error) {
    console.error('❌ GET /api/tickets:', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets/:id — détail complet
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'ID invalide' });
    const ticket = await Ticket.findOne({ _id: req.params.id, workspaceId: req.workspaceId }).lean();
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket introuvable' });
    return res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('❌ GET /api/tickets/:id:', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/tickets/:id/status — changement de statut manuel
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'ID invalide' });
    const { status: nextStatus, note = '' } = req.body || {};
    if (!Ticket.STATUSES.includes(nextStatus)) {
      return res.status(400).json({ success: false, message: `Statut invalide (${Ticket.STATUSES.join(', ')})` });
    }

    const ticket = await Ticket.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket introuvable' });

    const allowed = MANUAL_TRANSITIONS[ticket.status] || [];
    if (!allowed.includes(nextStatus)) {
      return res.status(409).json({
        success: false,
        message: `Transition ${ticket.status} → ${nextStatus} non autorisée manuellement (autorisées : ${allowed.join(', ') || 'aucune'})`,
      });
    }

    const userId = req.user._id || req.user.id;
    ticket.status = nextStatus;
    ticket.history.push(historyEntry('statut_change', userId, note || `Statut → ${nextStatus}`));
    await ticket.save();

    return res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('❌ PATCH /api/tickets/:id/status:', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tickets/:id/approve-patch — approbation fondateur
// Merge fix/ticket-{id} → dev (JAMAIS main). Admin uniquement.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/approve-patch', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Seul un admin peut approuver un patch' });
    }
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'ID invalide' });

    const ticket = await Ticket.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket introuvable' });

    if (ticket.status !== 'en_review') {
      return res.status(409).json({ success: false, message: `Le ticket n'est pas en review (statut actuel : ${ticket.status})` });
    }
    if (!ticket.claudeAnalysis?.proposedFix?.branch) {
      return res.status(409).json({ success: false, message: 'Aucun patch proposé sur ce ticket (le job d\'analyse — phase 2 — n\'a pas encore produit de branche)' });
    }
    if (ticket.claudeAnalysis.riskLevel === 'high' || ticket.claudeAnalysis.blacklistTriggered?.length) {
      return res.status(409).json({ success: false, message: 'Patch bloqué par la liste noire de sécurité — review manuelle du code requise, pas de merge via l\'API' });
    }

    // Phase 2 : services/ticketPatchService.mergePatchBranch(branch, 'dev')
    // → git merge --no-ff fix/ticket-{id} dans dev, jamais main, avec vérification
    //   des tests. Non implémenté en phase 1 pour validation du socle d'abord.
    return res.status(501).json({
      success: false,
      message: 'Merge automatisé vers dev livré en phase 2 (job d\'analyse). Le workflow de statut et les garde-fous sont en place.',
    });
  } catch (error) {
    console.error('❌ POST /api/tickets/:id/approve-patch:', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tickets/:id/reject-patch — rejet fondateur → escalade
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/reject-patch', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Seul un admin peut rejeter un patch' });
    }
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'ID invalide' });

    const ticket = await Ticket.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket introuvable' });
    if (!['en_review', 'patch_propose'].includes(ticket.status)) {
      return res.status(409).json({ success: false, message: `Rien à rejeter (statut actuel : ${ticket.status})` });
    }

    const userId = req.user._id || req.user.id;
    const { note = '' } = req.body || {};
    ticket.status = 'escalade';
    ticket.history.push(historyEntry('patch_rejete', userId, note || 'Patch rejeté par le fondateur — escalade humaine'));
    await ticket.save();

    return res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('❌ POST /api/tickets/:id/reject-patch:', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tickets/:id/dispatch — (re)envoyer le ticket à Claude Code. Admin.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/dispatch', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Réservé aux admins' });
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'ID invalide' });
    const ticket = await Ticket.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket introuvable' });

    await dispatchTicketToClaude(ticket);

    ticket.status = 'analyse_en_cours';
    ticket.claudeAnalysis.status = 'running';
    ticket.claudeAnalysis.error = '';
    ticket.history.push(historyEntry('analyse_lancee', req.user._id || req.user.id, 'Envoyé à Claude Code'));
    await ticket.save();
    return res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('❌ POST /api/tickets/:id/dispatch:', error.message);
    return res.status(502).json({ success: false, message: error.message || 'Dispatch impossible' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tickets/:id/analysis — callback machine-à-machine du workflow GitHub.
// Sécurisé par un secret partagé (header x-ticket-secret), PAS d'auth utilisateur.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/analysis', async (req, res) => {
  try {
    const secret = process.env.TICKET_CALLBACK_SECRET || '';
    if (!secret || req.headers['x-ticket-secret'] !== secret) {
      return res.status(401).json({ success: false, message: 'Non autorisé' });
    }
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'ID invalide' });
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket introuvable' });

    const { ok, diagnosis, branch, prUrl, filesChanged, testResults, riskLevel, recommendedAction, confidenceScore, error } = req.body || {};
    ticket.claudeAnalysis.analyzedAt = new Date();

    if (ok) {
      ticket.claudeAnalysis.status = 'completed';
      if (diagnosis) ticket.claudeAnalysis.diagnosis = String(diagnosis).slice(0, 8000);
      if (typeof confidenceScore === 'number') ticket.claudeAnalysis.confidenceScore = Math.max(0, Math.min(1, confidenceScore));
      if (riskLevel && Ticket.RISK_LEVELS.includes(riskLevel)) ticket.claudeAnalysis.riskLevel = riskLevel;
      if (['auto_patch', 'human_review', 'escalate_urgent'].includes(recommendedAction)) ticket.claudeAnalysis.recommendedAction = recommendedAction;
      ticket.claudeAnalysis.proposedFix.branch = branch || ticket.claudeAnalysis.proposedFix.branch || '';
      ticket.claudeAnalysis.proposedFix.prUrl = prUrl || '';
      if (Array.isArray(filesChanged)) ticket.claudeAnalysis.proposedFix.filesChanged = filesChanged.slice(0, 200);
      if (testResults) ticket.claudeAnalysis.proposedFix.testResults = testResults;
      ticket.status = 'en_review';
      ticket.history.push(historyEntry('patch_propose', 'claude', prUrl ? `PR : ${prUrl}` : (branch ? `Branche : ${branch}` : 'Analyse terminée')));
    } else {
      ticket.claudeAnalysis.status = 'failed';
      ticket.claudeAnalysis.error = String(error || 'Analyse échouée').slice(0, 2000);
      ticket.status = 'escalade';
      ticket.history.push(historyEntry('tests_echoues', 'claude', ticket.claudeAnalysis.error));
    }

    ticket.markModified('claudeAnalysis');
    await ticket.save();
    return res.json({ success: true });
  } catch (e) {
    console.error('❌ POST /api/tickets/:id/analysis:', e.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
