import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Order status update payload broadcast by the backend whenever
 * `PATCH /api/orders/:id/status` succeeds OR a new order is created
 * with status `pending`.
 *
 * `userEmail` is null for guest orders. Customer App uses this to
 * decide whether to surface a browser notification (only for orders
 * that match the authenticated user's email).
 */
export interface OrderUpdatePayload {
  orderId: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  userEmail: string | null;
  seatId: number | null;
  updatedAt: string;
}

/**
 * Subscribe to `order_status_update` events from the backend
 * Socket.IO server. Each event fires the supplied callback exactly
 * once. The callback is wrapped in a ref so consumers don't have to
 * memoize it themselves.
 *
 * Used by:
 *   - Admin Dashboard (App.tsx) to live-refresh the Order Queue when
 *     another admin tab advances an order's status.
 *   - Customer App (OrderHistoryView / OrderDetailView) to live-update
 *     the status pill and (optionally) fire a browser notification.
 */
export function useOrderUpdates(onUpdate: (update: OrderUpdatePayload) => void): void {
  const callbackRef = useRef(onUpdate);

  // Keep the callback ref current without re-creating the socket
  // connection on every parent render.
  useEffect(() => {
    callbackRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const socket: Socket = io(API_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    const handler = (data: OrderUpdatePayload) => {
      callbackRef.current(data);
    };

    socket.on('order_status_update', handler);

    return () => {
      socket.off('order_status_update', handler);
      socket.disconnect();
    };
  }, []);
}
