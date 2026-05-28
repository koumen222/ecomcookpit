/**
 * Migration ONE-SHOT — à exécuter UNE SEULE FOIS après déploiement du fix.
 *
 * Objectif : marquer tous les paiements historiques `status=paid` comme
 * `creditApplied=true` pour éviter que le cron recovery les recrédite en double.
 *
 * Usage :
 *   node Backend/scripts/migrate-credit-applied.js
 *
 * Idempotent : peut être ré-exécuté sans effet (filter creditApplied != true).
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import GenerationPayment from '../models/GenerationPayment.js';

async function main() {
  await connectDB();
  console.log('[migration] Connected to MongoDB');

  // On considère que tous les paiements actuellement `paid` ont DÉJÀ été crédités
  // (puisque jusqu'à présent c'était le contrat de l'app). On les marque tous
  // comme creditApplied=true pour que le cron recovery ne les retraite pas.
  const result = await GenerationPayment.updateMany(
    { status: 'paid', creditApplied: { $ne: true } },
    { $set: { creditApplied: true } }
  );

  console.log(`[migration] ✅ Marked ${result.modifiedCount} historical paid payments as creditApplied=true`);

  await mongoose.disconnect();
  console.log('[migration] Done');
  process.exit(0);
}

main().catch(err => {
  console.error('[migration] Failed:', err);
  process.exit(1);
});
