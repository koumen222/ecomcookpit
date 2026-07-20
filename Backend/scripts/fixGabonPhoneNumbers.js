/**
 * fixGabonPhoneNumbers.js
 *
 * Répare les numéros gabonais (+241) enregistrés SANS le 0 initial.
 *
 * Contexte : au Gabon, le 0 initial FAIT PARTIE du numéro international
 * (+241 06 XX XX XX). L'ancien code du checkout retirait ce 0 (« +2416123456 »)
 * → numéros injoignables en appel comme sur WhatsApp. Le code est corrigé ;
 * ce script répare les données déjà en base.
 *
 * Règle de réparation (identique à normalizePhone / formatInternationalPhone) :
 *   préfixe 241 + partie nationale de 7-8 chiffres ne commençant pas par 0
 *   → insérer le 0 : 241 6123456 → 241 06123456
 *
 * Collections traitées :
 *   - StoreOrder.phone                      (commandes storefront)
 *   - Order.clientPhone / clientPhoneNormalized
 *   - Client.phone / phoneNormalized
 *
 * Usage :
 *   node Backend/scripts/fixGabonPhoneNumbers.js           # simulation (dry-run)
 *   node Backend/scripts/fixGabonPhoneNumbers.js --apply   # applique les corrections
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');

// « +2416123456 », « 2416123456 », avec espaces éventuels — national 7-8
// chiffres ne commençant PAS par 0.
function repairGabonPhone(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  const digits = value.replace(/[^\d]/g, '');
  if (!digits.startsWith('241')) return null;
  const national = digits.substring(3);
  if (!national || national.startsWith('0')) return null;
  if (national.length < 7 || national.length > 8) return null;
  const repairedDigits = `2410${national}`;
  // Conserver le style d'origine (+ initial ou non)
  return value.startsWith('+') ? `+${repairedDigits}` : repairedDigits;
}

async function processCollection({ model, fields, label }) {
  const orConditions = fields.map((f) => ({ [f]: { $regex: '^\\+?241[1-9]' } }));
  const docs = await model.find({ $or: orConditions }).select(fields.join(' ')).lean();

  let repaired = 0;
  for (const doc of docs) {
    const updates = {};
    for (const field of fields) {
      const fixed = repairGabonPhone(doc[field]);
      if (fixed && fixed !== doc[field]) updates[field] = fixed;
    }
    if (Object.keys(updates).length === 0) continue;
    repaired++;
    if (APPLY) {
      await model.updateOne({ _id: doc._id }, { $set: updates });
    } else if (repaired <= 10) {
      console.log(`  [dry-run] ${label} ${doc._id}:`, updates);
    }
  }
  console.log(`${APPLY ? '✅' : '🔍'} ${label}: ${repaired} document(s) ${APPLY ? 'corrigé(s)' : 'à corriger'} sur ${docs.length} candidat(s)`);
  return repaired;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI manquant dans Backend/.env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log(`🔌 Connecté. Mode : ${APPLY ? 'APPLICATION' : 'SIMULATION (ajouter --apply pour corriger)'}\n`);

  const { default: StoreOrder } = await import('../models/StoreOrder.js');
  const { default: Order } = await import('../models/Order.js');
  const { default: Client } = await import('../models/Client.js');

  let total = 0;
  total += await processCollection({ model: StoreOrder, fields: ['phone'], label: 'StoreOrder' });
  total += await processCollection({ model: Order, fields: ['clientPhone', 'clientPhoneNormalized'], label: 'Order' });
  total += await processCollection({ model: Client, fields: ['phone', 'phoneNormalized'], label: 'Client' });

  console.log(`\n${APPLY ? '✅ Terminé' : '🔍 Simulation terminée'} — ${total} document(s) concerné(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
