/**
 * fixStoreOrderPriceQuantity.js
 *
 * Corrige les commandes du STORE SCALOR (source 'skelor') créées avec l'ancien
 * mapping « quantity: 1, price: total livraison incluse » :
 *   - la quantité réelle était perdue (coût produit sous-estimé, logistique fausse)
 *   - le CA produit était gonflé des frais de livraison
 *
 * Recalcul depuis la StoreOrder liée (source de vérité : products[].quantity,
 * total, deliveryCost) :
 *   quantity = somme des unités réelles
 *   price    = (total − deliveryCost) / quantity   (prix unitaire, offres incluses)
 *
 * Critère de correction SÛR : on ne touche une Order QUE si
 *   quantity === 1  ET  price === storeOrder.total  (preuve de l'ancien mapping).
 *
 * Usage :
 *   node Backend/scripts/fixStoreOrderPriceQuantity.js           # simulation
 *   node Backend/scripts/fixStoreOrderPriceQuantity.js --apply   # applique
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

import Order from '../models/Order.js';
import StoreOrder from '../models/StoreOrder.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log(`🔌 Connecté — mode ${APPLY ? 'APPLICATION' : 'SIMULATION (ajoute --apply pour corriger)'}\n`);

  const candidates = await Order.find({
    source: 'skelor',
    quantity: 1,
    storeOrderId: { $exists: true, $ne: null },
  }).select('_id orderId workspaceId price quantity storeOrderId createdAt').lean();

  let fixed = 0, skipped = 0, missing = 0;
  for (const o of candidates) {
    const so = await StoreOrder.findById(o.storeOrderId)
      .select('total deliveryCost products').lean();
    if (!so) { missing++; continue; }

    const total = Number(so.total) || 0;
    // Preuve de l'ancien mapping : le prix stocké est exactement le total.
    if (!(total > 0) || Math.abs(o.price - total) > 0.001) { skipped++; continue; }

    const units = Math.max(1, (so.products || []).reduce((s, p) => s + Math.max(1, Number(p.quantity) || 1), 0));
    if (units === 1) { skipped++; continue; } // qty 1 : price=total reste juste (hors livraison ci-dessous ? non : on ne touche pas, comportement identique)

    const productsAmount = Math.max(0, total - (Number(so.deliveryCost) || 0));
    const unit = productsAmount / units;
    console.log(
      `${APPLY ? '✏️' : '👀'} #${o.orderId || o._id} (ws ${String(o.workspaceId).slice(-6)}, ${o.createdAt?.toISOString?.()?.slice(0, 10) || '—'}) ` +
      `qté 1→${units} : price ${o.price} → ${unit.toFixed(2)} (produits ${productsAmount}${so.deliveryCost ? ` + livraison ${so.deliveryCost}` : ''})`
    );
    if (APPLY) {
      await Order.updateOne({ _id: o._id }, { $set: { price: unit, quantity: units } });
    }
    fixed++;
  }

  console.log(`\n📊 ${candidates.length} commandes store examinées — ${fixed} ${APPLY ? 'corrigées' : 'À corriger'}, ${skipped} déjà justes, ${missing} sans StoreOrder liée.`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
