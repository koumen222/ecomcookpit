import express from 'express';
import crypto from 'crypto';
import EcomUser from '../models/EcomUser.js';
import EcomWorkspace from '../models/Workspace.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import { generateEcomToken } from '../middleware/ecomAuth.js';
import { notifyTeamInvitation, notifyRoleChanged, notifyMemberRemoved } from '../core/notifications/notification.service.js';

const router = express.Router();

// Générer un token d'invitation
router.post('/invite', requireEcomAuth, async (req, res) => {
  try {
    const { email, role, workspaceId } = req.body;
    
    if (!email || !role || !workspaceId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, rôle et workspace requis' 
      });
    }

    // Vérifier que l'utilisateur a le droit d'inviter dans ce workspace
    const userRole = req.ecomUser.getRoleInWorkspace(workspaceId);
    if (!userRole || !['ecom_admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Permission insuffisante pour inviter' 
      });
    }

    // Vérifier que le workspace existe
    const workspace = await EcomWorkspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ 
        success: false, 
        message: 'Workspace non trouvé' 
      });
    }

    // Générer un token d'invitation unique
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

    // Vérifier si l'utilisateur existe déjà
    let targetUser = await EcomUser.findOne({ email: email.toLowerCase() });
    
    if (targetUser) {
      // Vérifier si l'utilisateur est déjà dans ce workspace
      if (targetUser.hasWorkspaceAccess(workspaceId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cet utilisateur est déjà membre de ce workspace' 
        });
      }

      // Ajouter le workspace à l'utilisateur existant
      const added = targetUser.addWorkspace(workspaceId, role, req.ecomUser._id);
      if (!added) {
        return res.status(400).json({ 
          success: false, 
          message: 'Erreur lors de l\'ajout du workspace' 
        });
      }

      // Mettre à jour le workspace actif et le rôle pour basculer vers le nouveau workspace
      targetUser.workspaceId = workspaceId;
      targetUser.role = role;

      await targetUser.save();
    } else {
      // Créer un utilisateur temporaire avec le workspace
      targetUser = new EcomUser({
        email: email.toLowerCase(),
        password: crypto.randomBytes(32).toString('hex'), // Mot de passe temporaire
        role: role,
        workspaceId: workspaceId,
        workspaces: [{
          workspaceId,
          role,
          invitedBy: req.ecomUser._id,
          joinedAt: new Date(),
          status: 'pending' // En attente de première connexion
        }]
      });

      await targetUser.save();
    }

    // Envoyer l'email d'invitation via le système centralisé
    const invitationLink = `${process.env.FRONTEND_URL}/ecom/invite/${invitationToken}`;
    notifyTeamInvitation(email, {
      inviterName: req.ecomUser.name || req.ecomUser.email,
      workspace,
      role,
      inviteUrl: invitationLink
    }).catch(err => console.warn('[notif] team_invitation:', err.message));

    res.json({
      success: true,
      message: 'Invitation envoyée avec succès',
      data: {
        email,
        role,
        workspaceId,
        invitationToken,
        invitationExpires
      }
    });

  } catch (error) {
    console.error('Erreur invitation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
});

// Accepter une invitation
router.post('/accept/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nom et mot de passe requis' 
      });
    }

    // Trouver l'utilisateur avec ce token d'invitation
    const user = await EcomUser.findOne({ 
      email: { $regex: new RegExp(`^${token}$`, 'i') } // Recherche flexible
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invitation non trouvée' 
      });
    }

    // Mettre à jour les informations de l'utilisateur
    user.name = name;
    user.password = password;
    user.isActive = true;

    // Activer tous les workspaces en attente
    user.workspaces.forEach(workspace => {
      if (workspace.status === 'pending') {
        workspace.status = 'active';
      }
    });

    // Définir le workspace principal si non défini
    if (!user.workspaceId && user.workspaces.length > 0) {
      user.workspaceId = user.workspaces[0].workspaceId;
    }

    await user.save();

    // Générer le token JWT
    const tokenJwt = generateEcomToken(user._id, user.email, user.role, user.workspaceId);

    res.json({
      success: true,
      message: 'Invitation acceptée avec succès',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          workspaceId: user.workspaceId,
          workspaces: user.getActiveWorkspaces()
        },
        token: tokenJwt
      }
    });

  } catch (error) {
    console.error('Erreur acceptation invitation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
});

// Lister les workspaces d'un utilisateur
router.get('/workspaces', requireEcomAuth, async (req, res) => {
  try {
    const user = await EcomUser.findById(req.ecomUser._id)
      .populate('workspaces.workspaceId', 'name description createdAt')
      .populate('workspaces.invitedBy', 'name email');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    const activeWorkspaces = user.getActiveWorkspaces().map(w => ({
      _id: w.workspaceId._id,
      name: w.workspaceId.name,
      description: w.workspaceId.description,
      role: w.role,
      joinedAt: w.joinedAt,
      invitedBy: w.invitedBy,
      createdAt: w.workspaceId.createdAt,
      isPrimary: user.workspaceId && user.workspaceId.toString() === w.workspaceId._id.toString()
    }));

    res.json({
      success: true,
      data: {
        workspaces: activeWorkspaces,
        currentWorkspace: user.workspaceId
      }
    });

  } catch (error) {
    console.error('Erreur liste workspaces:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
});

// Changer de workspace courant
router.put('/switch-workspace/:workspaceId', requireEcomAuth, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Vérifier que l'utilisateur a accès à ce workspace
    if (!req.ecomUser.hasWorkspaceAccess(workspaceId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Accès non autorisé à ce workspace' 
      });
    }

    // Obtenir le rôle dans ce workspace
    const role = req.ecomUser.getRoleInWorkspace(workspaceId);
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Rôle introuvable pour ce workspace'
      });
    }

    // Mettre à jour le workspace principal + rôle courant
    req.ecomUser.workspaceId = workspaceId;
    req.ecomUser.role = role;
    await req.ecomUser.save();

    // Générer un nouveau token avec le nouveau workspace
    const token = generateEcomToken(req.ecomUser);

    const populatedUser = await EcomUser.findById(req.ecomUser._id)
      .select('-password')
      .populate('workspaceId', 'name slug');

    const activeWorkspaces = await EcomUser.findById(req.ecomUser._id)
      .populate('workspaces.workspaceId', 'name description createdAt')
      .then((u) => (u ? u.getActiveWorkspaces().map((w) => ({
        _id: w.workspaceId._id,
        name: w.workspaceId.name,
        description: w.workspaceId.description,
        role: w.role,
        joinedAt: w.joinedAt,
        invitedBy: w.invitedBy,
        createdAt: w.workspaceId.createdAt,
        isPrimary: u.workspaceId && u.workspaceId.toString() === w.workspaceId._id.toString()
      })) : []));

    res.json({
      success: true,
      message: 'Workspace changé avec succès',
      data: {
        workspaceId,
        role,
        token,
        user: populatedUser,
        workspaces: activeWorkspaces,
        workspace: populatedUser?.workspaceId || null
      }
    });

  } catch (error) {
    console.error('Erreur changement workspace:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
});

// Quitter un workspace
router.delete('/leave-workspace/:workspaceId', requireEcomAuth, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Vérifier que l'utilisateur a accès à ce workspace
    if (!req.ecomUser.hasWorkspaceAccess(workspaceId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Accès non autorisé à ce workspace' 
      });
    }

    // Empêcher de quitter si c'est le seul workspace
    const activeWorkspaces = req.ecomUser.getActiveWorkspaces();
    if (activeWorkspaces.length <= 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vous ne pouvez pas quitter votre seul workspace' 
      });
    }

    // Quitter le workspace
    req.ecomUser.leaveWorkspace(workspaceId);
    await req.ecomUser.save();

    res.json({
      success: true,
      message: 'Workspace quitté avec succès'
    });

  } catch (error) {
    console.error('Erreur quitter workspace:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
});

// GET /workspaces/whatsapp-config - Récupérer la config WhatsApp du workspace
router.get('/whatsapp-config', requireEcomAuth, async (req, res) => {
  try {
    const workspace = await EcomWorkspace.findById(req.ecomUser.workspaceId).select('whatsappConfig name').lean();
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace non trouvé' });
    res.json({ success: true, data: { whatsappConfig: workspace.whatsappConfig || { status: 'none', phoneNumber: '' } } });
  } catch (error) {
    console.error('Erreur récupération config WhatsApp:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /workspaces/whatsapp-request - Demande d'activation de numéro WhatsApp
router.post('/whatsapp-request', requireEcomAuth, async (req, res) => {
  try {
    const { 
      phoneNumber, 
      businessName, 
      contactName, 
      email, 
      currentWhatsappNumber,
      businessType,
      monthlyMessages,
      reason 
    } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Numéro de téléphone requis'
      });
    }

    // Nettoyer le numéro (garder seulement les chiffres)
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    // Utiliser workspaceId du body ou du token
    const wsId = req.body.workspaceId || req.ecomUser.workspaceId;
    console.log(`📱 [WhatsApp] workspaceId utilisé: ${wsId} (body: ${req.body.workspaceId}, token: ${req.ecomUser.workspaceId})`);

    if (!wsId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace non trouvé - veuillez vous reconnecter'
      });
    }

    // Mettre à jour la configuration WhatsApp du workspace
    const workspace = await EcomWorkspace.findById(wsId);
    console.log(`📱 [WhatsApp] Workspace trouvé: ${workspace ? workspace.name : 'NULL'}`);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace non trouvé'
      });
    }

    // Initialiser settings si inexistant
    if (!workspace.settings) {
      workspace.settings = {};
    }

    // Mettre à jour la configuration WhatsApp avec toutes les informations de postulation
    workspace.settings.whatsappConfig = {
      phoneNumber: cleanPhone,
      status: 'pending',
      requestedAt: new Date(),
      requestedBy: req.ecomUser._id,
      note: 'Demande d\'activation en cours',
      // Informations de postulation détaillées
      businessName: businessName || '',
      contactName: contactName || '',
      email: email || '',
      currentWhatsappNumber: currentWhatsappNumber || '',
      businessType: businessType || '',
      monthlyMessages: monthlyMessages || '',
      reason: reason || ''
    };

    workspace.markModified('settings');
    await workspace.save();

    console.log(`📱 Postulation WhatsApp: ${cleanPhone} (${businessName}) par ${contactName}`);

    res.json({
      success: true,
      message: '🎉 Votre postulation a été envoyée avec succès ! Notre équipe vous contactera dans les plus brefs délais.',
      data: {
        phoneNumber: cleanPhone,
        status: 'pending',
        businessName
      }
    });

  } catch (error) {
    console.error('Erreur postulation WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi de la postulation'
    });
  }
});

export default router;
