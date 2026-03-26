import cron from 'node-cron';
import RitaStatusSchedule from '../models/RitaStatusSchedule.js';
import RitaConfig from '../models/RitaConfig.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import evolutionApiService from './evolutionApiService.js';

let statusCronJob = null;

function getStatusMediaType(mediaUrl = '') {
  const normalized = String(mediaUrl || '').split('?')[0].toLowerCase();
  if (/\/(video|videos)\//.test(normalized) || /\.(mp4|mov|avi|webm|mkv)$/i.test(normalized)) return 'video';
  return 'image';
}

function getProductStatusMedia(product, preferredMediaUrl = '') {
  const selectedMediaUrl = String(preferredMediaUrl || '').trim();

  if (selectedMediaUrl) {
    if ((product?.videos || []).includes(selectedMediaUrl)) {
      return { mediaUrl: selectedMediaUrl, type: 'video' };
    }

    if ((product?.images || []).includes(selectedMediaUrl)) {
      return { mediaUrl: selectedMediaUrl, type: 'image' };
    }

    return { mediaUrl: selectedMediaUrl, type: getStatusMediaType(selectedMediaUrl) };
  }

  const firstImage = (product?.images || []).find(Boolean);
  if (firstImage) {
    return { mediaUrl: firstImage, type: 'image' };
  }

  const firstVideo = (product?.videos || []).find(Boolean);
  if (firstVideo) {
    return { mediaUrl: firstVideo, type: 'video' };
  }

  return { mediaUrl: '', type: 'text' };
}

/**
 * Résout le contenu d'un statut selon son type
 * Pour type='product', va chercher l'image + le prix dans le catalogue RitaConfig
 */
export async function resolveStatusContent(schedule) {
  if (schedule.type === 'product' && schedule.productName) {
    // Chercher la config Rita pour récupérer le produit
    const query = schedule.agentId
      ? { agentId: schedule.agentId }
      : { userId: schedule.userId };
    const config = await RitaConfig.findOne(query).lean();
    const product = (config?.productCatalog || []).find(
      p => p.name?.toLowerCase() === schedule.productName.toLowerCase()
    );
    if (product) {
      const { mediaUrl, type } = getProductStatusMedia(product, schedule.mediaUrl);
      const priceText = product.price ? ` — ${product.price}` : '';
      const caption = schedule.caption?.trim()
        || `${product.name}${priceText}\n${product.description || ''}\n\n📦 Disponible maintenant ! Écris-moi pour commander.`;
      return { type: mediaUrl ? type : 'text', mediaUrl, caption };
    }
  }
  if (schedule.type === 'image' && schedule.mediaUrl) {
    return { type: 'image', mediaUrl: schedule.mediaUrl, caption: schedule.caption || '' };
  }
  // Fallback: statut texte
  return { type: 'text', mediaUrl: '', caption: schedule.caption || '', backgroundColor: schedule.backgroundColor };
}

/**
 * Vérifie si un schedule doit être publié maintenant
 */
function shouldPublishNow(schedule) {
  const now = new Date();
  const [h, m] = (schedule.sendTime || '09:00').split(':').map(Number);
  const nowH = now.getHours();
  const nowM = now.getMinutes();

  // On autorise une fenêtre de ±2 minutes autour de l'heure planifiée
  const scheduledMinutes = h * 60 + m;
  const nowMinutes = nowH * 60 + nowM;
  if (Math.abs(nowMinutes - scheduledMinutes) > 2) return false;

  if (schedule.scheduleType === 'daily') return true;

  if (schedule.scheduleType === 'weekly') {
    const today = now.getDay(); // 0=dim
    return (schedule.weekDays || []).includes(today);
  }

  return false;
}

/**
 * Cycle principal : publie les statuts planifiés
 */
const runStatusPublish = async () => {
  try {
    const schedules = await RitaStatusSchedule.find({ enabled: true }).lean();
    if (!schedules.length) return;

    const now = new Date();

    for (const schedule of schedules) {
      if (!shouldPublishNow(schedule)) continue;

      // Anti-doublon : ne pas renvoyer si déjà envoyé dans les 10 dernières minutes
      if (schedule.lastSentAt) {
        const minutesSinceLast = (now - new Date(schedule.lastSentAt)) / 60000;
        if (minutesSinceLast < 10) continue;
      }

      // Trouver l'instance WhatsApp
      const query = schedule.agentId
        ? { agentId: schedule.agentId }
        : { userId: schedule.userId };
      const config = await RitaConfig.findOne(query).lean();
      if (!config?.instanceId) continue;

      const instance = await WhatsAppInstance.findById(config.instanceId).lean();
      if (!instance?.instanceName || !instance?.instanceToken) continue;

      // Résoudre le contenu
      const content = await resolveStatusContent(schedule);
      if (!content.caption && !content.mediaUrl) continue;

      // Publier
      console.log(`📸 [STATUS CRON] Publication statut "${schedule.name}" pour userId=${schedule.userId}`);
      const result = await evolutionApiService.sendStatus(
        instance.instanceName,
        instance.instanceToken,
        { type: content.type, mediaUrl: content.mediaUrl, caption: content.caption, backgroundColor: schedule.backgroundColor }
      );

      if (result.success) {
        await RitaStatusSchedule.findByIdAndUpdate(schedule._id, {
          $set: { lastSentAt: now },
          $inc: { sentCount: 1 },
        });
        console.log(`✅ [STATUS CRON] Statut "${schedule.name}" publié`);
      } else {
        console.error(`❌ [STATUS CRON] Échec statut "${schedule.name}":`, result.error);
      }
    }
  } catch (err) {
    console.error('[STATUS CRON] Erreur cycle statuts:', err.message);
  }
};

/**
 * Démarre le cron de publication des statuts WhatsApp (toutes les minutes)
 */
export function startStatusCron() {
  if (statusCronJob) return;
  statusCronJob = cron.schedule('* * * * *', runStatusPublish);
  console.log('✅ [STATUS CRON] Service de statuts WhatsApp démarré');
}

export function stopStatusCron() {
  if (statusCronJob) {
    statusCronJob.stop();
    statusCronJob = null;
  }
}
