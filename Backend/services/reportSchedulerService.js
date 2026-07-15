// ─────────────────────────────────────────────────────────────────────────────
//  reportSchedulerService — génère automatiquement les rapports quotidiens de
//  chaque boutique à une heure fixe configurée (WorkspaceSettings.autoReportGeneration).
//  Calqué sur ritaBossReportService : cron chaque minute, on compare l'heure
//  locale de chaque boutique à son heure configurée. Réutilise le service
//  partagé generateDailyReports (même logique que la route /auto-generate).
// ─────────────────────────────────────────────────────────────────────────────
import cron from 'node-cron';
import mongoose from 'mongoose';
import WorkspaceSettings from '../models/WorkspaceSettings.js';
import Workspace from '../models/Workspace.js';
import DailyReport from '../models/DailyReport.js';
import { generateDailyReports } from './reportGenerationService.js';

let cronJob = null;
let isRunning = false;

// 'HH:MM' (24h) dans le fuseau donné
function nowHMInTz(tz) {
  return new Date().toLocaleTimeString('fr-FR', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// 'YYYY-MM-DD' du jour courant dans le fuseau donné
function dateKeyInTz(tz) {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz }); // en-CA → YYYY-MM-DD
}

// Décale une clé 'YYYY-MM-DD' de deltaDays jours
function shiftDateKey(key, deltaDays) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().split('T')[0];
}

// Agrège les totaux d'un jour depuis les DailyReport fraîchement générés
async function buildDaySummary(workspaceId, dateKey) {
  const dayStart = new Date(`${dateKey}T00:00:00.000Z`);
  const dayEnd = new Date(`${dateKey}T23:59:59.999Z`);
  const agg = await DailyReport.aggregate([
    { $match: { workspaceId: new mongoose.Types.ObjectId(workspaceId), date: { $gte: dayStart, $lte: dayEnd } } },
    { $group: {
      _id: null,
      delivered: { $sum: { $ifNull: ['$ordersDelivered', 0] } },
      revenue: { $sum: { $ifNull: ['$revenue', 0] } },
      cost: { $sum: { $ifNull: ['$cost', 0] } },
      profit: { $sum: { $ifNull: ['$profit', 0] } },
    }}
  ]);
  return agg[0] || { delivered: 0, revenue: 0, cost: 0, profit: 0 };
}

function formatReportMessage(dateKey, t) {
  const f = (n) => Math.round(n || 0).toLocaleString('fr-FR');
  const margin = t.revenue > 0 ? Math.round((t.profit / t.revenue) * 100) : 0;
  return `📊 *Rapport du ${dateKey}*\n\n`
    + `📦 Commandes livrées : *${t.delivered}*\n`
    + `💰 Chiffre d'affaires : *${f(t.revenue)} FCFA*\n`
    + `💸 Coûts : *${f(t.cost)} FCFA*\n`
    + `✅ Bénéfice net : *${t.profit >= 0 ? '+' : ''}${f(t.profit)} FCFA*  (${margin}% marge)\n\n`
    + `_Généré automatiquement par Scalor_`;
}

// Envoie le rapport à un numéro WhatsApp via l'instance hôte de la boutique
async function sendReportWhatsApp({ workspaceId, userId, number, message }) {
  const phone = String(number || '').replace(/\D/g, '');
  if (!phone) return;
  try {
    const { default: WhatsAppInstance } = await import('../models/WhatsAppInstance.js');
    const { default: evolutionApiService } = await import('./evolutionApiService.js');
    const statusFilter = { $in: ['connected', 'active'] };
    let instance = await WhatsAppInstance.findOne({ workspaceId, usageType: 'host', isActive: true, status: statusFilter }).lean();
    if (!instance && userId) instance = await WhatsAppInstance.findOne({ userId, usageType: 'host', isActive: true, status: statusFilter }).lean();
    if (!instance && userId) instance = await WhatsAppInstance.findOne({ userId, isActive: true, status: statusFilter }).lean();
    if (!instance) { console.log(`⏩ [AUTO-REPORT] pas d'instance WhatsApp active pour ws=${workspaceId}`); return; }
    await evolutionApiService.sendMessage(instance.instanceName, instance.instanceToken, phone, message);
    console.log(`📤 [AUTO-REPORT] rapport envoyé sur WhatsApp à ${phone}`);
  } catch (e) {
    console.error('❌ [AUTO-REPORT] envoi WhatsApp:', e.message);
  }
}

async function runDue() {
  if (isRunning) return;
  isRunning = true;
  try {
    const configs = await WorkspaceSettings.find({ 'autoReportGeneration.enabled': true })
      .select('workspaceId autoReportGeneration')
      .lean();

    for (const cfg of configs) {
      const auto = cfg.autoReportGeneration || {};
      const tz = auto.timezone || 'Africa/Douala';
      const time = auto.time || '21:00';

      // Ne s'exécute qu'à la minute exacte configurée
      if (nowHMInTz(tz) !== time) continue;

      const todayKey = dateKeyInTz(tz);
      // Anti-doublon : un seul run par jour local
      if (auto.lastRunKey === todayKey) continue;

      const targetKey = auto.target === 'yesterday' ? shiftDateKey(todayKey, -1) : todayKey;

      // userId propriétaire pour reportedBy (best-effort)
      let userId = null;
      try {
        const ws = await Workspace.findById(cfg.workspaceId).select('owner').lean();
        userId = ws?.owner || null;
      } catch { /* noop */ }

      try {
        const result = await generateDailyReports({
          workspaceId: String(cfg.workspaceId),
          userId,
          date: targetKey,
        });
        const created = result?.created?.length || 0;
        const updated = result?.updated?.length || 0;
        console.log(`🕒 [AUTO-REPORT] ws=${cfg.workspaceId} ${targetKey} → ${created} créé(s), ${updated} màj`);

        if (created + updated > 0) {
          try {
            const { sendPushNotification } = await import('./pushService.js');
            await sendPushNotification(String(cfg.workspaceId), {
              title: '🕒 Rapport du jour généré',
              body: `${created + updated} rapport(s) automatique(s) pour le ${targetKey}`,
              tag: 'auto-report',
              data: { type: 'auto_report', url: '/ecom/reports' },
            }, 'push_new_orders');
          } catch { /* push best-effort */ }
        }

        // Envoi WhatsApp du rapport si un numéro est configuré
        if (auto.whatsappNumber) {
          const totals = await buildDaySummary(cfg.workspaceId, targetKey);
          await sendReportWhatsApp({
            workspaceId: cfg.workspaceId,
            userId,
            number: auto.whatsappNumber,
            message: formatReportMessage(targetKey, totals),
          });
        }
      } catch (e) {
        console.error(`❌ [AUTO-REPORT] ws=${cfg.workspaceId}:`, e.message);
      } finally {
        // On marque le run (même en cas d'échec) pour éviter de boucler dans la minute
        await WorkspaceSettings.updateOne(
          { _id: cfg._id },
          { $set: { 'autoReportGeneration.lastRunAt': new Date(), 'autoReportGeneration.lastRunKey': todayKey } }
        ).catch(() => {});
      }
    }
  } catch (e) {
    console.error('❌ [AUTO-REPORT] cron erreur:', e.message);
  } finally {
    isRunning = false;
  }
}

export function startReportScheduler() {
  if (cronJob) cronJob.stop();
  cronJob = cron.schedule('* * * * *', runDue, { scheduled: true });
  console.log('✅ Cron génération auto des rapports démarré (vérification chaque minute)');
  return true;
}

export function stopReportScheduler() {
  if (cronJob) { cronJob.stop(); cronJob = null; }
}

export default { startReportScheduler, stopReportScheduler };
