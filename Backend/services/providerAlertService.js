// ─────────────────────────────────────────────────────────────────────────────
//  Alerte « fournisseur IA à sec » — panne côté prestataire, pas côté client.
//
//  Quand le fournisseur vidéo (KIE / Veo) refuse une requête pour solde
//  épuisé, aucun marchand ne peut plus générer. Ce n'est ni sa faute ni son
//  problème : il voit un message d'attente, et le super admin est prévenu
//  immédiatement pour recharger.
//
//  Deux garde-fous :
//   · anti-spam — une alerte par fournisseur toutes les ALERT_COOLDOWN_MS,
//     sinon une génération en rafale enverrait 50 notifications ;
//   · best-effort — une alerte qui échoue ne casse JAMAIS la requête en cours.
// ─────────────────────────────────────────────────────────────────────────────

import EcomUser from '../models/EcomUser.js';
import { createNotification } from './notificationHelper.js';
import { sendPushNotificationToUser } from './pushService.js';
import { sendEmail } from './emailService.js';

const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 min par fournisseur
const lastAlertAt = new Map(); // provider → timestamp

/** Le message d'erreur du fournisseur signale-t-il un solde épuisé ? */
export function isProviderOutOfCredits(message) {
  const m = String(message || '').toLowerCase();
  return /credits?\s*insufficient|insufficient\s*(credit|balance|funds)|balance\s*isn.?t\s*enough|top\s*up|quota\s*(exceeded|exhausted)|payment\s*required/.test(m);
}

/** Message montré au marchand — sa faute n'est pas en cause, son argent non plus. */
export const PROVIDER_DOWN_MESSAGE =
  'Le système de génération vidéo est momentanément indisponible. '
  + 'Nous sommes désolés — le service revient dans quelques minutes. '
  + 'Aucun crédit ne t’a été débité, réessaie tout à l’heure.';

/**
 * Prévient les super admins qu'un fournisseur est à sec.
 * @param {object} p
 * @param {string} p.provider   identifiant du moteur (groktalk, pixversetalk…)
 * @param {string} p.rawError   message brut du fournisseur (pour le diagnostic)
 * @param {string} [p.feature]  ce que le marchand tentait de générer
 * @param {string} [p.workspaceId] workspace concerné (traçabilité)
 */
export async function alertProviderOutOfCredits({ provider, rawError, feature = 'video', workspaceId = null }) {
  try {
    const key = String(provider || 'inconnu');
    const now = Date.now();
    const last = lastAlertAt.get(key) || 0;
    if (now - last < ALERT_COOLDOWN_MS) return { sent: false, reason: 'cooldown' };
    lastAlertAt.set(key, now);

    const admins = await EcomUser.find({ role: 'super_admin', isActive: true })
      .select('_id email firstName workspaceId')
      .lean();
    if (!admins.length) {
      console.error(`🚨 [provider] ${key} à sec — AUCUN super_admin à prévenir : ${rawError}`);
      return { sent: false, reason: 'no-admin' };
    }

    const title = `🚨 Fournisseur IA à sec — ${key}`;
    const message = `La génération ${feature} est bloquée : le solde du fournisseur ${key} est épuisé. `
      + 'Recharge le compte fournisseur pour rétablir le service.';

    await Promise.allSettled(admins.flatMap((a) => [
      // Notification in-app (cloche + WebSocket temps réel)
      a.workspaceId && createNotification({
        workspaceId: a.workspaceId,
        userId: a._id,
        type: 'system',
        title,
        message,
        icon: 'alert',
        metadata: { kind: 'provider_out_of_credits', provider: key, feature, workspaceId, rawError: String(rawError || '').slice(0, 500) },
      }),
      // Push : à recharger tout de suite, pas à la prochaine connexion
      sendPushNotificationToUser(a._id, {
        title,
        body: `Génération ${feature} bloquée — recharge le compte ${key}.`,
        data: { kind: 'provider_out_of_credits', provider: key },
      }),
      // E-mail : trace écrite avec le message brut du fournisseur
      a.email && sendEmail({
        to: a.email,
        subject: title,
        source: 'system',
        text: `${message}\n\nMessage du fournisseur :\n${rawError}\n\nWorkspace concerné : ${workspaceId || '—'}\nHorodatage : ${new Date().toISOString()}`,
        html: `<p>${message}</p><pre style="background:#f6f7f9;padding:12px;border-radius:8px;white-space:pre-wrap">${String(rawError || '').slice(0, 1000)}</pre>`
          + `<p style="color:#6b7280;font-size:12px">Workspace : ${workspaceId || '—'} · ${new Date().toISOString()}</p>`,
      }),
    ].filter(Boolean)));

    console.error(`🚨 [provider] ${key} à sec — ${admins.length} super admin(s) prévenu(s)`);
    return { sent: true, admins: admins.length };
  } catch (e) {
    // Une alerte qui échoue ne doit jamais faire échouer la génération.
    console.error('[providerAlert] échec de l’alerte :', e.message);
    return { sent: false, reason: 'error' };
  }
}

export default { isProviderOutOfCredits, alertProviderOutOfCredits, PROVIDER_DOWN_MESSAGE };
