/**
 * Billing routes — MoneyFusion payment integration for plan upgrades.
 *
 * Public (no auth):
 *   POST /api/ecom/billing/webhook   — MoneyFusion webhook (payin events)
 *
 * Protected (requireEcomAuth):
 *   GET  /api/ecom/billing/plan               — current plan for workspace
 *   POST /api/ecom/billing/checkout           — initiate a payment
 *   GET  /api/ecom/billing/status/:token      — poll payment status
 *   GET  /api/ecom/billing/history            — payment history for workspace
 */

import express from 'express';
import axios from 'axios';
import EcomWorkspace from '../models/Workspace.js';
import PlanPayment from '../models/PlanPayment.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = express.Router();

// ─── Config ──────────────────────────────────────────────────────────────────
const MF_API_URL = 'https://www.pay.moneyfusion.net/scalor/597e2cf962834532/pay/';
const MF_STATUS_URL = (token) => `https://www.pay.moneyfusion.net/paiementNotif/${token}`;

const PLAN_PRICES = {
  pro_1:  6000,   // 1 month
  pro_3:  16000,  // 3 months (~11% off)
  pro_6:  30000,  // 6 months (~17% off)
  pro_12: 55000,  // 12 months (~24% off)
};

const PLAN_DURATION = {
  pro_1: 1, pro_3: 3, pro_6: 6, pro_12: 12
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Apply an approved plan payment to the workspace:
 * - extends planExpiresAt from the current expiry (or now if expired/none)
 * - sets plan to 'pro'
 * - records the payment token
 */
async function applyPlanPayment(payment) {
  const workspace = await EcomWorkspace.findById(payment.workspaceId);
  if (!workspace) return;

  const now = new Date();
  const base = workspace.planExpiresAt && workspace.planExpiresAt > now
    ? workspace.planExpiresAt
    : now;

  const newExpiry = new Date(base);
  newExpiry.setMonth(newExpiry.getMonth() + payment.durationMonths);

  workspace.plan = 'pro';
  workspace.planExpiresAt = newExpiry;
  workspace.planPaymentToken = payment.mfToken;
  await workspace.save();

  payment.status = 'paid';
  payment.activatedAt = now;
  await payment.save();
}

// ─── GET /plan ────────────────────────────────────────────────────────────────
router.get('/plan', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId || req.query.workspaceId || req.body?.workspaceId;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'workspaceId requis' });
    }

    const workspace = await EcomWorkspace.findById(workspaceId).select(
      'plan planExpiresAt planPaymentToken'
    );
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    const now = new Date();
    const isActive =
      workspace.plan === 'pro' &&
      workspace.planExpiresAt &&
      workspace.planExpiresAt > now;

    // Auto-downgrade to free if subscription has expired
    if (workspace.plan === 'pro' && workspace.planExpiresAt && workspace.planExpiresAt <= now) {
      workspace.plan = 'free';
      workspace.planExpiresAt = null;
      await workspace.save();
    }

    res.json({
      success: true,
      plan: isActive ? 'pro' : 'free',
      planExpiresAt: workspace.planExpiresAt,
      isActive
    });
  } catch (err) {
    console.error('[billing] GET /plan error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── POST /checkout ───────────────────────────────────────────────────────────
router.post('/checkout', requireEcomAuth, async (req, res) => {
  try {
    const { plan = 'pro_1', phone, clientName, workspaceId: bodyWsId } = req.body;
    const workspaceId = req.workspaceId || bodyWsId;

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'workspaceId requis' });
    }
    if (!PLAN_PRICES[plan]) {
      return res.status(400).json({ success: false, message: 'Plan invalide' });
    }
    if (!phone || String(phone).trim().length < 8) {
      return res.status(400).json({ success: false, message: 'Numéro de téléphone requis' });
    }
    if (!clientName || String(clientName).trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Nom du client requis' });
    }

    const amount = PLAN_PRICES[plan];
    const durationMonths = PLAN_DURATION[plan];

    const frontendUrl = process.env.FRONTEND_URL || 'https://scalor.net';
    const backendUrl = process.env.BACKEND_URL || 'https://api.scalor.net';

    const paymentData = {
      totalPrice: amount,
      article: [{ 'Scalor Pro': amount }],
      personal_Info: [
        {
          workspaceId: workspaceId.toString(),
          userId: req.ecomUser._id.toString(),
          plan,
          durationMonths
        }
      ],
      numeroSend: String(phone).trim(),
      nomclient: String(clientName).trim(),
      return_url: `${frontendUrl}/ecom/billing/success`,
      webhook_url: `${backendUrl}/api/ecom/billing/webhook`
    };

    const mfResponse = await axios.post(MF_API_URL, paymentData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    const { statut, token: mfToken, url: paymentUrl, message } = mfResponse.data;

    if (!statut || !mfToken) {
      console.error('[billing] MoneyFusion bad response:', mfResponse.data);
      return res.status(502).json({
        success: false,
        message: message || 'Erreur lors de l\'initialisation du paiement'
      });
    }

    // Persist payment record
    const payment = new PlanPayment({
      workspaceId,
      userId: req.ecomUser._id,
      plan: 'pro',
      durationMonths,
      amount,
      mfToken,
      paymentUrl: paymentUrl || '',
      status: 'pending',
      phone: String(phone).trim(),
      clientName: String(clientName).trim()
    });
    await payment.save();

    res.json({
      success: true,
      mfToken,
      paymentUrl,
      message: message || 'Paiement en cours',
      amount,
      plan,
      durationMonths
    });
  } catch (err) {
    if (err.response) {
      console.error('[billing] MoneyFusion API error:', err.response.status, err.response.data);
      return res.status(502).json({
        success: false,
        message: 'Erreur de communication avec le prestataire de paiement'
      });
    }
    console.error('[billing] POST /checkout error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── GET /status/:token ───────────────────────────────────────────────────────
router.get('/status/:token', requireEcomAuth, async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length < 4) {
      return res.status(400).json({ success: false, message: 'Token invalide' });
    }

    // Find local record first
    const payment = await PlanPayment.findOne({ mfToken: token });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Paiement introuvable' });
    }

    // If already paid, return immediately
    if (payment.status === 'paid') {
      return res.json({ success: true, status: 'paid', payment });
    }

    // Fetch fresh status from MoneyFusion
    const mfResp = await axios.get(MF_STATUS_URL(token), { timeout: 10000 });
    const { statut, data: mfData } = mfResp.data;

    if (!statut || !mfData) {
      return res.json({ success: true, status: payment.status, payment });
    }

    const mfStatus = mfData.statut; // 'paid' | 'pending' | 'failure' | 'no paid'

    if (mfStatus === payment.status) {
      return res.json({ success: true, status: payment.status, payment });
    }

    // Update local record
    payment.status = mfStatus;
    if (mfData.moyen) payment.paymentMethod = mfData.moyen;
    if (mfData.numeroTransaction) payment.transactionNumber = mfData.numeroTransaction;
    if (mfData.frais) payment.fees = mfData.frais;

    if (mfStatus === 'paid') {
      await applyPlanPayment(payment);
    } else {
      await payment.save();
    }

    res.json({ success: true, status: mfStatus, payment });
  } catch (err) {
    if (err.response) {
      console.error('[billing] MF status check error:', err.response.status, err.response.data);
    } else {
      console.error('[billing] GET /status error:', err.message);
    }
    res.status(500).json({ success: false, message: 'Erreur lors de la vérification' });
  }
});

// ─── GET /history ─────────────────────────────────────────────────────────────
router.get('/history', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId || req.query.workspaceId;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'workspaceId requis' });
    }

    const payments = await PlanPayment.find({ workspaceId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, payments });
  } catch (err) {
    console.error('[billing] GET /history error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── POST /webhook (public — no auth) ────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  // Acknowledge immediately to MoneyFusion
  res.status(200).json({ received: true });

  try {
    const { event, tokenPay, statut: bodyStatut } = req.body;

    if (!tokenPay) {
      console.warn('[billing/webhook] Missing tokenPay in payload');
      return;
    }

    const payment = await PlanPayment.findOne({ mfToken: tokenPay });
    if (!payment) {
      console.warn('[billing/webhook] Unknown tokenPay:', tokenPay);
      return;
    }

    // Determine incoming status from event or body.statut
    let incomingStatus = payment.status;
    if (event === 'payin.session.completed' || bodyStatut === 'paid') {
      incomingStatus = 'paid';
    } else if (event === 'payin.session.cancelled' || bodyStatut === 'failure') {
      incomingStatus = 'failure';
    } else if (event === 'payin.session.pending') {
      incomingStatus = 'pending';
    }

    // Idempotency: ignore if no status change
    if (incomingStatus === payment.status) return;

    // Additional fields from webhook payload
    if (req.body.moyen) payment.paymentMethod = req.body.moyen;
    if (req.body.numeroTransaction) payment.transactionNumber = req.body.numeroTransaction;
    if (req.body.frais !== undefined) payment.fees = req.body.frais;

    if (incomingStatus === 'paid') {
      await applyPlanPayment(payment);
    } else {
      payment.status = incomingStatus;
      await payment.save();
    }

    console.log(`[billing/webhook] ${event} → token=${tokenPay} status=${incomingStatus}`);
  } catch (err) {
    console.error('[billing/webhook] processing error:', err);
  }
});

export default router;
