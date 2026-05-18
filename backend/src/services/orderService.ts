/**
 * Order service — pure pagination and sorting logic for order history,
 * plus helpers for managing order status history records.
 *
 * This module provides:
 *   - paginateOrders: a pure function for paginating and sorting orders
 *     by creation date descending (most recent first).
 *   - recordOrderStatusChange: a side-effecting helper that updates an
 *     order's status and inserts an OrderStatusHistory record atomically,
 *     so every status transition is captured in chronological order.
 */

import type { PrismaClient } from '@prisma/client';

const PAGE_SIZE = 20;

export interface PaginatedOrder {
  createdAt: Date;
  [key: string]: unknown;
}

export interface PaginationResult<T> {
  orders: T[];
  page: number;
  totalPages: number;
  totalOrders: number;
}

/**
 * Paginates and sorts orders by creation date descending (most recent first).
 *
 * @param orders - Array of orders with at least a `createdAt` Date field
 * @param page - Page number (1-based). Values < 1 are clamped to 1.
 * @returns Paginated result with at most 20 orders per page, sorted descending by createdAt
 */
export function paginateOrders<T extends PaginatedOrder>(
  orders: T[],
  page: number
): PaginationResult<T> {
  const totalOrders = orders.length;
  const totalPages = Math.ceil(totalOrders / PAGE_SIZE) || 1;
  const safePage = Math.max(1, Math.floor(page));

  // Sort by createdAt descending (most recent first)
  const sorted = [...orders].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  // Slice for the requested page
  const start = (safePage - 1) * PAGE_SIZE;
  const end = Math.min(safePage * PAGE_SIZE, totalOrders);
  const pageOrders = sorted.slice(start, end);

  return {
    orders: pageOrders,
    page: safePage,
    totalPages,
    totalOrders,
  };
}

/**
 * Updates an order's status and records the transition in OrderStatusHistory
 * atomically within a transaction. This ensures the status timeline shown
 * on the customer order detail view always reflects every status change.
 *
 * If the new status is identical to the current status, no history record
 * is inserted and the existing order is returned unchanged.
 *
 * @param prisma - PrismaClient or transaction client
 * @param orderId - The order whose status is being changed
 * @param newStatus - The new status value (must be one of the allowed values)
 * @param include - Optional Prisma include clause for the returned order
 * @returns The updated order with the requested includes
 */
export async function recordOrderStatusChange(
  prisma: PrismaClient,
  orderId: number,
  newStatus: string,
  include?: Record<string, unknown>
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({ where: { id: orderId } });
    if (!existing) {
      throw new Error('Order not found');
    }

    if (existing.status === newStatus) {
      // No-op: avoid inserting redundant history rows
      return tx.order.findUnique({
        where: { id: orderId },
        ...(include ? { include } : {}),
      } as never);
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: newStatus },
      ...(include ? { include } : {}),
    } as never);

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: newStatus,
      },
    });

    return updated;
  });
}
