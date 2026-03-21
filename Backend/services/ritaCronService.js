import cron from 'node-cron';
import RitaConfig from '../models/RitaConfig.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import evolutionApiService from './evolutionApiService.js';
import {
  getConversationsNeedingRelance,
  markRelanced,
  addRelanceToHistory,
  processIncomingMessage,
} from './ritaAgentService.js';

let relanceCronJob = null;
let isRunning = false;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Génère un message de relance via l'IA Rita (en passant par le system prompt)
 */
async function generateRelanceMessage(userId, from, relanceCount, history) {
  const relancePrompt = `[SYSTÈME] Le client n'a pas répondu depuis plusieurs heures. C'est la relance numéro ${relanceCount + 1}. Génère un message de relance naturel et chaleureux pour ramener le client dans la conversation. Ne sois pas insistant si c'est la 3ème relance.`;
  
  // Utiliser le moteur Rita normal pour générer la relance (respecte la config, le ton, etc.)
  const reply = await processIncomingMessage(userId, from, relancePrompt);
  return reply;
}

/**
 * Exécute le cycle de relance Rita
 */
const runRitaRelance = async () => {
  if (isRunning) {
    console.log('⚠️ [RITA CRON] Relance déjà en cours');
    return;
  }

  isRunning = true;

  try {
    // Récupérer toutes les configs Rita actives avec relance activée
    const configs = await RitaConfig.find({ enabled: true, followUpEnabled: true }).lean();

    if (!configs.length) {
      return;
    }

    let totalRelanced = 0;

    for (const config of configs) {
      const delayH = config.followUpDelay || 24;
      const maxRelances = config.followUpMaxRelances || 3;

      // Trouver les conversations de cet utilisateur qui nécessitent une relance
      const conversations = getConversationsNeedingRelance(delayH, maxRelances);
      const userConvs = conversations.filter(c => c.userId === config.userId);

      if (!userConvs.length) continue;

      // Trouver l'instance WhatsApp de cet utilisateur
      const instance = await WhatsAppInstance.findOne({
        userId: config.userId,
        isActive: true,
        ...(config.instanceId ? { instanceName: config.instanceId } : {}),
      }).lean();

      if (!instance) {
        console.log(`⚠️ [RITA CRON] Pas d'instance WhatsApp active pour userId=${config.userId}`);
        continue;
      }

      for (const conv of userConvs) {
        try {
          // Utiliser les messages pré-configurés si disponibles
          let relanceMsg = null;
          if (config.followUpRelanceMessages?.length > conv.relanceCount) {
            relanceMsg = config.followUpRelanceMessages[conv.relanceCount];
          } else if (conv.relanceCount === 0 && config.followUpMessage) {
            relanceMsg = config.followUpMessage;
          }

          // Sinon, générer via l'IA
          if (!relanceMsg) {
            relanceMsg = await generateRelanceMessage(conv.userId, conv.from, conv.relanceCount, conv.history);
          }

          if (!relanceMsg) continue;

          // Si c'est la dernière relance et il y a une offre spéciale
          if (conv.relanceCount === maxRelances - 1 && config.followUpOffer) {
            relanceMsg += `\n${config.followUpOffer}`;
          }

          // Envoyer le message via Evolution API
          const cleanFrom = conv.from.replace(/@s\.whatsapp\.net$/, '');
          console.log(`📤 [RITA CRON] Relance ${conv.relanceCount + 1}/${maxRelances} pour ${cleanFrom}`);

          const result = await evolutionApiService.sendMessage(
            instance.instanceName,
            instance.instanceToken,
            cleanFrom,
            relanceMsg,
            2,
            3000
          );

          if (result.success) {
            markRelanced(conv.userId, conv.from);
            addRelanceToHistory(conv.userId, conv.from, relanceMsg);
            totalRelanced++;
            console.log(`✅ [RITA CRON] Relance envoyée à ${cleanFrom}`);
          } else {
            console.error(`❌ [RITA CRON] Échec envoi relance à ${cleanFrom}:`, result.error);
          }

          // Délai entre les relances pour éviter le spam
          await sleep(5000);
        } catch (err) {
          console.error(`❌ [RITA CRON] Erreur relance ${conv.from}:`, err.message);
        }
      }
    }

    if (totalRelanced > 0) {
      console.log(`📊 [RITA CRON] ${totalRelanced} relance(s) envoyée(s)`);
    }
  } catch (error) {
    console.error('❌ [RITA CRON] Erreur globale:', error.message);
  } finally {
    isRunning = false;
  }
};

/**
 * Démarre le cron de relance Rita (toutes les 15 minutes)
 */
export function startRitaRelanceCron() {
  if (relanceCronJob) {
    console.log('⚠️ [RITA CRON] Déjà démarré');
    return;
  }

  relanceCronJob = cron.schedule('*/15 * * * *', runRitaRelance);
  console.log('🔄 [RITA CRON] Cron relance Rita démarré (toutes les 15 min)');
}

/**
 * Arrête le cron de relance Rita
 */
export function stopRitaRelanceCron() {
  if (relanceCronJob) {
    relanceCronJob.stop();
    relanceCronJob = null;
    console.log('⏹️ [RITA CRON] Cron relance Rita arrêté');
  }
}
