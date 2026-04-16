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
import PlanConfig from '../models/PlanConfig.js';
import GenerationPayment from '../models/GenerationPayment.js';
import EcomUser from '../models/EcomUser.js';
import AffiliateUser from '../models/AffiliateUser.js';
import AffiliateConversion from '../models/AffiliateConversion.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import { PLAN_DURATION, getPlanCheckoutAmount } from '../services/billingPricing.js';
import { clearSubscriptionWarning, downgradeWorkspaceToFree } from '../services/workspacePlanService.js';

const router = express.Router();

// ─── Config ──────────────────────────────────────────────────────────────────
const MF_API_URL = 'https://www.pay.moneyfusion.net/scalor/597e2cf962834532/pay/';
const MF_STATUS_URL = (token) => `https://www.pay.moneyfusion.net/paiementNotif/${token}`;

// Per-plan resource limits
export const PLAN_LIMITS = {
  free:  {
    agents: 0,
    instances: 0,
    messagesPerDay: 0,
    messagesPerMonth: 0,
    generationCredits: 0,
    whatsappAgent: false,
    maxOrders: 50,
    maxClients: 50,
    maxProducts: 10,
    maxStores: 1,
    maxUsers: 1,
    label: 'Gratuit'
  },
  starter: {
    agents: 0,
    instances: 0,
    messagesPerDay: 0,
    messagesPerMonth: 0,
    generationCredits: 0,
    whatsappAgent: false,
    label: 'Scalor'
  },
  pro:   {
    agents: 1,
    instances: 1,
    messagesPerDay: 1000,
    messagesPerMonth: 50000,
    generationCredits: 0,
    whatsappAgent: true,
    label: 'Scalor + IA'
  },
  ultra: {
    agents: 5,
    instances: 5,
    messagesPerDay: null, // Illimité
    messagesPerMonth: null, // Illimité
    generationCredits: 10,
    whatsappAgent: true,
    label: 'Scalor IA Pro'
  },
};

const TRIAL_DAYS = 7;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Apply an approved generation payment to the workspace:
 * - increments paidGenerationsRemaining
 * - records the payment token
 */
async function applyGenerationPayment(payment) {
  const workspace = await EcomWorkspace.findById(payment.workspaceId);
  if (!workspace) return;

  const now = new Date();
  
  // Add purchased generations to paid count
  workspace.paidGenerationsRemaining = (workspace.paidGenerationsRemaining || 0) + payment.quantity;
  await workspace.save();

  payment.status = 'paid';
  payment.creditedAt = now;
  await payment.save();

  console.log(`[billing] Credited ${payment.quantity} generation(s) to workspace ${workspace._id}`);
}

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

  // Determine which plan from the payment record
  const planName = payment.plan || 'starter';
  workspace.plan = planName;
  workspace.planExpiresAt = newExpiry;
  workspace.planPaymentToken = payment.mfToken;

  // Ultra plan: credit 10 product page generations per month purchased
  if (planName === 'ultra') {
    const creditsToAdd = 10 * payment.durationMonths;
    workspace.paidGenerationsRemaining = (workspace.paidGenerationsRemaining || 0) + creditsToAdd;
    console.log(`[billing] Credited ${creditsToAdd} generation(s) for ultra plan (${payment.durationMonths} month(s))`);
  }

  // Auto-disable subscription warning banner on successful payment
  if (workspace.subscriptionWarning?.active) {
    workspace.subscriptionWarning = clearSubscriptionWarning();
    console.log(`[billing] Subscription warning auto-disabled for workspace ${workspace.name}`);
  }

  await workspace.save();

  payment.status = 'paid';
  payment.activatedAt = now;
  await payment.save();

  // Credit 50% commission to referring affiliate (non-blocking)
  creditPaymentCommission(payment).catch(err =>
    console.warn('[affiliate] payment commission error:', err.message)
  );
}

/**
 * If the paying user was referred by an affiliate, create a 50% commission.
 */
async function creditPaymentCommission(payment) {
  const user = await EcomUser.findById(payment.userId).select('referredByAffiliateCode');
  if (!user?.referredByAffiliateCode) return;

  const affiliate = await AffiliateUser.findOne({
    referralCode: user.referredByAffiliateCode,
    isActive: true
  });
  if (!affiliate) return;

  const commissionAmount = Math.round(payment.amount * 0.5);
  await AffiliateConversion.create({
    affiliateId: affiliate._id,
    affiliateCode: affiliate.referralCode,
    conversionType: 'payment',
    referredUserId: user._id,
    orderAmount: payment.amount,
    commissionType: 'percentage',
    commissionValue: 50,
    commissionAmount,
    status: 'approved',
    statusNote: `50% commission sur paiement ${payment.plan} (${payment.durationMonths} mois)`
  });

  console.log(`[affiliate] ${commissionAmount} FCFA payment commission for affiliate ${affiliate.referralCode} (payment ${payment._id})`);
}

// ─── GET /plan ────────────────────────────────────────────────────────────────
// GET /api/ecom/billing/plans/public — public plan catalog for pricing page
// Returns prices (with active promo applied), limits, features, and bullets.
router.get('/plans/public', async (_req, res) => {
  try {
    await PlanConfig.seedDefaults();
    const plans = await PlanConfig.find().sort({ order: 1 }).lean();
    const now = Date.now();
    const out = plans.map(p => {
      const promoLive = !!(p.promoActive && p.pricePromo != null &&
        (!p.promoExpiresAt || new Date(p.promoExpiresAt).getTime() > now));
      return {
        key: p.key,
        displayName: p.displayName,
        tagline: p.tagline,
        currency: p.currency,
        priceRegular: p.priceRegular,
        pricePromo: promoLive ? p.pricePromo : null,
        effectivePrice: promoLive ? p.pricePromo : p.priceRegular,
        promoActive: promoLive,
        promoExpiresAt: promoLive ? p.promoExpiresAt : null,
        limits: p.limits,
        features: p.features,
        featuresList: p.featuresList,
        highlighted: p.highlighted,
        ctaLabel: p.ctaLabel,
        order: p.order
      };
    });
    res.json({ success: true, plans: out, serverTime: new Date().toISOString() });
  } catch (err) {
    console.error('[Billing] GET /plans/public error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.get('/plan', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId || req.query.workspaceId || req.body?.workspaceId;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'workspaceId requis' });
    }

    const workspace = await EcomWorkspace.findById(workspaceId).select(
      'plan planExpiresAt planPaymentToken trialStartedAt trialEndsAt trialUsed'
    );
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    const now = new Date();
    const isPaidActive =
      (workspace.plan === 'starter' || workspace.plan === 'pro' || workspace.plan === 'ultra') &&
      workspace.planExpiresAt &&
      workspace.planExpiresAt > now;

    // Auto-downgrade to free if subscription has expired
    if (!isPaidActive && workspace.plan !== 'free') {
      await downgradeWorkspaceToFree(workspace, {
        reason: 'billing_plan_poll',
        createSystemNotification: true
      });
    }

    // Trial status
    const trialActive = workspace.trialEndsAt && workspace.trialEndsAt > now;
    const trialExpired = workspace.trialUsed && workspace.trialEndsAt && workspace.trialEndsAt <= now;

    // Effective plan: paid > trial (Scalor/starter benefits) > free
    const effectivePlan = isPaidActive
      ? workspace.plan
      : trialActive
        ? 'starter' // essai 7j → bénéfices du plan Scalor (starter)
        : 'free';

    res.json({
      success: true,
      plan: effectivePlan,
      rawPlan: workspace.plan,
      planExpiresAt: workspace.planExpiresAt,
      isActive: isPaidActive,
      trial: {
        active: !!trialActive,
        expired: !!trialExpired,
        used: workspace.trialUsed,
        endsAt: workspace.trialEndsAt,
        startedAt: workspace.trialStartedAt,
      },
      limits: PLAN_LIMITS[effectivePlan] || PLAN_LIMITS.free,
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
    const normalizedPlan = ({ starter: 'starter_1', pro: 'pro_1', ultra: 'ultra_1' }[String(plan)] || String(plan));
    const workspaceId = req.workspaceId || bodyWsId;

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'workspaceId requis' });
    }
    if (!PLAN_DURATION[normalizedPlan]) {
      return res.status(400).json({ success: false, message: 'Plan invalide' });
    }
    if (!phone || String(phone).trim().length < 8) {
      return res.status(400).json({ success: false, message: 'Numéro de téléphone requis' });
    }
    if (!clientName || String(clientName).trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Nom du client requis' });
    }

    const amount = await getPlanCheckoutAmount(normalizedPlan);
    if (amount == null) {
      return res.status(400).json({ success: false, message: 'Prix du plan introuvable' });
    }
    const durationMonths = PLAN_DURATION[normalizedPlan];
    const planName = normalizedPlan.startsWith('ultra') ? 'ultra' : normalizedPlan.startsWith('pro') ? 'pro' : 'starter';

    const frontendUrl = process.env.FRONTEND_URL || 'https://scalor.net';
    const backendUrl = process.env.BACKEND_URL || 'https://api.scalor.net';

    const planLabels = { starter: 'Scalor', pro: 'Scalor + IA', ultra: 'Scalor IA Pro' };
    const planLabel = planLabels[planName] || 'Scalor';
    const paymentData = {
      totalPrice: amount,
      article: [{ [planLabel]: amount }],
      personal_Info: [
        {
          workspaceId: workspaceId.toString(),
          userId: req.ecomUser._id.toString(),
          plan: normalizedPlan,
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
      timeout: 60000
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
      plan: planName,
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
      plan: normalizedPlan,
      durationMonths
    });
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      console.error('[billing] MoneyFusion timeout on /checkout:', err.message);
      return res.status(504).json({
        success: false,
        message: 'Le service de paiement met trop de temps à répondre. Veuillez réessayer dans quelques instants.'
      });
    }
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

// ─── POST /buy-generation ─────────────────────────────────────────────────────
router.post('/buy-generation', requireEcomAuth, async (req, res) => {
  try {
    const { quantity = 1, phone, clientName, workspaceId: bodyWsId } = req.body;
    const workspaceId = req.workspaceId || bodyWsId;

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'workspaceId requis' });
    }
    if (!phone || String(phone).trim().length < 8) {
      return res.status(400).json({ success: false, message: 'Numéro de téléphone requis' });
    }
    if (!clientName || String(clientName).trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Nom du client requis' });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return res.status(400).json({ success: false, message: 'Quantité invalide (1-100)' });
    }

    // Pricing: 1 crédit = 1000 FCFA, pack 3 crédits = 2500 FCFA
    let amount;
    let pricePerGeneration;
    if (quantity === 3) {
      amount = 2500;
      pricePerGeneration = Math.round(2500 / 3);
    } else {
      pricePerGeneration = 1000;
      amount = pricePerGeneration * quantity;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://scalor.net';
    const backendUrl = process.env.BACKEND_URL || 'https://api.scalor.net';

    const paymentData = {
      totalPrice: amount,
      article: [{ [`Scalor - ${quantity} Génération${quantity > 1 ? 's' : ''} IA`]: amount }],
      personal_Info: [
        {
          workspaceId: workspaceId.toString(),
          userId: req.ecomUser._id.toString(),
          type: 'generation',
          quantity
        }
      ],
      numeroSend: String(phone).trim(),
      nomclient: String(clientName).trim(),
      return_url: `${frontendUrl}/ecom/products`,
      webhook_url: `${backendUrl}/api/ecom/billing/webhook`
    };

    const mfResponse = await axios.post(MF_API_URL, paymentData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
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
    const payment = new GenerationPayment({
      workspaceId,
      userId: req.ecomUser._id,
      quantity,
      pricePerGeneration,
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
      quantity,
      pricePerGeneration
    });
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      console.error('[billing] MoneyFusion timeout on /buy-generation:', err.message);
      return res.status(504).json({
        success: false,
        message: 'Le service de paiement met trop de temps à répondre. Veuillez réessayer dans quelques instants.'
      });
    }
    if (err.response) {
      console.error('[billing] MoneyFusion API error:', err.response.status, err.response.data);
      return res.status(502).json({
        success: false,
        message: 'Erreur de communication avec le prestataire de paiement'
      });
    }
    console.error('[billing] POST /buy-generation error:', err);
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

// ─── GET /generation-status/:token ────────────────────────────────────────────
router.get('/generation-status/:token', requireEcomAuth, async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length < 4) {
      return res.status(400).json({ success: false, message: 'Token invalide' });
    }

    // Find local record first
    const payment = await GenerationPayment.findOne({ mfToken: token });
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
      await applyGenerationPayment(payment);
    } else {
      await payment.save();
    }

    res.json({ success: true, status: mfStatus, payment });
  } catch (err) {
    if (err.response) {
      console.error('[billing] MF generation status check error:', err.response.status, err.response.data);
    } else {
      console.error('[billing] GET /generation-status error:', err.message);
    }
    res.status(500).json({ success: false, message: 'Erreur lors de la vérification' });
  }
});

// ─── GET /generations-info ────────────────────────────────────────────────────
router.get('/generations-info', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId || req.query.workspaceId;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'workspaceId requis' });
    }

    const workspace = await EcomWorkspace.findById(workspaceId).select('freeGenerationsRemaining paidGenerationsRemaining totalGenerations');
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace non trouvé' });
    }

    res.json({ 
      success: true, 
      generations: {
        freeRemaining: workspace.freeGenerationsRemaining || 0,
        paidRemaining: workspace.paidGenerationsRemaining || 0,
        totalUsed: workspace.totalGenerations || 0
      }
    });
  } catch (err) {
    console.error('[billing] GET /generations-info error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération' });
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

// ─── POST /trial — activate 7-day free trial ─────────────────────────────────
router.post('/trial', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId || req.body?.workspaceId;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'workspaceId requis' });
    }

    const workspace = await EcomWorkspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    if (workspace.trialUsed) {
      return res.status(400).json({ success: false, message: 'Essai gratuit déjà utilisé' });
    }
    if (workspace.plan === 'starter' || workspace.plan === 'pro' || workspace.plan === 'ultra') {
      return res.status(400).json({ success: false, message: 'Vous avez déjà un abonnement actif' });
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    workspace.trialStartedAt = now;
    workspace.trialEndsAt = trialEndsAt;
    workspace.trialUsed = true;
    await workspace.save();

    res.json({ success: true, trialEndsAt, message: `Essai gratuit de ${TRIAL_DAYS} jours activé` });
  } catch (err) {
    console.error('[billing] POST /trial error:', err);
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

    // Try to find payment in both PlanPayment and GenerationPayment
    let payment = await PlanPayment.findOne({ mfToken: tokenPay });
    let isGenerationPayment = false;
    
    if (!payment) {
      payment = await GenerationPayment.findOne({ mfToken: tokenPay });
      isGenerationPayment = !!payment;
    }
    
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
      if (isGenerationPayment) {
        await applyGenerationPayment(payment);
      } else {
        await applyPlanPayment(payment);
      }
    } else {
      payment.status = incomingStatus;
      await payment.save();
    }

    const paymentType = isGenerationPayment ? 'generation' : 'plan';
    console.log(`[billing/webhook] ${event} → token=${tokenPay} type=${paymentType} status=${incomingStatus}`);
  } catch (err) {
    console.error('[billing/webhook] processing error:', err);
  }
});

export default router;
