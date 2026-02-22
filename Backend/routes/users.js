import express from 'express';
import EcomUser from '../models/EcomUser.js';
import Workspace from '../models/Workspace.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import { logAudit, AuditLog } from '../middleware/security.js';

const router = express.Router();

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
      const { email, password, role } = req.body;

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
      const user = new EcomUser({ email, password, role, workspaceId: req.workspaceId, name: name || '', phone: phone || '' });
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
      const { role, isActive } = req.body;
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
      }
      if (req.body.name !== undefined) user.name = req.body.name;
      if (req.body.phone !== undefined) user.phone = req.body.phone;
      if (isActive !== undefined) {
        user.isActive = isActive;
      }

      await user.save();

      // Log audit
      const changes = [];
      if (role) changes.push(`rôle: ${role}`);
      if (req.body.name !== undefined) changes.push(`nom: ${req.body.name}`);
      if (req.body.phone !== undefined) changes.push(`téléphone: ${req.body.phone}`);
      if (isActive !== undefined) changes.push(`statut: ${isActive ? 'actif' : 'inactif'}`);
      await logAudit(req, 'UPDATE_USER', `Modification de ${user.email} - ${changes.join(', ')}`, 'user', user._id);

      res.json({
        success: true,
        message: 'Utilisateur mis à jour',
        data: {
          id: user._id,
          email: user.email,
          role: user.role,
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

export default router;
