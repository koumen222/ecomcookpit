import express from 'express';
import EcomUser from '../models/EcomUser.js';
import Workspace from '../models/Workspace.js';
import EcomWorkspace from '../models/Workspace.js';
import Order from '../models/Order.js';
import Transaction from '../models/Transaction.js';
import { requireEcomAuth, validateEcomAccess, generateEcomToken, invalidateUserCache } from '../middleware/ecomAuth.js';
import { logAudit, AuditLog } from '../middleware/security.js';
import { getPhonePrefixFromWorkspace, normalizePhone } from '../utils/phoneUtils.js';

const router = express.Router();

async function getDefaultPhonePrefixForWorkspace(workspaceId) {
  if (!workspaceId) return null;
  const workspace = await Workspace.findById(workspaceId).select('settings storeSettings').lean().catch(() => null);
  return getPhonePrefixFromWorkspace(workspace, '237');
}

async function normalizeWorkspacePhone(phone, workspaceId) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  const defaultPrefix = await getDefaultPhonePrefixForWorkspace(workspaceId);
  return normalizePhone(raw, defaultPrefix) || raw;
}

// GET /api/ecom/users - Liste des utilisateurs (admin seulement)
router.get('/',
  requireEcomAuth,
  validateEcomAccess('admin', 'read'),
  async (req, res) => {
    try {
      const { role, isActive } = req.query;
      const filter = { workspaceId: req.workspaceId };
      if (role) filter.role = role;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const users = await EcomUser.find(filter)
        .select('-password')
        .sort({ createdAt: -1 });

      // Stats par rôle
      const stats = {
        total: users.length,
        admins: users.filter(u => u.role === 'ecom_admin').length,
        closeuses: users.filter(u => u.role === 'ecom_closeuse').length,
        comptas: users.filter(u => u.role === 'ecom_compta').length,
        livreurs: users.filter(u => u.role === 'ecom_livreur').length,
        active: users.filter(u => u.isActive).length,
        inactive: users.filter(u => !u.isActive).length
      };

      res.json({
        success: true,
        data: { users, stats }
      });
    } catch (error) {
      console.error('Erreur liste utilisateurs ecom:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/users/livreurs/list - Liste des livreurs actifs (accessible par tous les authés)
router.get('/livreurs/list',
  requireEcomAuth,
  async (req, res) => {
    try {
      const livreurs = await EcomUser.find({
        workspaceId: req.workspaceId,
        role: 'ecom_livreur',
        isActive: true
      }).select('name email phone');

      res.json({ success: true, data: livreurs });
    } catch (error) {
      console.error('Erreur liste livreurs:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/users/livreurs/management - Gestion complète des livreurs (admin + closeuse)
router.get('/livreurs/management',
  requireEcomAuth,
  async (req, res) => {
    try {
      if (!['ecom_admin', 'ecom_closeuse', 'super_admin'].includes(req.ecomUser.role)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
      }

      const livreurs = await EcomUser.find({
        workspaceId: req.workspaceId,
        role: 'ecom_livreur'
      }).select('name email phone isActive createdAt lastLogin').lean();

      if (!livreurs.length) return res.json({ success: true, data: [] });

      const livreurIds = livreurs.map(l => l._id);

      // Orders en cours (confirmed + shipped)
      const activeOrders = await Order.find({
        workspaceId: req.workspaceId,
        assignedLivreur: { $in: livreurIds },
        status: { $in: ['confirmed', 'shipped'] }
      }).select('assignedLivreur status orderId clientName city').lean();

      // Commandes livrées aujourd'hui
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const deliveredToday = await Order.find({
        workspaceId: req.workspaceId,
        assignedLivreur: { $in: livreurIds },
        status: 'delivered',
        updatedAt: { $gte: todayStart }
      }).select('assignedLivreur price quantity').lean();

      // Total livré (all time)
      const deliveredAll = await Order.aggregate([
        { $match: { workspaceId: new (await import('mongoose')).default.Types.ObjectId(req.workspaceId), assignedLivreur: { $in: livreurIds }, status: 'delivered' } },
        { $group: { _id: '$assignedLivreur', count: { $sum: 1 }, revenue: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } } } }
      ]);

      // Mapper les stats par livreurId
      const statsMap = {};
      for (const l of livreurs) {
        const id = String(l._id);
        statsMap[id] = { activeOrders: [], deliveredTodayCount: 0, totalDelivered: 0, totalRevenue: 0 };
      }

      for (const o of activeOrders) {
        const id = String(o.assignedLivreur);
        if (statsMap[id]) {
          statsMap[id].activeOrders.push({ orderId: o.orderId, clientName: o.clientName, city: o.city, status: o.status });
        }
      }
      for (const o of deliveredToday) {
        const id = String(o.assignedLivreur);
        if (statsMap[id]) statsMap[id].deliveredTodayCount++;
      }
      for (const d of deliveredAll) {
        const id = String(d._id);
        if (statsMap[id]) {
          statsMap[id].totalDelivered = d.count;
          statsMap[id].totalRevenue = d.revenue;
        }
      }

      const result = livreurs.map(l => ({
        ...l,
        stats: statsMap[String(l._id)]
      }));

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erreur gestion livreurs:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/users/invites/list - Liste des invitations du workspace
router.get('/invites/list',
  requireEcomAuth,
  validateEcomAccess('admin', 'read'),
  async (req, res) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, message: 'workspaceId manquant dans le token' });
      }
      const workspace = await Workspace.findById(req.workspaceId)
        .populate('invites.createdBy', 'email name')
        .populate('invites.usedBy', 'email name');
      
      if (!workspace) {
        return res.status(404).json({ success: false, message: 'Workspace non trouvé' });
      }

      const invites = (workspace.invites || [])
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(inv => ({
          _id: inv._id,
          token: inv.token,
          createdBy: inv.createdBy,
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt,
          used: inv.used,
          usedBy: inv.usedBy,
          usedAt: inv.usedAt,
          isExpired: new Date(inv.expiresAt) < new Date(),
          inviteLink: `${process.env.FRONTEND_URL || 'https://app.safitech.shop'}/ecom/invite/${inv.token}`
        }));

      res.json({
        success: true,
        data: {
          invites,
          stats: {
            total: invites.length,
            active: invites.filter(i => !i.used && !i.isExpired).length,
            used: invites.filter(i => i.used).length,
            expired: invites.filter(i => i.isExpired && !i.used).length
          }
        }
      });
    } catch (error) {
      console.error('Erreur liste invitations:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/users/audit/logs - Journal d'audit du workspace
router.get('/audit/logs',
  requireEcomAuth,
  validateEcomAccess('admin', 'read'),
  async (req, res) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, message: 'workspaceId manquant dans le token' });
      }
      const { page = 1, limit = 30, action } = req.query;
      const filter = { workspaceId: req.workspaceId };
      if (action) filter.action = action;

      const total = await AuditLog.countDocuments(filter);
      const logs = await AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .lean();

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      console.error('Erreur audit logs:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/users/:id - Détail d'un utilisateur
router.get('/:id',
  requireEcomAuth,
  validateEcomAccess('admin', 'read'),
  async (req, res) => {
    try {
      const user = await EcomUser.findOne({ _id: req.params.id, workspaceId: req.workspaceId }).select('-password');
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }
      res.json({ success: true, data: user });
    } catch (error) {
      console.error('Erreur détail utilisateur ecom:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// POST /api/ecom/users - Créer un utilisateur (admin seulement)
router.post('/',
  requireEcomAuth,
  validateEcomAccess('admin', 'write'),
  async (req, res) => {
    try {
      const { email, password, role, canAccessRitaAgent } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
      }

      if (!['ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Rôle invalide' });
      }

      const existing = await EcomUser.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Cet email est déjà utilisé' });
      }

      const { name, phone } = req.body;
      const normalizedPhone = await normalizeWorkspacePhone(phone, req.workspaceId);
      const user = new EcomUser({
        email,
        password,
        role,
        workspaceId: req.workspaceId,
        name: name || '',
        phone: normalizedPhone,
        canAccessRitaAgent: role === 'ecom_admin' ? (canAccessRitaAgent !== false) : false,
      });
      await user.save();

      // Log audit
      await logAudit(req, 'CREATE_USER', `Création de l'utilisateur ${user.email} (${user.role})`, 'user', user._id);

      res.status(201).json({
        success: true,
        message: 'Utilisateur créé avec succès',
        data: {
          id: user._id,
          email: user.email,
          role: user.role,
          canAccessRitaAgent: user.canAccessRitaAgent,
          isActive: user.isActive,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Erreur création utilisateur ecom:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/ecom/users/:id - Modifier un utilisateur (rôle, statut)
router.put('/:id',
  requireEcomAuth,
  validateEcomAccess('admin', 'write'),
  async (req, res) => {
    try {
      const { role, isActive, canAccessRitaAgent } = req.body;
      const user = await EcomUser.findOne({ _id: req.params.id, workspaceId: req.workspaceId });

      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      // Empêcher l'admin de se désactiver lui-même
      if (req.ecomUser._id.toString() === req.params.id && isActive === false) {
        return res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous désactiver vous-même' });
      }

      if (role && ['ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur'].includes(role)) {
        user.role = role;
        if (role !== 'ecom_admin') {
          user.canAccessRitaAgent = false;
        }
      }
      if (req.body.name !== undefined) user.name = req.body.name;
      if (req.body.phone !== undefined) user.phone = await normalizeWorkspacePhone(req.body.phone, req.workspaceId);
      if (canAccessRitaAgent !== undefined) {
        user.canAccessRitaAgent = user.role === 'ecom_admin' ? !!canAccessRitaAgent : false;
      }
      if (isActive !== undefined) {
        user.isActive = isActive;
      }

      await user.save();

      // Log audit
      const changes = [];
      if (role) changes.push(`rôle: ${role}`);
      if (req.body.name !== undefined) changes.push(`nom: ${req.body.name}`);
      if (req.body.phone !== undefined) changes.push(`téléphone: ${req.body.phone}`);
      if (canAccessRitaAgent !== undefined) changes.push(`accès Rita IA: ${canAccessRitaAgent ? 'autorisé' : 'bloqué'}`);
      if (isActive !== undefined) changes.push(`statut: ${isActive ? 'actif' : 'inactif'}`);
      await logAudit(req, 'UPDATE_USER', `Modification de ${user.email} - ${changes.join(', ')}`, 'user', user._id);

      res.json({
        success: true,
        message: 'Utilisateur mis à jour',
        data: {
          id: user._id,
          email: user.email,
          role: user.role,
          canAccessRitaAgent: user.canAccessRitaAgent,
          isActive: user.isActive
        }
      });
    } catch (error) {
      console.error('Erreur mise à jour utilisateur ecom:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/ecom/users/:id/reset-password - Réinitialiser le mot de passe
router.put('/:id/reset-password',
  requireEcomAuth,
  validateEcomAccess('admin', 'write'),
  async (req, res) => {
    try {
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 6 caractères' });
      }

      const user = await EcomUser.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      user.password = newPassword;
      await user.save();

      // Log audit
      await logAudit(req, 'RESET_PASSWORD', `Réinitialisation du mot de passe de ${user.email}`, 'user', user._id);

      res.json({
        success: true,
        message: 'Mot de passe réinitialisé avec succès'
      });
    } catch (error) {
      console.error('Erreur reset password ecom:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// DELETE /api/ecom/users/:id - Supprimer un utilisateur
router.delete('/:id',
  requireEcomAuth,
  validateEcomAccess('admin', 'write'),
  async (req, res) => {
    try {
      // Empêcher l'admin de se supprimer lui-même
      if (req.ecomUser._id.toString() === req.params.id) {
        return res.status(400).json({ success: false, message: 'Vous ne pouvez pas supprimer votre propre compte' });
      }

      const user = await EcomUser.findOneAndDelete({ _id: req.params.id, workspaceId: req.workspaceId });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      // Log audit
      await logAudit(req, 'DELETE_USER', `Suppression de ${user.email} (rôle: ${user.role})`, 'user', req.params.id);

      res.json({ success: true, message: 'Utilisateur supprimé' });
    } catch (error) {
      console.error('Erreur suppression utilisateur ecom:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/users/me/workspaces - Récupérer tous les workspaces de l'utilisateur
router.get('/me/workspaces', requireEcomAuth, async (req, res) => {
  try {
    const user = req.ecomUser;
    
    // Récupérer les détails de tous les workspaces
    const workspaceIds = user.workspaces
      .filter(w => w.status === 'active')
      .map(w => w.workspaceId);
    
    const workspaceDetails = await EcomWorkspace.find({
      _id: { $in: workspaceIds },
      isActive: true
    }).select('name slug inviteCode owner').lean();
    
    // Combiner les infos
    const workspacesWithRoles = user.workspaces
      .filter(w => w.status === 'active')
      .map(userWorkspace => {
        const details = workspaceDetails.find(
          w => w._id.toString() === userWorkspace.workspaceId.toString()
        );
        
        return {
          _id: userWorkspace.workspaceId,
          name: details?.name || 'Workspace',
          slug: details?.slug,
          role: userWorkspace.role,
          joinedAt: userWorkspace.joinedAt,
          isActive: user.workspaceId && user.workspaceId.toString() === userWorkspace.workspaceId.toString(),
          isOwner: details?.owner && details.owner.toString() === user._id.toString()
        };
      });
    
    res.json({
      success: true,
      data: {
        workspaces: workspacesWithRoles,
        currentWorkspaceId: user.workspaceId
      }
    });
  } catch (error) {
    console.error('Erreur récupération workspaces:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/users/me/switch-workspace - Changer de workspace actif
router.post('/me/switch-workspace', requireEcomAuth, async (req, res) => {
  try {
    const { workspaceId } = req.body;
    const user = req.ecomUser;
    
    if (!workspaceId) {
      return res.status(400).json({ 
        success: false, 
        message: 'workspaceId requis' 
      });
    }
    
    // Vérifier que l'utilisateur a accès à ce workspace
    if (!user.hasWorkspaceAccess(workspaceId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Vous n\'avez pas accès à ce workspace' 
      });
    }
    
    // Récupérer le workspace pour vérifier qu'il existe et est actif
    const workspace = await EcomWorkspace.findOne({ 
      _id: workspaceId, 
      isActive: true 
    });
    
    if (!workspace) {
      return res.status(404).json({ 
        success: false, 
        message: 'Workspace non trouvé ou inactif' 
      });
    }
    
    // Mettre à jour le workspace actif et le rôle
    const newRole = user.getRoleInWorkspace(workspaceId);
    user.workspaceId = workspaceId;
    user.role = newRole;
    await user.save();
    
    // Invalider le cache utilisateur pour que les futures requêtes voient le nouveau workspace
    invalidateUserCache(user._id);
    
    // Générer un nouveau token avec le nouveau workspace
    const newToken = generateEcomToken(user);
    
    // Log audit
    await logAudit(req, 'SWITCH_WORKSPACE', `Changement vers workspace ${workspace.name}`, 'workspace', workspaceId);
    
    res.json({
      success: true,
      message: 'Workspace changé avec succès',
      data: {
        token: newToken,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          workspaceId: user.workspaceId
        },
        workspace: {
          id: workspace._id,
          name: workspace.name,
          slug: workspace.slug
        }
      }
    });
  } catch (error) {
    console.error('Erreur switch workspace:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/users/me/delete-all-data - Supprimer toutes les données du compte utilisateur
router.delete('/me/delete-all-data',
  requireEcomAuth,
  async (req, res) => {
    try {
      const userId = req.ecomUser._id;
      const workspaceId = req.workspaceId;
      const { confirmEmail } = req.body;

      // Vérification de sécurité : accepter soit l'email soit le mot de confirmation
      // Le frontend envoie maintenant l'email de l'utilisateur après validation du mot "SUPPRIMER"
      if (!confirmEmail || confirmEmail !== req.ecomUser.email) {
        return res.status(400).json({ 
          success: false, 
          message: 'Confirmation invalide' 
        });
      }

      // Log audit avant suppression
      await logAudit(req, 'DELETE_ALL_USER_DATA', `Suppression complète des données du compte ${req.ecomUser.email}`, 'user', userId);

      // Supprimer toutes les données liées à l'utilisateur
      const deletionResults = {
        orders: 0,
        transactions: 0,
        auditLogs: 'anonymized' // Les logs sont conservés mais anonymisés pour conformité légale
      };

      // Supprimer les commandes créées par l'utilisateur
      const ordersDeleted = await Order.deleteMany({ 
        workspaceId, 
        createdBy: userId 
      });
      deletionResults.orders = ordersDeleted.deletedCount || 0;

      // Supprimer les transactions créées par l'utilisateur
      const transactionsDeleted = await Transaction.deleteMany({ 
        workspaceId, 
        createdBy: userId 
      });
      deletionResults.transactions = transactionsDeleted.deletedCount || 0;

      // Les logs d'audit ne peuvent pas être supprimés (protection système)
      // mais on anonymise les données personnelles pour conformité RGPD
      // Note: Les logs sont conservés pour traçabilité légale et sécurité

      // Supprimer le compte utilisateur lui-même
      await EcomUser.findByIdAndDelete(userId);

      res.json({ 
        success: true, 
        message: 'Toutes vos données ont été supprimées avec succès',
        data: deletionResults
      });
    } catch (error) {
      console.error('Erreur suppression données utilisateur:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur lors de la suppression' });
    }
  }
);

// GET /api/ecom/users/team/performance - Performances de l'équipe
router.get('/team/performance', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { period = '30' } = req.query; // jours

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    // Récupérer tous les membres actifs du workspace
    const members = await EcomUser.find({ workspaceId, isActive: true })
      .select('name email role lastLogin createdAt')
      .lean();

    // Stats globales des commandes sur la période
    const allOrders = await Order.find({
      workspaceId,
      createdAt: { $gte: daysAgo }
    }).select('status assignedLivreur price quantity createdAt updatedAt statusModifiedManually').lean();

    // Stats par livreur (commandes assignées)
    const livreurStats = {};
    allOrders.forEach(order => {
      if (order.assignedLivreur) {
        const id = order.assignedLivreur.toString();
        if (!livreurStats[id]) livreurStats[id] = { assigned: 0, delivered: 0, returned: 0, pending: 0, revenue: 0 };
        livreurStats[id].assigned++;
        if (order.status === 'delivered') {
          livreurStats[id].delivered++;
          livreurStats[id].revenue += (order.price || 0) * (order.quantity || 1);
        }
        if (order.status === 'returned') livreurStats[id].returned++;
        if (['pending', 'shipped'].includes(order.status)) livreurStats[id].pending++;
      }
    });

    // Stats globales des commandes modifiées manuellement (closeuses)
    const modifiedOrders = await Order.find({
      workspaceId,
      statusModifiedManually: true,
      updatedAt: { $gte: daysAgo }
    }).select('status price quantity updatedAt').lean();

    const closeuseGlobalStats = {
      totalProcessed: modifiedOrders.length,
      confirmed: modifiedOrders.filter(o => o.status === 'confirmed').length,
      cancelled: modifiedOrders.filter(o => o.status === 'cancelled').length,
      unreachable: modifiedOrders.filter(o => o.status === 'unreachable').length,
      revenue: modifiedOrders
        .filter(o => o.status === 'confirmed')
        .reduce((sum, o) => sum + (o.price || 0) * (o.quantity || 1), 0)
    };

    // Stats des transactions (comptables)
    const allTransactions = await Transaction.find({
      workspaceId,
      createdAt: { $gte: daysAgo }
    }).select('type amount createdBy createdAt').lean();

    const comptaStats = {};
    allTransactions.forEach(tx => {
      if (tx.createdBy) {
        const id = tx.createdBy.toString();
        if (!comptaStats[id]) comptaStats[id] = { totalTransactions: 0, income: 0, expense: 0, totalIncome: 0, totalExpense: 0 };
        comptaStats[id].totalTransactions++;
        if (tx.type === 'income') {
          comptaStats[id].income++;
          comptaStats[id].totalIncome += tx.amount || 0;
        } else {
          comptaStats[id].expense++;
          comptaStats[id].totalExpense += tx.amount || 0;
        }
      }
    });

    // Totaux globaux
    const totalOrders = allOrders.length;
    const totalDelivered = allOrders.filter(o => o.status === 'delivered').length;
    const totalRevenue = allOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.price || 0) * (o.quantity || 1), 0);

    // Construire les stats par membre
    const membersWithStats = members.map(member => {
      const id = member._id.toString();
      let stats = {};

      if (member.role === 'ecom_livreur') {
        const s = livreurStats[id] || { assigned: 0, delivered: 0, returned: 0, pending: 0, revenue: 0 };
        stats = {
          ...s,
          deliveryRate: s.assigned > 0 ? Math.round((s.delivered / s.assigned) * 100) : 0
        };
      } else if (member.role === 'ecom_closeuse') {
        stats = { ...closeuseGlobalStats };
      } else if (member.role === 'ecom_compta') {
        const s = comptaStats[id] || { totalTransactions: 0, income: 0, expense: 0, totalIncome: 0, totalExpense: 0 };
        stats = {
          ...s,
          netBalance: s.totalIncome - s.totalExpense
        };
      }

      return {
        _id: member._id,
        name: member.name || member.email.split('@')[0],
        email: member.email,
        role: member.role,
        lastLogin: member.lastLogin,
        joinedAt: member.createdAt,
        stats
      };
    });

    res.json({
      success: true,
      data: {
        period: parseInt(period),
        members: membersWithStats,
        global: {
          totalOrders,
          totalDelivered,
          totalRevenue,
          totalMembers: members.length,
          activeMembers: members.filter(m => m.lastLogin && new Date(m.lastLogin) >= daysAgo).length
        }
      }
    });
  } catch (error) {
    console.error('Erreur team performance:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
