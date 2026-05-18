import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { adminAuthMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { calculateSalesTrend, rankPeakHours } from '../services/analyticsService';

/**
 * Creates the analytics REST API router.
 *
 * All routes are admin-only. `adminAuthMiddleware` enforces the role
 * guard directly: HTTP 401 on missing/invalid JWT, HTTP 403 on a valid
 * JWT that lacks `role: 'admin'` (Property 19 / Requirements 15.7,
 * 15.8, 21.6).
 *
 * GET /sales      — daily/weekly sales totals with trend percentage
 * GET /occupancy  — peak hours and seat efficiency per zone
 *
 * @param prisma - PrismaClient instance for database access
 * @returns Express Router
 */
export function createAnalyticsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.use(adminAuthMiddleware);

  /**
   * GET /sales
   * Query params:
   *   - period: "daily" | "weekly" (default: "daily")
   *
   * Returns current period sales total, previous period total, and trend percentage.
   */
  router.get('/sales', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const period = req.query.period === 'weekly' ? 'weekly' : 'daily';

      const now = new Date();
      let currentStart: Date;
      let previousStart: Date;
      let previousEnd: Date;

      if (period === 'daily') {
        // Current day: start of today
        currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // Previous day
        previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - 1);
        previousEnd = new Date(currentStart);
      } else {
        // Weekly: current week (Monday to now)
        const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);
        // Previous week (Monday to Sunday)
        previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - 7);
        previousEnd = new Date(currentStart);
      }

      // Calculate current period sales total (exclude cancelled orders)
      const currentOrders = await prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          createdAt: { gte: currentStart, lte: now },
          status: { not: 'cancelled' },
        },
      });

      // Calculate previous period sales total (exclude cancelled orders)
      const previousOrders = await prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          createdAt: { gte: previousStart, lt: previousEnd },
          status: { not: 'cancelled' },
        },
      });

      const currentTotal = Number(currentOrders._sum.totalAmount ?? 0);
      const previousTotal = Number(previousOrders._sum.totalAmount ?? 0);
      const trendPercentage = calculateSalesTrend(currentTotal, previousTotal);

      if (currentTotal === 0 && previousTotal === 0) {
        res.json({
          currentTotal: 0,
          previousTotal: 0,
          trendPercentage: 0,
          period,
          message: 'No data available',
        });
        return;
      }

      res.json({
        currentTotal,
        previousTotal,
        trendPercentage,
        period,
      });
    } catch (error) {
      console.error('❌ Error fetching sales analytics:', error);
      res.status(500).json({ error: 'Failed to fetch sales analytics' });
    }
  });

  /**
   * GET /occupancy
   * Returns peak hours (top 3 busiest time slots by average occupancy)
   * and seat efficiency per zone (avg occupancy duration, turnover rate).
   */
  router.get('/occupancy', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Fetch orders for today to compute hourly occupancy
      const todayOrders = await prisma.order.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: now },
          status: { not: 'cancelled' },
          seatId: { not: null },
        },
        select: {
          createdAt: true,
          seatId: true,
          updatedAt: true,
          seat: { select: { zone: true } },
        },
      });

      if (todayOrders.length === 0) {
        res.json({
          peakHours: [],
          seatEfficiency: [],
          message: 'No data available',
        });
        return;
      }

      // Calculate hourly occupancy from orders with assigned seats
      const hourlyMap = new Map<number, { totalOccupancy: number; count: number }>();

      for (const order of todayOrders) {
        const hour = order.createdAt.getHours();
        const existing = hourlyMap.get(hour) || { totalOccupancy: 0, count: 0 };
        existing.totalOccupancy += 1;
        existing.count += 1;
        hourlyMap.set(hour, existing);
      }

      const hourlyData = Array.from(hourlyMap.entries()).map(([hour, data]) => ({
        hour,
        avgOccupancy: data.totalOccupancy / data.count,
      }));

      const peakHours = rankPeakHours(hourlyData);

      // Calculate seat efficiency per zone
      const zones = ['left', 'center', 'upper'];
      const seatEfficiency = zones.map((zone) => {
        const zoneOrders = todayOrders.filter((o) => o.seat?.zone === zone);
        const totalDuration = zoneOrders.reduce((sum, order) => {
          const duration = (order.updatedAt.getTime() - order.createdAt.getTime()) / 60000; // minutes
          return sum + duration;
        }, 0);

        const avgDuration = zoneOrders.length > 0
          ? Math.round((totalDuration / zoneOrders.length) * 10) / 10
          : 0;

        // Turnover rate: number of occupy-then-vacate cycles per seat per day
        // Approximate using number of orders assigned to seats in this zone
        const seatsInZone = zone === 'left' ? 4 : zone === 'center' ? 6 : 14;
        const turnoverRate = zoneOrders.length > 0
          ? Math.round((zoneOrders.length / seatsInZone) * 10) / 10
          : 0;

        return {
          zone,
          avgOccupancyDuration: avgDuration,
          turnoverRate,
        };
      });

      res.json({
        peakHours,
        seatEfficiency,
      });
    } catch (error) {
      console.error('❌ Error fetching occupancy analytics:', error);
      res.status(500).json({ error: 'Failed to fetch occupancy analytics' });
    }
  });

  return router;
}
