import { describe, it, expect, vi } from 'vitest';
import { createOrdersRouter } from '../../src/routes/orders';

/**
 * Unit tests for the orders REST router after the Section-21 auth
 * rewrite. Customer JWTs now carry `email` (not `nim`), `userNim` on
 * the Order model has been replaced with `userEmail`, and
 * unauthenticated POSTs persist as Guest_Order rows with
 * `userEmail = null`.
 *
 * Ownership-checked GET /:id returns 404 for orders that don't belong
 * to the requesting customer (we deliberately collapse "not found" and
 * "forbidden" to avoid leaking the existence of other customers'
 * orders).
 */

function mockReq(overrides: Record<string, any> = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: { authorization: 'Bearer valid-token' },
    user: {
      email: 'jane@example.com',
      name: 'Jane',
      role: 'customer' as const,
    },
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

/**
 * Extract a route handler from the router by method and path. Skips
 * middleware layers (sanitizer, auth, tryCustomerAuth) and returns the
 * final handler.
 */
function getRouteHandler(prisma: any, method: string, path: string) {
  const router = createOrdersRouter(prisma);
  const layers = (router as any).stack;
  const routeLayer = layers.find(
    (layer: any) =>
      layer.route &&
      layer.route.path === path &&
      layer.route.methods[method]
  );
  if (!routeLayer) {
    throw new Error(`${method.toUpperCase()} ${path} route not found on orders router`);
  }
  const handlers = routeLayer.route.stack;
  return handlers[handlers.length - 1].handle;
}

describe('Orders Route - POST / (create order)', () => {
  it('should return 400 when items array is missing', async () => {
    const prisma = {} as any;
    const handler = getRouteHandler(prisma, 'post', '/');
    const req = mockReq({ body: {} });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Items array is required and must not be empty',
    });
  });

  it('should return 400 when items array is empty', async () => {
    const prisma = {} as any;
    const handler = getRouteHandler(prisma, 'post', '/');
    const req = mockReq({ body: { items: [] } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Items array is required and must not be empty',
    });
  });

  it('should return 400 when item has invalid menuItemId', async () => {
    const prisma = {} as any;
    const handler = getRouteHandler(prisma, 'post', '/');
    const req = mockReq({ body: { items: [{ quantity: 2 }] } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Each item must have a valid menuItemId',
    });
  });

  it('should return 400 when item has invalid quantity', async () => {
    const prisma = {} as any;
    const handler = getRouteHandler(prisma, 'post', '/');
    const req = mockReq({ body: { items: [{ menuItemId: 1, quantity: 0 }] } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Each item must have a quantity of at least 1',
    });
  });

  it('should return 400 when a menu item is not found', async () => {
    const prisma = {
      menuItem: {
        findMany: vi.fn().mockResolvedValue([{ id: 1, price: '25000' }]),
      },
    } as any;
    const handler = getRouteHandler(prisma, 'post', '/');
    const req = mockReq({
      body: {
        items: [
          { menuItemId: 1, quantity: 1 },
          { menuItemId: 999, quantity: 1 },
        ],
      },
    });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'One or more menu items not found',
    });
  });

  it('persists userEmail from req.user when a customer JWT is attached', async () => {
    const createdOrder = {
      id: 1,
      userEmail: 'jane@example.com',
      totalAmount: 68000,
      status: 'pending',
      items: [],
    };

    const txCreate = vi.fn().mockResolvedValue(createdOrder);
    const prisma = {
      menuItem: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, price: '25000' },
          { id: 2, price: '18000' },
        ]),
      },
      $transaction: vi.fn().mockImplementation(async (fn) => {
        return fn({
          order: { create: txCreate },
        });
      }),
    } as any;

    const handler = getRouteHandler(prisma, 'post', '/');
    const req = mockReq({
      body: {
        items: [
          { menuItemId: 1, quantity: 2 },
          { menuItemId: 2, quantity: 1 },
        ],
      },
    });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(createdOrder);
    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userEmail: 'jane@example.com',
          totalAmount: 68000,
          status: 'pending',
          statusHistory: { create: { status: 'pending' } },
        }),
      }),
    );
  });

  it('persists userEmail = null when no req.user is attached (Guest_Order)', async () => {
    const createdOrder = {
      id: 7,
      userEmail: null,
      totalAmount: 25000,
      status: 'pending',
      items: [],
    };
    const txCreate = vi.fn().mockResolvedValue(createdOrder);
    const prisma = {
      menuItem: {
        findMany: vi.fn().mockResolvedValue([{ id: 1, price: '25000' }]),
      },
      $transaction: vi.fn().mockImplementation(async (fn) =>
        fn({ order: { create: txCreate } }),
      ),
    } as any;

    const handler = getRouteHandler(prisma, 'post', '/');
    // No `user` on the request — tryCustomerAuth would simply skip
    // populating it for an unauthenticated guest.
    const req = mockReq({ user: undefined, body: { items: [{ menuItemId: 1, quantity: 1 }] } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userEmail: null }),
      }),
    );
  });

  it('should return 500 on database error', async () => {
    const prisma = {
      menuItem: {
        findMany: vi.fn().mockRejectedValue(new Error('DB error')),
      },
    } as any;
    const handler = getRouteHandler(prisma, 'post', '/');
    const req = mockReq({
      body: { items: [{ menuItemId: 1, quantity: 1 }] },
    });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create order' });
  });
});

describe('Orders Route - GET /history', () => {
  it('should return paginated order history filtered by userEmail', async () => {
    const orders = [
      { id: 2, status: 'completed', createdAt: new Date(), items: [] },
      { id: 1, status: 'pending', createdAt: new Date(), items: [] },
    ];

    const prisma = {
      order: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue(orders),
      },
    } as any;

    const handler = getRouteHandler(prisma, 'get', '/history');
    const req = mockReq({ query: { page: '1' } });
    const res = mockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      orders,
      page: 1,
      totalPages: 1,
      totalOrders: 2,
    });
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userEmail: 'jane@example.com' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      }),
    );
    expect(prisma.order.count).toHaveBeenCalledWith({
      where: { userEmail: 'jane@example.com' },
    });
  });

  it('should default to page 1 when no page param', async () => {
    const prisma = {
      order: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as any;

    const handler = getRouteHandler(prisma, 'get', '/history');
    const req = mockReq({ query: {} });
    const res = mockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      orders: [],
      page: 1,
      totalPages: 1,
      totalOrders: 0,
    });
  });

  it('should calculate correct totalPages', async () => {
    const prisma = {
      order: {
        count: vi.fn().mockResolvedValue(45),
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as any;

    const handler = getRouteHandler(prisma, 'get', '/history');
    const req = mockReq({ query: { page: '2' } });
    const res = mockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        totalPages: 3,
        totalOrders: 45,
      }),
    );
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
  });

  it('should return 500 on database error', async () => {
    const prisma = {
      order: {
        count: vi.fn().mockRejectedValue(new Error('DB error')),
      },
    } as any;

    const handler = getRouteHandler(prisma, 'get', '/history');
    const req = mockReq({ query: {} });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch order history' });
  });
});

describe('Orders Route - GET /pending', () => {
  it('should return pending orders sorted by createdAt ascending', async () => {
    const orders = [
      {
        id: 1,
        status: 'pending',
        createdAt: new Date('2024-01-01'),
        user: { name: 'Alice', email: 'alice@example.com' },
        items: [],
      },
      {
        id: 2,
        status: 'pending',
        createdAt: new Date('2024-01-02'),
        user: { name: 'Bob', email: 'bob@example.com' },
        items: [],
      },
    ];

    const prisma = {
      order: {
        findMany: vi.fn().mockResolvedValue(orders),
      },
    } as any;

    const handler = getRouteHandler(prisma, 'get', '/pending');
    const req = mockReq();
    const res = mockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(orders);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
      }),
    );
  });

  it('should return 500 on database error', async () => {
    const prisma = {
      order: {
        findMany: vi.fn().mockRejectedValue(new Error('DB error')),
      },
    } as any;

    const handler = getRouteHandler(prisma, 'get', '/pending');
    const req = mockReq();
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch pending orders' });
  });
});

describe('Orders Route - PATCH /:id/claim', () => {
  it('returns 400 for an invalid order id', async () => {
    const prisma = {} as any;
    const handler = getRouteHandler(prisma, 'patch', '/:id/claim');
    const req = mockReq({ params: { id: 'abc' } });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid order ID' });
  });

  it('returns 404 when the order does not exist', async () => {
    const prisma = {
      order: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any;
    const handler = getRouteHandler(prisma, 'patch', '/:id/claim');
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Order not found' });
  });

  it('returns 409 when the order is already claimed', async () => {
    const prisma = {
      order: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 1, userEmail: 'someone@example.com' }),
      },
    } as any;
    const handler = getRouteHandler(prisma, 'patch', '/:id/claim');
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Order is already claimed' });
  });

  it('claims a guest order by setting userEmail = req.user.email', async () => {
    const updated = {
      id: 1,
      userEmail: 'jane@example.com',
      totalAmount: 25000,
      items: [],
    };
    const prisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, userEmail: null }),
        update: vi.fn().mockResolvedValue(updated),
      },
    } as any;
    const handler = getRouteHandler(prisma, 'patch', '/:id/claim');
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await handler(req, res);
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { userEmail: 'jane@example.com' },
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updated);
  });
});

describe('Orders Route - PATCH /:id/assign-seat', () => {
  it('should return 400 for invalid order ID', async () => {
    const prisma = {} as any;
    const handler = getRouteHandler(prisma, 'patch', '/:id/assign-seat');
    const req = mockReq({ params: { id: 'abc' }, body: { seatId: 1 } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid order ID' });
  });

  it('should return 400 when seatId is missing', async () => {
    const prisma = {} as any;
    const handler = getRouteHandler(prisma, 'patch', '/:id/assign-seat');
    const req = mockReq({ params: { id: '1' }, body: {} });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'seatId is required and must be a number',
    });
  });

  it('should return 404 when seat not found', async () => {
    const prisma = {
      seat: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any;
    const handler = getRouteHandler(prisma, 'patch', '/:id/assign-seat');
    const req = mockReq({ params: { id: '1' }, body: { seatId: 99 } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Seat not found' });
  });

  it('should return 400 when seat is occupied', async () => {
    const prisma = {
      seat: { findUnique: vi.fn().mockResolvedValue({ id: 5, status: 1 }) },
    } as any;
    const handler = getRouteHandler(prisma, 'patch', '/:id/assign-seat');
    const req = mockReq({ params: { id: '1' }, body: { seatId: 5 } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Seat is currently occupied' });
  });

  it('should return 404 when order not found', async () => {
    const prisma = {
      seat: { findUnique: vi.fn().mockResolvedValue({ id: 5, status: 0 }) },
      order: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any;
    const handler = getRouteHandler(prisma, 'patch', '/:id/assign-seat');
    const req = mockReq({ params: { id: '999' }, body: { seatId: 5 } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Order not found' });
  });

  it('should assign seat and return updated order', async () => {
    const updatedOrder = { id: 1, seatId: 5, status: 'pending', items: [] };
    const prisma = {
      seat: { findUnique: vi.fn().mockResolvedValue({ id: 5, status: 0 }) },
      order: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, status: 'pending' }),
        update: vi.fn().mockResolvedValue(updatedOrder),
      },
    } as any;
    const handler = getRouteHandler(prisma, 'patch', '/:id/assign-seat');
    const req = mockReq({ params: { id: '1' }, body: { seatId: 5 } });
    const res = mockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(updatedOrder);
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { seatId: 5 },
      }),
    );
  });
});

describe('Orders Route - PATCH /:id/status', () => {
  it('should return 400 for invalid order ID', async () => {
    const prisma = {} as any;
    const handler = getRouteHandler(prisma, 'patch', '/:id/status');
    const req = mockReq({ params: { id: 'abc' }, body: { status: 'preparing' } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid order ID' });
  });

  it('should return 400 for invalid status value', async () => {
    const prisma = {} as any;
    const handler = getRouteHandler(prisma, 'patch', '/:id/status');
    const req = mockReq({ params: { id: '1' }, body: { status: 'invalid' } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid status. Must be one of: pending, preparing, ready, completed, cancelled',
    });
  });

  it('should return 404 when order not found', async () => {
    const prisma = {
      order: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any;
    const handler = getRouteHandler(prisma, 'patch', '/:id/status');
    const req = mockReq({ params: { id: '999' }, body: { status: 'preparing' } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Order not found' });
  });

  it('should update status, insert OrderStatusHistory, and return updated order', async () => {
    const updatedOrder = { id: 1, status: 'preparing', items: [] };
    const txOrderUpdate = vi.fn().mockResolvedValue(updatedOrder);
    const txOrderFindUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: 1, status: 'pending' });
    const txStatusHistoryCreate = vi.fn().mockResolvedValue({});

    const prisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, status: 'pending' }),
      },
      $transaction: vi.fn().mockImplementation(async (fn) => {
        return fn({
          order: { findUnique: txOrderFindUnique, update: txOrderUpdate },
          orderStatusHistory: { create: txStatusHistoryCreate },
        });
      }),
    } as any;

    const handler = getRouteHandler(prisma, 'patch', '/:id/status');
    const req = mockReq({ params: { id: '1' }, body: { status: 'preparing' } });
    const res = mockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(updatedOrder);
    expect(txOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { status: 'preparing' },
      }),
    );
    expect(txStatusHistoryCreate).toHaveBeenCalledWith({
      data: { orderId: 1, status: 'preparing' },
    });
  });

  it('should accept all valid status values', async () => {
    const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

    for (const status of validStatuses) {
      const updatedOrder = { id: 1, status, items: [] };
      const startingStatus = status === 'pending' ? 'preparing' : 'pending';
      const prisma = {
        order: {
          findUnique: vi.fn().mockResolvedValue({ id: 1, status: startingStatus }),
        },
        $transaction: vi.fn().mockImplementation(async (fn) => {
          return fn({
            order: {
              findUnique: vi.fn().mockResolvedValue({ id: 1, status: startingStatus }),
              update: vi.fn().mockResolvedValue(updatedOrder),
            },
            orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
          });
        }),
      } as any;
      const handler = getRouteHandler(prisma, 'patch', '/:id/status');
      const req = mockReq({ params: { id: '1' }, body: { status } });
      const res = mockRes();

      await handler(req, res);

      expect(res.json).toHaveBeenCalledWith(updatedOrder);
    }
  });
});

describe('Orders Route - GET /:id', () => {
  it('should return 400 for invalid order ID', async () => {
    const prisma = {} as any;
    const handler = getRouteHandler(prisma, 'get', '/:id');
    const req = mockReq({ params: { id: 'abc' } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid order ID' });
  });

  it('should return 404 when order not found', async () => {
    const prisma = {
      order: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any;
    const handler = getRouteHandler(prisma, 'get', '/:id');
    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Order not found' });
  });

  it('should return 404 when the order belongs to a different user', async () => {
    // The route deliberately collapses "not found" and "ownership
    // mismatch" to a single 404 to avoid leaking the existence of
    // other customers' orders.
    const prisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          userEmail: 'someone-else@example.com',
          status: 'pending',
          items: [],
          statusHistory: [],
          seat: null,
        }),
      },
    } as any;

    const handler = getRouteHandler(prisma, 'get', '/:id');
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Order not found' });
  });

  it('should return 404 for a Guest_Order (userEmail = null) on /:id', async () => {
    const prisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          userEmail: null,
          status: 'pending',
          items: [],
          statusHistory: [],
          seat: null,
        }),
      },
    } as any;
    const handler = getRouteHandler(prisma, 'get', '/:id');
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Order not found' });
  });

  it('should return order with items, statusHistory, and assigned seat when owned by the requester', async () => {
    const order = {
      id: 1,
      userEmail: 'jane@example.com',
      seatId: 5,
      status: 'preparing',
      totalAmount: '50000',
      createdAt: new Date('2024-01-01T08:00:00Z'),
      items: [
        {
          id: 1,
          menuItemId: 1,
          quantity: 2,
          priceAtOrder: '25000',
          menuItem: { id: 1, name: 'Americano', imageUrl: null },
        },
      ],
      statusHistory: [
        { id: 1, orderId: 1, status: 'pending', changedAt: new Date('2024-01-01T08:00:00Z') },
        { id: 2, orderId: 1, status: 'preparing', changedAt: new Date('2024-01-01T08:05:00Z') },
      ],
      seat: { id: 5, status: 1, zone: 'center' },
    };

    const findUnique = vi.fn().mockResolvedValue(order);
    const prisma = { order: { findUnique } } as any;

    const handler = getRouteHandler(prisma, 'get', '/:id');
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(order);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        include: expect.objectContaining({
          items: expect.any(Object),
          statusHistory: { orderBy: { changedAt: 'asc' } },
          seat: true,
        }),
      }),
    );
  });

  it('should return 500 on database error', async () => {
    const prisma = {
      order: { findUnique: vi.fn().mockRejectedValue(new Error('DB error')) },
    } as any;

    const handler = getRouteHandler(prisma, 'get', '/:id');
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch order' });
  });
});
