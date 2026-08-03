/**
 * KPay routes — webhook public de notification de paiement.
 *
 *   POST /api/ecom/kpay/webhook — reçu sur changement de statut (payment.*)
 *
 * Sécurité (règle d'or KPay) : on ne marque JAMAIS une commande payée sur la
 * seule foi du webhook. Ordre de vérification :
 *   1. Signature HMAC (X-KPAY-Signature sur corps brut) si le marchand a
 *      renseigné son webhookSecret — rejet si invalide.
 *   2. Confirmation systématique via GET /api/v1/payments/:id avec LES CLÉS
 *      DU MARCHAND — le statut retourné par l'API fait foi.
 * Idempotent : une commande déjà payée n'est pas retraitée.
 */
import express from 'express';
import StoreOrder from '../models/StoreOrder.js';
import Order from '../models/Order.js';
import {
  resolveKpayConfigForOrder,
  verifyKpayWebhookSignature,
  getKpayPayment
} from '../services/kpayService.js';

const router = express.Router();

/**
 * Billing plateforme payé via KPay (abonnements + crédits) : le paymentId KPay
 * est stocké dans mfToken (provider='kpay'). Vérifie la signature avec le
 * webhookSecret PLATEFORME si défini, puis confirme via l'API avant d'activer.
 */
async function handleBillingKpayEvent(paymentId, rawBody, signatureHeader) {
  if (!paymentId) return false;

  const { default: PlanPayment } = await import('../models/PlanPayment.js');
  const { default: GenerationPayment } = await import('../models/GenerationPayment.js');

  let payment = await PlanPayment.findOne({ mfToken: paymentId, provider: 'kpay' });
  let isGeneration = false;
  if (!payment) {
    payment = await GenerationPayment.findOne({ mfToken: paymentId, provider: 'kpay' });
    isGeneration = !!payment;
  }
  if (!payment) return false;
  if (payment.status === 'paid') return true; // idempotence

  const { getPlatformKpayConfig } = await import('../services/kpayService.js');
  const cfg = await getPlatformKpayConfig();
  if (!cfg) {
    console.warn('[kpay/webhook] billing: config plateforme KPay absente');
    return true;
  }

  const sigOk = verifyKpayWebhookSignature(rawBody, signatureHeader, cfg.kpayWebhookSecret);
  if (sigOk === false) {
    console.warn(`[kpay/webhook] billing: signature invalide (${paymentId}) — ignoré`);
    return true;
  }

  const kp = await getKpayPayment(cfg, paymentId);
  if (kp.status === 'COMPLETED') {
    const { applyPlanPayment, applyCreditPayment } = await import('./billing.js');
    if (isGeneration) {
      await applyCreditPayment(payment);
    } else {
      await applyPlanPayment(payment);
    }
    console.log(`✅ [kpay/webhook] billing ${isGeneration ? 'crédits' : 'plan'} payé (${paymentId})`);
  } else if (kp.status === 'FAILED' || kp.status === 'CANCELLED') {
    payment.status = 'failure';
    await payment.save();
    console.log(`⚠️ [kpay/webhook] billing ${paymentId} → ${kp.status}`);
  }
  return true;
}

router.post('/webhook', async (req, res) => {
  // ACK immédiat (KPay retry sur non-2xx / timeout 3 s)
  res.status(200).json({ received: true });

  try {
    const evt = req.body || {};
    const { paymentId, externalId, event, status } = evt;
    if (!paymentId && !externalId) {
      console.warn('[kpay/webhook] payload sans paymentId/externalId');
      return;
    }

    // Retrouver la commande boutique : par paymentId stocké à l'init, sinon externalId (= _id de la StoreOrder)
    let order = null;
    if (paymentId) order = await StoreOrder.findOne({ kpayPaymentId: paymentId });
    if (!order && externalId) {
      const cleanId = String(externalId).split('-')[0];
      if (/^[0-9a-fA-F]{24}$/.test(cleanId)) order = await StoreOrder.findById(cleanId);
    }
    if (!order) {
      // Pas une commande boutique → peut-être un paiement billing plateforme (plan/crédits)
      const handled = await handleBillingKpayEvent(paymentId, req.rawBody, req.headers['x-kpay-signature']);
      if (!handled) {
        console.warn(`[kpay/webhook] paiement inconnu (paymentId=${paymentId} externalId=${externalId})`);
      }
      return;
    }
    if (order.paymentStatus === 'paid') return; // idempotence

    const cfg = await resolveKpayConfigForOrder(order);
    if (!cfg) {
      console.warn(`[kpay/webhook] config KPay absente pour la commande ${order.orderNumber}`);
      return;
    }

    // 1) Signature (si secret configuré côté marchand)
    const sigOk = verifyKpayWebhookSignature(
      req.rawBody,
      req.headers['x-kpay-signature'],
      cfg.kpayWebhookSecret
    );
    if (sigOk === false) {
      console.warn(`[kpay/webhook] signature invalide pour ${order.orderNumber} — ignoré`);
      return;
    }

    // 2) Confirmation par l'API avec les clés du marchand (source de vérité)
    const payment = await getKpayPayment(cfg, order.kpayPaymentId || paymentId);
    const confirmed = payment?.status;

    if (confirmed === 'COMPLETED') {
      order.paymentStatus = 'paid';
      order.paidAt = payment.completedAt ? new Date(payment.completedAt) : new Date();
      order.kpayReference = payment.reference || order.kpayReference;
      await order.save();

      // Refléter sur la commande interne liée (dashboard/closeuses)
      if (order.linkedOrderId) {
        await Order.updateOne(
          { _id: order.linkedOrderId },
          { $set: { paymentStatus: 'paid' } }
        ).catch(() => {});
      }
      console.log(`✅ [kpay/webhook] ${order.orderNumber} payé (${payment.amount} ${payment.currency}, ${payment.provider || 'kpay'})`);
    } else if (confirmed === 'FAILED' || confirmed === 'CANCELLED') {
      order.paymentStatus = 'failed';
      await order.save();
      console.log(`⚠️ [kpay/webhook] ${order.orderNumber} → ${confirmed}${payment.failureReason ? ` (${payment.failureReason})` : ''}`);
    } else {
      console.log(`[kpay/webhook] ${order.orderNumber} → ${confirmed || event || status} (non terminal, ignoré)`);
    }
  } catch (err) {
    console.error('[kpay/webhook] error:', err.message);
  }
});

export default router;
