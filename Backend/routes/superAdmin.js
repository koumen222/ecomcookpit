import express from 'express';
import EcomUser from '../models/EcomUser.js';
import Workspace from '../models/Workspace.js';
import PlanPayment from '../models/PlanPayment.js';
import WhatsAppLog from '../models/WhatsAppLog.js';
import SupportConversation from '../models/SupportConversation.js';
import { requireEcomAuth, requireSuperAdmin } from '../middleware/ecomAuth.js';
import { logAudit, auditSensitiveAccess, AuditLog } from '../middleware/security.js';

const router = express.Router();

// GET /api/ecom/super-admin/users - Tous les utilisateurs de toutes les workspaces
router.get('/users',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { role, workspaceId, isActive, search, page = 1, limit = 1000 } = req.query;
      const filter = {};

      if (role) filter.role = role;
      if (workspaceId) filter.workspaceId = workspaceId;
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      if (search) {
        filter.email = { $regex: search, $options: 'i' };
      }

      console.log('🔍 [SuperAdmin Users] filter:', JSON.stringify(filter), 'limit:', limit, 'page:', page);
      await logAudit(req, 'VIEW_USERS', `Consultation liste utilisateurs (filter: ${JSON.stringify(filter)})`, 'user');

      const users = await EcomUser.find(filter)
        .select('-password')
        .populate('workspaceId', 'name slug')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await EcomUser.countDocuments(filter);

      console.log(`📊 [SuperAdmin Users] find() retourné: ${users.length}, countDocuments(filter): ${total}`);

      // Stats globales
      const stats = await EcomUser.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]);

      const totalActive = await EcomUser.countDocuments({ isActive: true });
      const totalInactive = await EcomUser.countDocuments({ isActive: false });

      res.json({
        success: true,
        data: {
          users,
          stats: {
            byRole: stats,
            totalUsers: total,
            totalActive,
            totalInactive
          },
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Erreur super-admin get users:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/super-admin/users/:id - Détails d'un utilisateur spécifique
router.get('/users/:id',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      console.log(`🔍 [SuperAdmin] Récupération utilisateur ${id}...`);
      await logAudit(req, 'VIEW_USER_DETAIL', `Consultation détails utilisateur ${id}`, 'user', id);

      const user = await EcomUser.findById(id)
        .select('-password')
        .populate('workspaceId', 'name slug')
        .populate('workspaces.workspaceId', 'name slug')
        .populate('workspaces.invitedBy', 'email name');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      console.log(`✅ [SuperAdmin] Utilisateur ${user.email} trouvé`);

      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      console.error('Erreur super-admin get user detail:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/super-admin/workspaces - Toutes les workspaces
router.get('/workspaces',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      console.log('🔍 [SuperAdmin] Récupération de tous les workspaces...');

      const workspaces = await Workspace.find()
        .populate('owner', 'email role')
        .sort({ createdAt: -1 });

      console.log(`📊 [SuperAdmin] ${workspaces.length} workspaces trouvés dans la base`);

      // Vérifier le nombre total sans filtre
      const totalCount = await Workspace.countDocuments();
      console.log(`📊 [SuperAdmin] Workspace.countDocuments() = ${totalCount}`);

      // Compter les membres par workspace
      const memberCounts = await EcomUser.aggregate([
        { $match: { workspaceId: { $ne: null } } },
        { $group: { _id: '$workspaceId', count: { $sum: 1 } } }
      ]);

      console.log(`📊 [SuperAdmin] ${memberCounts.length} workspaces avec membres`);

      const memberMap = {};
      memberCounts.forEach(m => { memberMap[m._id.toString()] = m.count; });

      const workspacesWithCounts = workspaces.map(ws => ({
        ...ws.toObject(),
        memberCount: memberMap[ws._id.toString()] || 0
      }));

      res.json({
        success: true,
        data: {
          workspaces: workspacesWithCounts,
          totalWorkspaces: workspaces.length,
          totalActive: workspaces.filter(w => w.isActive).length
        }
      });
    } catch (error) {
      console.error('Erreur super-admin get workspaces:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/ecom/super-admin/users/:id/role - Changer le rôle d'un utilisateur
router.put('/users/:id/role',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { role } = req.body;
      if (!['super_admin', 'ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Rôle invalide' });
      }

      const user = await EcomUser.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      const oldRole = user.role;
      user.role = role;
      await user.save();
      await logAudit(req, 'CHANGE_ROLE', `Changement rôle: ${user.email} ${oldRole} → ${role}`, 'user', user._id);

      res.json({
        success: true,
        message: 'Rôle mis à jour',
        data: { id: user._id, email: user.email, role: user.role }
      });
    } catch (error) {
      console.error('Erreur super-admin update role:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/ecom/super-admin/users/:id/toggle - Activer/désactiver un utilisateur
router.put('/users/:id/toggle',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const user = await EcomUser.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      if (user._id.toString() === req.ecomUser._id.toString()) {
        return res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous désactiver vous-même' });
      }

      user.isActive = !user.isActive;
      await user.save();
      await logAudit(req, 'TOGGLE_USER', `${user.isActive ? 'Activation' : 'Désactivation'} de ${user.email}`, 'user', user._id);

      res.json({
        success: true,
        message: user.isActive ? 'Utilisateur activé' : 'Utilisateur désactivé',
        data: { id: user._id, email: user.email, isActive: user.isActive }
      });
    } catch (error) {
      console.error('Erreur super-admin toggle user:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/ecom/super-admin/users/:id/rita-toggle - Activer/désactiver Rita IA pour un utilisateur
router.put('/users/:id/rita-toggle',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const user = await EcomUser.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }
      if (user.role !== 'ecom_admin') {
        return res.status(400).json({ success: false, message: 'Rita IA ne peut être activé que pour les admins' });
      }
      user.canAccessRitaAgent = !user.canAccessRitaAgent;
      await user.save();
      await logAudit(req, 'TOGGLE_RITA', `Rita IA ${user.canAccessRitaAgent ? 'activé' : 'désactivé'} pour ${user.email}`, 'user', user._id);
      res.json({
        success: true,
        message: user.canAccessRitaAgent ? 'Rita IA activé' : 'Rita IA désactivé',
        data: { id: user._id, email: user.email, canAccessRitaAgent: user.canAccessRitaAgent }
      });
    } catch (error) {
      console.error('Erreur super-admin toggle rita:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// DELETE /api/ecom/super-admin/users/:id - Supprimer un utilisateur
router.delete('/users/:id',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      if (req.ecomUser._id.toString() === req.params.id) {
        return res.status(400).json({ success: false, message: 'Vous ne pouvez pas supprimer votre propre compte' });
      }

      const user = await EcomUser.findByIdAndDelete(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }
      await logAudit(req, 'DELETE_USER', `Suppression de ${user.email} (rôle: ${user.role})`, 'user', req.params.id);

      res.json({ success: true, message: 'Utilisateur supprimé' });
    } catch (error) {
      console.error('Erreur super-admin delete user:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/ecom/super-admin/workspaces/:id/toggle - Activer/désactiver un workspace
router.put('/workspaces/:id/toggle',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const workspace = await Workspace.findById(req.params.id);
      if (!workspace) {
        return res.status(404).json({ success: false, message: 'Espace non trouvé' });
      }

      workspace.isActive = !workspace.isActive;
      await workspace.save();
      await logAudit(req, 'TOGGLE_WORKSPACE', `${workspace.isActive ? 'Activation' : 'Désactivation'} de l'espace ${workspace.name}`, 'workspace', workspace._id);

      res.json({
        success: true,
        message: workspace.isActive ? 'Espace activé' : 'Espace désactivé',
        data: workspace
      });
    } catch (error) {
      console.error('Erreur super-admin toggle workspace:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/super-admin/audit-logs - Consulter les logs d'audit (immuables)
router.get('/audit-logs',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { action, userId, page = 1, limit = 100 } = req.query;
      const filter = {};
      if (action) filter.action = action;
      if (userId) filter.userId = userId;

      await logAudit(req, 'VIEW_SENSITIVE_DATA', 'Consultation des logs d\'audit', 'audit_log');

      const logs = await AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await AuditLog.countDocuments(filter);

      // Stats par action
      const actionStats = await AuditLog.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      res.json({
        success: true,
        data: {
          logs,
          stats: { actionStats, total },
          pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
        }
      });
    } catch (error) {
      console.error('Erreur audit-logs:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/super-admin/security-info - Infos sécurité (public pour les utilisateurs connectés)
router.get('/security-info',
  requireEcomAuth,
  async (req, res) => {
    try {
      const totalLogs = await AuditLog.countDocuments();
      const last24h = await AuditLog.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86400000) } });
      const failedLogins = await AuditLog.countDocuments({ action: 'LOGIN_FAILED', createdAt: { $gte: new Date(Date.now() - 86400000) } });
      const lastActivity = await AuditLog.findOne().sort({ createdAt: -1 }).lean();

      res.json({
        success: true,
        data: {
          measures: [
            { id: 'encryption', name: 'Chiffrement mots de passe', status: 'active', type: 'bcrypt (12 rounds)', desc: 'Irréversible — même les admins ne peuvent pas lire les mots de passe' },
            { id: 'tls', name: 'Chiffrement en transit', status: 'active', type: 'HTTPS/TLS', desc: 'Toutes les communications sont chiffrées' },
            { id: 'aes', name: 'Chiffrement données sensibles', status: 'active', type: 'AES-256-GCM', desc: 'Données sensibles chiffrées dans la base de données' },
            { id: 'isolation', name: 'Isolation des workspaces', status: 'active', type: 'Filtrage MongoDB', desc: 'Chaque espace est cloisonné au niveau de la base de données' },
            { id: 'rbac', name: 'Contrôle d\'accès par rôle', status: 'active', type: 'RBAC', desc: 'Principe du moindre privilège appliqué' },
            { id: 'audit', name: 'Journalisation d\'audit', status: 'active', type: 'Logs immuables', desc: 'Chaque action est tracée et ne peut être ni modifiée ni supprimée' },
            { id: 'headers', name: 'Headers de sécurité HTTP', status: 'active', type: 'HSTS, CSP, XSS', desc: 'Protection contre XSS, clickjacking, sniffing' },
            { id: 'ratelimit', name: 'Protection brute force', status: 'active', type: 'Rate limiting', desc: 'Limitation des tentatives de connexion' },
            { id: 'nocookies', name: 'Zéro cookie tracking', status: 'active', type: 'JWT uniquement', desc: 'Aucun cookie publicitaire ni outil de suivi tiers' },
            { id: 'masking', name: 'Masquage des données', status: 'active', type: 'Data masking', desc: 'Les données sensibles sont masquées dans les réponses API' }
          ],
          stats: {
            totalAuditLogs: totalLogs,
            last24hActions: last24h,
            failedLoginsLast24h: failedLogins,
            lastActivity: lastActivity?.createdAt || null
          }
        }
      });
    } catch (error) {
      console.error('Erreur security-info:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/super-admin/whatsapp-postulations - Toutes les postulations WhatsApp
router.get('/whatsapp-postulations',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { status } = req.query;

      console.log('🔍 [SuperAdmin] Récupération des postulations WhatsApp...');

      // Récupérer TOUS les workspaces et filtrer en JavaScript
      const allWorkspaces = await Workspace.find({})
        .populate('owner', 'email name role')
        .lean();

      console.log(`📊 [SuperAdmin] ${allWorkspaces.length} workspaces trouvés au total`);

      // Normaliser les données et filtrer ceux qui ont une postulation WhatsApp
      const postulations = [];
      
      for (const ws of allWorkspaces) {
        const config = ws.settings?.whatsappConfig || ws.whatsappConfig || {};
        
        // Vérifier si ce workspace a une postulation WhatsApp
        const hasPostulation = config.status && ['pending', 'active', 'rejected'].includes(config.status);
        
        if (hasPostulation) {
          // Filtre optionnel par status
          if (status && config.status !== status) {
            continue;
          }

          // Récupérer l'utilisateur qui a fait la demande
          let requestedByUser = null;
          if (config.requestedBy) {
            requestedByUser = await EcomUser.findById(config.requestedBy)
              .select('email name role')
              .lean();
          }

          postulations.push({
            _id: ws._id,
            workspaceName: ws.name,
            workspaceSlug: ws.slug,
            owner: ws.owner,
            isActive: ws.isActive,
            phoneNumber: config.phoneNumber || '',
            status: config.status || 'none',
            requestedAt: config.requestedAt || null,
            activatedAt: config.activatedAt || null,
            note: config.note || '',
            businessName: config.businessName || '',
            contactName: config.contactName || '',
            email: config.email || '',
            currentWhatsappNumber: config.currentWhatsappNumber || '',
            businessType: config.businessType || '',
            monthlyMessages: config.monthlyMessages || '',
            reason: config.reason || '',
            requestedBy: requestedByUser
          });
        }
      }

      // Trier par date de demande (plus récent en premier)
      postulations.sort((a, b) => {
        const dateA = a.requestedAt ? new Date(a.requestedAt) : new Date(0);
        const dateB = b.requestedAt ? new Date(b.requestedAt) : new Date(0);
        return dateB - dateA;
      });

      const stats = {
        total: postulations.length,
        pending: postulations.filter(p => p.status === 'pending').length,
        active: postulations.filter(p => p.status === 'active').length,
        rejected: postulations.filter(p => p.status === 'rejected').length
      };

      console.log(`✅ [SuperAdmin] ${postulations.length} postulations WhatsApp trouvées`);
      console.log(`📊 [SuperAdmin] Stats: ${stats.pending} pending, ${stats.active} active, ${stats.rejected} rejected`);

      res.json({
        success: true,
        data: { postulations, stats }
      });
    } catch (error) {
      console.error('Erreur super-admin whatsapp-postulations:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/ecom/super-admin/whatsapp-postulations/:id - Approuver/rejeter une postulation
router.put('/whatsapp-postulations/:id',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { status, note } = req.body;

      if (!['active', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Statut invalide (active, rejected, pending)' });
      }

      const workspace = await Workspace.findById(req.params.id);
      if (!workspace) {
        return res.status(404).json({ success: false, message: 'Workspace non trouvé' });
      }

      // Mettre à jour dans settings.whatsappConfig (où le formulaire sauvegarde)
      if (!workspace.settings) workspace.settings = {};
      if (!workspace.settings.whatsappConfig) {
        // Peut-être que c'est dans whatsappConfig directement
        if (workspace.whatsappConfig && workspace.whatsappConfig.status !== 'none') {
          workspace.settings.whatsappConfig = { ...workspace.whatsappConfig.toObject() };
        } else {
          return res.status(400).json({ success: false, message: 'Aucune postulation WhatsApp trouvée pour ce workspace' });
        }
      }

      workspace.settings.whatsappConfig.status = status;
      if (note !== undefined) workspace.settings.whatsappConfig.note = note;
      if (status === 'active') {
        workspace.settings.whatsappConfig.activatedAt = new Date();
        workspace.settings.whatsappConfig.note = note || 'Approuvé par le Super Admin';
        workspace.whatsappConfig = {
          phoneNumber: workspace.settings.whatsappConfig.phoneNumber,
          status: 'active',
          requestedAt: workspace.settings.whatsappConfig.requestedAt,
          activatedAt: new Date(),
          note: note || 'Approuvé par le Super Admin'
        };
      } else if (status === 'rejected') {
        workspace.settings.whatsappConfig.note = note || 'Rejeté par le Super Admin';
      }

      workspace.markModified('settings');
      await workspace.save();
      await logAudit(req, 'WHATSAPP_POSTULATION_UPDATE', `${status === 'active' ? 'Approbation' : 'Rejet'} postulation WhatsApp pour ${workspace.name} (tel: ${workspace.settings.whatsappConfig.phoneNumber})`, 'workspace', workspace._id);

      console.log(`📱 [SuperAdmin] Postulation WhatsApp ${status}: ${workspace.name} (${workspace.settings.whatsappConfig.phoneNumber})`);

      res.json({
        success: true,
        message: status === 'active' ? '✅ Postulation approuvée' : status === 'rejected' ? '❌ Postulation rejetée' : '⏳ Postulation remise en attente',
        data: {
          workspaceId: workspace._id,
          status,
          phoneNumber: workspace.settings.whatsappConfig.phoneNumber
        }
      });
    } catch (error) {
      console.error('Erreur super-admin whatsapp-postulation update:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/super-admin/whatsapp-logs - Logs d'envoi WhatsApp
router.get('/whatsapp-logs',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { workspaceId, status, page = 1, limit = 100 } = req.query;
      const filter = {};
      if (workspaceId) filter.workspaceId = workspaceId;
      if (status) filter.status = status;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [logs, total] = await Promise.all([
        WhatsAppLog.find(filter)
          .sort({ sentAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('workspaceId', 'name slug')
          .populate('userId', 'email name')
          .populate('campaignId', 'name')
          .lean(),
        WhatsAppLog.countDocuments(filter)
      ]);

      const stats = {
        total,
        sent: await WhatsAppLog.countDocuments({ ...filter, status: 'sent' }),
        delivered: await WhatsAppLog.countDocuments({ ...filter, status: 'delivered' }),
        failed: await WhatsAppLog.countDocuments({ ...filter, status: 'failed' }),
        pending: await WhatsAppLog.countDocuments({ ...filter, status: 'pending' }),
      };

      res.json({ success: true, data: { logs, stats, page: parseInt(page), total } });
    } catch (error) {
      console.error('Erreur super-admin whatsapp-logs:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// SUPPORT CHAT — Admin endpoints
// ═══════════════════════════════════════════════════════════════

// GET /api/ecom/super-admin/support — Liste des conversations
router.get('/support', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;

    const conversations = await SupportConversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await SupportConversation.countDocuments(filter);
    const unreadTotal = await SupportConversation.aggregate([
      { $group: { _id: null, total: { $sum: '$unreadAdmin' } } }
    ]);

    res.json({
      success: true,
      data: {
        conversations,
        total,
        unreadTotal: unreadTotal[0]?.total || 0,
        page: Number(page),
      }
    });
  } catch (err) {
    console.error('[Support Admin] GET /support:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/super-admin/support/:sessionId — Détail + mark as read
router.get('/support/:sessionId', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const conv = await SupportConversation.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { $set: { unreadAdmin: 0 } },
      { new: true }
    );
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation introuvable' });
    res.json({ success: true, data: { conversation: conv } });
  } catch (err) {
    console.error('[Support Admin] GET /support/:id:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/super-admin/support/:sessionId/reply — Agent réplique
router.post('/support/:sessionId/reply', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { text, agentName } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }

    const conv = await SupportConversation.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      {
        $push: { messages: { from: 'agent', text: text.trim().slice(0, 2000), agentName: agentName || 'Rita' } },
        $set:  { status: 'replied', lastMessageAt: new Date() },
      },
      { new: true }
    );

    if (!conv) return res.status(404).json({ success: false, message: 'Conversation introuvable' });
    res.json({ success: true, data: { conversation: conv } });
  } catch (err) {
    console.error('[Support Admin] POST /support/:id/reply:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/super-admin/support/:sessionId/status — Changer le statut
router.put('/support/:sessionId/status', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['open', 'replied', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Statut invalide' });
    }
    const conv = await SupportConversation.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { $set: { status } },
      { new: true }
    );
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation introuvable' });
    res.json({ success: true, data: { conversation: conv } });
  } catch (err) {
    console.error('[Support Admin] PUT /support/:id/status:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── Plan management ─────────────────────────────────────────────────────────

// GET /api/ecom/super-admin/workspaces — list workspaces with plan info
router.get('/workspaces', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { search, plan, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (plan) filter.plan = plan;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const workspaces = await Workspace.find(filter)
      .select('name slug plan planExpiresAt trialStartedAt trialEndsAt trialUsed owner')
      .populate('owner', 'email name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Workspace.countDocuments(filter);
    res.json({ success: true, data: { workspaces, total } });
  } catch (err) {
    console.error('[SuperAdmin] GET /workspaces error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PATCH /api/ecom/super-admin/workspaces/:id/plan — manually set plan
router.patch('/workspaces/:id/plan', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { plan, durationMonths = 1 } = req.body;
    if (!['free', 'pro', 'ultra'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Plan invalide (free/pro/ultra)' });
    }

    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace introuvable' });

    await logAudit(req, 'SET_PLAN', `Plan set to ${plan} for workspace ${workspace.name}`, 'workspace', workspace._id);

    if (plan === 'free') {
      workspace.plan = 'free';
      workspace.planExpiresAt = null;
    } else {
      const now = new Date();
      const base = workspace.planExpiresAt && workspace.planExpiresAt > now ? workspace.planExpiresAt : now;
      const newExpiry = new Date(base);
      newExpiry.setMonth(newExpiry.getMonth() + durationMonths);
      workspace.plan = plan;
      workspace.planExpiresAt = newExpiry;
    }
    await workspace.save();

    res.json({ success: true, workspace: { _id: workspace._id, plan: workspace.plan, planExpiresAt: workspace.planExpiresAt } });
  } catch (err) {
    console.error('[SuperAdmin] PATCH /workspaces/:id/plan error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── Billing tracking (Super Admin) ──────────────────────────────────────────

// GET /api/ecom/super-admin/billing — full billing overview for all users
router.get('/billing', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    console.log('[SuperAdmin] GET /billing starting...');
    const { status, plan, search, page = 1, limit = 50 } = req.query;

    // 1) All payments with user + workspace info
    console.log('[SuperAdmin] Fetching payments...');
    const paymentFilter = {};
    if (status) paymentFilter.status = status;
    if (plan) paymentFilter.plan = plan;

    const payments = await PlanPayment.find(paymentFilter)
      .populate('userId', 'email name phone')
      .populate('workspaceId', 'name slug plan planExpiresAt trialEndsAt trialUsed')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const totalPayments = await PlanPayment.countDocuments(paymentFilter);

    // 2) Revenue stats
    console.log('[SuperAdmin] Calculating revenue stats...');
    const revenueAgg = await PlanPayment.aggregate([
      { $match: { status: 'paid' } },
      { $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        totalFees: { $sum: '$fees' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }}
    ]);
    const revenue = revenueAgg[0] || { totalRevenue: 0, totalFees: 0, count: 0, avgAmount: 0 };

    // Revenue by plan
    const revenueByPlan = await PlanPayment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: '$plan', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    // Revenue by month (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const revenueByMonth = await PlanPayment.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: twelveMonthsAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    // 3) Payment status breakdown
    const statusBreakdown = await PlanPayment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }
    ]);

    // 4) Workspace plan distribution
    console.log('[SuperAdmin] Calculating plan distribution...');
    const freeCt = await Workspace.countDocuments({ plan: 'free' });
    const proCt = await Workspace.countDocuments({ plan: 'pro' });
    const ultraCt = await Workspace.countDocuments({ plan: 'ultra' });
    const planDistribution = [
      { _id: 'free', count: freeCt },
      { _id: 'pro', count: proCt },
      { _id: 'ultra', count: ultraCt }
    ].filter(p => p.count > 0);

    // 5) Active subscriptions (plan != 'free' and not expired)
    console.log('[SuperAdmin] Calculating active subscriptions...');
    const now = new Date();
    const activeSubscriptions = await Workspace.countDocuments({
      plan: { $in: ['pro', 'ultra'] },
      planExpiresAt: { $gt: now }
    });

    // Expiring soon (within 7 days)
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);
    const expiringSoon = await Workspace.find({
      plan: { $in: ['pro', 'ultra'] },
      planExpiresAt: { $gt: now, $lte: sevenDaysFromNow }
    })
      .select('name slug plan planExpiresAt owner')
      .populate('owner', 'email name phone')
      .lean();

    // 6) Active trials
    const activeTrials = await Workspace.find({
      trialEndsAt: { $gt: now },
      trialUsed: false
    })
      .select('name slug trialStartedAt trialEndsAt owner plan')
      .populate('owner', 'email name phone')
      .sort({ trialEndsAt: 1 })
      .lean();

    // 7) Expired (paid plans that expired, now effectively free)
    const expiredPaid = await Workspace.find({
      plan: { $in: ['pro', 'ultra'] },
      planExpiresAt: { $lte: now }
    })
      .select('name slug plan planExpiresAt owner')
      .populate('owner', 'email name phone')
      .lean();

    // 8) Recent payments (last 30 days stats)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const recent30d = await PlanPayment.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    // 9) All workspaces with plan details (for search/filter)
    const wsFilter = {};
    if (search) wsFilter.name = { $regex: search, $options: 'i' };
    const allWorkspaces = await Workspace.find(wsFilter)
      .select('name slug plan planExpiresAt trialStartedAt trialEndsAt trialUsed owner createdAt')
      .populate('owner', 'email name phone')
      .sort({ createdAt: -1 })
      .lean();

    console.log('[SuperAdmin] Billing request completed successfully');
    res.json({
      success: true,
      data: {
        payments,
        totalPayments,
        revenue: {
          total: revenue.totalRevenue,
          fees: revenue.totalFees,
          paidCount: revenue.count,
          avgAmount: Math.round(revenue.avgAmount || 0),
          byPlan: revenueByPlan,
          byMonth: revenueByMonth,
          last30d: recent30d[0] || { total: 0, count: 0 }
        },
        statusBreakdown,
        planDistribution,
        activeSubscriptions,
        expiringSoon,
        activeTrials,
        expiredPaid,
        workspaces: allWorkspaces,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalPayments,
          pages: Math.ceil(totalPayments / Number(limit))
        }
      }
    });
  } catch (err) {
    console.error('[SuperAdmin] GET /billing error:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
