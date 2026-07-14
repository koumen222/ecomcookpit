import WhatsAppInstance from '../models/WhatsAppInstance.js';
import EcomUser from '../models/EcomUser.js';
import evolutionApiService from './evolutionApiService.js';

const CONNECTED_STATUSES = ['connected', 'active'];

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Envoie une information interne via l'unique instance hôte du workspace.
 * Les destinataires sont résolus depuis leur rôle et leur numéro de profil.
 */
export async function notifyWorkspaceRoles({ workspaceId, event, message, metadata = {} }) {
  if (!workspaceId || !event || !message) return { sent: 0, skipped: true, reason: 'missing_payload' };

  const host = await WhatsAppInstance.findOne({
    workspaceId,
    usageType: 'host',
    isActive: true,
    status: { $in: CONNECTED_STATUSES },
    'hostSettings.enabled': { $ne: false },
    'hostSettings.events': event,
  }).lean();

  if (!host) return { sent: 0, skipped: true, reason: 'host_unavailable' };

  const roles = host.hostSettings?.recipientRoles || [];
  if (!roles.length) return { sent: 0, skipped: true, reason: 'no_recipient_roles' };

  const users = await EcomUser.find({
    workspaceId,
    role: { $in: roles },
    isActive: true,
    phone: { $nin: ['', null] },
  }).select('_id name role phone').lean();

  const recipients = [...new Map(users.map(user => [cleanPhone(user.phone), user])).entries()]
    .filter(([phone]) => phone.length >= 8);

  const results = [];
  for (const [phone, user] of recipients) {
    try {
      await evolutionApiService.sendMessage(host.instanceName, host.instanceToken, phone, message);
      results.push({ userId: user._id, role: user.role, phone, success: true });
    } catch (error) {
      results.push({ userId: user._id, role: user.role, phone, success: false, error: error.message });
    }
  }

  const sent = results.filter(result => result.success).length;
  console.log(`📡 [WHATSAPP-HOST] ${event}: ${sent}/${results.length} notification(s) envoyée(s)`, metadata);
  return { sent, total: results.length, hostInstanceId: host._id, results };
}

export default { notifyWorkspaceRoles };
