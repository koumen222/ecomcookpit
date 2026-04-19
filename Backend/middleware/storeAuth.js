import EcomWorkspace from '../models/Workspace.js';
import Store from '../models/Store.js';

/**
 * Store middleware — validates workspace access for storefront routes.
 * 
 * Two modes:
 * 1. resolveStoreBySubdomain — public routes: resolves workspace from subdomain param
 * 2. requireStoreOwner — dashboard routes: ensures authenticated user owns the workspace
 */

/**
 * Resolve store/workspace from subdomain for public store routes.
 * Checks Store collection first (multi-store), then falls back to Workspace (legacy).
 * Sets req.store, req.storeWorkspaceId, and req.storeId for downstream use.
 * No authentication required — these are public-facing endpoints.
 */
export const resolveStoreBySubdomain = async (req, res, next) => {
  try {
    const { subdomain } = req.params;

    if (!subdomain) {
      return res.status(400).json({ success: false, message: 'Subdomain requis' });
    }

    const clean = subdomain.toLowerCase().trim();

    // 1. Try Store model first (multi-store)
    const store = await Store.findOne({
      subdomain: clean,
      isActive: true,
      'storeSettings.isStoreEnabled': true
    }).lean();

    if (store) {
      req.store = { ...store, _id: store.workspaceId };
      req.storeWorkspaceId = store.workspaceId;
      req.storeId = store._id;
      return next();
    }

    // 2. Fallback: legacy Workspace (pre-migration)
    const workspace = await EcomWorkspace.findOne({
      subdomain: clean,
      isActive: true,
      'storeSettings.isStoreEnabled': true
    }).lean();

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Boutique introuvable' });
    }

    req.store = workspace;
    req.storeWorkspaceId = workspace._id;
    req.storeId = null; // legacy single-store
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
