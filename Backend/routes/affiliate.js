import express from 'express';
import jwt from 'jsonwebtoken';
import AffiliateUser from '../models/AffiliateUser.js';
import AffiliateLink from '../models/AffiliateLink.js';
import AffiliateClick from '../models/AffiliateClick.js';
import AffiliateConversion from '../models/AffiliateConversion.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import {
  generateCode,
  normalizeCode,
  getAffiliateConfig,
  resolveCommissionRule
} from '../services/affiliateService.js';

const router = express.Router();

const AFFILIATE_JWT_SECRET = process.env.AFFILIATE_JWT_SECRET || process.env.ECOM_JWT_SECRET || 'affiliate-secret-key';
const AFFILIATE_JWT_EXPIRES = process.env.AFFILIATE_JWT_EXPIRES || '7d';

function makeAffiliateToken(affiliate) {
  return jwt.sign(
    { id: affiliate._id, email: affiliate.email, role: 'affiliate' },
    AFFILIATE_JWT_SECRET,
    { expiresIn: AFFILIATE_JWT_EXPIRES }
  );
}

function sanitizeAffiliate(affiliate) {
  return {
    id: affiliate._id,
    name: affiliate.name,
    email: affiliate.email,
    referralCode: affiliate.referralCode,
    commissionType: affiliate.commissionType,
    commissionValue: affiliate.commissionValue,
    isActive: affiliate.isActive,
    lastLoginAt: affiliate.lastLoginAt,
    createdAt: affiliate.createdAt
  };
}

async function requireAffiliateAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return res.status(401).json({ success: false, message: 'Token affilié requis' });

    const decoded = jwt.verify(token, AFFILIATE_JWT_SECRET);
    const affiliate = await AffiliateUser.findById(decoded.id);
    if (!affiliate || !affiliate.isActive) {
      return res.status(401).json({ success: false, message: 'Compte affilié invalide ou inactif' });
    }

    req.affiliate = affiliate;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token affilié invalide' });
  }
}

function requireSuperAdmin(req, res, next) {
  if (req.ecomUser?.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Accès super admin requis' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public tracking redirect
// ─────────────────────────────────────────────────────────────────────────────
router.get('/r/:linkCode', async (req, res) => {
  try {
    const linkCode = normalizeCode(req.params.linkCode);
    const link = await AffiliateLink.findOne({ code: linkCode, isActive: true }).populate('affiliateId');

    if (!link || !link.affiliateId || !link.affiliateId.isActive) {
      return res.redirect('https://scalor.net');
    }

    const destinationUrl = link.destinationUrl || 'https://scalor.net';
    const separator = destinationUrl.includes('?') ? '&' : '?';
    const redirectUrl = `${destinationUrl}${separator}aff=${encodeURIComponent(link.affiliateId.referralCode)}&aff_link=${encodeURIComponent(link.code)}`;

    const ipAddress = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();

    // Deduplicate: skip if same IP + same link within last 30 seconds
    const deduplicationWindow = new Date(Date.now() - 30 * 1000);
    const recentClick = await AffiliateClick.findOne({
      affiliateLinkCode: link.code,
      ipAddress,
      createdAt: { $gte: deduplicationWindow }
    }).lean();

    if (!recentClick) {
      await AffiliateClick.create({
        affiliateId: link.affiliateId._id,
        affiliateCode: link.affiliateId.referralCode,
        affiliateLinkCode: link.code,
        destinationUrl,
        sourceUrl: req.get('referer') || '',
        ipAddress,
        userAgent: req.get('user-agent') || ''
      });

      // Atomic increment to avoid race conditions
      await AffiliateLink.updateOne({ _id: link._id }, { $inc: { clickCount: 1 } });
    }

    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('affiliate redirect error:', error.message);
    return res.redirect('https://scalor.net');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Affiliate auth
// ─────────────────────────────────────────────────────────────────────────────
router.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nom, email et mot de passe requis' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await AffiliateUser.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Cet email affilié existe déjà' });
    }

    let referralCode = generateCode('AFF');
    while (await AffiliateUser.exists({ referralCode })) {
      referralCode = generateCode('AFF');
    }

    const config = await getAffiliateConfig();

    const affiliate = await AffiliateUser.create({
      name: String(name).trim(),
      email: cleanEmail,
      password: String(password),
      referralCode,
      commissionType: config.baseCommissionType || 'fixed',
      commissionValue: Number(config.baseCommissionValue || 500)
    });

    const defaultDestination = config.defaultLandingUrl || 'https://scalor.net';
    await AffiliateLink.create({
      affiliateId: affiliate._id,
      code: generateCode('LNK'),
      name: 'Lien principal',
      destinationUrl: defaultDestination,
      linkType: 'default'
    });

    const token = makeAffiliateToken(affiliate);

    return res.status(201).json({
      success: true,
      message: 'Compte affilié créé',
      data: {
        token,
        affiliate: sanitizeAffiliate(affiliate)
      }
    });
  } catch (error) {
    console.error('affiliate register error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const affiliate = await AffiliateUser.findOne({ email: cleanEmail });
    if (!affiliate || !affiliate.isActive) {
      return res.status(401).json({ success: false, message: 'Identifiants invalides' });
    }

    const ok = await affiliate.comparePassword(String(password));
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Identifiants invalides' });
    }

    affiliate.lastLoginAt = new Date();
    await affiliate.save();

    const token = makeAffiliateToken(affiliate);

    return res.json({
      success: true,
      data: {
        token,
        affiliate: sanitizeAffiliate(affiliate)
      }
    });
  } catch (error) {
    console.error('affiliate login error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.get('/auth/me', requireAffiliateAuth, async (req, res) => {
  return res.json({ success: true, data: { affiliate: sanitizeAffiliate(req.affiliate) } });
});

// ─────────────────────────────────────────────────────────────────────────────
// Affiliate portal
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', requireAffiliateAuth, async (req, res) => {
  try {
    const affiliateId = req.affiliate._id;

    const [linksCount, clicksCount, conversions] = await Promise.all([
      AffiliateLink.countDocuments({ affiliateId, isActive: true }),
      AffiliateClick.countDocuments({ affiliateId }),
      AffiliateConversion.find({ affiliateId }).sort({ createdAt: -1 }).limit(200).lean()
    ]);

    const totals = conversions.reduce((acc, conv) => {
      acc.orders += 1;
      acc.sales += Number(conv.orderAmount || 0);
      acc.commissions += Number(conv.commissionAmount || 0);
      if (conv.status === 'paid') acc.paid += Number(conv.commissionAmount || 0);
      if (conv.status === 'approved') acc.approved += Number(conv.commissionAmount || 0);
      if (conv.status === 'pending') acc.pending += Number(conv.commissionAmount || 0);
      return acc;
    }, { orders: 0, sales: 0, commissions: 0, paid: 0, approved: 0, pending: 0 });

    const conversionRate = clicksCount > 0 ? Number(((totals.orders / clicksCount) * 100).toFixed(2)) : 0;

    return res.json({
      success: true,
      data: {
        affiliate: sanitizeAffiliate(req.affiliate),
        kpis: {
          links: linksCount,
          clicks: clicksCount,
          conversions: totals.orders,
          conversionRate,
          totalSales: totals.sales,
          totalCommissions: totals.commissions,
          paidCommissions: totals.paid,
          approvedCommissions: totals.approved,
          pendingCommissions: totals.pending
        }
      }
    });
  } catch (error) {
    console.error('affiliate dashboard error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.get('/links', requireAffiliateAuth, async (req, res) => {
  const links = await AffiliateLink.find({ affiliateId: req.affiliate._id }).sort({ createdAt: -1 }).lean();
  return res.json({ success: true, data: { links } });
});

router.post('/links', requireAffiliateAuth, async (req, res) => {
  try {
    const { name, destinationUrl, linkType, commissionType, commissionValue } = req.body || {};
    if (!name || !destinationUrl) {
      return res.status(400).json({ success: false, message: 'Nom et URL destination requis' });
    }

    let code = generateCode('LNK');
    while (await AffiliateLink.exists({ code })) code = generateCode('LNK');

    const link = await AffiliateLink.create({
      affiliateId: req.affiliate._id,
      code,
      name: String(name).trim(),
      destinationUrl: String(destinationUrl).trim(),
      linkType: String(linkType || 'custom').trim(),
      commissionType: ['fixed', 'percentage'].includes(commissionType) ? commissionType : '',
      commissionValue: Number(commissionValue || 0)
    });

    return res.status(201).json({ success: true, data: { link } });
  } catch (error) {
    console.error('affiliate create link error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.get('/conversions', requireAffiliateAuth, async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const filter = { affiliateId: req.affiliate._id };
  if (status) filter.status = status;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));

  const [items, total] = await Promise.all([
    AffiliateConversion.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    AffiliateConversion.countDocuments(filter)
  ]);

  return res.json({
    success: true,
    data: {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Super admin management
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/config', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  const config = await getAffiliateConfig();
  return res.json({ success: true, data: config });
});

router.put('/admin/config', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  const config = await getAffiliateConfig();
  const {
    baseCommissionType,
    baseCommissionValue,
    defaultLandingUrl,
    linkTypeRules
  } = req.body || {};

  if (baseCommissionType && ['fixed', 'percentage'].includes(baseCommissionType)) {
    config.baseCommissionType = baseCommissionType;
  }
  if (baseCommissionValue !== undefined) {
    config.baseCommissionValue = Math.max(0, Number(baseCommissionValue) || 0);
  }
  if (defaultLandingUrl !== undefined) {
    config.defaultLandingUrl = String(defaultLandingUrl || '').trim() || config.defaultLandingUrl;
  }
  if (Array.isArray(linkTypeRules)) {
    config.linkTypeRules = linkTypeRules
      .filter((r) => r?.name)
      .map((r) => ({
        name: String(r.name).trim(),
        commissionType: ['fixed', 'percentage'].includes(r.commissionType) ? r.commissionType : 'fixed',
        commissionValue: Math.max(0, Number(r.commissionValue) || 0),
        isActive: r.isActive !== false
      }));
  }

  await config.save();
  return res.json({ success: true, message: 'Configuration affiliation sauvegardée', data: config });
});

router.get('/admin/affiliates', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  const affiliates = await AffiliateUser.find().sort({ createdAt: -1 }).lean();

  // Aggregate stats per affiliate in parallel
  const affiliateIds = affiliates.map((a) => a._id);

  const [clickStats, conversionStats, linkStats] = await Promise.all([
    AffiliateClick.aggregate([
      { $match: { affiliateId: { $in: affiliateIds } } },
      { $group: { _id: '$affiliateId', totalClicks: { $sum: 1 } } }
    ]),
    AffiliateConversion.aggregate([
      { $match: { affiliateId: { $in: affiliateIds } } },
      {
        $group: {
          _id: '$affiliateId',
          totalConversions: { $sum: 1 },
          totalSales: { $sum: '$orderAmount' },
          totalCommissions: { $sum: '$commissionAmount' },
          pendingCommissions: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$commissionAmount', 0] }
          },
          approvedCommissions: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$commissionAmount', 0] }
          },
          paidCommissions: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$commissionAmount', 0] }
          }
        }
      }
    ]),
    AffiliateLink.aggregate([
      { $match: { affiliateId: { $in: affiliateIds } } },
      { $group: { _id: '$affiliateId', totalLinks: { $sum: 1 } } }
    ])
  ]);

  const clickMap = Object.fromEntries(clickStats.map((s) => [String(s._id), s]));
  const convMap = Object.fromEntries(conversionStats.map((s) => [String(s._id), s]));
  const linkMap = Object.fromEntries(linkStats.map((s) => [String(s._id), s]));

  const data = affiliates.map((a) => {
    const id = String(a._id);
    const clicks = clickMap[id] || {};
    const conv = convMap[id] || {};
    const links = linkMap[id] || {};
    return {
      ...sanitizeAffiliate(a),
      stats: {
        totalClicks: clicks.totalClicks || 0,
        totalConversions: conv.totalConversions || 0,
        totalSales: conv.totalSales || 0,
        totalCommissions: conv.totalCommissions || 0,
        pendingCommissions: conv.pendingCommissions || 0,
        approvedCommissions: conv.approvedCommissions || 0,
        paidCommissions: conv.paidCommissions || 0,
        totalLinks: links.totalLinks || 0
      }
    };
  });

  return res.json({ success: true, data });
});

router.post('/admin/affiliates', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, password, referralCode, commissionType, commissionValue, isActive } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Nom et email requis' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await AffiliateUser.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email affilié déjà utilisé' });
    }

    let finalCode = normalizeCode(referralCode || generateCode('AFF'));
    while (await AffiliateUser.exists({ referralCode: finalCode })) {
      finalCode = generateCode('AFF');
    }

    const config = await getAffiliateConfig();
    const affiliate = await AffiliateUser.create({
      name: String(name).trim(),
      email: cleanEmail,
      password: String(password || 'Affiliate@1234'),
      referralCode: finalCode,
      commissionType: ['fixed', 'percentage'].includes(commissionType) ? commissionType : (config.baseCommissionType || 'fixed'),
      commissionValue: commissionValue !== undefined ? Math.max(0, Number(commissionValue) || 0) : Number(config.baseCommissionValue || 500),
      isActive: isActive !== false,
      createdBy: req.ecomUser._id
    });

    const defaultDestination = config.defaultLandingUrl || 'https://scalor.net';
    await AffiliateLink.create({
      affiliateId: affiliate._id,
      code: generateCode('LNK'),
      name: 'Lien principal',
      destinationUrl: defaultDestination,
      linkType: 'default'
    });

    return res.status(201).json({ success: true, data: sanitizeAffiliate(affiliate) });
  } catch (error) {
    console.error('affiliate admin create error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.put('/admin/affiliates/:id', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const affiliate = await AffiliateUser.findById(req.params.id);
    if (!affiliate) return res.status(404).json({ success: false, message: 'Affilié introuvable' });

    const { name, commissionType, commissionValue, isActive, notes, password } = req.body || {};

    if (name !== undefined) affiliate.name = String(name).trim();
    if (commissionType !== undefined && ['fixed', 'percentage'].includes(commissionType)) {
      affiliate.commissionType = commissionType;
    }
    if (commissionValue !== undefined) affiliate.commissionValue = Math.max(0, Number(commissionValue) || 0);
    if (isActive !== undefined) affiliate.isActive = Boolean(isActive);
    if (notes !== undefined) affiliate.notes = String(notes || '');
    if (password) affiliate.password = String(password);

    await affiliate.save();
    return res.json({ success: true, data: sanitizeAffiliate(affiliate) });
  } catch (error) {
    console.error('affiliate admin update error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.get('/admin/conversions', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  const { status, page = 1, limit = 100 } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(300, Math.max(1, Number(limit) || 100));

  const [items, total] = await Promise.all([
    AffiliateConversion.find(filter)
      .populate('affiliateId', 'name email referralCode')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    AffiliateConversion.countDocuments(filter)
  ]);

  return res.json({
    success: true,
    data: {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  });
});

router.put('/admin/conversions/:id/status', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  const { status, statusNote } = req.body || {};
  if (!['pending', 'approved', 'paid', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Statut invalide' });
  }

  const conversion = await AffiliateConversion.findById(req.params.id);
  if (!conversion) return res.status(404).json({ success: false, message: 'Conversion introuvable' });

  conversion.status = status;
  if (statusNote !== undefined) conversion.statusNote = String(statusNote || '');
  await conversion.save();

  return res.json({ success: true, data: conversion });
});

// Helper endpoint to preview commission rule
router.post('/admin/preview-commission', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  const { affiliateId, linkCode, amount } = req.body || {};
  const [affiliate, link, config] = await Promise.all([
    affiliateId ? AffiliateUser.findById(affiliateId) : null,
    linkCode ? AffiliateLink.findOne({ code: normalizeCode(linkCode) }) : null,
    getAffiliateConfig()
  ]);

  const rule = await resolveCommissionRule({
    affiliate,
    link,
    config,
    amount: Number(amount || 0)
  });

  return res.json({ success: true, data: rule });
});

export default router;
