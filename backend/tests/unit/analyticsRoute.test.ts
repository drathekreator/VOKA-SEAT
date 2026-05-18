import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAnalyticsRouter } from '../../src/routes/analytics';

/**
 * Analytics routes are gated by `adminAuthMiddleware`, which after the
 * Section-21 rewrite distinguishes "missing/invalid JWT" (401) from
 * "valid JWT lacking role=admin" (403). Stub jsonwebtoken so a request
 * with `Authorization: Bearer admin-token` resolves to a payload that
 * carries `role: 'admin'`. Anything else 401s.
 */
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: (token: string) => {
      if (token === 'admin-token') {
        return { username: 'admin', role: 'admin' };
      }
      throw new Error('invalid token');
    },
    sign: () => 'mock-token',
  },
}));

function createMockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    order: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { totalAmount: null } }),
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides,
    },
  } as unknown as Parameters<typeof createAnalyticsRouter>[0];
}

function createApp(prisma: ReturnType<typeof createMockPrisma>) {
  const app = express();
  app.use(express.json());
  app.use('/api/analytics', createAnalyticsRouter(prisma));
  return app;
}

const adminAuth = { Authorization: 'Bearer admin-token' };

describe('Analytics Route', () => {
  describe('GET /api/analytics/sales', () => {
    it('returns 401 without auth token', async () => {
      const prisma = createMockPrisma();
      const app = createApp(prisma);

      const res = await request(app).get('/api/analytics/sales');
      expect(res.status).toBe(401);
    });

    it('returns sales data with "No data available" message when no orders exist', async () => {
      const prisma = createMockPrisma();
      const app = createApp(prisma);

      const res = await request(app)
        .get('/api/analytics/sales')
        .set(adminAuth);

      expect(res.status).toBe(200);
      expect(res.body.currentTotal).toBe(0);
      expect(res.body.previousTotal).toBe(0);
      expect(res.body.trendPercentage).toBe(0);
      expect(res.body.period).toBe('daily');
      expect(res.body.message).toBe('No data available');
    });

    it('defaults to daily period', async () => {
      const prisma = createMockPrisma();
      const app = createApp(prisma);

      const res = await request(app)
        .get('/api/analytics/sales')
        .set(adminAuth);

      expect(res.status).toBe(200);
      expect(res.body.period).toBe('daily');
    });

    it('accepts weekly period', async () => {
      const prisma = createMockPrisma();
      const app = createApp(prisma);

      const res = await request(app)
        .get('/api/analytics/sales?period=weekly')
        .set(adminAuth);

      expect(res.status).toBe(200);
      expect(res.body.period).toBe('weekly');
    });

    it('returns trend percentage when data exists', async () => {
      const aggregateMock = vi
        .fn()
        .mockResolvedValueOnce({ _sum: { totalAmount: 150 } }) // current
        .mockResolvedValueOnce({ _sum: { totalAmount: 100 } }); // previous

      const prisma = createMockPrisma();
      (prisma.order as unknown as { aggregate: typeof aggregateMock }).aggregate = aggregateMock;
      const app = createApp(prisma);

      const res = await request(app)
        .get('/api/analytics/sales')
        .set(adminAuth);

      expect(res.status).toBe(200);
      expect(res.body.currentTotal).toBe(150);
      expect(res.body.previousTotal).toBe(100);
      expect(res.body.trendPercentage).toBe(50);
      expect(res.body.message).toBeUndefined();
    });
  });

  describe('GET /api/analytics/occupancy', () => {
    it('returns 401 without auth token', async () => {
      const prisma = createMockPrisma();
      const app = createApp(prisma);

      const res = await request(app).get('/api/analytics/occupancy');
      expect(res.status).toBe(401);
    });

    it('returns empty data with message when no orders exist', async () => {
      const prisma = createMockPrisma();
      const app = createApp(prisma);

      const res = await request(app)
        .get('/api/analytics/occupancy')
        .set(adminAuth);

      expect(res.status).toBe(200);
      expect(res.body.peakHours).toEqual([]);
      expect(res.body.seatEfficiency).toEqual([]);
      expect(res.body.message).toBe('No data available');
    });

    it('returns peak hours and seat efficiency when data exists', async () => {
      const now = new Date();
      const mockOrders = [
        {
          createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0),
          updatedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30),
          seatId: 1,
          seat: { zone: 'left' },
        },
        {
          createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 15),
          updatedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 45),
          seatId: 5,
          seat: { zone: 'center' },
        },
        {
          createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0),
          updatedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 20),
          seatId: 12,
          seat: { zone: 'upper' },
        },
      ];

      const prisma = createMockPrisma();
      (prisma.order as unknown as { findMany: ReturnType<typeof vi.fn> }).findMany =
        vi.fn().mockResolvedValue(mockOrders);
      const app = createApp(prisma);

      const res = await request(app)
        .get('/api/analytics/occupancy')
        .set(adminAuth);

      expect(res.status).toBe(200);
      expect(res.body.peakHours).toBeDefined();
      expect(Array.isArray(res.body.peakHours)).toBe(true);
      expect(res.body.peakHours.length).toBeLessThanOrEqual(3);
      expect(res.body.seatEfficiency).toBeDefined();
      expect(Array.isArray(res.body.seatEfficiency)).toBe(true);
      expect(res.body.seatEfficiency.length).toBe(3);
      expect(res.body.message).toBeUndefined();
    });

    it('returns 403 when a customer JWT is presented', async () => {
      // Override the global mock for this single test so we can
      // simulate a valid-but-non-admin JWT and assert 403.
      const jwt = await import('jsonwebtoken');
      const original = jwt.default.verify;
      (jwt.default.verify as unknown as (t: string) => unknown) = (token: string) => {
        if (token === 'customer-token') {
          return { email: 'jane@example.com', name: 'Jane', role: 'customer' };
        }
        throw new Error('invalid token');
      };
      try {
        const prisma = createMockPrisma();
        const app = createApp(prisma);
        const res = await request(app)
          .get('/api/analytics/occupancy')
          .set('Authorization', 'Bearer customer-token');
        expect(res.status).toBe(403);
      } finally {
        (jwt.default.verify as unknown as typeof original) = original;
      }
    });
  });
});
