/**
 * Workspace Resolver Middleware
 * 
 * Resolves workspace from subdomain and attaches to request.
 * Implements caching for performance at scale.
 * 
 * Architecture decisions:
 * - Uses in-memory cache (LRU) to avoid DB hits on every request
 * - Cache TTL: 5 minutes (balance between freshness and performance)
 * - Lean queries for minimal memory footprint
 * - Proper error handling with 404 for missing workspaces
 */

import Workspace from '../models/Workspace.js';

// Simple in-memory cache with TTL
class WorkspaceCache {
  constructor(ttlMs = 5 * 60 * 1000) { // 5 minutes default
    this.cache = new Map();
    this.ttl = ttlMs;
  }

  set(subdomain, workspace) {
    this.cache.set(subdomain, {
      data: workspace,
      expires: Date.now() + this.ttl
    });
  }

  get(subdomain) {
    const entry = this.cache.get(subdomain);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(subdomain);
      return null;
    }
    
    return entry.data;
  }

  invalidate(subdomain) {
    this.cache.delete(subdomain);
  }

  clear() {
    this.cache.clear();
  }

  // Cleanup expired entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expires) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance
const workspaceCache = new WorkspaceCache();

// Cleanup expired entries every 10 minutes
setInterval(() => workspaceCache.cleanup(), 10 * 60 * 1000);

/**
 * Resolve workspace from subdomain
 * Attaches req.workspace
 */
export const resolveWorkspace = async (req, res, next) => {
  try {
    // Skip if no subdomain (root domain)
    if (!req.subdomain) {
      req.workspace = null;
      return next();
    }

    // Check cache first
    let workspace = workspaceCache.get(req.subdomain);

    if (!workspace) {
      // Cache miss - query database
      workspace = await Workspace.findOne({ 
        subdomain: req.subdomain,
        isActive: true,
        'storeSettings.isStoreEnabled': true
      })
      .select('_id name subdomain owner storeSettings isActive')
      .lean(); // Use lean() for better performance

      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: `Store not found: ${req.subdomain}.scalor.net`,
          code: 'WORKSPACE_NOT_FOUND'
        });
      }

      // Cache the result
      workspaceCache.set(req.subdomain, workspace);
    }

    // Attach workspace to request
    req.workspace = workspace;
    req.workspaceId = workspace._id;

    next();
  } catch (error) {
    console.error('❌ Workspace resolver error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error resolving workspace',
      code: 'WORKSPACE_RESOLVER_ERROR'
    });
  }
};

/**
 * Require workspace to exist
 * Use after resolveWorkspace middleware
 */
export const requireWorkspace = (req, res, next) => {
  if (!req.workspace) {
    return res.status(404).json({
      success: false,
      message: 'Workspace not found',
      code: 'WORKSPACE_REQUIRED'
    });
  }
  next();
};

/**
 * Verify workspace ownership
 * Ensures logged-in user owns the workspace
 */
export const requireWorkspaceOwner = (req, res, next) => {
  if (!req.workspace) {
    return res.status(404).json({
      success: false,
      message: 'Workspace not found',
      code: 'WORKSPACE_NOT_FOUND'
    });
  }

  if (!req.ecomUser) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Check if user is owner or admin
  const isOwner = req.workspace.owner.toString() === req.ecomUser._id.toString();
  const isAdmin = req.ecomUser.role === 'ecom_admin' || req.ecomUser.role === 'super_admin';
  
  // Check if user has access to this workspace
  const hasWorkspaceAccess = req.ecomUser.workspaces?.some(
    ws => ws.workspaceId.toString() === req.workspace._id.toString()
  );

  if (!isOwner && !isAdmin && !hasWorkspaceAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not own this workspace.',
      code: 'WORKSPACE_ACCESS_DENIED'
    });
  }

  next();
};

/**
 * Invalidate workspace cache
 * Call this when workspace is updated
 */
export const invalidateWorkspaceCache = (subdomain) => {
  workspaceCache.invalidate(subdomain);
};

/**
 * Clear entire workspace cache
 * Use sparingly (e.g., during deployments)
 */
export const clearWorkspaceCache = () => {
  workspaceCache.clear();
};

export default {
  resolveWorkspace,
  requireWorkspace,
  requireWorkspaceOwner,
  invalidateWorkspaceCache,
  clearWorkspaceCache
};
