/**
 * Downgrade all accounts with an active subscription warning to the free plan,
 * publish an in-app announcement, and disable plan promos.
 *
 * Usage:
 *   node Backend/scripts/downgradeAlertedAccountsToFree.js
 *   node Backend/scripts/downgradeAlertedAccountsToFree.js --execute
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

if (!process.env.MONGO_URI && process.env.MONGODB_URI) {
  process.env.MONGO_URI = process.env.MONGODB_URI;
}

import Workspace from '../models/Workspace.js';
import PlanConfig from '../models/PlanConfig.js';
import { DOWNGRADED_TO_FREE_MESSAGE, downgradeWorkspaceToFree } from '../services/workspacePlanService.js';

const shouldExecute = process.argv.includes('--execute');

async function main() {
  try {
    console.log(`\n🚀 downgradeAlertedAccountsToFree (${shouldExecute ? 'EXECUTE' : 'DRY-RUN'})\n`);

    const { connectDB } = await import('../config/database.js');
    await connectDB();
    console.log('✅ Connecté à MongoDB\n');

    await PlanConfig.seedDefaults();

    const workspaces = await Workspace.find({ 'subscriptionWarning.active': true })
      .select('name plan planExpiresAt subscriptionWarning')
      .sort({ createdAt: -1 });

    console.log(`📊 ${workspaces.length} workspace(s) avec alerte abonnement active\n`);

    for (const workspace of workspaces) {
      const alreadyDowngraded = workspace.plan === 'free'
        && workspace.subscriptionWarning?.variant === 'downgraded'
        && workspace.subscriptionWarning?.message === DOWNGRADED_TO_FREE_MESSAGE;

      console.log(`• ${workspace.name} (${workspace._id})`);
      console.log(`  Plan actuel: ${workspace.plan}`);
      console.log(`  Message actuel: ${workspace.subscriptionWarning?.message || '—'}`);

      if (!shouldExecute) {
        console.log(`  Action prévue: ${alreadyDowngraded ? 'aucun changement' : 'passage au plan gratuit + annonce'}\n`);
        continue;
      }

      if (alreadyDowngraded) {
        console.log('  ✅ Déjà aligné\n');
        continue;
      }

      await downgradeWorkspaceToFree(workspace, {
        reason: 'active_subscription_warning_bulk',
        createSystemNotification: true
      });

      console.log('  ✅ Plan gratuit appliqué et annonce créée\n');
    }

    const promoPatch = {
      $set: {
        promoActive: false,
        promoExpiresAt: null
      }
    };

    if (shouldExecute) {
      const promoResult = await PlanConfig.updateMany({ key: { $in: ['starter', 'pro', 'ultra'] } }, promoPatch);
      console.log(`💳 Promos désactivées sur ${promoResult.modifiedCount} plan(s)\n`);
    } else {
      console.log('💳 Action prévue sur les plans: désactiver promoActive et vider promoExpiresAt\n');
    }

    await mongoose.disconnect();
    console.log('✅ Déconnecté de MongoDB');
    console.log(`🏁 Script terminé (${shouldExecute ? 'modifications appliquées' : 'aucune modification appliquée'})\n`);
  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore disconnect errors
    }
    process.exit(1);
  }
}

main();