/**
 * fixWebhookPriceQuantity.js
 *
 * Corrige les commandes WEBHOOK dont le prix stocké est le TOTAL de commande
 * (déjà × quantité côté expéditeur) au lieu du prix UNITAIRE — ce qui faisait
 * compter la quantité deux fois dans le CA (qté 3 → ×9).
 *
 * Critère de correction SÛR (aucune devinette) :
 *   - source: 'webhook'
 *   - quantity > 1
 *   - price === rawData.originalPayload.totalPrice  (le total a été stocké tel quel)
 *   → nouveau price = totalPrice / quantity
 *
 * Les commandes où price ≠ totalPrice (déjà corrigées, ou payload différent)
 * ne sont PAS touchées.
 *
 * Usage :
 *   node Backend/scripts/fixWebhookPriceQuantity.js           # simulation (dry-run)
 *   node Backend/scripts/fixWebhookPriceQuantity.js --apply   # applique
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

import Order from '../models/Order.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log(`🔌 Connecté — mode ${APPLY ? 'APPLICATION' : 'SIMULATION (ajoute --apply pour corriger)'}\n`);

  const candidates = await Order.find({
    source: 'webhook',
    quantity: { $gt: 1 },
    price: { $gt: 0 },
  }).select('_id orderId workspaceId price quantity rawData createdAt').lean();

  let fixed = 0, skipped = 0;
  for (const o of candidates) {
    const totalPrice = Number(o.rawData?.originalPayload?.totalPrice) || 0;
    // Sécurité : on ne corrige QUE si le prix stocké est exactement le total
    // du payload d'origine (preuve que la division n'a jamais été faite).
    if (!(totalPrice > 0) || Math.abs(o.price - totalPrice) > 0.001) { skipped++; continue; }

    const unit = totalPrice / o.quantity;
    console.log(
      `${APPLY ? '✏️' : '👀'} #${o.orderId || o._id} (ws ${String(o.workspaceId).slice(-6)}, ${o.createdAt?.toISOString?.()?.slice(0, 10) || '—'}) ` +
      `qté ${o.quantity} : price ${o.price} → ${unit.toFixed(2)} (total inchangé : ${totalPrice})`
    );
    if (APPLY) {
      await Order.updateOne({ _id: o._id }, { $set: { price: unit } });
    }
    fixed++;
  }

  console.log(`\n📊 ${candidates.length} commandes webhook qté>1 examinées — ${fixed} ${APPLY ? 'corrigées' : 'À corriger'}, ${skipped} laissées telles quelles.`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
