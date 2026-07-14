// ─────────────────────────────────────────────────────────────────────────────
//  reportSchedulerService — génère automatiquement les rapports quotidiens de
//  chaque boutique à une heure fixe configurée (WorkspaceSettings.autoReportGeneration).
//  Calqué sur ritaBossReportService : cron chaque minute, on compare l'heure
//  locale de chaque boutique à son heure configurée. Réutilise le service
//  partagé generateDailyReports (même logique que la route /auto-generate).
// ─────────────────────────────────────────────────────────────────────────────
import cron from 'node-cron';
import WorkspaceSettings from '../models/WorkspaceSettings.js';
import Workspace from '../models/Workspace.js';
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
