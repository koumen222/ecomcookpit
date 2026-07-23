import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import AffiliateUser from '../models/AffiliateUser.js';
import AffiliateLink from '../models/AffiliateLink.js';
import AffiliateClick from '../models/AffiliateClick.js';
import AffiliateVisit from '../models/AffiliateVisit.js';
import AffiliateConversion from '../models/AffiliateConversion.js';
import AffiliatePayout, { PAYOUT_METHODS } from '../models/AffiliatePayout.js';
import EcomUser from '../models/EcomUser.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import {
  generateCode,
  generateClickId,
  normalizeCode,
  getAffiliateConfig,
  resolveCommissionRule,
  recordAffiliateVisit,
  getAffiliateBalance
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
  // Pont « compte Scalor » : attachEcomAffiliate a déjà résolu l'affilié
  if (req.affiliate) return next();
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

// ─────────────────────────────────────────────────────────────────────────────
// Affiliation intégrée au compte Scalor — AUCUN compte affilié séparé.
// Chaque utilisateur Scalor (admin) obtient automatiquement son profil affilié
// (adossé à son compte : scalorUserId) au premier accès à /me/*.
// ─────────────────────────────────────────────────────────────────────────────
async function attachEcomAffiliate(req, res, next) {
  try {
    let affiliate = await AffiliateUser.findOne({ scalorUserId: req.ecomUser._id });

    if (!affiliate) {
      // Ancien compte affilié créé avec le même email → on le rattache
      affiliate = await AffiliateUser.findOne({ email: String(req.ecomUser.email || '').toLowerCase() });
      if (affiliate && !affiliate.scalorUserId) {
        affiliate.scalorUserId = req.ecomUser._id;
        await affiliate.save();
      }
    }

    if (!affiliate) {
      // Auto-provision : profil affilié transparent, lié au compte Scalor
      let referralCode = generateCode('SCL');
      while (await AffiliateUser.exists({ referralCode })) referralCode = generateCode('SCL');

      const config = await getAffiliateConfig();
      affiliate = await AffiliateUser.create({
        name: req.ecomUser.name || String(req.ecomUser.email || '').split('@')[0],
        email: String(req.ecomUser.email || '').toLowerCase(),
        password: `scalor_linked_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        phone: req.ecomUser.phone || '',
        referralCode,
        scalorUserId: req.ecomUser._id,
        commissionType: config.baseCommissionType || 'fixed',
        commissionValue: Number(config.baseCommissionValue || 500),
        lastLoginAt: new Date()
      });

      await AffiliateLink.create({
        affiliateId: affiliate._id,
        code: generateCode('LNK'),
        name: 'Lien principal',
        destinationUrl: config.defaultLandingUrl || 'https://scalor.net',
        linkType: 'default'
      });
      console.log(`[affiliate] profil auto-provisionné pour ${affiliate.email} (${affiliate.referralCode})`);
    }

    if (!affiliate.isActive) {
      return res.status(403).json({ success: false, message: 'Programme d’affiliation désactivé pour ce compte' });
    }

    req.affiliate = affiliate;
    return next();
  } catch (error) {
    console.error('attachEcomAffiliate error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}

// Alias /me/* : mêmes endpoints que le portail affilié, authentifiés par la
// session Scalor (Bearer ecom). La réécriture d'URL délègue aux routes
// existantes (/dashboard, /links, /stats/*, /referrals, /payouts, …).
router.all('/me/*', requireEcomAuth, attachEcomAffiliate, (req, res, next) => {
  req.url = req.url.replace(/^\/me/, '') || '/';
  next();
});

function requireSuperAdmin(req, res, next) {
  if (req.ecomUser?.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Accès super admin requis' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public tracking redirect
// /r/:trackingCode[?sub=ma_campagne&utm_source=...] →
//   destination?aff=CODE&aff_link=LNK&aff_click=ID[&aff_sub=...]
// Chaque clic reçoit un clickId unique, repris par le beacon de visite et les
// conversions → funnel exact clic → visite → inscription → paiement.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/r/:trackingCode', async (req, res) => {
  try {
    const trackingCode = normalizeCode(req.params.trackingCode);
    let link = await AffiliateLink.findOne({ code: trackingCode, isActive: true }).populate('affiliateId');

    // Le lien court principal utilise le code public SCL… de l'affilié.
    // Les codes LNK… continuent de cibler précisément les campagnes.
    if (!link) {
      const affiliate = await AffiliateUser.findOne({ referralCode: trackingCode, isActive: true }).select('_id');
      if (affiliate) {
        link = await AffiliateLink.findOne({
          affiliateId: affiliate._id,
          isActive: true,
          linkType: 'default'
        }).populate('affiliateId');
        if (!link) {
          link = await AffiliateLink.findOne({
            affiliateId: affiliate._id,
            isActive: true
          }).sort({ createdAt: 1 }).populate('affiliateId');
        }
      }
    }

    if (!link || !link.affiliateId || !link.affiliateId.isActive) {
      return res.redirect('https://scalor.net');
    }

    const subId = String(req.query.sub || req.query.subid || '').trim().slice(0, 100);
    const ipAddress = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();

    // Deduplicate: skip if same IP + same link within last 30 seconds
    const deduplicationWindow = new Date(Date.now() - 30 * 1000);
    const recentClick = await AffiliateClick.findOne({
      affiliateLinkCode: link.code,
      ipAddress,
      createdAt: { $gte: deduplicationWindow }
    }).lean();

    // Réutiliser le clickId du clic récent (double-clic) sinon en créer un
    const clickId = recentClick?.clickId || generateClickId();

    if (!recentClick) {
      await AffiliateClick.create({
        affiliateId: link.affiliateId._id,
        affiliateCode: link.affiliateId.referralCode,
        affiliateLinkCode: link.code,
        clickId,
        subId,
        utmSource: String(req.query.utm_source || '').trim().slice(0, 100),
        utmMedium: String(req.query.utm_medium || '').trim().slice(0, 100),
        utmCampaign: String(req.query.utm_campaign || '').trim().slice(0, 100),
        destinationUrl: link.destinationUrl || 'https://scalor.net',
        sourceUrl: req.get('referer') || '',
        ipAddress,
        userAgent: req.get('user-agent') || ''
      });

      // Atomic increment to avoid race conditions
      await AffiliateLink.updateOne({ _id: link._id }, { $inc: { clickCount: 1 } });
    }

    const destinationUrl = link.destinationUrl || 'https://scalor.net';
    const separator = destinationUrl.includes('?') ? '&' : '?';
    const redirectParams = new URLSearchParams({
      aff: link.affiliateId.referralCode,
      aff_link: link.code,
      aff_click: clickId
    });
    if (subId) redirectParams.set('aff_sub', subId);
    const redirectUrl = `${destinationUrl}${separator}${redirectParams.toString()}`;

    // Cookie first-party best-effort (fallback serveur si les params se perdent
    // sur un domaine scalor.net). Canal principal : params URL + localStorage.
    try {
      const config = await getAffiliateConfig();
      const windowDays = Math.max(1, Number(config.attributionWindowDays || 60));
      const payload = Buffer.from(JSON.stringify({
        aff: link.affiliateId.referralCode,
        link: link.code,
        click: clickId,
        exp: Date.now() + windowDays * 24 * 60 * 60 * 1000
      })).toString('base64url');
      const cookieOptions = {
        maxAge: windowDays * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/'
      };
      const hostname = String(req.hostname || '');
      if (hostname.endsWith('scalor.net')) cookieOptions.domain = '.scalor.net';
      res.cookie('scalor_aff', payload, cookieOptions);
    } catch { /* cookie best-effort */ }

    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('affiliate redirect error:', error.message);
    return res.redirect('https://scalor.net');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Public visit beacon — appelé par le frontend quand une attribution affiliée
// est active. Répond toujours 200 (ne révèle pas la validité des codes).
// ─────────────────────────────────────────────────────────────────────────────
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: false,
  legacyHeaders: false
});

router.post('/track/visit', trackLimiter, async (req, res) => {
  try {
    const { affiliateCode, affiliateLinkCode, clickId, visitorId, sessionId, url, referrer } = req.body || {};
    const ipAddress = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();

    const result = await recordAffiliateVisit({
      affiliateCode,
      affiliateLinkCode,
      clickId,
      visitorId,
      sessionId,
      url,
      referrer,
      ipAddress,
      userAgent: req.get('user-agent') || ''
    });

    return res.json({ success: true, recorded: result.recorded });
  } catch (error) {
    console.warn('affiliate track visit error:', error.message);
    return res.json({ success: true, recorded: false });
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
// Affiliate portal — statistiques (funnel, séries temporelles, par lien)
// ─────────────────────────────────────────────────────────────────────────────
const STATS_TZ = 'Africa/Douala';

function parsePeriodDays(query, def = 30) {
  const days = Number(query?.days);
  if (!Number.isFinite(days) || days <= 0) return def;
  return Math.min(365, Math.max(1, Math.round(days)));
}

function localDayKey(date) {
  return date.toLocaleDateString('fr-CA', { timeZone: STATS_TZ });
}

function maskEmail(email = '') {
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
}

// Funnel de la période + soldes à vie
router.get('/stats/summary', requireAffiliateAuth, async (req, res) => {
  try {
    const affiliateId = req.affiliate._id;
    const days = parsePeriodDays(req.query, 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      visitsCount,
      uniqueVisitorIds,
      clicksCount,
      convAgg,
      lifetimeAgg,
      balance,
      pendingPayoutAgg,
      config
    ] = await Promise.all([
      AffiliateVisit.countDocuments({ affiliateId, createdAt: { $gte: since } }),
      AffiliateVisit.distinct('visitorId', { affiliateId, createdAt: { $gte: since } }),
      AffiliateClick.countDocuments({ affiliateId, createdAt: { $gte: since } }),
      AffiliateConversion.aggregate([
        { $match: { affiliateId, createdAt: { $gte: since }, status: { $ne: 'rejected' } } },
        {
          $group: {
            _id: '$conversionType',
            count: { $sum: 1 },
            amount: { $sum: '$orderAmount' },
            commissions: { $sum: '$commissionAmount' }
          }
        }
      ]),
      AffiliateConversion.aggregate([
        { $match: { affiliateId } },
        { $group: { _id: '$status', count: { $sum: 1 }, commissions: { $sum: '$commissionAmount' } } }
      ]),
      getAffiliateBalance(affiliateId),
      AffiliatePayout.aggregate([
        { $match: { affiliateId, status: 'pending' } },
        { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      getAffiliateConfig()
    ]);

    const byType = Object.fromEntries(convAgg.map((r) => [r._id, r]));
    const byStatus = Object.fromEntries(lifetimeAgg.map((r) => [r._id, r]));
    const signups = byType.signup?.count || 0;
    const payments = byType.payment?.count || 0;

    return res.json({
      success: true,
      data: {
        periodDays: days,
        funnel: {
          clicks: clicksCount,
          visits: visitsCount,
          uniqueVisitors: uniqueVisitorIds.length,
          signups,
          payments,
          revenue: byType.payment?.amount || 0,
          periodCommissions:
            (byType.signup?.commissions || 0) +
            (byType.payment?.commissions || 0) +
            (byType.order?.commissions || 0),
          clickToSignupRate: clicksCount > 0 ? Number(((signups / clicksCount) * 100).toFixed(2)) : 0,
          signupToPaymentRate: signups > 0 ? Number(((payments / signups) * 100).toFixed(2)) : 0
        },
        lifetime: {
          pendingCommissions: byStatus.pending?.commissions || 0,
          approvedCommissions: byStatus.approved?.commissions || 0,
          paidCommissions: byStatus.paid?.commissions || 0,
          rejectedCommissions: byStatus.rejected?.commissions || 0,
          totalCommissions:
            (byStatus.pending?.commissions || 0) +
            (byStatus.approved?.commissions || 0) +
            (byStatus.paid?.commissions || 0)
        },
        balance: {
          available: balance.amount,
          conversions: balance.count,
          pendingPayouts: pendingPayoutAgg[0]?.amount || 0,
          minPayoutAmount: Number(config.minPayoutAmount ?? 5000)
        },
        program: {
          signupBonusAmount: Number(config.signupBonusAmount ?? 500),
          paymentCommissionPercent: Number(config.paymentCommissionPercent ?? 50),
          attributionWindowDays: Number(config.attributionWindowDays ?? 60)
        }
      }
    });
  } catch (error) {
    console.error('affiliate stats summary error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Séries par jour : visites, visiteurs uniques, clics, inscriptions, paiements, commissions
router.get('/stats/timeseries', requireAffiliateAuth, async (req, res) => {
  try {
    const affiliateId = req.affiliate._id;
    const days = parsePeriodDays(req.query, 30);
    const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
    since.setHours(0, 0, 0, 0);

    const dateExpr = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: STATS_TZ } };

    const [visitRows, clickRows, convRows] = await Promise.all([
      AffiliateVisit.aggregate([
        { $match: { affiliateId, createdAt: { $gte: since } } },
        { $group: { _id: dateExpr, visits: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
        { $project: { visits: 1, uniqueVisitors: { $size: '$visitors' } } }
      ]),
      AffiliateClick.aggregate([
        { $match: { affiliateId, createdAt: { $gte: since } } },
        { $group: { _id: dateExpr, clicks: { $sum: 1 } } }
      ]),
      AffiliateConversion.aggregate([
        { $match: { affiliateId, createdAt: { $gte: since }, status: { $ne: 'rejected' } } },
        {
          $group: {
            _id: { day: dateExpr, type: '$conversionType' },
            count: { $sum: 1 },
            commissions: { $sum: '$commissionAmount' }
          }
        }
      ])
    ]);

    const visitMap = Object.fromEntries(visitRows.map((r) => [r._id, r]));
    const clickMap = Object.fromEntries(clickRows.map((r) => [r._id, r]));
    const convMap = {};
    for (const row of convRows) {
      const day = row._id.day;
      if (!convMap[day]) convMap[day] = { signups: 0, payments: 0, commissions: 0 };
      if (row._id.type === 'signup') convMap[day].signups += row.count;
      if (row._id.type === 'payment') convMap[day].payments += row.count;
      convMap[day].commissions += row.commissions;
    }

    const series = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const day = localDayKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
      series.push({
        date: day,
        visits: visitMap[day]?.visits || 0,
        uniqueVisitors: visitMap[day]?.uniqueVisitors || 0,
        clicks: clickMap[day]?.clicks || 0,
        signups: convMap[day]?.signups || 0,
        payments: convMap[day]?.payments || 0,
        commissions: convMap[day]?.commissions || 0
      });
    }

    return res.json({ success: true, data: { periodDays: days, series } });
  } catch (error) {
    console.error('affiliate stats timeseries error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Performance par lien (+ répartition par sub-ID)
router.get('/stats/links', requireAffiliateAuth, async (req, res) => {
  try {
    const affiliateId = req.affiliate._id;
    const days = parsePeriodDays(req.query, 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [links, clickAgg, visitAgg, convAgg, subAgg] = await Promise.all([
      AffiliateLink.find({ affiliateId }).sort({ createdAt: -1 }).lean(),
      AffiliateClick.aggregate([
        { $match: { affiliateId, createdAt: { $gte: since } } },
        { $group: { _id: '$affiliateLinkCode', clicks: { $sum: 1 } } }
      ]),
      AffiliateVisit.aggregate([
        { $match: { affiliateId, createdAt: { $gte: since } } },
        { $group: { _id: '$affiliateLinkCode', visits: { $sum: 1 } } }
      ]),
      AffiliateConversion.aggregate([
        { $match: { affiliateId, createdAt: { $gte: since }, status: { $ne: 'rejected' } } },
        {
          $group: {
            _id: { link: '$affiliateLinkCode', type: '$conversionType' },
            count: { $sum: 1 },
            commissions: { $sum: '$commissionAmount' }
          }
        }
      ]),
      AffiliateClick.aggregate([
        { $match: { affiliateId, createdAt: { $gte: since }, subId: { $ne: '' } } },
        { $group: { _id: '$subId', clicks: { $sum: 1 } } },
        { $sort: { clicks: -1 } },
        { $limit: 50 }
      ])
    ]);

    const clickMap = Object.fromEntries(clickAgg.map((r) => [r._id || '', r.clicks]));
    const visitMap = Object.fromEntries(visitAgg.map((r) => [r._id || '', r.visits]));
    const convByLink = {};
    for (const row of convAgg) {
      const key = row._id.link || '';
      if (!convByLink[key]) convByLink[key] = { signups: 0, payments: 0, commissions: 0 };
      if (row._id.type === 'signup') convByLink[key].signups += row.count;
      if (row._id.type === 'payment') convByLink[key].payments += row.count;
      convByLink[key].commissions += row.commissions;
    }

    const rows = links.map((link) => {
      const clicks = clickMap[link.code] || 0;
      const conv = convByLink[link.code] || { signups: 0, payments: 0, commissions: 0 };
      return {
        code: link.code,
        name: link.name,
        destinationUrl: link.destinationUrl,
        isActive: link.isActive,
        createdAt: link.createdAt,
        lifetimeClicks: link.clickCount || 0,
        clicks,
        visits: visitMap[link.code] || 0,
        signups: conv.signups,
        payments: conv.payments,
        commissions: conv.commissions,
        clickToSignupRate: clicks > 0 ? Number(((conv.signups / clicks) * 100).toFixed(2)) : 0
      };
    });

    // Conversions rattachées à l'ancien système (sans lien identifié)
    const direct = convByLink[''];
    if (direct && (direct.signups || direct.payments)) {
      rows.push({
        code: '',
        name: '(sans lien identifié)',
        destinationUrl: '',
        isActive: true,
        createdAt: null,
        lifetimeClicks: 0,
        clicks: clickMap[''] || 0,
        visits: visitMap[''] || 0,
        signups: direct.signups,
        payments: direct.payments,
        commissions: direct.commissions,
        clickToSignupRate: 0
      });
    }

    return res.json({
      success: true,
      data: {
        periodDays: days,
        links: rows,
        subIds: subAgg.map((r) => ({ subId: r._id, clicks: r.clicks }))
      }
    });
  } catch (error) {
    console.error('affiliate stats links error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Filleuls (utilisateurs Scalor référés) — emails masqués
router.get('/referrals', requireAffiliateAuth, async (req, res) => {
  try {
    const referred = await EcomUser.find({ referredByAffiliateCode: req.affiliate.referralCode })
      .select('name email createdAt')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const ids = referred.map((u) => u._id);
    const totals = await AffiliateConversion.aggregate([
      {
        $match: {
          affiliateId: req.affiliate._id,
          referredUserId: { $in: ids },
          status: { $ne: 'rejected' }
        }
      },
      {
        $group: {
          _id: '$referredUserId',
          commissions: { $sum: '$commissionAmount' },
          payments: { $sum: { $cond: [{ $eq: ['$conversionType', 'payment'] }, 1, 0] } },
          revenue: { $sum: '$orderAmount' }
        }
      }
    ]);
    const totalsMap = Object.fromEntries(totals.map((t) => [String(t._id), t]));

    return res.json({
      success: true,
      data: {
        referrals: referred.map((u) => {
          const t = totalsMap[String(u._id)] || {};
          return {
            id: u._id,
            name: u.name || '',
            email: maskEmail(u.email),
            signedUpAt: u.createdAt,
            payments: t.payments || 0,
            revenue: t.revenue || 0,
            commissions: t.commissions || 0
          };
        })
      }
    });
  } catch (error) {
    console.error('affiliate referrals error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Affiliate portal — retraits de commissions
// ─────────────────────────────────────────────────────────────────────────────
router.get('/payouts', requireAffiliateAuth, async (req, res) => {
  try {
    const [payouts, balance, config] = await Promise.all([
      AffiliatePayout.find({ affiliateId: req.affiliate._id }).sort({ createdAt: -1 }).limit(100).lean(),
      getAffiliateBalance(req.affiliate._id),
      getAffiliateConfig()
    ]);

    return res.json({
      success: true,
      data: {
        payouts,
        balance: balance.amount,
        balanceConversions: balance.count,
        minPayoutAmount: Number(config.minPayoutAmount ?? 5000),
        savedMethod: {
          method: req.affiliate.payoutMethod || '',
          phoneNumber: req.affiliate.payoutPhone || '',
          accountName: req.affiliate.payoutAccountName || ''
        }
      }
    });
  } catch (error) {
    console.error('affiliate payouts error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.post('/payouts/request', requireAffiliateAuth, async (req, res) => {
  try {
    const { method, phoneNumber, accountName } = req.body || {};

    if (!PAYOUT_METHODS.includes(method)) {
      return res.status(400).json({ success: false, message: 'Méthode de retrait invalide' });
    }
    const cleanPhone = String(phoneNumber || '').trim().slice(0, 30);
    if (['mtn_momo', 'orange_money'].includes(method) && !cleanPhone) {
      return res.status(400).json({ success: false, message: 'Numéro Mobile Money requis' });
    }

    const existingPending = await AffiliatePayout.findOne({
      affiliateId: req.affiliate._id,
      status: 'pending'
    }).lean();
    if (existingPending) {
      return res.status(409).json({ success: false, message: 'Un retrait est déjà en cours de traitement' });
    }

    const config = await getAffiliateConfig();
    const minAmount = Number(config.minPayoutAmount ?? 5000);

    const conversions = await AffiliateConversion.find({
      affiliateId: req.affiliate._id,
      status: 'approved',
      payoutId: null
    }).select('_id commissionAmount').lean();

    const amount = conversions.reduce((sum, c) => sum + (Number(c.commissionAmount) || 0), 0);
    if (amount < minAmount) {
      return res.status(400).json({
        success: false,
        message: `Solde insuffisant : minimum ${minAmount.toLocaleString('fr-FR')} FCFA (solde actuel ${amount.toLocaleString('fr-FR')} FCFA)`
      });
    }

    const payout = await AffiliatePayout.create({
      affiliateId: req.affiliate._id,
      amount,
      currency: 'XAF',
      method,
      phoneNumber: cleanPhone,
      accountName: String(accountName || '').trim().slice(0, 120),
      conversionCount: conversions.length
    });

    // Verrouiller les conversions sur ce retrait (protégé contre les courses)
    const ids = conversions.map((c) => c._id);
    const upd = await AffiliateConversion.updateMany(
      { _id: { $in: ids }, payoutId: null, status: 'approved' },
      { $set: { payoutId: payout._id } }
    );

    // Si une conversion a bougé entre-temps, recaler le montant exact
    if (upd.modifiedCount !== ids.length) {
      const attached = await AffiliateConversion.find({ payoutId: payout._id })
        .select('commissionAmount').lean();
      payout.amount = attached.reduce((s, c) => s + (Number(c.commissionAmount) || 0), 0);
      payout.conversionCount = attached.length;
      await payout.save();
    }

    // Mémoriser les coordonnées de retrait
    req.affiliate.payoutMethod = method;
    req.affiliate.payoutPhone = cleanPhone;
    req.affiliate.payoutAccountName = String(accountName || '').trim().slice(0, 120);
    await req.affiliate.save();

    return res.status(201).json({ success: true, message: 'Demande de retrait enregistrée', data: { payout } });
  } catch (error) {
    console.error('affiliate payout request error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
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
      topAffiliates,
      // Funnel : visites référées + conversions par jour + retraits en attente
      visitsByDay,
      visitsTotal,
      conversionsByDay,
      payoutsPendingAgg
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
      // Top 10 affiliés : triés par conversions desc, puis commissions desc
      // Part des users pour inclure ceux qui ont des conversions sans clics trackés
      AffiliateUser.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'affiliate_conversions',
            localField: '_id',
            foreignField: 'affiliateId',
            as: 'conversions'
          }
        },
        {
          $lookup: {
            from: 'affiliate_links',
            localField: '_id',
            foreignField: 'affiliateId',
            as: 'links'
          }
        },
        {
          $project: {
            affiliateId: '$_id',
            name: 1,
            email: 1,
            referralCode: 1,
            isActive: 1,
            totalClicks: { $sum: '$links.clickCount' },
            totalConversions: { $size: '$conversions' },
            totalCommissions: { $sum: '$conversions.commissionAmount' }
          }
        },
        // Garder seulement ceux qui ont au moins une activité
        { $match: { $or: [{ totalConversions: { $gt: 0 } }, { totalClicks: { $gt: 0 } }] } },
        { $sort: { totalConversions: -1, totalCommissions: -1, totalClicks: -1 } },
        { $limit: 10 }
      ]),
      // Visites référées par jour (30j)
      AffiliateVisit.aggregate([
        { $match: { createdAt: { $gte: start30d } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: STATS_TZ } },
            visits: { $sum: 1 },
            visitors: { $addToSet: '$visitorId' }
          }
        },
        { $project: { visits: 1, uniqueVisitors: { $size: '$visitors' } } },
        { $sort: { _id: 1 } }
      ]),
      AffiliateVisit.countDocuments(),
      // Inscriptions / paiements par jour (30j)
      AffiliateConversion.aggregate([
        { $match: { createdAt: { $gte: start30d }, status: { $ne: 'rejected' } } },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: STATS_TZ } },
              type: '$conversionType'
            },
            count: { $sum: 1 },
            commissions: { $sum: '$commissionAmount' }
          }
        }
      ]),
      AffiliatePayout.aggregate([
        { $match: { status: 'pending' } },
        { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
      ])
    ]);

    const clicksTotal = clickAggregates[0]?.clicksTotal || 0;
    // Clics du jour : depuis AffiliateClick (timestampé) — cohérent avec le graphique
    const clicksToday = await AffiliateClick.countDocuments({ createdAt: { $gte: startOfToday } });

    const clicksByDayFormatted = clicksByDay.map((d) => ({
      date: `${d._id.y}-${String(d._id.m).padStart(2, '0')}-${String(d._id.d).padStart(2, '0')}`,
      clicks: d.clicks
    }));

    // Fusion funnel par jour (visites + inscriptions + paiements + commissions)
    const convDayMap = {};
    for (const row of conversionsByDay) {
      const day = row._id.day;
      if (!convDayMap[day]) convDayMap[day] = { signups: 0, payments: 0, commissions: 0 };
      if (row._id.type === 'signup') convDayMap[day].signups += row.count;
      if (row._id.type === 'payment') convDayMap[day].payments += row.count;
      convDayMap[day].commissions += row.commissions;
    }
    const visitDayMap = Object.fromEntries(visitsByDay.map((v) => [v._id, v]));
    const clickDayMap = Object.fromEntries(clicksByDayFormatted.map((c) => [c.date, c.clicks]));
    const funnelDays = [...new Set([
      ...Object.keys(visitDayMap),
      ...Object.keys(convDayMap),
      ...Object.keys(clickDayMap)
    ])].sort();
    const funnelByDay = funnelDays.map((day) => ({
      date: day,
      visits: visitDayMap[day]?.visits || 0,
      uniqueVisitors: visitDayMap[day]?.uniqueVisitors || 0,
      clicks: clickDayMap[day] || 0,
      signups: convDayMap[day]?.signups || 0,
      payments: convDayMap[day]?.payments || 0,
      commissions: convDayMap[day]?.commissions || 0
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
          conversionsPending,
          visitsTotal,
          payoutsPendingCount: payoutsPendingAgg[0]?.count || 0,
          payoutsPendingAmount: payoutsPendingAgg[0]?.amount || 0
        },
        clicksByDay: clicksByDayFormatted,
        funnelByDay,
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
    linkTypeRules,
    signupBonusAmount,
    paymentCommissionPercent,
    attributionWindowDays,
    minPayoutAmount
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
  if (signupBonusAmount !== undefined) {
    config.signupBonusAmount = Math.max(0, Number(signupBonusAmount) || 0);
  }
  if (paymentCommissionPercent !== undefined) {
    config.paymentCommissionPercent = Math.min(100, Math.max(0, Number(paymentCommissionPercent) || 0));
  }
  if (attributionWindowDays !== undefined) {
    config.attributionWindowDays = Math.max(1, Number(attributionWindowDays) || 60);
  }
  if (minPayoutAmount !== undefined) {
    config.minPayoutAmount = Math.max(0, Number(minPayoutAmount) || 0);
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

// ─────────────────────────────────────────────────────────────────────────────
// Super admin — retraits
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/payouts', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status && ['pending', 'paid', 'rejected'].includes(status)) filter.status = status;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));

    const [items, total, pendingAgg] = await Promise.all([
      AffiliatePayout.find(filter)
        .populate('affiliateId', 'name email referralCode phone')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      AffiliatePayout.countDocuments(filter),
      AffiliatePayout.aggregate([
        { $match: { status: 'pending' } },
        { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
      ])
    ]);

    return res.json({
      success: true,
      data: {
        items,
        pendingTotal: pendingAgg[0]?.amount || 0,
        pendingCount: pendingAgg[0]?.count || 0,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
      }
    });
  } catch (error) {
    console.error('affiliate admin payouts error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.put('/admin/payouts/:id', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { status, adminNote, paymentReference } = req.body || {};
    if (!['paid', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Statut invalide (paid ou rejected)' });
    }

    const payout = await AffiliatePayout.findById(req.params.id);
    if (!payout) return res.status(404).json({ success: false, message: 'Retrait introuvable' });
    if (payout.status !== 'pending') {
      return res.status(409).json({ success: false, message: `Retrait déjà ${payout.status}` });
    }

    if (status === 'paid') {
      // Les commissions verrouillées passent définitivement à "paid"
      await AffiliateConversion.updateMany(
        { payoutId: payout._id },
        { $set: { status: 'paid' } }
      );
    } else {
      // Rejet : les commissions retournent au solde disponible
      await AffiliateConversion.updateMany(
        { payoutId: payout._id },
        { $set: { payoutId: null } }
      );
    }

    payout.status = status;
    payout.adminNote = String(adminNote || '').trim().slice(0, 500);
    payout.paymentReference = String(paymentReference || '').trim().slice(0, 200);
    payout.processedAt = new Date();
    payout.processedBy = req.ecomUser._id;
    await payout.save();

    return res.json({ success: true, message: `Retrait ${status === 'paid' ? 'payé' : 'rejeté'}`, data: payout });
  } catch (error) {
    console.error('affiliate admin payout update error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
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
