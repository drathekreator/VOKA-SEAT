import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInventoryRouter } from '../../src/routes/inventory';

function mockReq(overrides: Record<string, any> = {}) {
  return {
    query: {},
    body: {},
    params: {},
    headers: { authorization: 'Bearer valid-token' },
    ...overrides,
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
    inventory: {
      findMany: vi.fn().mockResolvedValue(items),
      findUnique: vi.fn().mockResolvedValue(items[0] || null),
      update: vi.fn().mockResolvedValue(items[0] || null),
    },
  } as any;
}

/**
 * Extract a route handler from the router by method and path.
 * Skips middleware layers and finds the actual route handler.
 */
function getRouteHandler(prisma: any, method: string, path: string) {
  const router = createInventoryRouter(prisma);
  const layers = (router as any).stack;
  const routeLayer = layers.find(
    (layer: any) => layer.route && layer.route.path === path && layer.route.methods[method]
  );
  if (!routeLayer) {
    throw new Error(`${method.toUpperCase()} ${path} route not found on inventory router`);
  }
  const handlers = routeLayer.route.stack;
  return handlers[handlers.length - 1].handle;
}

describe('Inventory Route - GET /api/inventory', () => {
  it('should return all inventory items ordered by itemName', async () => {
    const inventoryItems = [
      { id: 1, itemName: 'Coffee Beans', quantity: 50, unit: 'kg', minimumThreshold: 10, createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-15') },
      { id: 2, itemName: 'Milk', quantity: 20, unit: 'liters', minimumThreshold: 5, createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-15') },
    ];

    const prisma = createMockPrisma(inventoryItems);
    const handler = getRouteHandler(prisma, 'get', '/');
    const req = mockReq();
    const res = mockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(inventoryItems);
  });

  it('should call findMany with correct orderBy and select', async () => {
    const prisma = createMockPrisma([]);
    const handler = getRouteHandler(prisma, 'get', '/');
    const req = mockReq();
    const res = mockRes();

    await handler(req, res);

    expect(prisma.inventory.findMany).toHaveBeenCalledWith({
      orderBy: { itemName: 'asc' },
      select: {
        id: true,
        itemName: true,
        quantity: true,
        unit: true,
        minimumThreshold: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('should return empty array when no inventory items exist', async () => {
    const prisma = createMockPrisma([]);
    const handler = getRouteHandler(prisma, 'get', '/');
    const req = mockReq();
    const res = mockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('should return 500 when database throws an error', async () => {
    const prisma = {
      inventory: {
        findMany: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      },
    } as any;
    const handler = getRouteHandler(prisma, 'get', '/');
    const req = mockReq();
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch inventory' });
  });
});

describe('Inventory Route - PATCH /api/inventory/:id', () => {
  it('should update inventory item quantity and return updated item', async () => {
    const updatedItem = { id: 1, itemName: 'Coffee Beans', quantity: 75, unit: 'kg', minimumThreshold: 10, createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-16') };
    const prisma = {
      inventory: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, itemName: 'Coffee Beans', quantity: 50 }),
        update: vi.fn().mockResolvedValue(updatedItem),
      },
    } as any;

    const handler = getRouteHandler(prisma, 'patch', '/:id');
    const req = mockReq({ params: { id: '1' }, body: { quantity: 75 } });
    const res = mockRes();

    await handler(req, res);

    expect(prisma.inventory.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { quantity: 75 },
      select: {
        id: true,
        itemName: true,
        quantity: true,
        unit: true,
        minimumThreshold: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(res.json).toHaveBeenCalledWith(updatedItem);
  });

  it('should return 404 when inventory item is not found', async () => {
    const prisma = {
      inventory: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
    } as any;

    const handler = getRouteHandler(prisma, 'patch', '/:id');
    const req = mockReq({ params: { id: '999' }, body: { quantity: 10 } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Inventory item not found' });
    expect(prisma.inventory.update).not.toHaveBeenCalled();
  });

  it('should return 400 when quantity AND minimumThreshold are both missing', async () => {
    const prisma = createMockPrisma([]);
    const handler = getRouteHandler(prisma, 'patch', '/:id');
    const req = mockReq({ params: { id: '1' }, body: {} });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'quantity or minimumThreshold is required',
    });
  });

  it('should return 400 when quantity is negative', async () => {
    const prisma = createMockPrisma([]);
    const handler = getRouteHandler(prisma, 'patch', '/:id');
    const req = mockReq({ params: { id: '1' }, body: { quantity: -5 } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'quantity must be a non-negative integer' });
  });

  it('should return 400 when quantity is a float', async () => {
    const prisma = createMockPrisma([]);
    const handler = getRouteHandler(prisma, 'patch', '/:id');
    const req = mockReq({ params: { id: '1' }, body: { quantity: 5.5 } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'quantity must be a non-negative integer' });
  });

  it('should return 400 when quantity is a string', async () => {
    const prisma = createMockPrisma([]);
    const handler = getRouteHandler(prisma, 'patch', '/:id');
    const req = mockReq({ params: { id: '1' }, body: { quantity: 'ten' } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'quantity must be a non-negative integer' });
  });

  it('should return 400 when id is not a valid number', async () => {
    const prisma = createMockPrisma([]);
    const handler = getRouteHandler(prisma, 'patch', '/:id');
    const req = mockReq({ params: { id: 'abc' }, body: { quantity: 10 } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid inventory item ID' });
  });

  it('should accept quantity of 0', async () => {
    const updatedItem = { id: 1, itemName: 'Sugar', quantity: 0, unit: 'kg', minimumThreshold: 5, createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-16') };
    const prisma = {
      inventory: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, itemName: 'Sugar', quantity: 10 }),
        update: vi.fn().mockResolvedValue(updatedItem),
      },
    } as any;

    const handler = getRouteHandler(prisma, 'patch', '/:id');
    const req = mockReq({ params: { id: '1' }, body: { quantity: 0 } });
    const res = mockRes();

    await handler(req, res);

    expect(prisma.inventory.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { quantity: 0 },
      select: expect.any(Object),
    });
    expect(res.json).toHaveBeenCalledWith(updatedItem);
  });

  it('should return 500 when database throws an error on update', async () => {
    const prisma = {
      inventory: {
        findUnique: vi.fn().mockResolvedValue({ id: 1 }),
        update: vi.fn().mockRejectedValue(new Error('DB write failed')),
      },
    } as any;

    const handler = getRouteHandler(prisma, 'patch', '/:id');
    const req = mockReq({ params: { id: '1' }, body: { quantity: 10 } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to update inventory item' });
  });
});
