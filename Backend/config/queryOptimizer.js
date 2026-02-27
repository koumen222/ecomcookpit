import prisma from './prismaClient.js';

/**
 * Optimized Prisma query builder
 * Prevents N+1 queries, selects only needed fields
 */

export const orderQueryOptimizer = {
  // Common select patterns
  selects: {
    basic: {
      id: true,
      orderNumber: true,
      clientName: true,
      clientPhone: true,
      status: true,
      amount: true,
      createdAt: true,
    },
    full: {
      id: true,
      orderNumber: true,
      clientName: true,
      clientPhone: true,
      clientEmail: true,
      status: true,
      amount: true,
      items: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      assignedTo: true,
    },
    withClient: {
      id: true,
      orderNumber: true,
      status: true,
      amount: true,
      createdAt: true,
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          city: true,
          country: true,
        }
      }
    }
  },

  /**
   * Get orders with optimized query
   * - Selects only needed fields
   * - Uses includes strategically
   * - Limits batch sizes
   */
  async getOrders(workspaceId, filters = {}, pagination = {}) {
    const {
      limit = 20,
      offset = 0,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = { ...filters, ...pagination };

    // Validate pagination
    const take = Math.min(Math.max(1, limit), 100); // Max 100 per query
    const skip = Math.max(0, offset);

    const where = {
      workspaceId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { clientName: { contains: search, mode: 'insensitive' } },
          { clientPhone: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    // Execute query with selection
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: this.selects.basic,
        orderBy: { [sortBy]: sortOrder },
        take,
        skip,
      }),
      prisma.order.count({ where })
    ]);

    return {
      orders,
      total,
      hasMore: skip + orders.length < total,
      pageSize: take
    };
  },

  /**
   * Get single order with relationships
   */
  async getOrderWithDetails(orderId, workspaceId) {
    return prisma.order.findUnique({
      where: { id: orderId },
      select: {
        ...this.selects.full,
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
            country: true,
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });
  },

  /**
   * Batch get orders (more efficient than loop)
   */
  async getOrdersByIds(ids, workspaceId) {
    return prisma.order.findMany({
      where: {
        id: { in: ids },
        workspaceId
      },
      select: this.selects.basic,
      take: 100 // Safety limit
    });
  },

  /**
   * Aggregate statistics (use Prisma aggregation, not post-processing)
   */
  async getOrderStats(workspaceId, dateFrom, dateTo) {
    const results = await prisma.order.groupBy({
      by: ['status'],
      where: {
        workspaceId,
        createdAt: {
          gte: dateFrom,
          lte: dateTo
        }
      },
      _count: {
        id: true
      },
      _sum: {
        amount: true
      },
      _avg: {
        amount: true
      }
    });

    return results;
  },

  /**
   * Bulk update (single query, not loop)
   */
  async bulkUpdateStatus(orderIds, status, workspaceId) {
    return prisma.order.updateMany({
      where: {
        id: { in: orderIds },
        workspaceId
      },
      data: {
        status,
        updatedAt: new Date()
      }
    });
  },

  /**
   * Batch create (use createMany)
   */
  async bulkCreate(orders, workspaceId) {
    return prisma.order.createMany({
      data: orders.map(o => ({ ...o, workspaceId })),
      skipDuplicates: true
    });
  },

  /**
   * Advanced search with full text (requires database support)
   */
  async searchOrders(workspaceId, query) {
    // Use raw SQL for better performance on large datasets
    return prisma.$queryRaw`
      SELECT id, "orderNumber", "clientName", status, amount, "createdAt"
      FROM "Order"
      WHERE "workspaceId" = ${workspaceId}
      AND (
        "orderNumber" ILIKE ${`%${query}%`}
        OR "clientName" ILIKE ${`%${query}%`}
        OR "clientPhone" ILIKE ${`%${query}%`}
      )
      ORDER BY "createdAt" DESC
      LIMIT 100
    `;
  }
};

/**
 * Generic query optimizer
 */
export const queryOptimizer = {
  /**
   * Execute with timeout to prevent hanging queries
   */
  async withTimeout(promise, timeoutMs = 5000) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
      )
    ]);
  },

  /**
   * Batch processor for large datasets
   */
  async processBatch(items, batchSize = 50, processor) {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const processed = await Promise.all(batch.map(processor));
      results.push(...processed);
    }
    
    return results;
  },

  /**
   * Parallel queries with concurrency limit
   */
  async parallelQueries(queries, concurrency = 3) {
    const results = [];
    const executing = [];

    for (const query of queries) {
      const p = Promise.resolve(query()).then(r => {
        executing.splice(executing.indexOf(p), 1);
        return r;
      });

      results.push(p);
      executing.push(p);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }

    return Promise.all(results);
  }
};
