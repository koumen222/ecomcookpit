import cron from 'node-cron';
import AgentConversation from '../models/AgentConversation.js';
import {
  getConversationsNeedingRelance,
  deactivateStaleConversations
} from './agentService.js';
import {
  sendRelanceMessage,
  initAgentWhatsapp
} from './agentWhatsappService.js';

let relanceCronJob = null;
let cleanupCronJob = null;
let isRelanceRunning = false;
let isCleanupRunning = false;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runRelanceCron = async () => {
  if (isRelanceRunning) {
    console.log('⚠️ Relance déjà en cours, ignoré');
    return;
  }

  isRelanceRunning = true;
  console.log('🔄 Démarrage cron relance agent...');

  try {
    const conversations = await getConversationsNeedingRelance();

    if (conversations.length === 0) {
      console.log('✅ Aucune conversation à relancer');
      return;
    }

    console.log(`📤 ${conversations.length} conversation(s) à relancer`);

    let successCount = 0;
    let errorCount = 0;

    for (const conv of conversations) {
      try {
        console.log(`📱 Relance conversation ${conv._id} (client: ${conv.clientPhone})`);
        
        const result = await sendRelanceMessage(conv);
        
        if (result.success) {
          successCount++;
          console.log(`✅ Relance ${result.relanceNumber} envoyée pour ${conv.clientPhone}`);
        } else {
          errorCount++;
          console.log(`❌ Échec relance pour ${conv.clientPhone}`);
        }

        await sleep(10000);
      } catch (error) {
        errorCount++;
        console.error(`❌ Erreur relance ${conv._id}:`, error.message);
      }
    }

    console.log(`📊 Relances terminées: ${successCount} succès, ${errorCount} échecs`);
  } catch (error) {
    console.error('❌ Erreur cron relance:', error.message);
  } finally {
    isRelanceRunning = false;
  }
};

const runCleanupCron = async () => {
  if (isCleanupRunning) {
    console.log('⚠️ Nettoyage déjà en cours, ignoré');
    return;
  }

  isCleanupRunning = true;
  console.log('🧹 Démarrage cron nettoyage conversations...');

  try {
    const deactivatedCount = await deactivateStaleConversations();
    
    if (deactivatedCount > 0) {
      console.log(`🧹 ${deactivatedCount} conversation(s) désactivée(s)`);
    } else {
      console.log('✅ Aucune conversation à nettoyer');
    }
  } catch (error) {
    console.error('❌ Erreur cron nettoyage:', error.message);
  } finally {
    isCleanupRunning = false;
  }
};

const startAgentCronJobs = () => {
  const whatsappReady = initAgentWhatsapp();
  
  if (!whatsappReady) {
    // WhatsApp agent non configuré globalement, cron jobs non démarrés
    return false;
  }

  if (relanceCronJob) {
    relanceCronJob.stop();
  }
  if (cleanupCronJob) {
    cleanupCronJob.stop();
  }

  relanceCronJob = cron.schedule('*/5 * * * *', runRelanceCron, {
    scheduled: true,
    timezone: 'Africa/Douala'
  });

  cleanupCronJob = cron.schedule('0 * * * *', runCleanupCron, {
    scheduled: true,
    timezone: 'Africa/Douala'
  });

  console.log('✅ Cron jobs agent vendeur démarrés:');
  console.log('   - Relances: toutes les 5 minutes');
  console.log('   - Nettoyage: toutes les heures');

  return true;
};

const stopAgentCronJobs = () => {
  if (relanceCronJob) {
    relanceCronJob.stop();
    relanceCronJob = null;
    console.log('⏹️ Cron relance arrêté');
  }

  if (cleanupCronJob) {
    cleanupCronJob.stop();
    cleanupCronJob = null;
    console.log('⏹️ Cron nettoyage arrêté');
  }
};

const getAgentCronStatus = () => {
  return {
    relance: {
      running: relanceCronJob !== null,
      busy: isRelanceRunning
    },
    cleanup: {
      running: cleanupCronJob !== null,
      busy: isCleanupRunning
    }
  };
};

const triggerRelanceManually = async () => {
  console.log('🔧 Relance manuelle déclenchée');
  await runRelanceCron();
};

const triggerCleanupManually = async () => {
  console.log('🔧 Nettoyage manuel déclenché');
  await runCleanupCron();
};

export {
  startAgentCronJobs,
  stopAgentCronJobs,
  getAgentCronStatus,
  triggerRelanceManually,
  triggerCleanupManually,
  runRelanceCron,
  runCleanupCron
};
