import express from 'express';
import crypto from 'crypto';
import Provider from '../models/Provider.js';
import EcomWorkspace from '../models/Workspace.js';
import EcomUser from '../models/EcomUser.js';
import { requireProviderAuth } from '../middleware/providerAuth.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = express.Router();

// ============ AUTHENTIFICATION PROVIDER ============

/**
 * @route   POST /api/provider/from-ecom
 * @desc    Auto-login provider via ecom session (no manual provider login)
 * @access  Private (Ecom Auth)
 */
router.post('/from-ecom', requireEcomAuth, async (req, res) => {
  try {
    const ecomUser = req.ecomUser;
    const email = (ecomUser?.email || '').toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email utilisateur manquant' });
    }

    let provider = await Provider.findOne({ email });

    if (!provider) {
      const workspace = req.workspaceId
        ? await EcomWorkspace.findById(req.workspaceId).select('name')
        : null;

      const newProvider = new Provider({
        email,
        password: `${crypto.randomBytes(16).toString('hex')}${crypto.randomBytes(16).toString('hex')}`,
        company: workspace?.name || ecomUser?.name || 'Scalor Workspace',
        name: ecomUser?.name || email,
        phone: ecomUser?.phone || '',
        status: 'active',
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null
      });

      // Create first API token for this provider
      newProvider.generateNewApiToken();
      try {
        provider = await newProvider.save();
      } catch (saveError) {
        // Concurrent requests can race on unique email. Recover by loading existing provider.
        if (saveError?.code === 11000) {
          provider = await Provider.findOne({ email });
        } else {
          throw saveError;
        }
      }
    }

    if (!provider) {
      return res.status(500).json({ success: false, message: 'Provider auto-login failed' });
    }

    // Keep suspended accounts blocked, auto-activate other states
    if (provider.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Provider account suspended' });
    }
    if (provider.status !== 'active') {
      provider.status = 'active';
      provider.isEmailVerified = true;
    }

    if (!provider.apiToken) {
      provider.generateNewApiToken();
    }

    provider.lastLogin = new Date();
    await provider.save();

    res.json({
      success: true,
      message: 'Provider session initialized',
      data: {
        provider: {
          id: provider._id,
          email: provider.email,
          company: provider.company,
          name: provider.name,
          status: provider.status,
          stats: provider.stats,
          limits: {
            instanceLimit: provider.instanceLimit,
            activeInstances: provider.activeInstances
          }
        },
        token: provider.apiToken,
        tokenType: 'Bearer'
      }
    });
  } catch (error) {
    console.error('Provider from-ecom error:', error);
    res.status(500).json({ success: false, message: 'Provider auto-login failed', error: error.message });
  }
});

/**
 * @route   POST /api/provider/register
 * @desc    Enregistrer un nouveau provider
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, company, name, phone } = req.body;

    if (!email || !password || !company || !name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: email, password, company, name' 
      });
    }

    // Vérifier si le provider existe déjà
    let provider = await Provider.findOne({ email: email.toLowerCase() });
    if (provider) {
      return res.status(400).json({ 
        success: false, 
        message: 'This email is already registered' 
      });
    }

    // Créer le nouveau provider
    provider = new Provider({
      email: email.toLowerCase(),
      password,
      company,
      name,
      phone: phone || '',
      status: 'pending',
      emailVerificationToken: crypto.randomBytes(32).toString('hex'),
      emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
    });

    await provider.save();

    // Générer le token API permanent
    const apiToken = provider.generateNewApiToken();
    await provider.save();

    // TODO: Envoyer un email de vérification
    console.log(`Verification token for ${email}: ${provider.emailVerificationToken}`);

    res.status(201).json({
      success: true,
      message: 'Provider registered successfully. Please verify your email.',
      provider: {
        id: provider._id,
        email: provider.email,
        company: provider.company,
        status: provider.status,
        apiToken: apiToken
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed', error: error.message });
  }
});

/**
 * @route   POST /api/provider/login
 * @desc    Login provider et recevoir le Bearer token
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password required' 
      });
    }

    // Trouver le provider
    const provider = await Provider.findOne({ email: email.toLowerCase() });
    if (!provider) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Vérifier le password
    const isMatch = await provider.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Vérifier que le provider est actif
    if (provider.status !== 'active' && provider.status !== 'verified') {
      return res.status(403).json({ 
        success: false, 
        message: `Provider account is ${provider.status}. Please contact support.` 
      });
    }

    // Mettre à jour lastLogin
    provider.lastLogin = new Date();
    await provider.save();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        provider: {
          id: provider._id,
          email: provider.email,
          company: provider.company,
          name: provider.name,
          status: provider.status,
          stats: provider.stats
        },
        token: provider.apiToken,
        tokenType: 'Bearer'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed', error: error.message });
  }
});

/**
 * @route   POST /api/provider/verify-email/:token
 * @desc    Vérifier l'email du provider
 * @access  Public
 */
router.post('/verify-email/:token', async (req, res) => {
  try {
    const provider = await Provider.findOne({
      emailVerificationToken: req.params.token,
      emailVerificationExpiresAt: { $gt: Date.now() }
    });

    if (!provider) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired verification token' 
      });
    }

    provider.isEmailVerified = true;
    provider.emailVerificationToken = null;
    provider.emailVerificationExpiresAt = null;
    provider.status = 'active';
    await provider.save();

    res.json({
      success: true,
      message: 'Email verified successfully. Your account is now active.'
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Verification failed', error: error.message });
  }
});

/**
 * @route   POST /api/provider/refresh-token
 * @desc    Générer un nouveau Bearer token
 * @access  Private (Provider Auth)
 */
router.post('/refresh-token', requireProviderAuth, async (req, res) => {
  try {
    const provider = await Provider.findById(req.providerId);

    if (!provider) {
      return res.status(404).json({ 
        success: false, 
        message: 'Provider not found' 
      });
    }

    const newToken = provider.generateNewApiToken();
    await provider.save();

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
        expiresAt: provider.tokenExpiresAt
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Token refresh failed', error: error.message });
  }
});

// ============ GESTION DES INSTANCES ============

/**
 * @route   POST /api/provider/instances
 * @desc    Créer une nouvelle instance (workspace)
 * @access  Private (Provider Auth)
 */
router.post('/instances', requireProviderAuth, async (req, res) => {
  try {
    const { name, subdomain, settings } = req.body;

    if (!name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Instance name is required' 
      });
    }

    // Vérifier le quota
    const provider = await Provider.findById(req.providerId);
    if (provider.activeInstances >= provider.instanceLimit) {
      return res.status(403).json({
        success: false,
        message: `You have reached your instance limit (${provider.instanceLimit}). Please upgrade your plan.`
      });
    }

    // Vérifier que le subdomain n'existe pas
    if (subdomain) {
      const existing = await EcomWorkspace.findOne({ subdomain });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'This subdomain is already taken'
        });
      }
    }

    // Créer un utilisateur admin pour cette instance
    const adminEmail = `admin-${Date.now()}@provider-${provider._id}.local`;
    let adminUser = await EcomUser.findOne({ email: adminEmail });

    if (!adminUser) {
      adminUser = new EcomUser({
        email: adminEmail,
        name: `Admin - ${name}`,
        password: crypto.randomBytes(32).toString('hex'),
        role: 'super_admin',
        isActive: true
      });
      await adminUser.save();
    }

    // Créer la workspace
    const workspace = new EcomWorkspace({
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      subdomain: subdomain || undefined,
      owner: adminUser._id,
      settings: settings || {
        currency: 'XAF',
        businessType: 'ecommerce',
        providerManaged: true
      }
    });

    await workspace.save();

    // Ajouter à el provider
    provider.addInstance(workspace._id);
    await provider.save();

    res.status(201).json({
      success: true,
      message: 'Instance created successfully',
      instance: {
        id: workspace._id,
        name: workspace.name,
        slug: workspace.slug,
        subdomain: workspace.subdomain,
        createdAt: workspace.createdAt,
        accessUrl: workspace.subdomain ? `https://${workspace.subdomain}.scalor.net` : null
      }
    });

  } catch (error) {
    console.error('Create instance error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create instance', 
      error: error.message 
    });
  }
});

/**
 * @route   GET /api/provider/instances
 * @desc    Lister toutes les instances du provider
 * @access  Private (Provider Auth)
 */
router.get('/instances', requireProviderAuth, async (req, res) => {
  try {
    const provider = await Provider.findById(req.providerId).populate({
      path: 'instances.workspaceId',
      select: 'name slug subdomain createdAt status'
    });

    if (!provider) {
      return res.status(404).json({ 
        success: false, 
        message: 'Provider not found' 
      });
    }

    res.json({
      success: true,
      data: {
        stats: provider.stats,
        instances: provider.instances.map(inst => ({
          id: inst.workspaceId._id,
          name: inst.workspaceId.name,
          slug: inst.workspaceId.slug,
          subdomain: inst.workspaceId.subdomain,
          status: inst.status,
          createdAt: inst.createdAt,
          accessUrl: inst.workspaceId.subdomain ? 
            `https://${inst.workspaceId.subdomain}.scalor.net` : null
        }))
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch instances', 
      error: error.message 
    });
  }
});

/**
 * @route   GET /api/provider/instances/:instanceId
 * @desc    Obtenir les détails d'une instance
 * @access  Private (Provider Auth)
 */
router.get('/instances/:instanceId', requireProviderAuth, async (req, res) => {
  try {
    const provider = await Provider.findById(req.providerId);

    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    // Vérifier que cette instance appartient au provider
    const instanceOwnership = provider.instances.find(
      inst => inst.workspaceId.toString() === req.params.instanceId
    );

    if (!instanceOwnership) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have access to this instance' 
      });
    }

    const workspace = await EcomWorkspace.findById(req.params.instanceId);

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Instance not found' });
    }

    res.json({
      success: true,
      data: {
        id: workspace._id,
        name: workspace.name,
        slug: workspace.slug,
        subdomain: workspace.subdomain,
        status: workspace.status || 'active',
        createdAt: workspace.createdAt,
        settings: workspace.settings,
        storeSettings: workspace.storeSettings,
        accessUrl: workspace.subdomain ? 
          `https://${workspace.subdomain}.scalor.net` : null
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch instance', 
      error: error.message 
    });
  }
});

/**
 * @route   PUT /api/provider/instances/:instanceId
 * @desc    Mettre à jour une instance
 * @access  Private (Provider Auth)
 */
router.put('/instances/:instanceId', requireProviderAuth, async (req, res) => {
  try {
    const provider = await Provider.findById(req.providerId);

    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    // Vérifier que cette instance appartient au provider
    const instanceOwnership = provider.instances.find(
      inst => inst.workspaceId.toString() === req.params.instanceId
    );

    if (!instanceOwnership) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have access to this instance' 
      });
    }

    const { name, settings, storeSettings } = req.body;
    const workspace = await EcomWorkspace.findById(req.params.instanceId);

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Instance not found' });
    }

    if (name) workspace.name = name;
    if (settings) workspace.settings = { ...workspace.settings, ...settings };
    if (storeSettings) workspace.storeSettings = { ...workspace.storeSettings, ...storeSettings };

    await workspace.save();

    res.json({
      success: true,
      message: 'Instance updated successfully',
      data: {
        id: workspace._id,
        name: workspace.name,
        settings: workspace.settings,
        storeSettings: workspace.storeSettings
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update instance', 
      error: error.message 
    });
  }
});

/**
 * @route   DELETE /api/provider/instances/:instanceId
 * @desc    Supprimer une instance
 * @access  Private (Provider Auth)
 */
router.delete('/instances/:instanceId', requireProviderAuth, async (req, res) => {
  try {
    const provider = await Provider.findById(req.providerId);

    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    // Vérifier que cette instance appartient au provider
    const instanceOwnership = provider.instances.find(
      inst => inst.workspaceId.toString() === req.params.instanceId
    );

    if (!instanceOwnership) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have access to this instance' 
      });
    }

    // Soft delete - marquer comme supprimée
    instanceOwnership.status = 'deleted';
    provider.removeInstance(req.params.instanceId);
    await provider.save();

    // Optionnel: soft delete du workspace aussi
    await EcomWorkspace.findByIdAndUpdate(req.params.instanceId, { $set: { status: 'deleted' } });

    res.json({
      success: true,
      message: 'Instance deleted successfully'
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete instance', 
      error: error.message 
    });
  }
});

// ============ INFOS PROVIDER ============

/**
 * @route   GET /api/provider/me
 * @desc    Obtenir mes infos de provider
 * @access  Private (Provider Auth)
 */
router.get('/me', requireProviderAuth, async (req, res) => {
  try {
    const provider = await Provider.findById(req.providerId).populate({
      path: 'instances.workspaceId',
      select: 'name slug subdomain'
    });

    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    res.json({
      success: true,
      data: {
        id: provider._id,
        email: provider.email,
        company: provider.company,
        name: provider.name,
        phone: provider.phone,
        status: provider.status,
        permissions: provider.permissions,
        stats: provider.stats,
        limits: {
          instanceLimit: provider.instanceLimit,
          activeInstances: provider.activeInstances
        },
        tokenInfo: {
          expiresAt: provider.tokenExpiresAt,
          refreshCount: provider.tokenRefreshCount,
          lastRefresh: provider.lastTokenRefresh
        },
        createdAt: provider.createdAt
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch provider info', 
      error: error.message 
    });
  }
});

export default router;
