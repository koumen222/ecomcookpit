import express from 'express';
import EcomUser from '../models/EcomUser.js';
import Workspace from '../models/Workspace.js';
import WhatsAppLog from '../models/WhatsAppLog.js';
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

export default router;
