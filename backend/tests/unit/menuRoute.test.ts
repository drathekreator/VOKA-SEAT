import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMenuRouter } from '../../src/routes/menu';

// Mock request/response objects for testing Express route handlers
function mockReq(query: Record<string, string> = {}) {
  return {
    query,
    body: {},
    params: {},
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function createMockPrisma(items: any[] = []) {
  return {
    menuItem: {
      findMany: vi.fn().mockResolvedValue(items),
    },
  } as any;
}

/**
 * Extract the GET / handler from the router.
 * Express Router stores route layers internally.
 */
function getRouteHandler(prisma: any) {
  const router = createMenuRouter(prisma);
  // The router has a stack of layers. We need the GET / handler.
  // We'll find the route layer that matches GET /
  const layers = (router as any).stack;
  const routeLayer = layers.find(
    (layer: any) => layer.route && layer.route.path === '/' && layer.route.methods.get
  );
  if (!routeLayer) {
    throw new Error('GET / route not found on menu router');
  }
  // The last handler in the route stack is our actual handler (after middleware)
  const handlers = routeLayer.route.stack;
  return handlers[handlers.length - 1].handle;
}

describe('Menu Route - GET /api/menu', () => {
  it('should return all menu items with price converted to number', async () => {
    const prismaItems = [
      { id: 1, name: 'Americano', description: 'Classic black coffee', price: '25000', category: 'Coffee', imageUrl: 'https://example.com/americano.jpg', isAvailable: true },
      { id: 2, name: 'Croissant', description: 'Buttery pastry', price: '18000', category: 'Pastry', imageUrl: null, isAvailable: true },
    ];

    const prisma = createMockPrisma(prismaItems);
    const handler = getRouteHandler(prisma);
    const req = mockReq();
    const res = mockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith([
      { id: 1, name: 'Americano', description: 'Classic black coffee', price: 25000, category: 'Coffee', imageUrl: 'https://example.com/americano.jpg', isAvailable: true },
      { id: 2, name: 'Croissant', description: 'Buttery pastry', price: 18000, category: 'Pastry', imageUrl: null, isAvailable: true },
    ]);
  });

  it('should filter by category query param (case-insensitive)', async () => {
    const prisma = createMockPrisma([]);
    const handler = getRouteHandler(prisma);
    const req = mockReq({ category: 'coffee' });
    const res = mockRes();

    await handler(req, res);

    expect(prisma.menuItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          category: {
            equals: 'coffee',
            mode: 'insensitive',
          },
        },
      })
    );
  });

  it('should return items ordered by category then name', async () => {
    const prisma = createMockPrisma([]);
    const handler = getRouteHandler(prisma);
    const req = mockReq();
    const res = mockRes();

    await handler(req, res);

    expect(prisma.menuItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { category: 'asc' },
          { name: 'asc' },
        ],
      })
    );
  });

  it('should return empty array when no items exist', async () => {
    const prisma = createMockPrisma([]);
    const handler = getRouteHandler(prisma);
    const req = mockReq();
    const res = mockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('should ignore empty category query param', async () => {
    const prisma = createMockPrisma([]);
    const handler = getRouteHandler(prisma);
    const req = mockReq({ category: '' });
    const res = mockRes();

    await handler(req, res);

    expect(prisma.menuItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });

  it('should return 500 when database throws an error', async () => {
    const prisma = {
      menuItem: {
        findMany: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      },
    } as any;
    const handler = getRouteHandler(prisma);
    const req = mockReq();
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch menu items' });
  });

  it('should select only required fields', async () => {
    const prisma = createMockPrisma([]);
    const handler = getRouteHandler(prisma);
    const req = mockReq();
    const res = mockRes();

    await handler(req, res);

    expect(prisma.menuItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          category: true,
          imageUrl: true,
          isAvailable: true,
        },
      })
    );
  });

  it('should handle Decimal price objects from Prisma', async () => {
    // Prisma Decimal objects have a toString that returns the numeric string
    const prismaItems = [
      { id: 1, name: 'Latte', description: 'Espresso with milk', price: { toString: () => '30000.50' }, category: 'Coffee', imageUrl: null, isAvailable: true },
    ];

    const prisma = createMockPrisma(prismaItems);
    const handler = getRouteHandler(prisma);
    const req = mockReq();
    const res = mockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith([
      { id: 1, name: 'Latte', description: 'Espresso with milk', price: 30000.5, category: 'Coffee', imageUrl: null, isAvailable: true },
    ]);
  });
});
