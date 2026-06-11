import Workspace from '../models/Workspace.js';
import Store from '../models/Store.js';
import { invalidateUserCache } from '../middleware/ecomAuth.js';
import { getPhonePrefixFromWorkspace, normalizePhone } from '../utils/phoneUtils.js';

const WORKSPACE_ROLES = new Set(['ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur']);

function sanitizeName(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function getNameFromEmail(email = '') {
  const localPart = String(email || '').split('@')[0] || 'espace';
  return sanitizeName(
    localPart
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  ) || 'Espace';
}

export function buildDefaultWorkspaceName(user = {}) {
  const profileName = sanitizeName(user.name);
  if (profileName) return profileName;
  return getNameFromEmail(user.email);
}

async function normalizeUserPhoneForWorkspace(user, workspaceId) {
  const rawPhone = sanitizeName(user.phone);
  if (!rawPhone || !workspaceId) return rawPhone;

  const workspace = await Workspace.findById(workspaceId).select('settings storeSettings').lean().catch(() => null);
  const defaultPrefix = getPhonePrefixFromWorkspace(workspace, '237');
  return normalizePhone(rawPhone, defaultPrefix) || rawPhone;
}

async function findOrCreateWorkspace(user, options) {
  let workspace = user.workspaceId
    ? await Workspace.findById(user.workspaceId)
    : null;

  if (!workspace && user.workspaceId) {
    console.warn(`[AUTH_PROVISION] workspace_missing user=${user._id} workspaceId=${user.workspaceId}`);
    user.workspaceId = null;
  }

  if (!workspace) {
    workspace = await Workspace.findOne({ owner: user._id, isActive: true }).sort({ createdAt: 1 });
  }

  if (!workspace) {
    const workspaceName = sanitizeName(options.workspaceName) || buildDefaultWorkspaceName(user);
    workspace = await Workspace.create({
      name: workspaceName,
      owner: user._id
    });
    options.createdWorkspace = true;
    console.log(`[AUTH_PROVISION] workspace_created user=${user.email} workspace=${workspace._id} source=${options.source}`);
  }

  return workspace;
}

async function resolveExistingPrimaryStore(workspace, options) {
  if (!workspace?._id) return null;

  let store = null;
  if (workspace.primaryStoreId) {
    store = await Store.findOne({
      _id: workspace.primaryStoreId,
      workspaceId: workspace._id,
      isActive: true
    });
  }

  if (!store) {
    store = await Store.findOne({ workspaceId: workspace._id, isActive: true }).sort({ createdAt: 1 });
  }

  if (!store) {
    return null;
  }

  if (String(workspace.primaryStoreId || '') !== String(store._id)) {
    workspace.primaryStoreId = store._id;
    await workspace.save();
    console.log(`[AUTH_PROVISION] primary_store_linked workspace=${workspace._id} store=${store._id} source=${options.source}`);
  }

  return store;
}

export async function ensureAuthWorkspace(user, opts = {}) {
  if (user?.role && !WORKSPACE_ROLES.has(user.role) && user.role !== 'super_admin') {
    return { user, workspace: null, store: null, createdWorkspace: false };
  }

  const options = {
    source: opts.source || 'auth',
    workspaceName: opts.workspaceName,
    role: WORKSPACE_ROLES.has(opts.role) ? opts.role : (WORKSPACE_ROLES.has(user?.role) ? user.role : 'ecom_admin'),
    createdWorkspace: false
  };

  if (!user || !user.isActive || user.role === 'super_admin') {
    return { user, workspace: null, store: null, createdWorkspace: false };
  }

  const workspace = await findOrCreateWorkspace(user, options);
  const role = options.role || 'ecom_admin';
  let userChanged = false;

  if (!user.workspaceId || String(user.workspaceId) !== String(workspace._id)) {
    user.workspaceId = workspace._id;
    userChanged = true;
  }

  if (!user.role) {
    user.role = role;
    userChanged = true;
  }

  if (!user.hasWorkspaceAccess?.(workspace._id)) {
    user.addWorkspace(workspace._id, user.role || role);
    userChanged = true;
  }

  if (user.phone) {
    const normalizedPhone = await normalizeUserPhoneForWorkspace(user, workspace._id);
    if (normalizedPhone !== user.phone) {
      user.phone = normalizedPhone;
      userChanged = true;
    }
  }

  if (userChanged) {
    await user.save();
    invalidateUserCache(user._id);
    console.log(`[AUTH_PROVISION] user_linked user=${user.email} role=${user.role} workspace=${workspace._id} source=${options.source}`);
  }

  const store = await resolveExistingPrimaryStore(workspace, options);

  return {
    user,
    workspace,
    store,
    createdWorkspace: options.createdWorkspace
  };
}
