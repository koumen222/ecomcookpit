/**
 * Rita Boss Report Service
 * Sends daily WhatsApp summary reports to the boss
 * and logs Rita's activity for the dashboard.
 */

import cron from 'node-cron';
import RitaConfig from '../models/RitaConfig.js';
import WhatsAppOrder from '../models/WhatsAppOrder.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import RitaActivity from '../models/RitaActivity.js';
import Workspace from '../models/Workspace.js';
import evolutionApiService from './evolutionApiService.js';

let dailyCronJob = null;
let isRunning = false;

/**
 * Log a Rita activity event (called from externalWhatsapp.js)
 */
export async function logRitaActivity(userId, type, data = {}) {
  try {
    await RitaActivity.create({ userId, type, ...data });
  } catch (err) {
    console.error(`⚠️ [RITA-LOG] Erreur log activité:`, err.message);
  }
}

/**
 * Build and send the daily summary for one user/instance
 */
async function sendDailySummary(ritaCfg) {
  let userId = ritaCfg.userId;
  const bossPhone = ritaCfg.bossPhone?.replace(/\D/g, '');
  if (!bossPhone) return;

  // Find the WhatsApp instance — prefer instanceId from config, fallback to userId lookup
  let instance = null;
  if (ritaCfg.instanceId) {
    instance = await WhatsAppInstance.findById(ritaCfg.instanceId).lean();
  }
  if (!instance && userId) {
    instance = await WhatsAppInstance.findOne({
      userId,
      isActive: true,
      status: { $in: ['connected', 'active'] }
    }).lean();
  }
  if (!instance) {
    console.log(`⏩ [RITA-REPORT] Pas d'instance active pour userId=${userId} / instanceId=${ritaCfg.instanceId}`);
    return;
  }

  // Resolve userId from workspace owner if missing (legacy per-agent configs)
  if (!userId && instance.workspaceId) {
    try {
      const ws = await Workspace.findById(instance.workspaceId).select('owner').lean();
      if (ws?.owner) userId = String(ws.owner);
    } catch { }
  }
  if (!userId) userId = instance.userId;
  if (!userId) {
    console.log(`⏩ [RITA-REPORT] Impossible de résoudre userId pour config ${ritaCfg._id}`);
    return;
  }

  // Get today's date range (Africa/Douala timezone)
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // Count today's activities
  const [activities, orders] = await Promise.all([
    RitaActivity.find({ userId, createdAt: { $gte: startOfDay } }).lean(),
    WhatsAppOrder.find({ userId, createdAt: { $gte: startOfDay } }).lean(),
  ]);

  const messagesReceived = activities.filter(a => a.type === 'message_received').length;
  const messagesReplied = activities.filter(a => a.type === 'message_replied').length;
  const uniqueClients = new Set(activities.filter(a => a.customerPhone).map(a => a.customerPhone)).size;
  const ordersConfirmed = orders.filter(o => o.status === 'pending' || o.status === 'accepted').length;
  const totalRevenue = orders.reduce((sum, o) => {
    const price = parseFloat(String(o.productPrice || '0').replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
    return sum + price;
  }, 0);
  const vocalsTranscribed = activities.filter(a => a.type === 'vocal_transcribed').length;
  const vocalsSent = activities.filter(a => a.type === 'vocal_sent').length;

  const dateStr = now.toLocaleDateString('fr-FR', { timeZone: 'Africa/Douala', weekday: 'long', day: 'numeric', month: 'long' });

  let report = `📊 *Rapport Rita — ${dateStr}*\n\n`;
  report += `💬 Messages reçus: *${messagesReceived}*\n`;
  report += `📤 Réponses envoyées: *${messagesReplied}*\n`;
  report += `👥 Clients uniques: *${uniqueClients}*\n`;

  if (vocalsTranscribed > 0) report += `🎤 Vocaux transcrits: *${vocalsTranscribed}*\n`;
  if (vocalsSent > 0) report += `🔊 Notes vocales envoyées: *${vocalsSent}*\n`;

  report += `\n📦 *Commandes du jour: ${ordersConfirmed}*\n`;

  if (orders.length > 0) {
    report += `💰 Chiffre d'affaires: *${totalRevenue.toLocaleString('fr-FR')} FCFA*\n\n`;
    // List orders
    orders.forEach((o, i) => {
      report += `${i + 1}. ${o.productName || 'Produit'} — ${o.customerName || 'Client'} (${o.customerCity || '?'}) — ${o.productPrice || '?'}\n`;
    });
  } else {
    report += `Aucune commande aujourd'hui.\n`;
  }

  report += `\n✨ _Rapport automatique généré par Rita_`;

  try {
    await evolutionApiService.sendMessage(
      instance.instanceName,
      instance.instanceToken,
      bossPhone,
      report
    );
    console.log(`✅ [RITA-REPORT] Rapport quotidien envoyé au boss ${bossPhone} (userId=${userId})`);
  } catch (err) {
    console.error(`❌ [RITA-REPORT] Erreur envoi rapport boss:`, err.message);
  }
}

/**
 * Run all daily reports (called by cron every minute, checks summaryTime match)
 */
async function runDailyReports() {
  if (isRunning) return;
  isRunning = true;

  try {
    // Get current time in Africa/Douala
    const now = new Date();
    const currentTime = now.toLocaleTimeString('fr-FR', {
      timeZone: 'Africa/Douala',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    // Find all configs where boss notifications + daily summary are enabled
    const configs = await RitaConfig.find({
      bossNotifications: true,
      dailySummary: true,
      bossPhone: { $ne: '' }
    }).lean();

    for (const cfg of configs) {
      const summaryTime = cfg.dailySummaryTime || '20:00';
      if (currentTime === summaryTime) {
        console.log(`📊 [RITA-REPORT] Envoi rapport pour userId=${cfg.userId}...`);
        await sendDailySummary(cfg);
      }
    }
  } catch (err) {
    console.error(`❌ [RITA-REPORT] Erreur cron rapport:`, err.message);
  } finally {
    isRunning = false;
  }
}

export function startBossReportCron() {
  if (dailyCronJob) dailyCronJob.stop();

  // Run every minute to check if it's time for any user's daily summary
  dailyCronJob = cron.schedule('* * * * *', runDailyReports, {
    scheduled: true,
    timezone: 'Africa/Douala'
  });

  console.log('✅ Cron rapport boss Rita démarré (vérification chaque minute)');
  return true;
}

export function stopBossReportCron() {
  if (dailyCronJob) {
    dailyCronJob.stop();
    dailyCronJob = null;
    console.log('⏹️ Cron rapport boss Rita arrêté');
  }
}
