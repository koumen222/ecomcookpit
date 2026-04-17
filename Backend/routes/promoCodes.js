/**
 * Promo codes — gestion super-admin (CRUD) + endpoint public-validation.
 *
 * Super admin (requireEcomAuth + requireSuperAdmin):
 *   GET    /api/ecom/promo-codes              — liste paginée
 *   POST   /api/ecom/promo-codes              — créer un code
 *   GET    /api/ecom/promo-codes/:id          — détail
 *   PATCH  /api/ecom/promo-codes/:id          — mise à jour
 *   DELETE /api/ecom/promo-codes/:id          — suppression
 */
import express from 'express';
import PromoCode from '../models/PromoCode.js';
import PlanPayment from '../models/PlanPayment.js';
import { requireEcomAuth, requireSuperAdmin } from '../middleware/ecomAuth.js';

const router = express.Router();

router.use(requireEcomAuth, requireSuperAdmin);

// ─── GET /promo-codes ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search = '', isActive } = req.query;
    const filter = {};
    if (search) {
      filter.code = { $regex: String(search).trim(), $options: 'i' };
    }
    if (isActive === 'true') filter.isActive = true;
    if (isActive === 'false') filter.isActive = false;

    const codes = await PromoCode.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, codes });
  } catch (err) {
    console.error('[promoCodes] GET / error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── GET /promo-codes/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const code = await PromoCode.findById(req.params.id).lean();
    if (!code) return res.status(404).json({ success: false, message: 'Code introuvable' });

    const usageCount = await PlanPayment.countDocuments({
      promoCodeId: code._id,
      status: 'paid'
    });
    res.json({ success: true, code: { ...code, paidUsageCount: usageCount } });
  } catch (err) {
    console.error('[promoCodes] GET /:id error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── POST /promo-codes ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      applicablePlans = [],
      applicableDurations = [],
      maxUses = null,
      maxUsesPerWorkspace = null,
      minAmount = 0,
      validFrom = null,
      validUntil = null,
      isActive = true
    } = req.body || {};

    if (!code || typeof code !== 'string' || code.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Code requis (min 3 caractères)' });
    }
    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({ success: false, message: 'discountType invalide' });
    }
    const value = Number(discountValue);
    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ success: false, message: 'discountValue invalide' });
    }
    if (discountType === 'percentage' && value > 100) {
      return res.status(400).json({ success: false, message: 'Pourcentage > 100 interdit' });
    }

    const normalized = code.trim().toUpperCase();
    const existing = await PromoCode.findOne({ code: normalized });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Ce code existe déjà' });
    }

    const promo = await PromoCode.create({
      code: normalized,
      description,
      discountType,
      discountValue: value,
      applicablePlans,
      applicableDurations: applicableDurations.map(Number),
      maxUses: maxUses == null ? null : Number(maxUses),
      maxUsesPerWorkspace: maxUsesPerWorkspace == null ? null : Number(maxUsesPerWorkspace),
      minAmount: Number(minAmount) || 0,
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      isActive: !!isActive,
      createdBy: req.ecomUser._id
    });

    res.status(201).json({ success: true, code: promo });
  } catch (err) {
    console.error('[promoCodes] POST / error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── PATCH /promo-codes/:id ──────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const allowed = [
      'description', 'discountType', 'discountValue',
      'applicablePlans', 'applicableDurations',
      'maxUses', 'maxUsesPerWorkspace', 'minAmount',
      'validFrom', 'validUntil', 'isActive'
    ];
    const update = {};
    for (const key of allowed) {
      if (key in req.body) update[key] = req.body[key];
    }
    if ('discountValue' in update) update.discountValue = Number(update.discountValue);
    if ('maxUses' in update && update.maxUses != null) update.maxUses = Number(update.maxUses);
    if ('maxUsesPerWorkspace' in update && update.maxUsesPerWorkspace != null) {
      update.maxUsesPerWorkspace = Number(update.maxUsesPerWorkspace);
    }
    if ('applicableDurations' in update) {
      update.applicableDurations = (update.applicableDurations || []).map(Number);
    }
    if ('validFrom' in update) update.validFrom = update.validFrom ? new Date(update.validFrom) : null;
    if ('validUntil' in update) update.validUntil = update.validUntil ? new Date(update.validUntil) : null;

    const promo = await PromoCode.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!promo) return res.status(404).json({ success: false, message: 'Code introuvable' });
    res.json({ success: true, code: promo });
  } catch (err) {
    console.error('[promoCodes] PATCH /:id error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── DELETE /promo-codes/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await PromoCode.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Code introuvable' });
    res.json({ success: true });
  } catch (err) {
    console.error('[promoCodes] DELETE /:id error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
