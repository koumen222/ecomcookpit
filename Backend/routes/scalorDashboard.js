import { Router } from 'express';
import { scalorAuth, scalorRateLimit } from '../middleware/scalorAuth.js';
import ScalorInstance from '../models/ScalorInstance.js';
import ScalorMessageLog from '../models/ScalorMessageLog.js';
import { scalorDashboardAuth } from './scalorAuth.js';

const router = Router();

// ═══════════════════════════════════════════════
// GET /usage — Get usage stats (API key auth)
// ═══════════════════════════════════════════════
router.get('/usage', scalorAuth, scalorRateLimit, async (req, res) => {
  try {
    const user = req.scalorUser;
    user.checkAndResetCounters();

    const instanceCount = await ScalorInstance.countDocuments({ userId: user._id, isActive: true });

    // Stats for last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [totalMessages, failedMessages, dailyStats] = await Promise.all([
      ScalorMessageLog.countDocuments({ userId: user._id, sentAt: { $gte: thirtyDaysAgo } }),
      ScalorMessageLog.countDocuments({ userId: user._id, sentAt: { $gte: thirtyDaysAgo }, status: 'failed' }),
      ScalorMessageLog.aggregate([
        { $match: { userId: user._id, sentAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$sentAt' } },
            count: { $sum: 1 },
            sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    res.json({
      success: true,
      plan: user.plan,
      usage: {
        instances: { current: instanceCount, max: user.maxInstances },
        daily: { sent: user.messagesSentToday, limit: user.dailyMessageLimit },
        monthly: { sent: user.messagesSentThisMonth, limit: user.monthlyMessageLimit }
      },
      stats: {
        last30Days: { total: totalMessages, failed: failedMessages, successRate: totalMessages > 0 ? ((totalMessages - failedMessages) / totalMessages * 100).toFixed(1) + '%' : 'N/A' },
        daily: dailyStats
      }
    });
  } catch (error) {
    console.error('❌ [Scalor] Usage error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// GET /dashboard — Full dashboard data (JWT auth)
// ═══════════════════════════════════════════════
router.get('/dashboard', scalorDashboardAuth, async (req, res) => {
  try {
    const user = req.scalorUser;
    user.checkAndResetCounters();
    await user.save();

    const [instances, recentMessages, totalMessages, instanceStats] = await Promise.all([
      ScalorInstance.find({ userId: user._id, isActive: true })
        .select('displayName instanceName status phoneNumber messagesSentToday messagesSentThisMonth lastConnectedAt createdAt'),
      ScalorMessageLog.find({ userId: user._id })
        .sort({ sentAt: -1 })
        .limit(20)
        .select('phoneNumber messageType status contentPreview sentAt instanceName'),
      ScalorMessageLog.countDocuments({ userId: user._id }),
      ScalorMessageLog.aggregate([
        { $match: { userId: user._id } },
        {
          $group: {
            _id: '$instanceName',
            total: { $sum: 1 },
            sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        dailyMessageLimit: user.dailyMessageLimit,
        monthlyMessageLimit: user.monthlyMessageLimit,
        messagesSentToday: user.messagesSentToday,
        messagesSentThisMonth: user.messagesSentThisMonth,
        maxInstances: user.maxInstances
      },
      instances,
      recentMessages,
      totalMessages,
      instanceStats
    });
  } catch (error) {
    console.error('❌ [Scalor] Dashboard error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
