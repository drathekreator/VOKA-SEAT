import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import PDFDocument from 'pdfkit';
import { sanitizerMiddleware } from '../middleware/sanitizer';
import { idempotency } from '../middleware/idempotency';
import { rateLimit } from '../middleware/rateLimit';
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
 * Customers may cancel their own order ONLY within this many ms after
 * placement and ONLY while the order is still `pending` (not yet picked
 * up by the bartender). After that, only an admin can cancel.
 */
const CUSTOMER_CANCEL_WINDOW_MS = 5 * 60 * 1000;

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
 *                             Rate-limited (10 req/min/IP) and
 *                             idempotency-key-aware.
 *   PATCH /:id/claim          Customer JWT required.
 *   PATCH /:id/cancel         Customer JWT required — own pending
 *                             orders only, within 5 minutes of placement.
 *   GET   /history            Customer JWT required.
 *   GET   /:id                Customer JWT required.
 *   GET   /:id/receipt.pdf    Customer JWT required — PDF receipt
 *                             stream for the order. Ownership-checked.
 *   GET   /pending            Admin JWT required.
 *   GET   /active             Admin JWT required.
 *   PATCH /:id/assign-seat    Admin JWT required.
 *   PATCH /:id/status         Admin JWT required.
 */
export function createOrdersRouter(prisma: PrismaClient, io?: SocketIOServer): Router {
  const router = Router();
  router.use(sanitizerMiddleware);

  // ===================================================================
  // POST /  (optional customer JWT — orders without a valid JWT become
  //          Guest_Order rows with userEmail = NULL).
  // Rate limit: 10 orders per minute per IP.
  // Idempotency: clients send a stable Idempotency-Key header per
  //              checkout attempt to prevent double-submission from
  //              flaky networks or accidental double-taps.
  // ===================================================================
  router.post(
    '/',
    rateLimit({
      windowMs: 60_000,
      max: 10,
      message: 'Too many orders. Please wait a moment and try again.',
    }),
    idempotency({ windowMs: 5 * 60_000 }),
    tryCustomerAuth,
    async (req: AuthenticatedRequest, res: Response) => {
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
  // existing tests / older admin UIs.
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

  // GET /active (admin JWT) — pending + preparing + ready.
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

  // PATCH /:id/cancel (customer JWT) — customer cancels their own order
  // within CUSTOMER_CANCEL_WINDOW_MS of placement, only while status
  // is still `pending`. Beyond that window or status, the bartender has
  // already picked up the order — only an admin can cancel.
  router.patch('/:id/cancel', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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

      // Ownership check (404 to avoid leaking other customers' orders).
      if (existing.userEmail !== req.user!.email) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      if (existing.status !== 'pending') {
        res.status(409).json({
          error: 'Order can no longer be cancelled — already in preparation.',
        });
        return;
      }

      const ageMs = Date.now() - existing.createdAt.getTime();
      if (ageMs > CUSTOMER_CANCEL_WINDOW_MS) {
        res.status(409).json({
          error: 'Cancellation window expired (5 minutes after placement).',
        });
        return;
      }

      const updated = await recordOrderStatusChange(prisma, orderId, 'cancelled', {
        items: { include: { menuItem: { select: { name: true } } } },
      });

      res.json(updated);

      if (io && updated) {
        broadcastOrderStatusUpdate(io, {
          id: updated.id,
          status: updated.status,
          userEmail: (updated as { userEmail?: string | null }).userEmail ?? null,
          seatId: (updated as { seatId?: number | null }).seatId ?? null,
          updatedAt: (updated as { updatedAt?: Date | string }).updatedAt ?? new Date(),
        });
      }
    } catch (error) {
      console.error('❌ Error cancelling order:', error);
      res.status(500).json({ error: 'Failed to cancel order' });
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

  // GET /:id/receipt.pdf (customer JWT, ownership-checked) — streamed
  // PDF download. Layout: VOKAFE header, order number, item table,
  // total in IDR, paid timestamp, footer thank-you.
  router.get('/:id/receipt.pdf', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.id as string);
      if (isNaN(orderId)) {
        res.status(400).json({ error: 'Invalid order ID' });
        return;
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { menuItem: { select: { name: true } } } },
          seat: { select: { id: true, zone: true } },
        },
      });
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      if (order.userEmail !== req.user!.email) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      // ---- Stream the PDF ----------------------------------------------
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="vokafe-receipt-${order.id}.pdf"`,
      );

      const doc = new PDFDocument({ size: 'A4', margin: 56 });
      doc.pipe(res);

      // Header — VOKAFE wordmark + tagline
      doc.fillColor('#D81B60').fontSize(26).text('VOKAFE', { align: 'left' });
      doc.fillColor('#1E293B').fontSize(10).text('Coffee · Comfort · Community', { align: 'left' });
      doc.moveDown(1);

      // Receipt label + order number
      doc.fillColor('#000').fontSize(18).text('Order Receipt', { align: 'left' });
      doc.fontSize(12).fillColor('#475569').text(`Order #${order.id}`);
      doc
        .fontSize(10)
        .fillColor('#475569')
        .text(`Placed: ${new Date(order.createdAt).toLocaleString('id-ID')}`);
      if (order.userEmail) doc.text(`Customer: ${order.userEmail}`);
      if (order.seat) doc.text(`Seat: #${order.seat.id} (${order.seat.zone})`);
      doc.moveDown(1);

      // Items table — name | qty | price | line total
      const tableTop = doc.y;
      const colName = 56;
      const colQty = 320;
      const colPrice = 380;
      const colLine = 470;

      doc.fontSize(10).fillColor('#1E293B');
      doc.text('Item', colName, tableTop);
      doc.text('Qty', colQty, tableTop, { width: 40, align: 'right' });
      doc.text('Price', colPrice, tableTop, { width: 80, align: 'right' });
      doc.text('Total', colLine, tableTop, { width: 80, align: 'right' });

      doc
        .moveTo(colName, tableTop + 14)
        .lineTo(colLine + 80, tableTop + 14)
        .strokeColor('#E5E7EB')
        .stroke();

      let y = tableTop + 22;
      let total = 0;
      const fmtIdr = (n: number) =>
        'Rp ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

      for (const item of order.items) {
        const unit = Number(item.priceAtOrder);
        const line = unit * item.quantity;
        total += line;

        doc.fillColor('#1E293B').fontSize(10);
        doc.text(item.menuItem.name, colName, y, { width: colQty - colName - 8 });
        doc.text(String(item.quantity), colQty, y, { width: 40, align: 'right' });
        doc.text(fmtIdr(unit), colPrice, y, { width: 80, align: 'right' });
        doc.text(fmtIdr(line), colLine, y, { width: 80, align: 'right' });
        y += 18;
      }

      // Totals
      doc
        .moveTo(colName, y + 4)
        .lineTo(colLine + 80, y + 4)
        .strokeColor('#E5E7EB')
        .stroke();

      y += 16;
      doc.fontSize(12).fillColor('#1E293B').text('Subtotal', colPrice, y, { width: 80, align: 'right' });
      doc.text(fmtIdr(total), colLine, y, { width: 80, align: 'right' });

      y += 22;
      doc.fontSize(14).fillColor('#D81B60').text('TOTAL', colPrice, y, { width: 80, align: 'right' });
      doc.text(fmtIdr(Number(order.totalAmount)), colLine, y, { width: 80, align: 'right' });

      // Footer
      doc.moveDown(4);
      doc
        .fontSize(10)
        .fillColor('#475569')
        .text(
          'Thank you for visiting VOKAFE. We hope to see you again.',
          { align: 'center' },
        );
      doc.text(`Status: ${order.status.toUpperCase()}`, { align: 'center' });

      doc.end();
    } catch (error) {
      console.error('❌ Error generating receipt PDF:', error);
      // PDFKit may have already written headers/bytes; only send a JSON
      // error if we haven't started streaming yet.
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate receipt' });
      } else {
        res.end();
      }
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
