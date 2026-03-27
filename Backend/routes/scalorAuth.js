import { Router } from 'express';
import jwt from 'jsonwebtoken';
import ScalorUser from '../models/ScalorUser.js';
import ScalorApiKey from '../models/ScalorApiKey.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = Router();

const SCALOR_JWT_SECRET = process.env.SCALOR_JWT_SECRET || process.env.ECOM_JWT_SECRET || 'scalor-secret-change-me';

// Plan configurations with FCFA pricing
const PLAN_CONFIGS = {
  starter:    { maxInstances: 1,  dailyMessageLimit: 500,   monthlyMessageLimit: 10000,  rateLimit: 30,  priceXAF: 0,     priceUSD: 0,   label: 'Starter (Gratuit)' },
  pro:        { maxInstances: 5,  dailyMessageLimit: 5000,  monthlyMessageLimit: 100000, rateLimit: 120, priceXAF: 10000, priceUSD: 16,  label: 'Pro' },
  business:   { maxInstances: 20, dailyMessageLimit: 50000, monthlyMessageLimit: 500000, rateLimit: 300, priceXAF: 25000, priceUSD: 40,  label: 'Business' },
  enterprise: { maxInstances: -1, dailyMessageLimit: -1,    monthlyMessageLimit: -1,     rateLimit: 600, priceXAF: 50000, priceUSD: 80,  label: 'Enterprise' },
};

// GET /plans — Public: list available plans with pricing
router.get('/plans', (_req, res) => {
  const plans = Object.entries(PLAN_CONFIGS).map(([key, cfg]) => ({
    id: key,
    label: cfg.label,
    maxInstances: cfg.maxInstances === -1 ? 'Illimité' : cfg.maxInstances,
    dailyMessages: cfg.dailyMessageLimit === -1 ? 'Illimité' : cfg.dailyMessageLimit,
    monthlyMessages: cfg.monthlyMessageLimit === -1 ? 'Illimité' : cfg.monthlyMessageLimit,
    rateLimit: `${cfg.rateLimit} req/min`,
    pricing: { XAF: cfg.priceXAF, USD: cfg.priceUSD }
  }));
  res.json({ success: true, plans });
});

// =================================================================
// POST /from-ecom — Auto-login via ecom session (no password needed)
// Accepts the ecom JWT and returns/creates a linked Scalor account.
// =================================================================
router.post('/from-ecom', requireEcomAuth, async (req, res) => {
  try {
    const ecomUser = req.ecomUser;
    const email = (ecomUser.email || '').toLowerCase().trim();
    const name  = ecomUser.name || ecomUser.email || 'Ecom Admin';

    if (!email) return res.status(400).json({ error: 'no_email' });

    // Find or create a Scalor account linked to this ecom email
    let user = await ScalorUser.findOne({ email });
    if (!user) {
      // Auto-create with a random password (never used for login, only from-ecom is allowed)
      const planConfig = PLAN_CONFIGS.business;
      user = await ScalorUser.create({
        email,
        password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
        name,
        plan: 'business',
        ...planConfig
      });
      // Auto-generate first API key
      const { rawKey: _rk, keyHash, keyPrefix } = ScalorApiKey.generateKey('live');
      await ScalorApiKey.create({
        userId: user._id,
        keyHash,
        keyPrefix,
        name: 'Default API Key',
        rateLimit: planConfig.rateLimit
      });
    }

    // Backfill older auto-linked accounts created with starter limits
    // so the Developer section can create multiple instances.
    if ((user.maxInstances ?? 0) <= 1 && user.plan === 'starter') {
      const planConfig = PLAN_CONFIGS.business;
      user.plan = 'business';
      user.maxInstances = planConfig.maxInstances;
      user.dailyMessageLimit = planConfig.dailyMessageLimit;
      user.monthlyMessageLimit = planConfig.monthlyMessageLimit;

      await ScalorApiKey.updateMany(
        { userId: user._id, isActive: true },
        { $set: { rateLimit: planConfig.rateLimit } }
      );
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'account_suspended' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      SCALOR_JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        company: user.company,
        plan: user.plan,
        maxInstances: user.maxInstances,
        dailyMessageLimit: user.dailyMessageLimit,
        monthlyMessageLimit: user.monthlyMessageLimit,
        messagesSentToday: user.messagesSentToday,
        messagesSentThisMonth: user.messagesSentThisMonth
      },
      token
    });
  } catch (error) {
    console.error('❌ [Scalor] from-ecom error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// POST /register — Create a new Scalor account
// ═══════════════════════════════════════════════
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, company, phone } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'missing_fields', message: 'email, password and name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'weak_password', message: 'Password must be at least 8 characters' });
    }

    // Check if email already exists
    const existing = await ScalorUser.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'email_exists', message: 'An account with this email already exists' });
    }

    const planConfig = PLAN_CONFIGS.starter;
    const user = await ScalorUser.create({
      email: email.toLowerCase().trim(),
      password,
      name: name.trim(),
      company: company?.trim(),
      phone: phone?.trim(),
      plan: 'starter',
      ...planConfig
    });

    // Auto-generate first API key
    const { rawKey, keyHash, keyPrefix } = ScalorApiKey.generateKey('live');
    await ScalorApiKey.create({
      userId: user._id,
      keyHash,
      keyPrefix,
      name: 'Default API Key',
      rateLimit: planConfig.rateLimit
    });

    // Generate JWT for dashboard access
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      SCALOR_JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        plan: user.plan
      },
      apiKey: rawKey,  // Show only once!
      token,
      message: '⚠️ Save your API key now. It will not be shown again.'
    });
  } catch (error) {
    console.error('❌ [Scalor] Register error:', error);
    res.status(500).json({ error: 'server_error', message: 'Registration failed' });
  }
});

// ═══════════════════════════════════════════════
// POST /login — Login to Scalor dashboard
// ═══════════════════════════════════════════════
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'missing_fields', message: 'email and password are required' });
    }

    const user = await ScalorUser.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'account_suspended', message: 'Your account has been suspended' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      SCALOR_JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        company: user.company,
        plan: user.plan,
        maxInstances: user.maxInstances,
        dailyMessageLimit: user.dailyMessageLimit,
        monthlyMessageLimit: user.monthlyMessageLimit,
        messagesSentToday: user.messagesSentToday,
        messagesSentThisMonth: user.messagesSentThisMonth
      },
      token
    });
  } catch (error) {
    console.error('❌ [Scalor] Login error:', error);
    res.status(500).json({ error: 'server_error', message: 'Login failed' });
  }
});

// ═══════════════════════════════════════════════
// Dashboard auth middleware (JWT-based for web UI)
// ═══════════════════════════════════════════════
export function scalorDashboardAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'token_required' });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, SCALOR_JWT_SECRET);

    ScalorUser.findById(decoded.userId).then(user => {
      if (!user || !user.isActive) {
        return res.status(403).json({ error: 'account_inactive' });
      }
      req.scalorUser = user;
      next();
    }).catch(() => {
      res.status(500).json({ error: 'auth_error' });
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'token_expired', message: 'Session expired. Please login again.' });
    }
    return res.status(401).json({ error: 'invalid_token' });
  }
}

// ═══════════════════════════════════════════════
// GET /me — Get current user info (dashboard)
// ═══════════════════════════════════════════════
router.get('/me', scalorDashboardAuth, async (req, res) => {
  const user = req.scalorUser;
  user.checkAndResetCounters();
  await user.save();

  const keys = await ScalorApiKey.find({ userId: user._id }).select('keyPrefix name isActive permissions createdAt lastUsedAt expiresAt');

  res.json({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      company: user.company,
      phone: user.phone,
      plan: user.plan,
      planExpiresAt: user.planExpiresAt,
      maxInstances: user.maxInstances,
      dailyMessageLimit: user.dailyMessageLimit,
      monthlyMessageLimit: user.monthlyMessageLimit,
      messagesSentToday: user.messagesSentToday,
      messagesSentThisMonth: user.messagesSentThisMonth,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    },
    apiKeys: keys
  });
});

// ═══════════════════════════════════════════════
// POST /api-keys — Generate a new API key
// ═══════════════════════════════════════════════
router.post('/api-keys', scalorDashboardAuth, async (req, res) => {
  try {
    const { name, type = 'live' } = req.body;

    // Limit number of API keys per user
    const existingCount = await ScalorApiKey.countDocuments({ userId: req.scalorUser._id, isActive: true });
    if (existingCount >= 5) {
      return res.status(400).json({ error: 'max_keys_reached', message: 'Maximum 5 active API keys allowed' });
    }

    const planConfig = PLAN_CONFIGS[req.scalorUser.plan] || PLAN_CONFIGS.starter;
    const { rawKey, keyHash, keyPrefix } = ScalorApiKey.generateKey(type);
    await ScalorApiKey.create({
      userId: req.scalorUser._id,
      keyHash,
      keyPrefix,
      name: name || `API Key ${existingCount + 1}`,
      rateLimit: planConfig.rateLimit
    });

    res.status(201).json({
      success: true,
      apiKey: rawKey,
      keyPrefix,
      message: '⚠️ Save your API key now. It will not be shown again.'
    });
  } catch (error) {
    console.error('❌ [Scalor] Create API key error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// DELETE /api-keys/:id — Revoke an API key
// ═══════════════════════════════════════════════
router.delete('/api-keys/:id', scalorDashboardAuth, async (req, res) => {
  try {
    const key = await ScalorApiKey.findOne({ _id: req.params.id, userId: req.scalorUser._id });
    if (!key) {
      return res.status(404).json({ error: 'key_not_found' });
    }

    key.isActive = false;
    await key.save();

    res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// PUT /plan — Upgrade plan (manual for now)
// ═══════════════════════════════════════════════
router.put('/plan', scalorDashboardAuth, async (req, res) => {
  try {
    const { plan } = req.body;
    const config = PLAN_CONFIGS[plan];
    if (!config) {
      return res.status(400).json({ error: 'invalid_plan', message: 'Valid plans: starter, pro, business, enterprise' });
    }

    const user = req.scalorUser;
    user.plan = plan;
    user.maxInstances = config.maxInstances;
    user.dailyMessageLimit = config.dailyMessageLimit;
    user.monthlyMessageLimit = config.monthlyMessageLimit;
    user.planExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000); // 30 days
    await user.save();

    // Update rate limits on all active keys
    await ScalorApiKey.updateMany(
      { userId: user._id, isActive: true },
      { rateLimit: config.rateLimit }
    );

    res.json({
      success: true,
      plan: user.plan,
      limits: config,
      pricing: { XAF: config.priceXAF, USD: config.priceUSD }
    });
  } catch (error) {
    res.status(500).json({ error: 'server_error' });
  }
});

export { PLAN_CONFIGS };
export default router;
