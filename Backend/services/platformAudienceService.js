import mongoose from 'mongoose';
import EcomUser from '../models/EcomUser.js';
import PlatformSubscriber from '../models/PlatformSubscriber.js';
import EmailSuppression from '../models/EmailSuppression.js';

/**
 * Traduit un segment en liste de destinataires.
 *
 * Deux règles tiennent tout le fichier :
 *
 *  1. Un humain ne reçoit qu'UNE fois par canal. Un marchand peut être à la
 *     fois EcomUser et inscrit newsletter ; sans dédoublonnage sur l'email, il
 *     reçoit deux exemplaires de la même annonce et se désabonne.
 *  2. La liste de suppression est consultée AVANT de constituer l'audience,
 *     pas au moment d'envoyer. Compter dans « ciblés » quelqu'un qui ne
 *     recevra jamais rend tous les taux d'ouverture faux.
 */

const asArray = (v) => (Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []));
const daysAgo = (n) => new Date(Date.now() - Number(n) * 86400000);

function buildUserQuery(filters = {}) {
  const q = {};

  const explicit = asArray(filters.explicitUserIds);
  if (explicit.length) {
    // Ciblage manuel : il court-circuite les filtres, sinon on ne peut pas
    // réenvoyer à une poignée de gens précis après un échec.
    return { _id: { $in: explicit.map((id) => new mongoose.Types.ObjectId(String(id))) } };
  }

  const roles = asArray(filters.roles);
  if (roles.length) q.role = { $in: roles };

  const sources = asArray(filters.acquisitionSources);
  if (sources.length) q.acquisitionSource = { $in: sources };

  if (filters.signedUpAfter || filters.signedUpBefore) {
    q.createdAt = {};
    if (filters.signedUpAfter) q.createdAt.$gte = new Date(filters.signedUpAfter);
    if (filters.signedUpBefore) q.createdAt.$lte = new Date(filters.signedUpBefore);
  }

  if (filters.activeWithinDays) {
    q.lastLogin = { $gte: daysAgo(filters.activeWithinDays) };
  }
  if (filters.inactiveSinceDays) {
    // Jamais connecté compte comme inactif — sinon les comptes créés puis
    // abandonnés, exactement la cible d'une relance, sortent du segment.
    q.$or = [
      { lastLogin: { $lt: daysAgo(filters.inactiveSinceDays) } },
      { lastLogin: { $exists: false } },
      { lastLogin: null },
    ];
  }

  if (filters.hasWhatsappInstance === true) q.supportNotificationEnabled = true;

  // Pays : aucun champ dédié côté utilisateur ni workspace. Le seul signal
  // fiable est l'indicatif du numéro — imparfait, mais honnête, et il évite
  // d'inventer une colonne qui n'existe pas.
  const countries = asArray(filters.countries);
  if (countries.length) {
    q.phone = { $regex: `^\\+?(${countries.map((c) => String(c).replace(/[^0-9]/g, '')).filter(Boolean).join('|')})` };
  }

  // Un compte désactivé ne doit rien recevoir.
  q.isActive = { $ne: false };

  return q;
}

/** Applique les filtres qui vivent sur le workspace, pas sur l'utilisateur. */
async function filterByWorkspace(users, filters = {}) {
  const plans = asArray(filters.plans);
  // Le pays n'existe pas sur EcomWorkspace : le filtre `countries` porte sur
  // l'indicatif du téléphone utilisateur, traité plus bas, pas ici.
  const needsWorkspace = plans.length > 0
    || filters.minSparks != null || filters.maxSparks != null
    || filters.hasStore === true || filters.hasStore === false;
  if (!needsWorkspace) return users;

  const Workspace = mongoose.models.EcomWorkspace || mongoose.models.Workspace;
  if (!Workspace) return users;

  const wq = {};
  if (plans.length) wq.plan = { $in: plans };
  if (filters.minSparks != null || filters.maxSparks != null) {
    wq.creativeCreditsRemaining = {};
    if (filters.minSparks != null) wq.creativeCreditsRemaining.$gte = Number(filters.minSparks);
    if (filters.maxSparks != null) wq.creativeCreditsRemaining.$lte = Number(filters.maxSparks);
  }

  let ids = await Workspace.find(wq).select('_id').lean();

  // « A une boutique » / « n'en a pas » : le segment d'activation le plus utile.
  // Il se lit sur Store, pas sur le workspace — d'où ce second passage.
  if (filters.hasStore === true || filters.hasStore === false) {
    const Store = mongoose.models.Store;
    if (Store) {
      const withStore = await Store.distinct('workspaceId', {
        workspaceId: { $in: ids.map((w) => w._id) },
      });
      const owning = new Set(withStore.map((id) => String(id)));
      ids = ids.filter((w) => owning.has(String(w._id)) === filters.hasStore);
    }
  }

  const allowed = new Set(ids.map((w) => String(w._id)));
  return users.filter((u) => {
    const own = [u.workspaceId, ...(u.workspaces || []).map((w) => w.workspaceId)].filter(Boolean);
    return own.some((id) => allowed.has(String(id)));
  });
}

/**
 * @returns {Promise<{recipients: Array, counts: object}>}
 * recipients = [{ userId, subscriberId, email, phone, name, kind }]
 */
export async function resolveAudience(audience = {}) {
  const sources = asArray(audience.sources).length ? asArray(audience.sources) : ['users'];
  const filters = audience.filters || {};

  const out = [];
  const seenEmail = new Set();
  const seenPhone = new Set();
  const counts = { users: 0, subscribers: 0, duplicates: 0, suppressed: 0 };

  if (sources.includes('users')) {
    const raw = await EcomUser.find(buildUserQuery(filters))
      .select('_id email name phone role workspaceId workspaces createdAt lastLoginAt')
      .lean();
    const users = await filterByWorkspace(raw, filters);
    counts.users = users.length;
    for (const u of users) {
      const email = String(u.email || '').toLowerCase().trim();
      if (email && seenEmail.has(email)) { counts.duplicates += 1; continue; }
      if (email) seenEmail.add(email);
      const phone = String(u.phone || '').trim();
      if (phone) seenPhone.add(phone);
      out.push({ userId: u._id, subscriberId: null, email, phone, name: u.name || '', kind: 'user' });
    }
  }

  if (sources.includes('subscribers')) {
    const subs = await PlatformSubscriber.find({ isActive: true }).select('_id email name phone').lean();
    counts.subscribers = subs.length;
    for (const s of subs) {
      const email = String(s.email || '').toLowerCase().trim();
      if (!email || seenEmail.has(email)) { counts.duplicates += 1; continue; }
      seenEmail.add(email);
      const phone = String(s.phone || '').trim();
      if (phone && seenPhone.has(phone)) {
        out.push({ userId: null, subscriberId: s._id, email, phone: '', name: s.name || '', kind: 'subscriber' });
        continue;
      }
      if (phone) seenPhone.add(phone);
      out.push({ userId: null, subscriberId: s._id, email, phone, name: s.name || '', kind: 'subscriber' });
    }
  }

  // Barrière de suppression — avant tout comptage affiché.
  const { suppressed } = await EmailSuppression.filterSendable(out.map((r) => r.email).filter(Boolean));
  counts.suppressed = suppressed.size;
  const recipients = out.map((r) => ({ ...r, emailSuppressed: r.email ? suppressed.has(r.email) : false }));

  return { recipients, counts };
}

/** Compte seul, pour l'aperçu d'audience dans l'interface. */
export async function previewAudience(audience = {}) {
  const { recipients, counts } = await resolveAudience(audience);
  const withEmail = recipients.filter((r) => r.email && !r.emailSuppressed).length;
  const withPhone = recipients.filter((r) => r.phone).length;
  return {
    total: recipients.length,
    reachable: { email: withEmail, whatsapp: withPhone },
    counts,
    sample: recipients.slice(0, 8).map((r) => ({
      name: r.name,
      email: r.email ? `${r.email.slice(0, 3)}***@${r.email.split('@')[1] || ''}` : '',
      kind: r.kind,
    })),
  };
}

export default { resolveAudience, previewAudience };
