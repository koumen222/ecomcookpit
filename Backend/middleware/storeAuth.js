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
 *
 * Sets on req:
 *   req.store            — the raw Store or Workspace document
 *   req.storeWorkspaceId — always the parent workspace ObjectId
 *   req.storeId          — the Store._id (null for legacy workspace-only stores)
 *   req.workspaceId      — alias for storeWorkspaceId (for downstream compat)
 *   req.requestHost      — original clean hostname (may already be set by extractSubdomain)
 *
 * No authentication required — these are public-facing endpoints.
 */
export const resolveStoreBySubdomain = async (req, res, next) => {
  try {
    // Prefer req.params.subdomain (URL param), fall back to req.subdomain (set by extractSubdomain middleware)
    const rawSubdomain = req.params.subdomain || req.subdomain;

    if (!rawSubdomain) {
      return res.status(400).json({ success: false, message: 'Subdomain requis' });
    }

    const clean = rawSubdomain.toLowerCase().trim();

    // 1. Try Store model first (multi-store)
    const store = await Store.findOne({
      subdomain: clean,
      isActive: true,
      'storeSettings.isStoreEnabled': true
    }).lean();

    if (store) {
      // IMPORTANT: keep store._id as the real Store ObjectId, not the workspaceId.
      // Previous bug: req.store._id was being set to store.workspaceId, causing
      // downstream queries to scope by the wrong ID.
      req.store = store;
      req.storeId = store._id;
      req.storeWorkspaceId = store.workspaceId;
      req.workspaceId = store.workspaceId; // compat alias
      return next();
    }

    // 2. Fallback: also check by custom domain (req.requestHost set by extractSubdomain)
    const requestHost = req.requestHost;
    if (requestHost && requestHost !== `${clean}.scalor.net`) {
      const storeByDomain = await Store.findOne({
        'storeDomains.customDomain': requestHost,
        isActive: true,
        'storeSettings.isStoreEnabled': true
      }).lean();

      if (storeByDomain) {
        req.store = storeByDomain;
        req.storeId = storeByDomain._id;
        req.storeWorkspaceId = storeByDomain.workspaceId;
        req.workspaceId = storeByDomain.workspaceId;
        return next();
      }
    }

    // 3. Fallback: legacy Workspace (pre-migration or single-store setup)
    const workspaceQuery = { subdomain: clean, isActive: true, 'storeSettings.isStoreEnabled': true };
    let workspace = await EcomWorkspace.findOne(workspaceQuery).lean();

    // Also try by custom domain for legacy workspaces
    if (!workspace && requestHost && requestHost !== `${clean}.scalor.net`) {
      workspace = await EcomWorkspace.findOne({
        'storeDomains.customDomain': requestHost,
        isActive: true,
        'storeSettings.isStoreEnabled': true
      }).lean();
    }

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Boutique introuvable' });
    }

    req.store = workspace;
    req.storeWorkspaceId = workspace._id;
    req.workspaceId = workspace._id; // compat alias
    req.storeId = null; // legacy single-store — no dedicated Store document
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
