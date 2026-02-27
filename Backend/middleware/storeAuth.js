import EcomWorkspace from '../models/Workspace.js';

/**
 * Store middleware — validates workspace access for storefront routes.
 * 
 * Two modes:
 * 1. resolveStoreBySubdomain — public routes: resolves workspace from subdomain param
 * 2. requireStoreOwner — dashboard routes: ensures authenticated user owns the workspace
 */

/**
 * Resolve workspace from subdomain for public store routes.
 * Sets req.store (workspace) and req.storeWorkspaceId for downstream use.
 * No authentication required — these are public-facing endpoints.
 */
export const resolveStoreBySubdomain = async (req, res, next) => {
  try {
    const { subdomain } = req.params;

    if (!subdomain) {
      return res.status(400).json({ success: false, message: 'Subdomain requis' });
    }

    const workspace = await EcomWorkspace.findOne({
      subdomain: subdomain.toLowerCase(),
      isActive: true,
      'storeSettings.isStoreEnabled': true
    }).lean();

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Boutique introuvable' });
    }

    req.store = workspace;
    req.storeWorkspaceId = workspace._id;
    next();
  } catch (error) {
    console.error('Erreur resolveStoreBySubdomain:', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/**
 * Ensure the authenticated user is the owner of the workspace (or admin).
 * Must be used AFTER requireEcomAuth middleware.
 * Validates that store management actions are workspace-scoped.
 */
export const requireStoreOwner = async (req, res, next) => {
  try {
    if (!req.workspaceId) {
      return res.status(403).json({
        success: false,
        message: 'Aucun workspace associé'
      });
    }

    const workspace = await EcomWorkspace.findById(req.workspaceId).lean();
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace introuvable'
      });
    }

    // Allow workspace owner or super_admin
    const isOwner = workspace.owner.toString() === req.user.id;
    const isSuperAdmin = req.ecomUser?.role === 'super_admin';
    const isAdmin = req.ecomUserRole === 'ecom_admin';

    if (!isOwner && !isSuperAdmin && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Permission insuffisante pour gérer cette boutique'
      });
    }

    req.store = workspace;
    next();
  } catch (error) {
    console.error('Erreur requireStoreOwner:', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
