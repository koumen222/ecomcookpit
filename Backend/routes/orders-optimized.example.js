/**
 * Example: Optimized Orders Route
 * 
 * This shows how to use the optimization tools in a real route handler
 * 
 * To use this:
 * 1. Copy patterns from this file into your actual routes
 * 2. Apply caching, query optimization, and compression
 */

import express from 'express';
import { redisClient } from '../config/redisOptimized.js';
import { orderQueryOptimizer, queryOptimizer } from '../config/queryOptimizer.js';
import { cacheMiddleware, invalidateCache } from '../middleware/cacheHelper.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = express.Router();

/**
 * GET /api/ecom/orders
 * Get orders with full caching and optimization
 */
router.get(
  '/',
  requireEcomAuth,
  cacheMiddleware(180), // Cache for 3 minutes
  async (req, res) => {
    try {
      const { workspaceId, userId } = req.user;
      const { page = 1, limit = 20, status, search, sort = 'createdAt' } = req.query;

      const offset = (page - 1) * limit;

      // Use optimized query (no N+1, only needed fields)
      const { orders, total, hasMore } = await orderQueryOptimizer.getOrders(
        workspaceId,
        { status, search },
        { offset, limit, sortBy: sort }
      );

      return res.json({
        success: true,
        data: orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          hasMore,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  }
);

/**
 * GET /api/ecom/orders/:id
 * Get single order with details (shorter cache)
 */
router.get(
  '/:id',
  requireEcomAuth,
  cacheMiddleware(60), // Cache for 1 minute
  async (req, res) => {
    try {
      const { id } = req.params;
      const { workspaceId } = req.user;

      // Use Redis get-with-refresh pattern
      const order = await redisClient.getWithRefresh(
        `order:${id}:${workspaceId}`,
        () => orderQueryOptimizer.getOrderWithDetails(id, workspaceId),
        60
      );

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.json({ success: true, data: order });
    } catch (error) {
      console.error('Error fetching order:', error);
      res.status(500).json({ error: 'Failed to fetch order' });
    }
  }
);

/**
 * GET /api/ecom/orders/stats/summary
 * Get order statistics with heavy computation
 */
router.get(
  '/stats/summary',
  requireEcomAuth,
  cacheMiddleware(300), // Cache for 5 minutes
  async (req, res) => {
    try {
      const { workspaceId } = req.user;
      const { startDate, endDate } = req.query;

      const from = new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = new Date(endDate || Date.now());

      // Aggregate at database level, not in memory
      const stats = await orderQueryOptimizer.getOrderStats(
        workspaceId,
        from,
        to
      );

      // Transform for frontend
      const summary = {};
      let totalAmount = 0;
      let totalOrders = 0;

      for (const stat of stats) {
        summary[stat.status] = {
          count: stat._count.id,
          amount: stat._sum.amount || 0,
          average: stat._avg.amount || 0
        };
        totalAmount += stat._sum.amount || 0;
        totalOrders += stat._count.id;
      }

      res.json({
        success: true,
        data: {
          byStatus: summary,
          total: {
            count: totalOrders,
            amount: totalAmount,
            average: totalOrders > 0 ? totalAmount / totalOrders : 0
          },
          dateRange: { from, to }
        }
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
      res.status(500).json({ error: 'Failed to calculate stats' });
    }
  }
);

/**
 * POST /api/ecom/orders
 * Create order (invalidate list cache)
 */
router.post(
  '/',
  requireEcomAuth,
  async (req, res) => {
    try {
      const { workspaceId, userId } = req.user;
      const orderData = req.body;

      // Create order
      const order = await prisma.order.create({
        data: {
          ...orderData,
          workspaceId,
          createdBy: userId
        },
        select: orderQueryOptimizer.selects.full
      });

      // Invalidate list cache
      await invalidateCache('/api/ecom/orders/*');

      res.status(201).json({
        success: true,
        data: order,
        message: 'Order created successfully'
      });
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  }
);

/**
 * PUT /api/ecom/orders/bulk/update-status
 * Bulk update orders status (optimized)
 */
router.put(
  '/bulk/update-status',
  requireEcomAuth,
  async (req, res) => {
    try {
      const { workspaceId } = req.user;
      const { orderIds, status } = req.body;

      if (!orderIds?.length || !status) {
        return res.status(400).json({ error: 'Missing orderIds or status' });
      }

      // Use bulk update (single query, not loop)
      const result = await orderQueryOptimizer.bulkUpdateStatus(
        orderIds,
        status,
        workspaceId
      );

      // Invalidate individual caches
      await Promise.all([
        invalidateCache('/api/ecom/orders/*'),
        ...orderIds.map(id => redisClient.client.del(`order:${id}:${workspaceId}`))
      ]);

      res.json({
        success: true,
        message: `Updated ${result.count} orders`,
        updated: result.count
      });
    } catch (error) {
      console.error('Error bulk updating orders:', error);
      res.status(500).json({ error: 'Failed to update orders' });
    }
  }
);

/**
 * GET /api/admin/cache-stats
 * Monitor cache performance
 */
router.get('/admin/cache-stats', requireEcomAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const redisStats = await redisClient.getStats();
    const cacheSize = redisClient.client ? 
      await redisClient.client.dbsize() : 
      0;

    res.json({
      success: true,
      data: {
        redis: {
          ...redisStats,
          keysCount: cacheSize,
          enabled: redisClient.enabled
        },
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

/**
 * DELETE /api/admin/cache/clear
 * Clear all cache (dangerous!)
 */
router.delete('/admin/cache/clear', requireEcomAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    await invalidateCache('/*');
    res.json({
      success: true,
      message: 'Cache cleared'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;
