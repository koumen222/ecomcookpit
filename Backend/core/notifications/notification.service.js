/**
 * notification.service.js
 * Point d'entrée unique pour déclencher toutes les notifications.
 *
 * Usage :
 *   import { trigger } from '../core/notifications/notification.service.js';
 *   await trigger('user_registered', { user, workspace }, { to: user.email });
 */

import { sendNotificationEmail } from './email.service.js';
import { NOTIFICATION_RULES } from './notification.rules.js';
import NotificationLog from '../../models/NotificationLog.js';
import UserNotificationPreferences from '../../models/UserNotificationPreferences.js';

// ─── Anti-spam in-memory (complète le throttle DB) ───────────────────────────
// Map<throttleKey, lastSentTimestamp>
const throttleCache = new Map();

// Nettoyage périodique pour éviter les fuites mémoire (toutes les heures)
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of throttleCache.entries()) {
    if (now - ts > 48 * 60 * 60 * 1000) throttleCache.delete(key);
  }
}, 60 * 60 * 1000);

// ─── Vérification throttle ────────────────────────────────────────────────────

const isThrottled = async (throttleKey, throttleMs) => {
  if (!throttleKey || !throttleMs) return false;

  // 1. Vérifier le cache mémoire (rapide)
  const cached = throttleCache.get(throttleKey);
  if (cached && Date.now() - cached < throttleMs) return true;

  // 2. Vérifier la DB (persistant entre redémarrages)
  try {
    const lastLog = await NotificationLog.findOne({
      'metadata.throttleKey': throttleKey,
      status: 'SENT',
      createdAt: { $gte: new Date(Date.now() - throttleMs) }
    }).sort({ createdAt: -1 }).lean();

    if (lastLog) {
      throttleCache.set(throttleKey, lastLog.createdAt.getTime());
      return true;
    }
  } catch (err) {
    console.warn('[notification.service] Erreur vérification throttle DB:', err.message);
  }

  return false;
};

// ─── Vérification préférences utilisateur ────────────────────────────────────

const isPreferenceEnabled = async (userId, prefCategory) => {
  if (!userId || !prefCategory) return true; // Pas d'userId = toujours envoyer

  // securityEmails est toujours envoyé (non désactivable)
  if (prefCategory === 'securityEmails') return true;

  try {
    const prefs = await UserNotificationPreferences.findOne({ userId }).lean();
    if (!prefs) return true; // Pas de prefs = tout activé par défaut
    return prefs[prefCategory] !== false;
  } catch (err) {
    console.warn('[notification.service] Erreur lecture préférences:', err.message);
    return true;
  }
};

// ─── Fonction principale trigger ─────────────────────────────────────────────

/**
 * @param {string} eventType - Clé dans NOTIFICATION_RULES
 * @param {object} payload   - Données brutes de l'événement
 * @param {object} options
 *   @param {string|string[]} options.to       - Adresse(s) email destinataire(s)
 *   @param {string}          options.userId   - ID utilisateur (pour prefs + log)
 *   @param {string}          options.workspaceId
 *   @param {boolean}         options.force    - Ignorer throttle et prefs
 */
export const trigger = async (eventType, payload = {}, options = {}) => {
  const rule = NOTIFICATION_RULES[eventType];

  if (!rule) {
    console.warn(`[notification.service] Règle inconnue: "${eventType}"`);
    return { success: false, reason: 'UNKNOWN_EVENT' };
  }

  const { to, userId, workspaceId, force = false } = options;

  if (!to) {
    console.warn(`[notification.service] Pas de destinataire pour "${eventType}"`);
    return { success: false, reason: 'NO_RECIPIENT' };
  }

  // 1. Vérifier la condition métier
  if (!force && rule.condition && !rule.condition(payload)) {
    return { success: false, reason: 'CONDITION_NOT_MET' };
  }

  // 2. Vérifier les préférences utilisateur
  if (!force && rule.prefCategory) {
    const enabled = await isPreferenceEnabled(userId, rule.prefCategory);
    if (!enabled) {
      await NotificationLog.create({
        userId, workspaceId, eventType,
        channel: 'EMAIL', status: 'SKIPPED',
        recipient: Array.isArray(to) ? to.join(', ') : to,
        metadata: { reason: 'USER_PREF_DISABLED', prefCategory: rule.prefCategory }
      }).catch(() => {});
      return { success: false, reason: 'USER_PREF_DISABLED' };
    }
  }

  // 3. Vérifier le throttle
  const throttleKey = rule.throttleKey ? rule.throttleKey(payload) : null;
  if (!force && throttleKey && rule.throttleMs) {
    const throttled = await isThrottled(throttleKey, rule.throttleMs);
    if (throttled) {
      console.log(`[notification.service] Throttled: ${throttleKey}`);
      await NotificationLog.create({
        userId, workspaceId, eventType,
        channel: 'EMAIL', status: 'THROTTLED',
        recipient: Array.isArray(to) ? to.join(', ') : to,
        metadata: { throttleKey }
      }).catch(() => {});
      return { success: false, reason: 'THROTTLED' };
    }
  }

  // 4. Construire les données du template
  const data = rule.buildData ? rule.buildData(payload) : payload;

  // 5. Envoyer l'email
  const result = await sendNotificationEmail({
    to,
    templateKey: rule.templateKey,
    data,
    userId,
    workspaceId,
    eventType
  });

  // 6. Mettre à jour le cache throttle si envoi réussi
  if (result.success && throttleKey) {
    throttleCache.set(throttleKey, Date.now());
    // Persister la clé throttle dans le dernier log
    await NotificationLog.findOneAndUpdate(
      { eventType, 'metadata.throttleKey': { $exists: false }, status: 'SENT', recipient: Array.isArray(to) ? to.join(', ') : to },
      { $set: { 'metadata.throttleKey': throttleKey } },
      { sort: { createdAt: -1 } }
    ).catch(() => {});
  }

  return result;
};

// ─── Helpers raccourcis ───────────────────────────────────────────────────────

export const notifyUserRegistered = (user, workspace) =>
  trigger('user_registered', { user, workspace }, {
    to: user.email, userId: user._id, workspaceId: workspace?._id
  });

export const notifyForgotPassword = (user, resetUrl) =>
  trigger('forgot_password', { user, resetUrl }, {
    to: user.email, userId: user._id, force: true
  });

export const notifyPasswordChanged = (user) =>
  trigger('password_changed', { user }, {
    to: user.email, userId: user._id, force: true
  });

export const notifySuspiciousLogin = (user, { ip, device, location } = {}) =>
  trigger('suspicious_login', { user, ip, device, location }, {
    to: user.email, userId: user._id, force: true
  });

export const notifyTeamInvitation = (targetEmail, { inviterName, workspace, role, inviteUrl }) =>
  trigger('team_invitation', { inviterName, workspace, role, inviteUrl, targetEmail }, {
    to: targetEmail, workspaceId: workspace?._id
  });

export const notifyRoleChanged = (user, { workspace, oldRole, newRole, changedBy }) =>
  trigger('role_changed', { user, workspace, oldRole, newRole, changedBy }, {
    to: user.email, userId: user._id, workspaceId: workspace?._id
  });

export const notifyMemberRemoved = (user, { workspace, removedBy }) =>
  trigger('member_removed', { user, workspace, removedBy }, {
    to: user.email, userId: user._id, workspaceId: workspace?._id
  });

export const notifyBudgetWarning = (adminEmail, { budget, workspace, currency, userId }) =>
  trigger('budget_warning_70', { budget, workspace, currency }, {
    to: adminEmail, userId, workspaceId: workspace?._id
  });

export const notifyBudgetExceeded = (adminEmail, { budget, workspace, currency, userId }) =>
  trigger('budget_exceeded', { budget, workspace, currency }, {
    to: adminEmail, userId, workspaceId: workspace?._id
  });

export const notifyCriticalTransaction = (adminEmail, { transaction, workspace, currency, threshold, userId }) =>
  trigger('critical_transaction', { transaction, workspace, currency, threshold }, {
    to: adminEmail, userId, workspaceId: workspace?._id
  });

export const notifyWeeklyReport = (adminEmail, { workspace, period, income, expenses, balance, topCategory, ordersCount, currency, userId }) =>
  trigger('weekly_report', { workspace, period, income, expenses, balance, topCategory, ordersCount, currency }, {
    to: adminEmail, userId, workspaceId: workspace?._id
  });

export const notifyMonthlyReport = (adminEmail, { workspace, month, income, expenses, balance, growth, budgetUsage, currency, userId }) =>
  trigger('monthly_report', { workspace, month, income, expenses, balance, growth, budgetUsage, currency }, {
    to: adminEmail, userId, workspaceId: workspace?._id
  });

export const notifyStockLow = (adminEmail, { product, workspace, userId }) =>
  trigger('stock_low', { product, workspace }, {
    to: adminEmail, userId, workspaceId: workspace?._id
  });

export const notifyStockOut = (adminEmail, { product, workspace, userId }) =>
  trigger('stock_out', { product, workspace }, {
    to: adminEmail, userId, workspaceId: workspace?._id
  });

export const notifySalesSpike = (adminEmail, { workspace, ordersCount, period, revenue, currency, userId }) =>
  trigger('sales_spike', { workspace, ordersCount, period, revenue, currency }, {
    to: adminEmail, userId, workspaceId: workspace?._id
  });

export const notifyNewRecord = (adminEmail, { workspace, metric, value, previousRecord, currency, userId }) =>
  trigger('new_record', { workspace, metric, value, previousRecord, currency }, {
    to: adminEmail, userId, workspaceId: workspace?._id
  });
