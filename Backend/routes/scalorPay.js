/**
 * Scalor Pay routes — managed payment method wallet & webhook.
 *
 * Public (no auth):
 *   POST /api/ecom/scalor-pay/webhook          — MoneyFusion payin webhook
 *
 * Protected (requireEcomAuth + requireWorkspace):
 *   GET  /api/ecom/scalor-pay/wallet           — solde + cumuls
 *   GET  /api/ecom/scalor-pay/transactions     — ledger (ventes + retraits)
 *   POST /api/ecom/scalor-pay/withdraw         — demande de retrait (payout)
 *
 * The storefront checkout that opens a Scalor Pay MoneyFusion session lives in
 * routes/storeApi.js (public, per-subdomain).
 */
import express from 'express';
import axios from 'axios';
import ScalorPayWallet from '../models/ScalorPayWallet.js';
import ScalorPayTransaction from '../models/ScalorPayTransaction.js';
import { requireEcomAuth, requireWorkspace } from '../middleware/ecomAuth.js';
import {
  getOrCreateWallet,
  creditSaleTransaction,
  MF_STATUS_URL,
  mfHttpsAgent,
  COMMISSION_RATE,
} from '../services/scalorPayService.js';

const router = express.Router();

// ─── POST /webhook — MoneyFusion payin (public) ───────────────────────────────
router.post('/webhook', async (req, res) => {
  // Acknowledge immediately (MoneyFusion retries on non-2xx).
  res.status(200).json({ received: true });

  try {
    const { event, tokenPay, statut: bodyStatut } = req.body || {};
    if (!tokenPay) {
      console.warn('[scalorPay/webhook] Missing tokenPay');
      return;
    }

    const tx = await ScalorPayTransaction.findOne({ mfToken: tokenPay, type: 'sale' });
    if (!tx) {
      // Peut appartenir au billing — non pertinent ici.
      return;
    }

    let incoming = tx.status;
    if (event === 'payin.session.completed' || bodyStatut === 'paid') incoming = 'paid';
    else if (event === 'payin.session.cancelled' || bodyStatut === 'failure') incoming = 'failure';
    else if (event === 'payin.session.pending') incoming = 'pending';

    const ancillary = {};
    if (req.body.moyen) ancillary.paymentMethod = req.body.moyen;
    if (req.body.numeroTransaction) ancillary.transactionNumber = req.body.numeroTransaction;

    if (incoming === 'paid') {
      await creditSaleTransaction(tx, ancillary);
    } else if (incoming !== tx.status) {
      tx.status = incoming;
      if (ancillary.paymentMethod) tx.paymentMethod = ancillary.paymentMethod;
      if (ancillary.transactionNumber) tx.transactionNumber = ancillary.transactionNumber;
      await tx.save();
    }

    console.log(`[scalorPay/webhook] ${event || bodyStatut} → token=${tokenPay} status=${incoming}`);
  } catch (err) {
    console.error('[scalorPay/webhook] error:', err);
  }
});

// ─── GET /wallet — solde du marchand ──────────────────────────────────────────
router.get('/wallet', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const wallet = await getOrCreateWallet(req.workspaceId);

    // Montant en attente = ventes 'pending' pas encore confirmées.
    const pendingAgg = await ScalorPayTransaction.aggregate([
      { $match: { workspaceId: wallet.workspaceId, type: 'sale', status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } },
    ]);
    const pendingBalance = pendingAgg[0]?.total || 0;

    res.json({
      success: true,
      data: {
        currency: wallet.currency,
        balance: wallet.balance,
        pendingBalance,
        totalCollected: wallet.totalCollected,
        totalCommission: wallet.totalCommission,
        totalCredited: wallet.totalCredited,
        totalWithdrawn: wallet.totalWithdrawn,
        commissionRate: COMMISSION_RATE,
      },
    });
  } catch (err) {
    console.error('[scalorPay] GET /wallet error:', err);
    res.status(500).json({ success: false, message: 'Erreur lors du chargement du solde' });
  }
});

// ─── GET /transactions — historique (ventes + retraits) ───────────────────────
router.get('/transactions', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const filter = { workspaceId: req.workspaceId };
    if (req.query.type === 'sale' || req.query.type === 'payout') filter.type = req.query.type;

    const rows = await ScalorPayTransaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('type orderNumber grossAmount commissionAmount netAmount currency status paymentMethod customerName createdAt')
      .lean();

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[scalorPay] GET /transactions error:', err);
    res.status(500).json({ success: false, message: 'Erreur lors du chargement des transactions' });
  }
});

// ─── POST /withdraw — demande de retrait ──────────────────────────────────────
router.post('/withdraw', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const amount = Math.round(Number(req.body?.amount) || 0);
    const phone = String(req.body?.phone || '').trim();

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Montant invalide' });
    }
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Numéro Mobile Money requis' });
    }

    // Débit atomique : ne réussit que si le solde couvre le montant.
    const wallet = await ScalorPayWallet.findOneAndUpdate(
      { workspaceId: req.workspaceId, balance: { $gte: amount } },
      { $inc: { balance: -amount, totalWithdrawn: amount } },
      { new: true }
    );

    if (!wallet) {
      return res.status(400).json({ success: false, message: 'Solde insuffisant' });
    }

    const payout = await ScalorPayTransaction.create({
      workspaceId: req.workspaceId,
      type: 'payout',
      currency: wallet.currency,
      grossAmount: amount,
      netAmount: amount,
      status: 'requested',
      phone,
      customerName: req.body?.beneficiaryName || '',
    });

    res.json({
      success: true,
      message: 'Demande de retrait enregistrée',
      data: { balance: wallet.balance, payoutId: payout._id },
    });
  } catch (err) {
    console.error('[scalorPay] POST /withdraw error:', err);
    res.status(500).json({ success: false, message: 'Erreur lors de la demande de retrait' });
  }
});

// ─── GET /sync/:token — force la vérif d'une vente (fallback poll) ─────────────
router.get('/sync/:token', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const tx = await ScalorPayTransaction.findOne({
      mfToken: req.params.token,
      workspaceId: req.workspaceId,
      type: 'sale',
    });
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction introuvable' });
    if (tx.status === 'paid') return res.json({ success: true, status: 'paid' });

    const mfResp = await axios.get(MF_STATUS_URL(tx.mfToken), { timeout: 10000, httpsAgent: mfHttpsAgent });
    const mfData = mfResp.data?.data;
    if (mfResp.data?.statut && mfData?.statut === 'paid') {
      await creditSaleTransaction(tx, {
        paymentMethod: mfData.moyen,
        transactionNumber: mfData.numeroTransaction,
      });
      return res.json({ success: true, status: 'paid' });
    }
    res.json({ success: true, status: tx.status });
  } catch (err) {
    console.error('[scalorPay] GET /sync error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur de synchronisation' });
  }
});

export default router;
