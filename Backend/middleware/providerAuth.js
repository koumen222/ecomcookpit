import Provider from '../models/Provider.js';

/**
 * Middleware d'authentification Provider
 * Vérifie le Bearer token du provider
 * 
 * Usage: Authorization: Bearer prov_xxxxx
 */
export const requireProviderAuth = async (req, res, next) => {
  try {
    // Récupérer le token du header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No or invalid Authorization header. Use: Bearer <token>'
      });
    }

    const token = authHeader.slice(7); // Enlever "Bearer "

    // Chercher le provider avec ce token
    const provider = await Provider.findOne({ 
      apiToken: token,
      tokenExpiresAt: { $gt: Date.now() },
      status: 'active'
    });

    if (!provider) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Vérifier que le token n'a pas expiré
    if (provider.tokenExpiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please refresh your token.'
      });
    }

    // Attacher le provider ID au request
    req.providerId = provider._id;
    req.provider = provider;

    next();

  } catch (error) {
    console.error('Provider auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};

/**
 * Middleware pour vérifier les permissions du provider
 */
export const requireProviderPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.providerId) {
        return res.status(401).json({
          success: false,
          message: 'Provider not authenticated'
        });
      }

      const provider = await Provider.findById(req.providerId);

      if (!provider || !provider.permissions.includes(requiredPermission)) {
        return res.status(403).json({
          success: false,
          message: `Provider does not have required permission: ${requiredPermission}`
        });
      }

      next();

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Permission check failed',
        error: error.message
      });
    }
  };
};

/**
 * Middleware pour logger les actions du provider
 */
export const logProviderAction = (action) => {
  return async (req, res, next) => {
    // Peut être utilisé pour auditer les actions des providers
    if (req.providerId) {
      console.log(`[PROVIDER ACTION] ${action} - Provider: ${req.providerId} at ${new Date().toISOString()}`);
    }
    next();
  };
};

/**
 * Middleware pour vérifier l'accès à une instance spécifique
 */
export const requireInstanceAccess = async (req, res, next) => {
  try {
    const { instanceId } = req.params;

    if (!req.providerId) {
      return res.status(401).json({
        success: false,
        message: 'Provider not authenticated'
      });
    }

    const provider = await Provider.findById(req.providerId);

    // Vérifier que cette instance appartient au provider
    const hasAccess = provider.instances.some(
      inst => inst.workspaceId.toString() === instanceId && inst.status !== 'deleted'
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this instance'
      });
    }

    next();

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Instance access verification failed',
      error: error.message
    });
  }
};
