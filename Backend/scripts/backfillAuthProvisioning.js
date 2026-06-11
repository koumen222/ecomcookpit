import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import EcomUser from '../models/EcomUser.js';
import Workspace from '../models/Workspace.js';
import Store from '../models/Store.js';
import { ensureAuthWorkspace } from '../services/authProvisioningService.js';

const WORKSPACE_ROLES = new Set(['ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur']);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function parseArgs(argv) {
  const args = {
    write: false,
    since: null,
    email: null,
    limit: 5000,
  };

  for (const arg of argv.slice(2)) {
    if (arg === '--write') args.write = true;
    else if (arg.startsWith('--since=')) args.since = new Date(arg.slice('--since='.length));
    else if (arg.startsWith('--email=')) args.email = arg.slice('--email='.length).toLowerCase().trim();
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length)) || args.limit;
  }

  if (args.since && Number.isNaN(args.since.getTime())) {
    throw new Error('Format --since invalide. Exemple: --since=2026-06-01');
  }

  return args;
}

function maskEmail(email = '') {
  const [local, domain] = String(email).split('@');
  if (!domain) return email;
  const maskedLocal = local.length <= 2 ? `${local[0] || '*'}*` : `${local.slice(0, 2)}***`;
  return `${maskedLocal}@${domain}`;
}

function compactUserAudit({ user, workspace, store }) {
  return {
    email: maskEmail(user.email),
    userId: String(user._id),
    role: user.role || null,
    workspaceId: user.workspaceId ? String(user.workspaceId) : null,
    workspaceExists: !!workspace,
    workspacePrimaryStoreId: workspace?.primaryStoreId ? String(workspace.primaryStoreId) : null,
    storeId: store?._id ? String(store._id) : null,
    isActive: user.isActive,
    subscription: workspace?.plan || null,
    onboardingCompleted: user.onboardingData?.completed === true,
  };
}

async function connectForMigration() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/plateforme';
  console.log('[auth-backfill] Connecting MongoDB:', uri.replace(/\/\/.*@/, '//***:***@'));
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 15000,
    maxPoolSize: 8,
    minPoolSize: 0,
    retryWrites: true,
    retryReads: true,
    family: 4,
  });
  console.log('[auth-backfill] Connected DB:', mongoose.connection.db.databaseName);
}

function inspectUser(user, workspace, store) {
  const directWorkspaceMissing = !user.workspaceId || !workspace || (user.workspaceId && String(user.workspaceId) !== String(workspace._id));

  const hasWorkspaceRole = !user.role || WORKSPACE_ROLES.has(user.role);
  const roleMissing = !user.role;
  const workspaceMissing = directWorkspaceMissing;
  const membershipMissing = !!workspace && !user.hasWorkspaceAccess?.(workspace._id);
  const storeMissing = !!workspace && (!store || !workspace.primaryStoreId);
  const criticalMissing = roleMissing || workspaceMissing || membershipMissing;

  return {
    user,
    workspace,
    store,
    broken: hasWorkspaceRole && criticalMissing,
    criticalMissing,
    reasons: {
      roleMissing,
      workspaceMissing,
      membershipMissing,
      storeMissing,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  await connectForMigration();

  const query = {
    isActive: true,
    role: { $ne: 'super_admin' },
  };

  if (args.email) query.email = args.email;
  if (args.since) query.createdAt = { $gte: args.since };

  const users = await EcomUser.find(query).sort({ createdAt: -1 }).limit(args.limit).maxTimeMS(15000);
  const userIds = users.map((user) => user._id);
  const workspaceIds = users.map((user) => user.workspaceId).filter(Boolean);

  const workspaceQuery = {
    $or: [
      { _id: { $in: workspaceIds } },
      { owner: { $in: userIds }, isActive: true },
    ],
  };

  const workspaces = await Workspace.find(workspaceQuery)
    .select('_id name owner primaryStoreId plan isActive createdAt')
    .sort({ createdAt: 1 })
    .maxTimeMS(15000)
    .lean();

  const workspaceById = new Map(workspaces.map((workspace) => [String(workspace._id), workspace]));
  const ownerWorkspaceByUserId = new Map();
  for (const workspace of workspaces) {
    const ownerId = String(workspace.owner || '');
    if (ownerId && !ownerWorkspaceByUserId.has(ownerId)) {
      ownerWorkspaceByUserId.set(ownerId, workspace);
    }
  }

  const stores = await Store.find({
    workspaceId: { $in: workspaces.map((workspace) => workspace._id) },
    isActive: true,
  })
    .select('_id name workspaceId isActive createdAt')
    .sort({ createdAt: 1 })
    .maxTimeMS(15000)
    .lean();

  const storeByWorkspaceId = new Map();
  for (const store of stores) {
    const wsId = String(store.workspaceId || '');
    if (wsId && !storeByWorkspaceId.has(wsId)) {
      storeByWorkspaceId.set(wsId, store);
    }
  }

  const candidates = [];
  let healthySample = null;
  const reasonCounts = {
    roleMissing: 0,
    workspaceMissing: 0,
    membershipMissing: 0,
    storeMissing: 0,
    criticalMissing: 0,
  };

  for (const user of users) {
    const workspace = user.workspaceId
      ? workspaceById.get(String(user.workspaceId))
      : ownerWorkspaceByUserId.get(String(user._id));
    const store = workspace ? storeByWorkspaceId.get(String(workspace._id)) : null;
    const inspected = inspectUser(user, workspace, store);
    if (inspected.broken) {
      for (const key of Object.keys(reasonCounts)) {
        if (inspected.reasons[key] || inspected[key]) reasonCounts[key] += 1;
      }

      if (inspected.criticalMissing) {
        candidates.push(inspected);
      }
    }
    else if (!healthySample && inspected.workspace && inspected.store && WORKSPACE_ROLES.has(user.role)) {
      healthySample = inspected;
    }
  }

  console.log('\n[auth-backfill] Mode:', args.write ? 'WRITE' : 'DRY-RUN');
  console.log('[auth-backfill] Users scanned:', users.length);
  console.log('[auth-backfill] Users needing repair:', candidates.length);
  console.log('[auth-backfill] Reason counts:', JSON.stringify(reasonCounts));
  console.log('[auth-backfill] Store-only gaps are reported but never repaired by this script.');
  if (args.since) console.log('[auth-backfill] Since:', args.since.toISOString());
  if (args.email) console.log('[auth-backfill] Email filter:', maskEmail(args.email));

  if (healthySample) {
    console.log('\n[auth-backfill] Healthy sample');
    console.log(JSON.stringify(compactUserAudit(healthySample), null, 2));
  }

  if (candidates[0]) {
    console.log('\n[auth-backfill] Broken/new sample');
    console.log(JSON.stringify({
      ...compactUserAudit(candidates[0]),
      reasons: candidates[0].reasons,
    }, null, 2));
  }

  if (!args.write) {
    console.log('\n[auth-backfill] Dry-run only. Re-run with --write to apply fixes.');
    return;
  }

  let repaired = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      await ensureAuthWorkspace(candidate.user, {
        source: 'migration_auth_backfill',
        role: WORKSPACE_ROLES.has(candidate.user.role) ? candidate.user.role : 'ecom_admin',
      });
      repaired += 1;
    } catch (error) {
      failed += 1;
      console.error(`[auth-backfill] Failed user=${candidate.user._id} email=${maskEmail(candidate.user.email)}:`, error.message);
    }
  }

  console.log('\n[auth-backfill] Done');
  console.log('[auth-backfill] Repaired:', repaired);
  console.log('[auth-backfill] Failed:', failed);
}

main()
  .catch((error) => {
    console.error('[auth-backfill] Fatal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(process.exitCode || 0);
  });
