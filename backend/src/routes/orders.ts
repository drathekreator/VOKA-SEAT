import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { sanitizerMiddleware } from '../middleware/sanitizer';
import {
  authMiddleware,
  adminAuthMiddleware,
  tryCustomerAuth,
  AuthenticatedRequest,
} from '../middleware/auth';
import { recordOrderStatusChange } from '../services/orderService';
import { broadcastOrderStatusUpdate } from '../websocket/broadcaster';

const VALID_STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'] as const;
const ACTIVE_STATUSES = ['pending', 'preparing', 'ready'] as const;
const PAGE_SIZE = 20;

/**
 * Creates the orders REST API router.
 *
 * Auth model after the Section-21 rewrite (see requirements.md /
 * design.md "Authentication state"):
 *
 *   POST /                    Optional customer JWT — orders without a
 *                             JWT are persisted as Guest_Order
 *                             (userEmail = NULL). Property 20 forbids
 *                             rejecting solely for missing auth.
 *   PATCH /:id/claim          Customer JWT required — retroactively sets
 *                             userEmail on a Guest_Order whose userEmail
 *                             is currently NULL.
 *   GET   /history            Customer JWT required — paginated order
 *                             history filtered to the JWT's email.
 *   GET   /:id                Customer JWT required — order detail; the
 *                             order must belong to the authenticated
 *                             customer or the request is rejected.
 *   GET   /pending            Admin JWT required — pending orders queue.
 *   GET   /active             Admin JWT required — pending + preparing +
 *                             ready (everything that hasn't reached a
 *                             terminal state). Used by the redesigned
 *                             Order Queue with status-transition buttons.
 *   PATCH /:id/assign-seat    Admin JWT required.
 *   PATCH /:id/status         Admin JWT required. On success, broadcasts
 *                             `order_status_update` to all connected
 *                             WebSocket clients.
 *
 * Route registration order matters: Express matches in declaration
 * order, so we register all literal-path routes (e.g. `/history`,
 * `/pending`, `/active`) BEFORE any `/:id`-style parametric routes —
 * otherwise `/active` would be swallowed by `/:id` and rejected with
 * 401 before the admin auth check runs.
 *
 * @param prisma  Shared Prisma client.
 * @param io      Socket.IO server. Optional so existing unit tests that
 *                construct the router without IO context still work — in
 *                that case status updates simply skip the broadcast.
 */
export function createOrdersRouter(prisma: PrismaClient, io?: SocketIOServer): Router {
  const router = Router();
  router.use(sanitizerMiddleware);

  // ===================================================================
  // POST /  (optional customer JWT — orders without a valid JWT become
  //          Guest_Order rows with userEmail = NULL).
  // ===================================================================
  router.post('/', tryCustomerAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { items } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'Items array is required and must not be empty' });
        return;
      }

      for (const item of items) {
        if (!item.menuItemId || typeof item.menuItemId !== 'number') {
          res.status(400).json({ error: 'Each item must have a valid menuItemId' });
          return;
        }
        if (!item.quantity || typeof item.quantity !== 'number' || item.quantity < 1) {
          res.status(400).json({ error: 'Each item must have a quantity of at least 1' });
          return;
        }
      }

      const menuItemIds = items.map((item: { menuItemId: number }) => item.menuItemId);
      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: menuItemIds } },
        select: { id: true, price: true },
      });

      if (menuItems.length !== new Set(menuItemIds).size) {
        res.status(400).json({ error: 'One or more menu items not found' });
        return;
      }

      const priceMap = new Map(menuItems.map((mi) => [mi.id, mi.price]));

      let totalAmount = 0;
      const orderItemsData = items.map((item: { menuItemId: number; quantity: number }) => {
        const price = Number(priceMap.get(item.menuItemId));
        totalAmount += item.quantity * price;
        return {
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          priceAtOrder: price,
        };
      });

      // Property 20: a valid customer JWT ties the order to its email;
      // otherwise persist as a Guest_Order with NULL.
      const userEmail = req.user?.email ?? null;

      const order = await prisma.$transaction(async (tx) => {
        return tx.order.create({
          data: {
            userEmail,
            totalAmount,
            status: 'pending',
            items: { create: orderItemsData },
            statusHistory: { create: { status: 'pending' } },
          },
          include: {
            items: { include: { menuItem: { select: { name: true } } } },
          },
        });
      });

      res.status(201).json(order);

      // After persisting, notify connected admin tabs that a new pending
      // order has appeared so the queue refreshes without a manual reload.
      // Customer-side ignores `pending` notifications (only `ready`/etc).
      if (io) {
        broadcastOrderStatusUpdate(io, {
          id: order.id,
          status: order.status,
          userEmail: order.userEmail ?? null,
          seatId: order.seatId ?? null,
          updatedAt: order.updatedAt,
        });
      }
    } catch (error) {
      console.error('❌ Error creating order:', error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  });

  // ===================================================================
  // Literal-path routes — MUST come before /:id-style parametric routes.
  // ===================================================================

  // GET /history (customer JWT)
  router.get('/history', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const userEmail = req.user!.email;

      const totalOrders = await prisma.order.count({ where: { userEmail } });
      const totalPages = Math.ceil(totalOrders / PAGE_SIZE) || 1;

      const orders = await prisma.order.findMany({
        where: { userEmail },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          items: { include: { menuItem: { select: { name: true } } } },
        },
      });

      res.json({ orders, page, totalPages, totalOrders });
    } catch (error) {
      console.error('❌ Error fetching order history:', error);
      res.status(500).json({ error: 'Failed to fetch order history' });
    }
  });

  // GET /pending (admin JWT) — kept for backwards compatibility with
  // existing tests / older admin UIs that only look at NEW orders.
  router.get('/pending', adminAuthMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const orders = await prisma.order.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { name: true, email: true } },
          items: { include: { menuItem: { select: { name: true } } } },
        },
      });
      res.json(orders);
    } catch (error) {
      console.error('❌ Error fetching pending orders:', error);
      res.status(500).json({ error: 'Failed to fetch pending orders' });
    }
  });

  // GET /active (admin JWT) — pending + preparing + ready. The new
  // Order Queue UI uses this so the queue stays populated until the
  // order is completed or cancelled, allowing status-transition
  // buttons to advance each order through its lifecycle.
  router.get('/active', adminAuthMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const orders = await prisma.order.findMany({
        where: { status: { in: [...ACTIVE_STATUSES] } },
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { name: true, email: true } },
          seat: { select: { id: true, zone: true } },
          items: { include: { menuItem: { select: { name: true } } } },
        },
      });
      res.json(orders);
    } catch (error) {
      console.error('❌ Error fetching active orders:', error);
      res.status(500).json({ error: 'Failed to fetch active orders' });
    }
  });

  // ===================================================================
  // Parametric /:id-style routes — declared after the literal routes.
  // ===================================================================

  // PATCH /:id/claim (customer JWT)
  router.patch('/:id/claim', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.id as string);
      if (isNaN(orderId)) {
        res.status(400).json({ error: 'Invalid order ID' });
        return;
      }

      const existing = await prisma.order.findUnique({ where: { id: orderId } });
      if (!existing) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      if (existing.userEmail !== null) {
        res.status(409).json({ error: 'Order is already claimed' });
        return;
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { userEmail: req.user!.email },
        include: {
          items: { include: { menuItem: { select: { name: true } } } },
        },
      });

      res.status(200).json(updated);
    } catch (error) {
      console.error('❌ Error claiming order:', error);
      res.status(500).json({ error: 'Failed to claim order' });
    }
  });

  // PATCH /:id/assign-seat (admin JWT)
  router.patch('/:id/assign-seat', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.id as string);
      if (isNaN(orderId)) {
        res.status(400).json({ error: 'Invalid order ID' });
        return;
      }

      const { seatId } = req.body;
      if (!seatId || typeof seatId !== 'number') {
        res.status(400).json({ error: 'seatId is required and must be a number' });
        return;
      }

      const seat = await prisma.seat.findUnique({ where: { id: seatId } });
      if (!seat) {
        res.status(404).json({ error: 'Seat not found' });
        return;
      }
      if (seat.status !== 0) {
        res.status(400).json({ error: 'Seat is currently occupied' });
        return;
      }

      const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
      if (!existingOrder) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { seatId },
        include: {
          items: { include: { menuItem: { select: { name: true } } } },
        },
      });

      res.json(updatedOrder);
    } catch (error) {
      console.error('❌ Error assigning seat to order:', error);
      res.status(500).json({ error: 'Failed to assign seat' });
    }
  });

  // PATCH /:id/status (admin JWT)
  router.patch('/:id/status', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.id as string);
      if (isNaN(orderId)) {
        res.status(400).json({ error: 'Invalid order ID' });
        return;
      }

      const { status } = req.body;
      if (!status || !VALID_STATUSES.includes(status)) {
        res.status(400).json({
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        });
        return;
      }

      const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
      if (!existingOrder) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      const updatedOrder = await recordOrderStatusChange(prisma, orderId, status, {
        items: { include: { menuItem: { select: { name: true } } } },
      });

      res.json(updatedOrder);

      // Broadcast to all connected clients (admin tabs + customer
      // browsers). Customer App listens for this event and surfaces a
      // browser notification when their own order reaches `ready`.
      if (io && updatedOrder) {
        broadcastOrderStatusUpdate(io, {
          id: updatedOrder.id,
          status: updatedOrder.status,
          userEmail: (updatedOrder as { userEmail?: string | null }).userEmail ?? null,
          seatId: (updatedOrder as { seatId?: number | null }).seatId ?? null,
          updatedAt: (updatedOrder as { updatedAt?: Date | string }).updatedAt ?? new Date(),
        });
      }
    } catch (error) {
      console.error('❌ Error updating order status:', error);
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  // GET /:id (customer JWT, ownership-checked) — declared LAST so the
  // literal routes above (e.g. /pending, /history, /active) are matched
  // first.
  router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.id as string);
      if (isNaN(orderId)) {
        res.status(400).json({ error: 'Invalid order ID' });
        return;
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { menuItem: { select: { id: true, name: true, imageUrl: true } } } },
          statusHistory: { orderBy: { changedAt: 'asc' } },
          seat: true,
        },
      });

      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      // Customers may only view their own orders. Guest_Orders
      // (userEmail = NULL) and other customers' orders both 404 out.
      if (order.userEmail !== req.user!.email) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      res.json(order);
    } catch (error) {
      console.error('❌ Error fetching order:', error);
      res.status(500).json({ error: 'Failed to fetch order' });
    }
  });

  return router;
}
