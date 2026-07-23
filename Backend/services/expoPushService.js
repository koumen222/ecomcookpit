import axios from 'axios';
import ExpoPushToken from '../models/ExpoPushToken.js';

/**
 * Envoi de notifications push aux appareils mobiles (app Scalor iOS/Android)
 * via l'API HTTP d'Expo — aucune dépendance supplémentaire (axios déjà présent).
 * https://docs.expo.dev/push-notifications/sending-notifications/
 *
 * Sons côté app (fichiers embarqués dans le build mobile) :
 *  - nouvelle commande  → canal Android "orders",  son iOS "cash.wav"   (ka-ching)
 *  - course livreur     → canal Android "courses", son iOS "alarm.wav"  (jingle)
 *  - autre              → canal "default", son système
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const isCourseNotification = (data = {}) => {
  const t = `${data.tag || ''} ${data.data?.type || ''} ${data.title || ''}`.toLowerCase();
  return t.includes('course') || t.includes('livreur') || t.includes('delivery_offer');
};

const isNewOrderNotification = (data = {}) => {
  const t = `${data.tag || ''} ${data.data?.type || ''}`.toLowerCase();
  return t.includes('new-order') || t.includes('new_order');
};

/** Construit le message Expo à partir du payload web-push existant. */
const buildExpoMessage = (to, notificationData = {}) => {
  const course = isCourseNotification(notificationData);
  const newOrder = isNewOrderNotification(notificationData);

  return {
    to,
    title: notificationData.title || 'Scalor',
    body: notificationData.body || '',
    data: notificationData.data || {},
    priority: 'high',
    // Android : le son est porté par le canal de notification de l'app
    channelId: course ? 'courses' : newOrder ? 'orders' : 'default',
    // iOS : nom du fichier son embarqué dans le build
    sound: course ? 'alarm.wav' : newOrder ? 'cash.wav' : 'default',
  };
};

/** Envoie un lot de messages (chunks de 100, limite Expo). */
const sendMessages = async (messages) => {
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await axios.post(EXPO_PUSH_URL, chunk, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 10000
      });
      const tickets = res.data?.data || [];
      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        if (ticket.status === 'ok') {
          successful++;
        } else {
          failed++;
          // Token mort (app désinstallée) → suppression
          if (ticket.details?.error === 'DeviceNotRegistered') {
            const dead = chunk[j]?.to;
            if (dead) await ExpoPushToken.deleteMany({ token: dead }).catch(() => {});
          }
        }
      }
    } catch (error) {
      failed += chunk.length;
      console.warn('⚠️ Envoi Expo push échoué:', error.message);
    }
  }

  return { successful, failed };
};

/** Push mobile à tous les appareils d'un workspace. */
const sendExpoPushToWorkspace = async (workspaceId, notificationData) => {
  try {
    const tokens = await ExpoPushToken.find({ workspaceId }).maxTimeMS(5000).catch(() => []);
    if (!tokens.length) return { successful: 0, failed: 0, total: 0 };

    const messages = tokens.map((t) => buildExpoMessage(t.token, notificationData));
    const result = await sendMessages(messages);
    console.log(`📲 Expo push workspace ${workspaceId}: ${result.successful} ok / ${tokens.length}`);
    return { ...result, total: tokens.length };
  } catch (error) {
    console.warn('⚠️ Expo push workspace échoué:', error.message);
    return { successful: 0, failed: 0, total: 0 };
  }
};

/** Push mobile à tous les appareils d'un utilisateur. */
const sendExpoPushToUser = async (userId, notificationData) => {
  try {
    const tokens = await ExpoPushToken.find({ userId }).maxTimeMS(5000).catch(() => []);
    if (!tokens.length) return { successful: 0, failed: 0, total: 0 };

    const messages = tokens.map((t) => buildExpoMessage(t.token, notificationData));
    const result = await sendMessages(messages);
    console.log(`📲 Expo push user ${userId}: ${result.successful} ok / ${tokens.length}`);
    return { ...result, total: tokens.length };
  } catch (error) {
    console.warn('⚠️ Expo push user échoué:', error.message);
    return { successful: 0, failed: 0, total: 0 };
  }
};

export { sendExpoPushToWorkspace, sendExpoPushToUser };
