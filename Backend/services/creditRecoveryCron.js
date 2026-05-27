/**
 * Credit Recovery Cron
 *
 * Garantit que TOUS les paiements crédits sont bien appliqués au workspace,
 * même si :
 *   - Le webhook MoneyFusion a échoué (network, downtime, signature)
 *   - L'utilisateur a fermé l'onglet juste après payer (polling stop)
 *   - Le serveur a crash entre le marquage 'paid' et le $inc workspace
 *
 * Fonctionne en 2 phases, toutes les 5 min :
 *
 *   PHASE A — "Paid but not credited"
 *   --------------------------------
 *   Trouve les payments avec status='paid' ET creditApplied=false
 *   → ce sont des paiements où on a planté entre les 2 updates.
 *   → ré-applique le crédit (idempotent via le flag creditApplied).
 *
 *   PHASE B — "Pending too long, check MoneyFusion"
 *   ----------------------------------------------
 *   Trouve les payments status='pending' créés il y a > 10 min.
 *   → Re-poll MoneyFusion pour récupérer le vrai statut.
 *   → Si payé selon MF mais pas chez nous → applique le crédit.
 *   → Si échec → marque failure.
 */

import axios from 'axios';
import GenerationPayment from '../models/GenerationPayment.js';
import EcomWorkspace from '../models/Workspace.js';

const MF_STATUS_URL = (token) => `https://www.pay.moneyfusion.net/paiementNotif/${token}`;
const POLL_INTERVAL_MS = 5 * 60 * 1000; // toutes les 5 min
const PENDING_MIN_AGE_MS = 10 * 60 * 1000; // ne re-poll que si pending > 10 min
const MAX_PENDING_AGE_MS = 7 * 24 * 60 * 60 * 1000; // arrête de poll après 7 j
const BATCH_SIZE = 20;

let cronTimer = null;
let isRunning = false;

// Versions locales des helpers (évite l'import circulaire avec billing.js)
async function reCreditGenerationPayment(payment) {
  try {
    if (payment.type === 'creative') {
      const workspace = await EcomWorkspace.findByIdAndUpdate(
        payment.workspaceId,
        { $inc: { creativeCreditsRemaining: payment.quantity } },
        { new: true }
      );
      if (!workspace) {
        await GenerationPayment.findByIdAndUpdate(payment._id, {
          $set: { lastCreditError: 'Workspace not found (recovery)' }
        });
        return false;
      }
      const finalState = await GenerationPayment.findOneAndUpdate(
        { _id: payment._id, creditApplied: { $ne: true } },
        { $set: { creditApplied: true, lastCreditError: '' }, $inc: { creditAttempts: 1 } },
        { new: true }
      );
      if (!finalState) {
        // Race : un autre process a appliqué entre temps → annuler notre inc
        await EcomWorkspace.findByIdAndUpdate(payment.workspaceId, {
          $inc: { creativeCreditsRemaining: -payment.quantity }
        });
        return false;
      }
      console.log(`[recovery] ✅ Re-credited ${payment.quantity} creative(s) → workspace ${workspace._id}`);
      return true;
    } else {
      const workspace = await EcomWorkspace.findByIdAndUpdate(
        payment.workspaceId,
        { $inc: { paidGenerationsRemaining: payment.quantity } },
        { new: true }
      );
      if (!workspace) {
        await GenerationPayment.findByIdAndUpdate(payment._id, {
          $set: { lastCreditError: 'Workspace not found (recovery)' }
        });
        return false;
      }
      const finalState = await GenerationPayment.findOneAndUpdate(
        { _id: payment._id, creditApplied: { $ne: true } },
        { $set: { creditApplied: true, lastCreditError: '' }, $inc: { creditAttempts: 1 } },
        { new: true }
      );
      if (!finalState) {
        await EcomWorkspace.findByIdAndUpdate(payment.workspaceId, {
          $inc: { paidGenerationsRemaining: -payment.quantity }
        });
        return false;
      }
      console.log(`[recovery] ✅ Re-credited ${payment.quantity} generation(s) → workspace ${workspace._id}`);
      return true;
    }
  } catch (err) {
    console.error(`[recovery] reCreditGenerationPayment error for ${payment._id}:`, err.message);
    await GenerationPayment.findByIdAndUpdate(payment._id, {
      $set: { lastCreditError: String(err.message || err).slice(0, 200) }
    });
    return false;
  }
}

async function runPhaseA() {
  // Paid but not credited — apply credit
  const stuck = await GenerationPayment.find({
    status: 'paid',
    creditApplied: { $ne: true },
  })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  if (stuck.length === 0) return 0;

  console.log(`[recovery] Phase A — ${stuck.length} paid-but-not-credited payment(s) found`);
  let recovered = 0;
  for (const p of stuck) {
    const ok = await reCreditGenerationPayment(p);
    if (ok) recovered++;
  }
  if (recovered > 0) console.log(`[recovery] Phase A — recovered ${recovered}/${stuck.length}`);
  return recovered;
}

async function runPhaseB() {
  // Pending too long — re-check MoneyFusion
  const cutoffOld = new Date(Date.now() - PENDING_MIN_AGE_MS);
  const cutoffTooOld = new Date(Date.now() - MAX_PENDING_AGE_MS);

  const stuck = await GenerationPayment.find({
    status: 'pending',
    createdAt: { $lt: cutoffOld, $gte: cutoffTooOld },
  })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE);

  if (stuck.length === 0) return 0;

  console.log(`[recovery] Phase B — ${stuck.length} pending payment(s) to re-check`);
  let updated = 0;
  for (const p of stuck) {
    try {
      const mfResp = await axios.get(MF_STATUS_URL(p.mfToken), { timeout: 10000 });
      const mfStatus = mfResp.data?.data?.statut;

      if (mfStatus === 'paid') {
        p.status = 'paid';
        if (!p.creditedAt) p.creditedAt = new Date();
        await p.save();
        await reCreditGenerationPayment(p);
        updated++;
      } else if (mfStatus === 'failure' || mfStatus === 'no paid') {
        p.status = mfStatus;
        await p.save();
        updated++;
      }
      // sinon : encore pending côté MF, on retentera dans 5 min
    } catch (err) {
      // Erreur réseau / token expiré → log et continue
      console.warn(`[recovery] Phase B — MF check failed for ${p._id}: ${err.message}`);
    }
  }
  if (updated > 0) console.log(`[recovery] Phase B — updated ${updated}/${stuck.length}`);
  return updated;
}

async function runCycle() {
  if (isRunning) {
    console.log('[recovery] Previous cycle still running, skipping');
    return;
  }
  isRunning = true;
  try {
    const a = await runPhaseA();
    const b = await runPhaseB();
    if (a + b > 0) {
      console.log(`[recovery] Cycle done — Phase A: ${a}, Phase B: ${b}`);
    }
  } catch (err) {
    console.error('[recovery] Cycle error:', err);
  } finally {
    isRunning = false;
  }
}

export function startCreditRecoveryCron() {
  if (cronTimer) return;
  console.log(`[recovery] 🔁 Credit recovery cron started (every ${POLL_INTERVAL_MS / 60000} min)`);
  // 1ère exécution 30 sec après le boot pour ne pas hit MongoDB pile au démarrage
  setTimeout(runCycle, 30_000);
  cronTimer = setInterval(runCycle, POLL_INTERVAL_MS);
}

export function stopCreditRecoveryCron() {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
    console.log('[recovery] Credit recovery cron stopped');
  }
}

// Export pour tests / déclenchement manuel
export { runCycle as runCreditRecoveryNow };
