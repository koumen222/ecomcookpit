/**
 * Script diagnostic pour simuler un message client entrant
 * Usage: node diag-rita-message.mjs [userId]
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import RitaConfig from './models/RitaConfig.js';
import { processIncomingMessage } from './services/ritaAgentService.js';

const TEST_USER_ID = process.argv[2];

await mongoose.connect(process.env.MONGODB_URI);
console.log('✅ MongoDB connecté');

// Trouver le premier userId disponible si pas fourni
let userId = TEST_USER_ID;
if (!userId) {
  const cfg = await RitaConfig.findOne({ enabled: true }).lean();
  if (!cfg) {
    const anyCfg = await RitaConfig.findOne({}).lean();
    if (!anyCfg) {
      console.error('❌ Aucune config Rita trouvée');
      process.exit(1);
    }
    userId = anyCfg.userId;
    console.log(`⚠️  Aucune config enabled=true, utilisation de userId=${userId} (enabled=${anyCfg.enabled})`);
  } else {
    userId = cfg.userId;
    console.log(`✅ Config trouvée: userId=${userId} (enabled=${cfg.enabled}, bossPhone=${cfg.bossPhone || '(vide)'})`);
  }
}

console.log(`\n🧪 Test processIncomingMessage pour userId=${userId}...`);
const testMessages = ['Bonjour', 'cc', 'bjr'];

for (const msg of testMessages) {
  console.log(`\n─── Message: "${msg}" ───`);
  try {
    const reply = await processIncomingMessage(userId, '22500000001@s.whatsapp.net', msg);
    if (reply) {
      console.log(`✅ Réponse: "${reply.substring(0, 200)}"`);
    } else {
      console.log(`❌ Pas de réponse (null retourné)`);
    }
  } catch (e) {
    console.error(`❌ Erreur exception:`, e.message);
  }
}

await mongoose.disconnect();
console.log('\n✅ Diagnostic terminé');
