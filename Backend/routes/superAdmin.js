import express from 'express';
import mongoose from 'mongoose';
import EcomUser from '../models/EcomUser.js';
import Workspace from '../models/Workspace.js';
import FeatureUsageLog from '../models/FeatureUsageLog.js';
import PlanPayment from '../models/PlanPayment.js';
import GenerationPayment from '../models/GenerationPayment.js';
import WhatsAppLog from '../models/WhatsAppLog.js';
import SupportConversation from '../models/SupportConversation.js';
import StoreProduct from '../models/StoreProduct.js';
import { requireEcomAuth, requireSuperAdmin } from '../middleware/ecomAuth.js';
import { logAudit, auditSensitiveAccess, AuditLog } from '../middleware/security.js';
import { sendCustomNotificationEmail, sendNotificationEmail } from '../core/notifications/email.service.js';
import { sendPushNotification, sendPushNotificationToUser } from '../services/pushService.js';

const router = express.Router();

function sumPaymentAggRows(rows = []) {
  return rows.reduce((acc, row) => {
    acc.totalRevenue += row.totalRevenue || 0;
    acc.totalFees += row.totalFees || 0;
    acc.count += row.count || 0;
    acc.amountSum += row.amountSum || 0;
    return acc;
  }, { totalRevenue: 0, totalFees: 0, count: 0, amountSum: 0 });
}

function mergeGroupedTotals(...groups) {
  const merged = new Map();
  groups.flat().forEach((item) => {
    const key = item?._id;
    if (!key) return;
    const current = merged.get(key) || { _id: key, count: 0, total: 0 };
    current.count += item.count || 0;
    current.total += item.total || 0;
    merged.set(key, current);
  });
  return Array.from(merged.values());
}

function mergeGroupedLabelTotals(...groups) {
  const merged = new Map();
  groups.flat().forEach((item) => {
    const key = item?._id || 'unknown';
    const current = merged.get(key) || { _id: key, count: 0, total: 0 };
    current.count += item.count || 0;
    current.total += item.total || 0;
    merged.set(key, current);
  });
  return Array.from(merged.values()).sort((a, b) => (b.total || 0) - (a.total || 0));
}

function normalizePlanPayment(payment) {
  return {
    ...payment,
    paymentType: 'plan',
    paymentLabel: 'Abonnement',
    appliedAt: payment.activatedAt || null,
  };
}

function normalizeGenerationPayment(payment) {
  return {
    ...payment,
    paymentType: 'generation',
    paymentLabel: 'Credits pages produits',
    appliedAt: payment.creditedAt || null,
  };
}

function mergeRevenueByMonth(...groups) {
  const merged = new Map();
  groups.flat().forEach((item) => {
    const key = item?._id;
    if (!key) return;
    const current = merged.get(key) || { _id: key, total: 0, count: 0 };
    current.total += item.total || 0;
    current.count += item.count || 0;
    merged.set(key, current);
  });
  return Array.from(merged.values()).sort((a, b) => String(a._id).localeCompare(String(b._id)));
}

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
        .select('+freeGenerationsRemaining +paidGenerationsRemaining +totalGenerations')
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

// PUT /api/ecom/super-admin/workspaces/:id/subscription-warning - Toggle subscription warning banner
router.put('/workspaces/:id/subscription-warning',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const workspace = await Workspace.findById(req.params.id);
      if (!workspace) {
        return res.status(404).json({ success: false, message: 'Espace non trouvé' });
      }

      const { active, message } = req.body || {};
      const isActive = active !== undefined ? Boolean(active) : !workspace.subscriptionWarning?.active;

      workspace.subscriptionWarning = {
        active: isActive,
        message: message || workspace.subscriptionWarning?.message || 'Votre abonnement expire bientôt. Vous avez 24h pour renouveler afin de conserver l\'accès à votre compte.',
        deadline: isActive ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
        activatedAt: isActive ? new Date() : null,
        activatedBy: isActive ? req.ecomUser._id : null
      };

      await workspace.save();
      await logAudit(req, 'SUBSCRIPTION_WARNING', `${isActive ? 'Activation' : 'Désactivation'} alerte abonnement pour ${workspace.name}`, 'workspace', workspace._id);

      res.json({
        success: true,
        message: isActive ? 'Alerte abonnement activée (24h)' : 'Alerte abonnement désactivée',
        data: workspace
      });
    } catch (error) {
      console.error('Erreur super-admin subscription-warning:', error);
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
        $inc:  { unreadUser: 1 },
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

// POST /api/ecom/super-admin/support/send-to-user — Envoyer un message à un utilisateur spécifique
router.post('/support/send-to-user', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { userId, text, subject, agentName } = req.body;
    if (!userId || !text?.trim()) {
      return res.status(400).json({ success: false, message: 'userId et text requis' });
    }
    const user = await EcomUser.findById(userId).select('name email workspaceId');
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });

    const sessionId = `admin_to_${userId}_${Date.now()}`;
    const conv = await SupportConversation.create({
      sessionId,
      userId: user._id,
      userName: user.name || '',
      userEmail: user.email || '',
      workspaceId: user.workspaceId || null,
      subject: (subject || '').trim().slice(0, 200) || 'Message du support',
      category: 'general',
      messages: [{ from: 'agent', text: text.trim().slice(0, 2000), agentName: agentName || 'Scalor' }],
      unreadUser: 1,
      status: 'replied',
      lastMessageAt: new Date(),
    });

    res.json({ success: true, data: { conversation: conv } });
  } catch (err) {
    console.error('[Support Admin] POST /support/send-to-user:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/super-admin/support/broadcast — Envoyer un message à tous les utilisateurs actifs
router.post('/support/broadcast', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { text, subject, agentName } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }

    const users = await EcomUser.find({ isActive: true, role: { $ne: 'super_admin' } })
      .select('_id name email workspaceId')
      .lean();

    const safeText = text.trim().slice(0, 2000);
    const safeSubject = (subject || '').trim().slice(0, 200) || 'Message de Scalor';
    const agent = agentName || 'Scalor';
    const now = new Date();

    const docs = users.map(u => ({
      sessionId: `broadcast_${u._id}_${now.getTime()}`,
      userId: u._id,
      userName: u.name || '',
      userEmail: u.email || '',
      workspaceId: u.workspaceId || null,
      subject: safeSubject,
      category: 'general',
      messages: [{ from: 'agent', text: safeText, agentName: agent, createdAt: now }],
      unreadUser: 1,
      status: 'replied',
      lastMessageAt: now,
    }));

    await SupportConversation.insertMany(docs, { ordered: false });

    res.json({ success: true, data: { sent: docs.length } });
  } catch (err) {
    console.error('[Support Admin] POST /support/broadcast:', err.message);
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
      .select('name slug plan planExpiresAt trialStartedAt trialEndsAt trialUsed owner freeGenerationsRemaining paidGenerationsRemaining totalGenerations')
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

// PATCH /api/ecom/super-admin/workspaces/:id/generations — manually update generations
router.patch('/workspaces/:id/generations', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { freeGenerations, paidGenerations } = req.body;
    
    if (typeof freeGenerations !== 'number' || typeof paidGenerations !== 'number') {
      return res.status(400).json({ success: false, message: 'Les valeurs doivent être des nombres' });
    }

    if (freeGenerations < 0 || paidGenerations < 0) {
      return res.status(400).json({ success: false, message: 'Les valeurs doivent être positives' });
    }

    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace introuvable' });

    await logAudit(req, 'UPDATE_GENERATIONS', 
      `Updated generations for workspace ${workspace.name}: free ${workspace.freeGenerationsRemaining || 0} → ${freeGenerations}, paid ${workspace.paidGenerationsRemaining || 0} → ${paidGenerations}`, 
      'workspace', workspace._id);

    workspace.freeGenerationsRemaining = freeGenerations;
    workspace.paidGenerationsRemaining = paidGenerations;
    await workspace.save();

    res.json({ 
      success: true, 
      message: 'Générations mises à jour avec succès',
      workspace: { 
        _id: workspace._id, 
        freeGenerationsRemaining: workspace.freeGenerationsRemaining,
        paidGenerationsRemaining: workspace.paidGenerationsRemaining,
        totalGenerations: workspace.totalGenerations || 0
      } 
    });
  } catch (err) {
    console.error('[SuperAdmin] PATCH /workspaces/:id/generations error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── Billing tracking (Super Admin) ──────────────────────────────────────────

// GET /api/ecom/super-admin/billing — full billing overview for all users
router.get('/billing', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    console.log('[SuperAdmin] GET /billing starting...');
    const { status, plan, search, page = 1, limit = 50 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.max(1, Number(limit) || 50);
    const fetchWindow = pageNumber * limitNumber;

    // 1) All payments with user + workspace info
    console.log('[SuperAdmin] Fetching payments...');
    const sharedPaymentFilter = {};
    if (status) sharedPaymentFilter.status = status;

    const planPaymentFilter = { ...sharedPaymentFilter };
    if (plan) planPaymentFilter.plan = plan;

    const generationPaymentFilter = { ...sharedPaymentFilter };

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const [
      planPayments,
      generationPayments,
      totalPlanPayments,
      totalGenerationPayments,
      planRevenueAgg,
      generationRevenueAgg,
      planRevenueByMonth,
      generationRevenueByMonth,
      planStatusBreakdown,
      generationStatusBreakdown,
      planRecent30d,
      generationRecent30d,
      planRevenueByPlan,
      generationRevenueByType,
      planPaymentsByType,
      generationPaymentsByType,
      planPaymentMethods,
      generationPaymentMethods,
    ] = await Promise.all([
      PlanPayment.find(planPaymentFilter)
        .populate('userId', 'email name phone')
        .populate('workspaceId', 'name slug plan planExpiresAt trialEndsAt trialUsed')
        .sort({ createdAt: -1 })
        .limit(fetchWindow)
        .lean(),
      GenerationPayment.find(generationPaymentFilter)
        .populate('userId', 'email name phone')
        .populate('workspaceId', 'name slug plan planExpiresAt trialEndsAt trialUsed')
        .sort({ createdAt: -1 })
        .limit(fetchWindow)
        .lean(),
      PlanPayment.countDocuments(planPaymentFilter),
      GenerationPayment.countDocuments(generationPaymentFilter),
      PlanPayment.aggregate([
        { $match: { status: 'paid' } },
        { $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalFees: { $sum: '$fees' },
          count: { $sum: 1 },
          amountSum: { $sum: '$amount' }
        }}
      ]),
      GenerationPayment.aggregate([
        { $match: { status: 'paid' } },
        { $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalFees: { $sum: '$fees' },
          count: { $sum: 1 },
          amountSum: { $sum: '$amount' }
        }}
      ]),
      PlanPayment.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: twelveMonthsAgo } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ]),
      GenerationPayment.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: twelveMonthsAgo } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ]),
      PlanPayment.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }
      ]),
      GenerationPayment.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }
      ]),
      PlanPayment.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      GenerationPayment.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      PlanPayment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: '$plan', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      GenerationPayment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: 'generation', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      PlanPayment.aggregate([
        { $group: { _id: 'plan', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      GenerationPayment.aggregate([
        { $group: { _id: 'generation', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      PlanPayment.aggregate([
        { $match: { status: 'paid', paymentMethod: { $nin: [null, ''] } } },
        { $group: { _id: { $toLower: '$paymentMethod' }, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      GenerationPayment.aggregate([
        { $match: { status: 'paid', paymentMethod: { $nin: [null, ''] } } },
        { $group: { _id: { $toLower: '$paymentMethod' }, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
    ]);

    const payments = [
      ...planPayments.map(normalizePlanPayment),
      ...generationPayments.map(normalizeGenerationPayment),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice((pageNumber - 1) * limitNumber, pageNumber * limitNumber);

    const totalPayments = totalPlanPayments + totalGenerationPayments;

    // 2) Revenue stats
    console.log('[SuperAdmin] Calculating revenue stats...');
    const revenueTotals = sumPaymentAggRows(planRevenueAgg, generationRevenueAgg);
    const revenueByMonth = mergeRevenueByMonth(planRevenueByMonth, generationRevenueByMonth);
    const recent30d = sumPaymentAggRows(
      planRecent30d.map(item => ({ ...item, totalRevenue: item.total, totalFees: 0, amountSum: item.total })),
      generationRecent30d.map(item => ({ ...item, totalRevenue: item.total, totalFees: 0, amountSum: item.total }))
    );
    const revenueByType = [
      ...planRevenueByPlan,
      ...generationRevenueByType,
    ];
    const paymentsByType = mergeGroupedLabelTotals(planPaymentsByType, generationPaymentsByType);
    const paymentMethods = mergeGroupedLabelTotals(planPaymentMethods, generationPaymentMethods);

    // 3) Payment status breakdown
    const statusBreakdown = mergeGroupedTotals(planStatusBreakdown, generationStatusBreakdown);

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
      trialUsed: true
    })
      .select('name slug trialStartedAt trialEndsAt trialExpiryNotifiedAt trialExpiredNotifiedAt owner plan')
      .populate('owner', 'email name phone')
      .sort({ trialEndsAt: 1 })
      .lean();

    // 6b) Expired trials (trial ended, still on free plan)
    const expiredTrials = await Workspace.find({
      trialUsed: true,
      trialEndsAt: { $lte: now },
      plan: 'free',
    })
      .select('name slug trialStartedAt trialEndsAt trialExpiryNotifiedAt trialExpiredNotifiedAt owner plan')
      .populate('owner', 'email name phone')
      .sort({ trialEndsAt: -1 })
      .limit(50)
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
          total: revenueTotals.totalRevenue,
          fees: revenueTotals.totalFees,
          paidCount: revenueTotals.count,
          avgAmount: revenueTotals.count > 0 ? Math.round((revenueTotals.amountSum || 0) / revenueTotals.count) : 0,
          byType: revenueByType,
          byMonth: revenueByMonth,
          last30d: { total: recent30d.totalRevenue || 0, count: recent30d.count || 0 }
        },
        paymentsByType,
        paymentMethods,
        statusBreakdown,
        planDistribution,
        activeSubscriptions,
        expiringSoon,
        activeTrials,
        expiredTrials,
        expiredPaid,
        workspaces: allWorkspaces,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total: totalPayments,
          pages: Math.ceil(totalPayments / limitNumber)
        }
      }
    });
  } catch (err) {
    console.error('[SuperAdmin] GET /billing error:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ── Migration : nettoyer les descriptions HTML des produits ──────────────────
function cleanProductHtml(html) {
  if (!html || typeof html !== 'string') return html;
  let s = html;

  // Supprimer liens/boutons WhatsApp (wa.me)
  s = s.replace(/<a[^>]*href=["'][^"']*wa\.me[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');
  // Supprimer boutons contenant "WhatsApp"
  s = s.replace(/<a[^>]*>[\s\S]*?[Ww]hat[sS]?[Aa]pp[\s\S]*?<\/a>/gi, '');
  s = s.replace(/<button[^>]*>[\s\S]*?[Ww]hat[sS]?[Aa]pp[\s\S]*?<\/button>/gi, '');
  // Supprimer liens "Retour"
  s = s.replace(/<a[^>]*>[^<]*[Rr]etour[^<]*<\/a>/gi, '');
  s = s.replace(/<a[^>]*>[^<]*←[^<]*<\/a>/gi, '');
  // Supprimer border-radius sur les images
  s = s.replace(/(<img[^>]+style=["'][^"']*)border-radius\s*:\s*[^;'"]+;?\s*/gi, '$1');
  // Ajouter aspect-ratio + object-fit si absent sur images
  s = s.replace(/<img([^>]+style=["'])([^"']*)(["'][^>]*)>/gi, (match, before, styles, after) => {
    let st = styles;
    if (!st.includes('aspect-ratio')) st += ';aspect-ratio:1 / 1';
    if (!st.includes('object-fit')) st += ';object-fit:cover';
    st = st.replace(/border-radius\s*:\s*[^;]+;?/gi, '').replace(/;;+/g, ';').replace(/^;|;$/g, '');
    return `<img${before}${st}${after}>`;
  });

  return s.trim();
}

router.post('/migrate-product-descriptions', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const products = await StoreProduct.find({
      description: { $exists: true, $ne: '', $regex: /<[^>]+>/ }
    }).select('_id name description').lean();

    let updated = 0, skipped = 0;
    for (const p of products) {
      const cleaned = cleanProductHtml(p.description);
      if (cleaned === p.description) { skipped++; continue; }
      await StoreProduct.updateOne({ _id: p._id }, { $set: { description: cleaned } });
      updated++;
    }

    res.json({ success: true, updated, skipped, total: products.length });
  } catch (err) {
    console.error('[SuperAdmin] migrate-product-descriptions error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /super-admin/notify-workspace — Envoyer email/push manuellement ────
router.post('/notify-workspace', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { workspaceId, channel, templateKey, customEmail } = req.body;
    // channel: 'email' | 'push' | 'both'
    // templateKey: 'trial_expiring' | 'trial_expired' | 'plan_expired'
    if (!workspaceId || !channel || !templateKey) {
      return res.status(400).json({ success: false, message: 'workspaceId, channel et templateKey requis' });
    }

    const allowedTemplates = ['trial_expiring', 'trial_expired', 'plan_expired'];
    if (!allowedTemplates.includes(templateKey)) {
      return res.status(400).json({ success: false, message: `Template invalide. Autorisés: ${allowedTemplates.join(', ')}` });
    }

    const workspace = await Workspace.findById(workspaceId).populate('owner', 'email name phone').lean();
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    const owner = workspace.owner;
    if (!owner?.email) {
      return res.status(400).json({ success: false, message: 'Propriétaire sans email' });
    }

    const results = { email: null, push: null };

    // Build data for templates
    const hoursLeft = workspace.trialEndsAt
      ? Math.max(1, Math.round((new Date(workspace.trialEndsAt) - new Date()) / (60 * 60 * 1000)))
      : 0;
    const trialEndsStr = workspace.trialEndsAt
      ? new Date(workspace.trialEndsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—';
    const planName = workspace.plan === 'pro' ? 'Pro' : workspace.plan === 'ultra' ? 'Ultra' : 'Gratuit';

    const templateData = {
      name: owner.name || '',
      workspaceName: workspace.name,
      hoursLeft,
      trialEndsAt: trialEndsStr,
      planName,
    };

    const pushTitles = {
      trial_expiring: { title: '⏰ Essai gratuit expire bientôt', body: `Plus que ${hoursLeft}h — vos agents IA seront désactivés. Passez à Pro !` },
      trial_expired: { title: '🚫 Essai terminé — Agents IA désactivés', body: 'Vos agents ne répondent plus. Passez à Pro pour les réactiver !' },
      plan_expired: { title: `🚫 Plan ${planName} expiré`, body: 'Vos agents IA sont désactivés. Renouvelez pour continuer à vendre !' },
    };

    const hasCustomEmail = !!(customEmail?.subject?.trim() && customEmail?.message?.trim());

    // Email
    if (channel === 'email' || channel === 'both') {
      try {
        const emailResult = hasCustomEmail
          ? await sendCustomNotificationEmail({
              to: owner.email,
              subject: customEmail.subject,
              message: customEmail.message,
              userId: String(workspace.owner._id),
              workspaceId: String(workspace._id),
              eventType: `manual_custom_${templateKey}`,
            })
          : await sendNotificationEmail({
              to: owner.email,
              templateKey,
              data: templateData,
              userId: String(workspace.owner._id),
              workspaceId: String(workspace._id),
              eventType: `manual_${templateKey}`,
            });
        results.email = emailResult;
      } catch (e) {
        results.email = { success: false, error: e.message };
      }
    }

    // Push
    if (channel === 'push' || channel === 'both') {
      try {
        const pushData = {
          ...pushTitles[templateKey],
          icon: '/icons/icon-192x192.png',
          tag: `manual-${templateKey}`,
          data: { type: templateKey, url: '/ecom/billing' },
        };
        const pushResult = await sendPushNotificationToUser(String(workspace.owner._id), pushData);
        results.push = pushResult || { success: true };
      } catch (e) {
        results.push = { success: false, error: e.message };
      }
    }

    // Vérifier si au moins un canal a réussi
    const emailOk = results.email ? results.email.success : true;
    const pushOk = results.push ? results.push.success : true;
    const allSuccess = emailOk && pushOk;

    await logAudit(req, 'NOTIFY_WORKSPACE', `Manual ${templateKey}${hasCustomEmail ? ' custom-email' : ''} (${channel}) sent to ${owner.email} — ${allSuccess ? 'OK' : 'FAILED'}`, 'workspace', workspace._id);
    res.json({ success: allSuccess, results, email: owner.email, message: allSuccess ? undefined : (results.email?.error || results.push?.error || 'Échec envoi') });
  } catch (err) {
    console.error('[SuperAdmin] POST /notify-workspace error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /super-admin/deactivate-trial — Désactiver l'essai gratuit d'un workspace ────
router.post('/deactivate-trial', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { workspaceId } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'workspaceId requis' });
    }

    const workspace = await Workspace.findById(workspaceId).populate('owner', 'email name').lean();
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    // Vérifier si un trial existe
    if (!workspace.trialStartedAt && !workspace.trialEndsAt && !workspace.trialUsed) {
      return res.status(400).json({ success: false, message: 'Aucun essai gratuit trouvé sur ce compte' });
    }

    // Désactiver le trial
    await Workspace.updateOne(
      { _id: workspaceId },
      {
        $set: {
          trialStartedAt: null,
          trialEndsAt: null,
          trialUsed: false,
          trialExpiryNotifiedAt: null,
          trialExpiredNotifiedAt: null,
        }
      }
    );

    await logAudit(req, 'DEACTIVATE_TRIAL', `Trial désactivé pour ${workspace.owner?.email} (${workspace.name})`, 'workspace', workspace._id);
    res.json({ 
      success: true, 
      message: `Essai désactivé pour ${workspace.name}`,
      workspace: { id: workspace._id, name: workspace.name, owner: workspace.owner?.email }
    });
  } catch (err) {
    console.error('[SuperAdmin] POST /deactivate-trial error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/ecom/super-admin/feature-analytics
router.get('/feature-analytics',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { days = 30, workspaceId } = req.query;
      const since = new Date(Date.now() - Number(days) * 24 * 3600 * 1000);
      const matchBase = { createdAt: { $gte: since } };
      if (workspaceId) matchBase.workspaceId = new mongoose.Types.ObjectId(workspaceId);

      const [
        topFeatures,
        dailyActivity,
        perWorkspace,
        topUsers,
        recentGenerations
      ] = await Promise.all([
        // Top features by usage count
        FeatureUsageLog.aggregate([
          { $match: matchBase },
          { $group: { _id: '$feature', count: { $sum: 1 }, successCount: { $sum: { $cond: ['$meta.success', 1, 0] } } } },
          { $sort: { count: -1 } }
        ]),

        // Daily usage per feature (last N days)
        FeatureUsageLog.aggregate([
          { $match: matchBase },
          { $group: {
            _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, feature: '$feature' },
            count: { $sum: 1 }
          }},
          { $sort: { '_id.date': 1 } }
        ]),

        // Per workspace: which features they use most
        FeatureUsageLog.aggregate([
          { $match: matchBase },
          { $group: { _id: { workspaceId: '$workspaceId', feature: '$feature' }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 100 },
          { $lookup: { from: 'workspaces', localField: '_id.workspaceId', foreignField: '_id', as: 'ws' } },
          { $addFields: { workspaceName: { $arrayElemAt: ['$ws.name', 0] } } },
          { $project: { ws: 0 } }
        ]),

        // Top users by usage
        FeatureUsageLog.aggregate([
          { $match: matchBase },
          { $group: { _id: '$userId', count: { $sum: 1 }, features: { $addToSet: '$feature' } } },
          { $sort: { count: -1 } },
          { $limit: 20 },
          { $lookup: { from: 'ecomusers', localField: '_id', foreignField: '_id', as: 'user' } },
          { $addFields: { email: { $arrayElemAt: ['$user.email', 0] }, name: { $arrayElemAt: ['$user.name', 0] } } },
          { $project: { user: 0 } }
        ]),

        // Recent product page generations with details
        FeatureUsageLog.find({ ...matchBase, feature: 'product_page_generator' })
          .sort({ createdAt: -1 })
          .limit(50)
          .populate('workspaceId', 'name')
          .populate('userId', 'email name')
          .lean()
      ]);

      res.json({ success: true, topFeatures, dailyActivity, perWorkspace, topUsers, recentGenerations });
    } catch (err) {
      console.error('[SuperAdmin] feature-analytics error:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

export default router;
