import express from 'express';
import jwt from 'jsonwebtoken';
import AffiliateUser from '../models/AffiliateUser.js';
import AffiliateLink from '../models/AffiliateLink.js';
import AffiliateClick from '../models/AffiliateClick.js';
import AffiliateConversion from '../models/AffiliateConversion.js';
import EcomUser from '../models/EcomUser.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import {
  generateCode,
  normalizeCode,
  getAffiliateConfig,
  resolveCommissionRule
} from '../services/affiliateService.js';
import { verifyGoogleIdToken } from '../services/googleAuthService.js';

const ECOM_JWT_SECRET = process.env.ECOM_JWT_SECRET || 'ecom-secret-key-change-in-production';

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
    phone: affiliate.phone || '',
    referralCode: affiliate.referralCode,
    commissionType: affiliate.commissionType,
    commissionValue: affiliate.commissionValue,
    isActive: affiliate.isActive,
    lastLoginAt: affiliate.lastLoginAt,
    scalorLinked: !!affiliate.scalorUserId,
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
    const { name, email, password, phone } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nom, email et mot de passe requis' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await AffiliateUser.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Cet email affilié existe déjà' });
    }

    let referralCode = generateCode('SCL');
    while (await AffiliateUser.exists({ referralCode })) {
      referralCode = generateCode('SCL');
    }

    const config = await getAffiliateConfig();

    const affiliate = await AffiliateUser.create({
      name: String(name).trim(),
      email: cleanEmail,
      password: String(password),
      phone: String(phone || '').trim(),
      referralCode,
      commissionType: config.baseCommissionType || 'percentage',
      commissionValue: Number(config.baseCommissionValue || 30)
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

// Login/join with Scalor account credentials (like "Sign in with Google")
router.post('/auth/login-scalor', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email et mot de passe Scalor requis' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Verify credentials against EcomUser (Scalor main account)
    const scalorUser = await EcomUser.findOne({ email: cleanEmail });
    if (!scalorUser) {
      return res.status(401).json({ success: false, message: 'Aucun compte Scalor trouvé avec cet email' });
    }

    // bcrypt compare
    const bcrypt = await import('bcryptjs');
    const validPassword = await bcrypt.default.compare(String(password), scalorUser.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Mot de passe Scalor incorrect' });
    }

    // Credentials OK — find or create affiliate account
    let affiliate = await AffiliateUser.findOne({ scalorUserId: scalorUser._id });

    if (!affiliate) {
      affiliate = await AffiliateUser.findOne({ email: cleanEmail });

      if (affiliate) {
        affiliate.scalorUserId = scalorUser._id;
        affiliate.lastLoginAt = new Date();
        await affiliate.save();
      } else {
        let referralCode = generateCode('SCL');
        while (await AffiliateUser.exists({ referralCode })) {
          referralCode = generateCode('SCL');
        }

        const config = await getAffiliateConfig();

        affiliate = await AffiliateUser.create({
          name: scalorUser.name || cleanEmail.split('@')[0],
          email: cleanEmail,
          password: `scalor_linked_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          phone: scalorUser.phone || '',
          referralCode,
          scalorUserId: scalorUser._id,
          commissionType: config.baseCommissionType || 'percentage',
          commissionValue: Number(config.baseCommissionValue || 30),
          lastLoginAt: new Date()
        });

        const defaultDestination = config.defaultLandingUrl || 'https://scalor.net/ecom/register';
        await AffiliateLink.create({
          affiliateId: affiliate._id,
          code: generateCode('LNK'),
          name: 'Lien principal',
          destinationUrl: defaultDestination,
          linkType: 'default'
        });
      }
    } else {
      affiliate.lastLoginAt = new Date();
      await affiliate.save();
    }

    const token = makeAffiliateToken(affiliate);

    return res.json({
      success: true,
      data: {
        token,
        affiliate: sanitizeAffiliate(affiliate)
      }
    });
  } catch (error) {
    console.error('affiliate login-scalor error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Login/join with Google (same as Scalor Google login)
router.post('/auth/google', async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Token Google manquant' });
    }

    let payload;
    try {
      const verification = await verifyGoogleIdToken(credential);
      payload = verification.payload;
    } catch (verifyError) {
      if (verifyError.code === 'GOOGLE_CLIENT_ID_MISSING') {
        return res.status(503).json({ success: false, message: 'GOOGLE_CLIENT_ID non configuré' });
      }
      return res.status(401).json({ success: false, message: 'Token Google invalide' });
    }

    const { sub: googleId, email, name } = payload;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email non disponible depuis Google' });
    }

    const cleanEmail = email.toLowerCase();

    // Find or create affiliate
    let affiliate = await AffiliateUser.findOne({ email: cleanEmail });

    if (!affiliate) {
      // Check if a Scalor user exists with this email/googleId to link
      const scalorUser = await EcomUser.findOne({ $or: [{ email: cleanEmail }, { googleId }] });

      let referralCode = generateCode('SCL');
      while (await AffiliateUser.exists({ referralCode })) {
        referralCode = generateCode('SCL');
      }

      const config = await getAffiliateConfig();

      affiliate = await AffiliateUser.create({
        name: name || cleanEmail.split('@')[0],
        email: cleanEmail,
        password: `google_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        referralCode,
        scalorUserId: scalorUser?._id || null,
        commissionType: config.baseCommissionType || 'percentage',
        commissionValue: Number(config.baseCommissionValue || 30),
        lastLoginAt: new Date()
      });

      const defaultDestination = config.defaultLandingUrl || 'https://scalor.net/ecom/register';
      await AffiliateLink.create({
        affiliateId: affiliate._id,
        code: generateCode('LNK'),
        name: 'Lien principal',
        destinationUrl: defaultDestination,
        linkType: 'default'
      });
    } else {
      // Link to Scalor user if not already linked
      if (!affiliate.scalorUserId) {
        const scalorUser = await EcomUser.findOne({ $or: [{ email: cleanEmail }, { googleId }] });
        if (scalorUser) affiliate.scalorUserId = scalorUser._id;
      }
      affiliate.lastLoginAt = new Date();
      await affiliate.save();
    }

    const token = makeAffiliateToken(affiliate);

    return res.json({
      success: true,
      data: {
        token,
        affiliate: sanitizeAffiliate(affiliate)
      }
    });
  } catch (error) {
    console.error('affiliate google auth error:', error);
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

// Overview: KPIs globaux + clics par jour + top affiliés
router.get('/admin/overview', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalAffiliates,
      activeAffiliates,
      newToday,
      conversionsToday,
      conversionsPending,
      clicksByDay,
      // Clics totaux + clics du jour depuis AffiliateLink.clickCount (source de vérité)
      clickAggregates,
      // Top 10 affiliés par sum(clickCount) sur leurs liens
      topAffiliates
    ] = await Promise.all([
      AffiliateUser.countDocuments(),
      AffiliateUser.countDocuments({ isActive: true }),
      AffiliateUser.countDocuments({ createdAt: { $gte: startOfToday } }),
      AffiliateConversion.countDocuments({ createdAt: { $gte: startOfToday } }),
      AffiliateConversion.countDocuments({ status: 'pending' }),
      // Graphique clics par jour : AffiliateClick (seule collection avec timestamp par clic)
      AffiliateClick.aggregate([
        { $match: { createdAt: { $gte: start30d } } },
        {
          $group: {
            _id: {
              y: { $year: '$createdAt' },
              m: { $month: '$createdAt' },
              d: { $dayOfMonth: '$createdAt' }
            },
            clicks: { $sum: 1 }
          }
        },
        { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } }
      ]),
      // Clics totaux et du jour depuis la même source que le portail affilié
      AffiliateLink.aggregate([
        {
          $group: {
            _id: null,
            clicksTotal: { $sum: '$clickCount' }
          }
        }
      ]),
      // Top 10 affiliés par sum(clickCount) sur leurs liens
      AffiliateLink.aggregate([
        { $group: { _id: '$affiliateId', totalClicks: { $sum: '$clickCount' } } },
        { $sort: { totalClicks: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'affiliate_users',
            localField: '_id',
            foreignField: '_id',
            as: 'affiliate'
          }
        },
        { $unwind: { path: '$affiliate', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'affiliate_conversions',
            localField: '_id',
            foreignField: 'affiliateId',
            as: 'conversions'
          }
        },
        {
          $project: {
            affiliateId: '$_id',
            name: '$affiliate.name',
            email: '$affiliate.email',
            referralCode: '$affiliate.referralCode',
            isActive: '$affiliate.isActive',
            totalClicks: 1,
            totalConversions: { $size: '$conversions' },
            totalCommissions: { $sum: '$conversions.commissionAmount' }
          }
        }
      ])
    ]);

    const clicksTotal = clickAggregates[0]?.clicksTotal || 0;
    // Clics du jour : depuis AffiliateClick (timestampé) — cohérent avec le graphique
    const clicksToday = await AffiliateClick.countDocuments({ createdAt: { $gte: startOfToday } });

    const clicksByDayFormatted = clicksByDay.map((d) => ({
      date: `${d._id.y}-${String(d._id.m).padStart(2, '0')}-${String(d._id.d).padStart(2, '0')}`,
      clicks: d.clicks
    }));

    return res.json({
      success: true,
      data: {
        kpis: {
          totalAffiliates,
          activeAffiliates,
          newToday,
          clicksToday,
          clicksTotal,
          conversionsToday,
          conversionsPending
        },
        clicksByDay: clicksByDayFormatted,
        topAffiliates
      }
    });
  } catch (error) {
    console.error('affiliate admin overview error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

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

  const affiliateIds = affiliates.map((a) => a._id);

  const [linkStats, conversionStats] = await Promise.all([
    // Source de vérité pour les clics : sum(clickCount) sur AffiliateLink
    // C'est la même valeur que voit l'affilié dans son portail
    AffiliateLink.aggregate([
      { $match: { affiliateId: { $in: affiliateIds } } },
      {
        $group: {
          _id: '$affiliateId',
          totalClicks: { $sum: '$clickCount' },
          totalLinks: { $sum: 1 }
        }
      }
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
    ])
  ]);

  const linkMap = Object.fromEntries(linkStats.map((s) => [String(s._id), s]));
  const convMap = Object.fromEntries(conversionStats.map((s) => [String(s._id), s]));

  const data = affiliates.map((a) => {
    const id = String(a._id);
    const links = linkMap[id] || {};
    const conv = convMap[id] || {};
    const totalClicks = links.totalClicks || 0;
    const totalConversions = conv.totalConversions || 0;
    return {
      ...sanitizeAffiliate(a),
      stats: {
        totalClicks,
        totalConversions,
        conversionRate: totalClicks > 0 ? Number(((totalConversions / totalClicks) * 100).toFixed(2)) : 0,
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
