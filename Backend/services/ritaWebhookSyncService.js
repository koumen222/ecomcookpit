/**
 * Rita Webhook Auto-Sync Service
 * 
 * Assure que tous les webhooks Evolution API sont correctement configurés :
 * - Au démarrage du serveur (auto-reconnect)
 * - Périodiquement (health check toutes les 10 minutes)
 * 
 * Garantit que RITA fonctionne à 100% même après un redémarrage en production.
 */
import cron from 'node-cron';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import RitaConfig from '../models/RitaConfig.js';
import evolutionApiService from './evolutionApiService.js';

const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://api.scalor.net';
const WEBHOOK_PATH = '/api/ecom/v1/external/whatsapp/incoming';
const WEBHOOK_EVENTS = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];

let healthCheckCronJob = null;

/**
 * Configure le webhook sur une instance Evolution API
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function configureWebhookForInstance(instance) {
  const webhookUrl = `${WEBHOOK_BASE_URL}${WEBHOOK_PATH}`;
  try {
    const result = await evolutionApiService.setWebhook(
      instance.instanceName,
      instance.instanceToken,
      {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events: WEBHOOK_EVENTS,
      }
    );
    return result;
  } catch (err) {
    console.error(`❌ [WEBHOOK-SYNC] Erreur config webhook ${instance.instanceName}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Vérifie si le webhook d'une instance pointe vers la bonne URL
 * @returns {Promise<boolean>} true si le webhook est correctement configuré
 */
async function isWebhookCorrect(instance) {
  try {
    const result = await evolutionApiService.getWebhook(instance.instanceName, instance.instanceToken);
    if (!result.success) return false;

    const webhookUrl = `${WEBHOOK_BASE_URL}${WEBHOOK_PATH}`;
    const data = result.data;

    // Evolution API peut retourner la config dans différents formats
    const currentUrl = data?.webhook?.url || data?.url || data?.[0]?.webhook?.url || data?.[0]?.url || '';
    const isEnabled = data?.webhook?.enabled ?? data?.enabled ?? data?.[0]?.webhook?.enabled ?? false;

    return isEnabled && currentUrl === webhookUrl;
  } catch {
    return false;
  }
}

/**
 * Synchronise les webhooks pour toutes les instances actives avec RITA activé.
 * Appelé au démarrage du serveur et périodiquement.
 * 
 * @param {object} options
 * @param {boolean} options.force - Force la reconfiguration même si le webhook semble correct
 * @param {boolean} options.silent - Réduit les logs (pour les health checks périodiques)
 */
export async function syncAllWebhooks({ force = false, silent = false } = {}) {
  const label = force ? 'STARTUP' : 'HEALTH-CHECK';
  if (!silent) {
    console.log(`\n🔄 ═══════════════════════════════════════════════════`);
    console.log(`🔄 [${label}] Synchronisation webhooks Rita...`);
  }

  try {
    // Trouver toutes les configs Rita activées
    const enabledConfigs = await RitaConfig.find({ enabled: true }).lean();
    if (!enabledConfigs.length) {
      if (!silent) console.log(`ℹ️ [${label}] Aucune config Rita activée`);
      return { total: 0, configured: 0, skipped: 0, errors: 0 };
    }

    const userIds = enabledConfigs.map(c => c.userId);

    // Trouver toutes les instances WhatsApp actives de ces utilisateurs
    const instances = await WhatsAppInstance.find({
      userId: { $in: userIds },
      isActive: true,
    }).lean();

    if (!instances.length) {
      if (!silent) console.log(`ℹ️ [${label}] Aucune instance WhatsApp active`);
      return { total: 0, configured: 0, skipped: 0, errors: 0 };
    }

    if (!silent) {
      console.log(`🔄 [${label}] ${instances.length} instance(s) à vérifier pour ${enabledConfigs.length} utilisateur(s)`);
    }

    let configured = 0;
    let skipped = 0;
    let errors = 0;

    for (const inst of instances) {
      try {
        // Vérifier si le webhook est déjà correct (sauf en mode force)
        if (!force) {
          const correct = await isWebhookCorrect(inst);
          if (correct) {
            skipped++;
            continue;
          }
        }

        // Configurer/reconfigurer le webhook
        const result = await configureWebhookForInstance(inst);
        if (result.success) {
          configured++;
          console.log(`✅ [${label}] Webhook configuré: ${inst.instanceName} (user=${inst.userId})`);
        } else {
          errors++;
          console.error(`❌ [${label}] Échec webhook: ${inst.instanceName} — ${result.error}`);
        }
      } catch (err) {
        errors++;
        console.error(`❌ [${label}] Exception pour ${inst.instanceName}:`, err.message);
      }
    }

    const summary = { total: instances.length, configured, skipped, errors };
    if (!silent || configured > 0 || errors > 0) {
      console.log(`📊 [${label}] Résultat: ${configured} configuré(s), ${skipped} déjà OK, ${errors} erreur(s) sur ${instances.length} instance(s)`);
    }
    if (!silent) {
      console.log(`🔄 ═══════════════════════════════════════════════════\n`);
    }

    return summary;
  } catch (error) {
    console.error(`❌ [${label}] Erreur globale sync webhooks:`, error.message);
    return { total: 0, configured: 0, skipped: 0, errors: 1 };
  }
}

/**
 * Démarre le cron de health check des webhooks (toutes les 10 minutes)
 */
export function startWebhookHealthCheck() {
  if (healthCheckCronJob) {
    console.log('⚠️ [WEBHOOK-SYNC] Health check déjà démarré');
    return;
  }

  // Health check toutes les 10 minutes
  healthCheckCronJob = cron.schedule('*/10 * * * *', async () => {
    await syncAllWebhooks({ force: false, silent: true });
  });

  console.log('🔄 [WEBHOOK-SYNC] Health check démarré (toutes les 10 min)');
}

/**
 * Arrête le cron de health check
 */
export function stopWebhookHealthCheck() {
  if (healthCheckCronJob) {
    healthCheckCronJob.stop();
    healthCheckCronJob = null;
    console.log('🛑 [WEBHOOK-SYNC] Health check arrêté');
  }
}

/**
 * Initialisation complète au démarrage du serveur :
 * 1. Force la reconfiguration de tous les webhooks
 * 2. Démarre le health check périodique
 */
export async function initRitaWebhookSync() {
  console.log('🚀 [WEBHOOK-SYNC] Initialisation auto-sync webhooks Rita...');

  // Délai de 5 secondes pour laisser le serveur démarrer complètement
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Force sync au démarrage
  await syncAllWebhooks({ force: true, silent: false });

  // Démarrer le health check périodique
  startWebhookHealthCheck();

  console.log('✅ [WEBHOOK-SYNC] Rita webhook sync initialisé');
}
