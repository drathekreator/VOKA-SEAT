import React, { useState, useEffect, useRef } from 'react';
import {
  classifyUrgency,
  getUrgencyTopBarColor,
  getUrgencyBadgeClasses,
  getUrgencyTimerColor,
  formatElapsedTime,
  getElapsedSeconds,
} from '../utils/orderUrgency';

export interface OrderItem {
  id: number;
  name: string;
  quantity: number;
}

export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export interface Order {
  id: number;
  customerName: string;
  items: OrderItem[];
  createdAt: string;
  /**
   * Lifecycle status. Defaults to `pending` for orders coming from the
   * legacy `/api/orders/pending` endpoint that doesn't carry the field.
   */
  status?: OrderStatus;
  /** Optional assigned seat (admin can see at a glance which seat is taken). */
  seatId?: number | null;
}

interface OrderQueueProps {
  orders: Order[];
  /** Click handler for the Assign Table button. */
  onAssignTable: (orderId: number) => void;
  /**
   * Advance the order to a new status. The redesigned queue calls this
   * with `'preparing' | 'ready' | 'completed' | 'cancelled'` depending
   * on the current status of the order card.
   */
  onUpdateStatus?: (orderId: number, status: OrderStatus) => void;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'NEW',
  preparing: 'PREPARING',
  ready: 'READY',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

const STATUS_PILL_CLASS: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  preparing: 'bg-primary/10 text-primary',
  ready: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-700',
};

/**
 * Decide which transition buttons to show for an order based on its
 * current status. Each transition is a [target-status, label, button-style] tuple.
 */
function transitionsFor(
  status: OrderStatus,
): Array<{ target: OrderStatus; label: string; primary: boolean }> {
  switch (status) {
    case 'pending':
      return [
        { target: 'preparing', label: 'Mark Preparing', primary: true },
        { target: 'cancelled', label: 'Cancel', primary: false },
      ];
    case 'preparing':
      return [
        { target: 'ready', label: 'Mark Ready', primary: true },
        { target: 'cancelled', label: 'Cancel', primary: false },
      ];
    case 'ready':
      return [
        { target: 'completed', label: 'Mark Completed', primary: true },
      ];
    default:
      // completed / cancelled are terminal — no transitions.
      return [];
  }
}

const OrderQueue: React.FC<OrderQueueProps> = ({ orders, onAssignTable, onUpdateStatus }) => {
  const [now, setNow] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update the clock every second for live timers
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Sort orders by waiting time descending (longest first)
  const sortedOrders = [...orders].sort((a, b) => {
    const elapsedA = getElapsedSeconds(a.createdAt, now);
    const elapsedB = getElapsedSeconds(b.createdAt, now);
    return elapsedB - elapsedA;
  });

  return (
    <div className="p-container-margin bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="font-section-title text-section-title text-on-background">Order Queue</h2>
          <p className="font-body text-body text-on-surface-variant mt-2">
            Manage incoming orders, advance their status, and assign tables.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-full border border-outline-variant shadow-sm">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>pending_actions</span>
          <span className="font-card-title text-card-title text-primary">{orders.length}</span>
          <span className="font-body text-body text-on-surface-variant">Active</span>
        </div>
      </div>

      {/* Empty state */}
      {sortedOrders.length === 0 && (
        <div
          data-testid="order-queue-empty"
          className="bg-surface rounded-lg border border-border-soft shadow-sm p-12 text-center"
        >
          <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">inbox</span>
          <p className="font-body text-body text-on-surface-variant">
            No active orders. New orders will appear here in real-time.
          </p>
        </div>
      )}

      {/* Queue Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedOrders.map((order) => {
          const elapsedSeconds = getElapsedSeconds(order.createdAt, now);
          const elapsedMinutes = elapsedSeconds / 60;
          const urgency = classifyUrgency(elapsedMinutes);
          const topBarColor = getUrgencyTopBarColor(urgency);
          const badgeClasses = getUrgencyBadgeClasses(urgency);
          const timerColor = getUrgencyTimerColor(urgency);
          const timerDisplay = formatElapsedTime(elapsedSeconds);

          const status: OrderStatus = order.status ?? 'pending';
          const transitions = transitionsFor(status);

          return (
            <article
              key={order.id}
              data-testid={`order-card-${order.id}`}
              className="bg-surface rounded-lg border border-border-soft shadow-sm p-5 flex flex-col gap-4 relative overflow-hidden group hover:shadow-md transition-shadow"
            >
              {/* Top accent bar */}
              <div className={`absolute top-0 left-0 w-full h-1 ${topBarColor}`}></div>

              {/* Header: urgency badge, order ID, customer name, timer */}
              <div className="flex justify-between items-start">
                <div>
                  {/* Urgency + status badges side-by-side */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`font-label text-label ${badgeClasses} px-2 py-1 rounded-md inline-block font-bold tracking-wider`}>
                      {urgency}
                    </span>
                    <span
                      data-testid={`order-status-pill-${order.id}`}
                      className={`font-label text-label ${STATUS_PILL_CLASS[status]} px-2 py-1 rounded-md inline-block font-bold tracking-wider`}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                  </div>
                  <h3 className="font-card-title text-card-title text-on-background">#{order.id}</h3>
                  <p className="font-body text-body text-on-surface-variant">{order.customerName}</p>
                  {order.seatId != null && (
                    <p className="font-small-text text-small-text text-on-surface-variant flex items-center gap-1 mt-1">
                      <span className="material-symbols-outlined text-base">chair_alt</span>
                      Seat {order.seatId}
                    </p>
                  )}
                </div>
                <div className={`flex items-center gap-1 ${timerColor}`}>
                  <span className="material-symbols-outlined">timer</span>
                  <span className="font-body text-body font-bold">{timerDisplay}</span>
                </div>
              </div>

              {/* Item list */}
              <div className="bg-surface-container-low rounded p-3 border border-border-soft flex-1">
                <ul className="font-small-text text-small-text text-on-background space-y-2">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                      {item.quantity}x {item.name}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2">
                {/* Assign Table only when no seat assigned yet */}
                {order.seatId == null && status !== 'cancelled' && (
                  <button
                    onClick={() => onAssignTable(order.id)}
                    data-testid={`order-assign-table-${order.id}`}
                    className="w-full bg-primary/10 text-primary font-body text-body py-2.5 rounded-lg hover:bg-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-medium border border-primary/20"
                  >
                    <span className="material-symbols-outlined">chair_alt</span>
                    Assign Table
                  </button>
                )}

                {/* Status transition buttons (depend on current status) */}
                {transitions.length > 0 && onUpdateStatus && (
                  <div className="flex gap-2">
                    {transitions.map((t) => (
                      <button
                        key={t.target}
                        onClick={() => onUpdateStatus(order.id, t.target)}
                        data-testid={`order-status-${t.target}-${order.id}`}
                        className={
                          t.primary
                            ? 'flex-1 bg-primary text-on-primary font-body text-body py-2.5 rounded-lg hover:bg-secondary-container active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-medium'
                            : 'flex-1 bg-white text-red-600 font-body text-body py-2.5 rounded-lg hover:bg-red-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-medium border border-red-200'
                        }
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default OrderQueue;
