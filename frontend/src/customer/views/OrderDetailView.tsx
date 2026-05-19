/**
 * OrderDetailView — Customer App single-order detail screen with status timeline.
 *
 * Reached either from the Order History list (tap card → mount this view with
 * the selected order id) or from the Payment Success screen (tap "View Order
 * Status" → mount with the order id we just confirmed). The parent shell
 * (CustomerApp) decides where the back arrow returns to via the onBack prop.
 *
 * Data flow:
 *   - Reads the JWT from useAuth() and sends it as `Authorization: Bearer`.
 *   - Fetches GET ${API_BASE_URL}/api/orders/:id. The backend (orders.ts)
 *     returns the full order with `items[]` (each carrying menuItem.name and
 *     priceAtOrder), `statusHistory[]` (already sorted ascending by
 *     changedAt by the backend, but we re-sort defensively for robustness),
 *     `status`, `seatId` (nullable), and `totalAmount`.
 *   - On 401 we drop the session via useAuth().logout() so the auth gate in
 *     CustomerApp can bounce the user to the Login screen on the next
 *     render. Mirrors OrderHistoryView's contract.
 *   - On 404 we render an "Order not found" panel with a back button so the
 *     user can return to wherever they came from.
 *
 * Spec references:
 *   - Requirement 19.3 (tapping an order card navigates here)
 *   - Requirement 19.4 (display item list with quantity + unit price,
 *     subtotal, total, assigned seat number, status change timestamps in
 *     chronological order)
 *   - Requirement 19.5 (when seatId is null, render "No seat assigned"
 *     placeholder)
 *   - design.md "Order Detail view" (uses OrderStatusPill for current
 *     status, status timeline rendered from OrderStatusHistory records)
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import OrderStatusPill, {
  type OrderStatus,
  getStatusPillStyle,
} from '../components/OrderStatusPill';
import { formatIDR } from './MenuView';
import { useOrderUpdates } from '../../hooks/useOrderUpdates';
import {
  notifyOrderStatusChange,
  requestOrderNotificationPermission,
} from '../utils/orderNotifications';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:4000';

export interface OrderDetailItem {
  id: number;
  menuItemId: number;
  quantity: number;
  priceAtOrder: number | string;
  menuItem: { name: string };
}

export interface OrderStatusHistoryEntry {
  id: number;
  status: string;
  changedAt: string;
}

export interface OrderDetail {
  id: number;
  status: string;
  seatId: number | null;
  totalAmount: number | string;
  createdAt: string;
  items: OrderDetailItem[];
  statusHistory: OrderStatusHistoryEntry[];
}

export interface OrderDetailViewProps {
  /** The order id to load. Provided by the parent (CustomerApp). */
  orderId: number;
  /**
   * Back arrow handler. The parent decides where the arrow returns to:
   *   - From PaymentSuccess flow → back to Menu (cart cleared).
   *   - From Order History → back to the Order History list.
   * Keeping the destination decision in the parent avoids leaking the
   * navigation context into this view.
   */
  onBack: () => void;
}

/**
 * Map an OrderStatus to a Material Symbols Outlined icon name. Falls back to
 * the neutral "circle" symbol so the timeline still has a glyph for unknown
 * future statuses.
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'pending':
      return 'receipt_long';
    case 'preparing':
      return 'restaurant';
    case 'ready':
    case 'completed':
      return 'check_circle';
    case 'cancelled':
      return 'cancel';
    default:
      return 'circle';
  }
}

/**
 * Format an ISO timestamp using the id-ID locale, matching the convention
 * used elsewhere in the Customer App (Indonesian month names + 24h time).
 * Tolerates malformed dates by falling back to the raw value rather than
 * throwing.
 */
function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

/**
 * Defensive coerce of an unknown order status string into the OrderStatus
 * union expected by OrderStatusPill. Unknown values fall through to the
 * neutral "Unknown" pill (handled inside getStatusPillStyle).
 */
function coerceStatus(status: string): OrderStatus {
  return status as OrderStatus;
}

export default function OrderDetailView({
  orderId,
  onBack,
}: OrderDetailViewProps) {
  const { token, user, logout } = useAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // 5-minute customer cancel window — must match the backend constant
  // CUSTOMER_CANCEL_WINDOW_MS in routes/orders.ts. We re-evaluate on
  // every render so the button hides automatically once the window
  // expires while the user is still on the page.
  const CANCEL_WINDOW_MS = 5 * 60 * 1000;
  const cancellable =
    order?.status === 'pending' &&
    Date.now() - new Date(order.createdAt).getTime() < CANCEL_WINDOW_MS;

  const handleCancel = async () => {
    if (!token || !order || cancelling) return;
    if (!cancellable) return;
    if (!window.confirm('Cancel this order? This cannot be undone.')) return;

    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/${order.id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setCancelError(body?.error ?? 'Failed to cancel order');
        return;
      }
      const updated = (await res.json()) as OrderDetail;
      setOrder((prev) => (prev ? { ...prev, ...updated, status: updated.status } : prev));
    } catch {
      setCancelError('Network error — please try again');
    } finally {
      setCancelling(false);
    }
  };

  // One-shot permission prompt the first time this view mounts.
  useEffect(() => {
    void requestOrderNotificationPermission();
  }, []);

  // Live status update for the *currently displayed* order. We patch the
  // local `order` object so the pill and timeline reflect the new status
  // without a full refetch. We also append a synthetic statusHistory
  // entry using the broadcast's updatedAt — when the user refreshes (or
  // backs in/out of the view), the next fetch will replace it with the
  // canonical entry from the database. Only fires when the order belongs
  // to the authenticated user.
  useOrderUpdates((update) => {
    if (update.orderId !== orderId) return;
    if (!user || update.userEmail !== user.email) return;

    setOrder((prev) =>
      prev
        ? {
            ...prev,
            status: update.status,
            seatId: update.seatId,
            statusHistory: [
              ...prev.statusHistory,
              {
                id: -Date.now(), // negative synthetic id, no DB collision
                status: update.status,
                changedAt: update.updatedAt,
              },
            ],
          }
        : prev,
    );

    notifyOrderStatusChange(update.orderId, update.status);
  });

  const fetchOrder = useCallback(
    async (authToken: string) => {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/orders/${orderId}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          },
        );

        if (response.status === 401) {
          // Token is no longer valid — drop the session. The auth gate in
          // CustomerApp will redirect to Login on the next render.
          logout();
          return;
        }

        if (response.status === 404) {
          setNotFound(true);
          setOrder(null);
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to load order');
        }

        const data: OrderDetail = await response.json();
        setOrder(data);
      } catch {
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    },
    [orderId, logout],
  );

  useEffect(() => {
    if (!token) return;
    fetchOrder(token);
  }, [token, fetchOrder]);

  // Defensive: in practice OrderDetailView is only mounted from inside an
  // authenticated CustomerApp shell, so token will be non-null. We keep
  // this branch so the component is renderable in isolation (e.g. from a
  // unit test that hasn't seeded a token).
  if (!token) {
    return (
      <div
        className="flex items-center justify-center py-16 px-4"
        data-testid="order-detail-unauthenticated"
      >
        <p className="text-sm text-on-surface-variant">
          Please log in to view this order
        </p>
      </div>
    );
  }

  // ----- Sticky header (always rendered so the user can back out) -----
  const header = (
    <header
      className="sticky top-0 z-30 flex items-center gap-sm bg-surface px-margin-mobile h-16 border-b border-outline-variant"
      data-testid="order-detail-header"
    >
      <button
        type="button"
        aria-label="Back"
        data-testid="order-detail-back"
        onClick={onBack}
        className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors active:scale-95"
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          arrow_back
        </span>
      </button>
      <h1 className="font-headline-sm text-headline-sm text-on-surface">
        Order Detail
      </h1>
    </header>
  );

  if (loading) {
    return (
      <div
        className="min-h-screen w-full bg-surface flex flex-col"
        data-testid="order-detail-view"
      >
        {header}
        <div
          className="flex-1 flex items-center justify-center py-16"
          data-testid="order-detail-loading"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-on-surface-variant">Loading order…</p>
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div
        className="min-h-screen w-full bg-surface flex flex-col"
        data-testid="order-detail-view"
      >
        {header}
        <div
          className="flex-1 flex flex-col items-center justify-center py-16 px-4 gap-3 text-center"
          data-testid="order-detail-not-found"
        >
          <span
            className="material-symbols-outlined text-on-surface-variant/70"
            style={{ fontSize: '64px' }}
            aria-hidden="true"
          >
            search_off
          </span>
          <p className="text-sm text-on-surface">Order not found</p>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-sm bg-primary text-on-primary rounded-lg active:scale-95 transition-transform"
            data-testid="order-detail-not-found-back"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div
        className="min-h-screen w-full bg-surface flex flex-col"
        data-testid="order-detail-view"
      >
        {header}
        <div
          className="flex-1 flex flex-col items-center justify-center py-16 px-4 gap-3"
          data-testid="order-detail-error"
        >
          <p className="text-sm text-error">Failed to load order details</p>
          <button
            type="button"
            onClick={() => token && fetchOrder(token)}
            className="px-4 py-2 text-sm bg-primary text-on-primary rounded-lg active:scale-95 transition-transform"
            data-testid="order-detail-retry"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Subtotal = sum of (quantity * unit price) for each line item.
  // We compute it client-side rather than trusting the backend's totalAmount
  // for the "subtotal" row so we display a transparent breakdown.
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.quantity * Number(item.priceAtOrder),
    0,
  );

  // Total uses the backend's totalAmount. In practice it equals subtotal
  // today, but displaying both leaves room for tax/discount lines later
  // without changing the layout.
  const total = Number(order.totalAmount);

  // Defensively re-sort statusHistory ascending by changedAt. The backend
  // already orders ascending, but the spec calls for chronological order
  // explicitly so we don't rely solely on the API.
  const sortedHistory = [...order.statusHistory].sort(
    (a, b) =>
      new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
  );

  return (
    <div
      className="min-h-screen w-full bg-surface flex flex-col"
      data-testid="order-detail-view"
    >
      {header}

      <main className="flex-1 overflow-y-auto bg-surface-container-lowest">
        <div className="px-margin-mobile py-md flex flex-col gap-md pb-24">
          {/* ---------------- Status + Order number ---------------- */}
          <section
            className="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-outline-variant/20 p-md flex flex-col gap-2"
            data-testid="order-detail-status-section"
          >
            <h2
              className="font-headline-sm text-headline-sm text-on-surface"
              data-testid="order-detail-order-number"
            >
              Order #{order.id}
            </h2>
            <div>
              <OrderStatusPill status={coerceStatus(order.status)} />
            </div>
          </section>

          {/* ---------------- Items ---------------- */}
          <section
            className="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-outline-variant/20 p-md flex flex-col gap-3"
            data-testid="order-detail-items-section"
          >
            <h3 className="font-label-md text-label-md text-on-surface">
              Items
            </h3>
            <ul className="flex flex-col gap-2">
              {order.items.map((item) => {
                const unitPrice = Number(item.priceAtOrder);
                const lineTotal = item.quantity * unitPrice;
                return (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3"
                    data-testid={`order-detail-item-${item.id}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-body-md text-body-md text-on-surface">
                        {item.quantity}x {item.menuItem.name}
                      </span>
                      <span
                        className="text-xs text-on-surface-variant"
                        data-testid={`order-detail-item-${item.id}-unit-price`}
                      >
                        @{formatIDR(unitPrice)}
                      </span>
                    </div>
                    <span
                      className="font-body-md text-body-md text-on-surface whitespace-nowrap"
                      data-testid={`order-detail-item-${item.id}-line-total`}
                    >
                      {formatIDR(lineTotal)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ---------------- Totals ---------------- */}
          <section
            className="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-outline-variant/20 p-md flex flex-col gap-2"
            data-testid="order-detail-totals-section"
          >
            <div className="flex justify-between items-center">
              <span className="text-on-surface-variant">Subtotal</span>
              <span
                className="text-on-surface"
                data-testid="order-detail-subtotal"
              >
                {formatIDR(subtotal)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-outline-variant/30">
              <span className="font-label-md text-label-md text-on-surface">
                Total
              </span>
              <span
                className="font-headline-sm text-headline-sm text-primary"
                data-testid="order-detail-total"
              >
                {formatIDR(total)}
              </span>
            </div>
          </section>

          {/* ---------------- Assigned Seat ---------------- */}
          <section
            className="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-outline-variant/20 p-md flex items-center gap-3"
            data-testid="order-detail-seat"
          >
            <span
              className="material-symbols-outlined text-on-surface-variant"
              aria-hidden="true"
            >
              event_seat
            </span>
            <div className="flex flex-col">
              <span className="text-xs text-on-surface-variant">
                Assigned Seat
              </span>
              {order.seatId !== null && order.seatId !== undefined ? (
                <span
                  className="font-body-md text-body-md text-on-surface"
                  data-testid="order-detail-seat-assigned"
                >
                  Seat #{order.seatId}
                </span>
              ) : (
                <span
                  className="font-body-md text-body-md text-on-surface-variant italic"
                  data-testid="order-detail-seat-none"
                >
                  No seat assigned
                </span>
              )}
            </div>
          </section>

          {/* ---------------- Status Timeline ---------------- */}
          <section
            className="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-outline-variant/20 p-md flex flex-col gap-3"
            data-testid="order-detail-timeline-section"
          >
            <h3 className="font-label-md text-label-md text-on-surface">
              Status Updates
            </h3>
            {sortedHistory.length === 0 ? (
              <p
                className="text-sm text-on-surface-variant"
                data-testid="order-detail-timeline-empty"
              >
                No status updates yet
              </p>
            ) : (
              <ol className="flex flex-col gap-3">
                {sortedHistory.map((entry, index) => {
                  const { label } = getStatusPillStyle(
                    coerceStatus(entry.status),
                  );
                  return (
                    <li
                      key={entry.id}
                      className="flex items-start gap-3"
                      data-testid={`order-detail-status-history-${index}`}
                    >
                      <span
                        className="material-symbols-outlined text-primary"
                        aria-hidden="true"
                      >
                        {getStatusIcon(entry.status)}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-body-md text-body-md text-on-surface">
                          {label}
                        </span>
                        <span
                          className="text-xs text-on-surface-variant"
                          data-testid={`order-detail-status-history-${index}-timestamp`}
                        >
                          {formatTimestamp(entry.changedAt)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* ---------------- Actions: Receipt + Cancel ---------------- */}
          <section
            className="flex flex-col gap-2"
            data-testid="order-detail-actions"
          >
            {/* Receipt PDF — always available for the order owner. We open
                the URL in a new tab so the browser's PDF viewer / Save As
                dialog handles it natively, sidestepping the friction of
                blob downloads on mobile Safari. */}
            <a
              href={`${API_BASE_URL}/api/orders/${order.id}/receipt.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="order-detail-download-receipt"
              className="w-full inline-flex items-center justify-center gap-2 bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl h-12 font-label-md text-label-md active:scale-95 transition-transform"
              onClick={(e) => {
                // The link uses Authorization: Bearer auth via Express — but
                // <a target="_blank"> can't carry custom headers, so we
                // intercept and use a programmatic fetch + blob URL.
                e.preventDefault();
                if (!token) return;
                void (async () => {
                  try {
                    const res = await fetch(
                      `${API_BASE_URL}/api/orders/${order.id}/receipt.pdf`,
                      { headers: { Authorization: `Bearer ${token}` } },
                    );
                    if (!res.ok) return;
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `vokafe-receipt-${order.id}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } catch {
                    /* silent — user can retry */
                  }
                })();
              }}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                receipt_long
              </span>
              Download Receipt (PDF)
            </a>

            {/* Customer cancel button — only visible while still in the
                5-minute window AND status === 'pending'. Beyond that
                the bartender has picked it up; only an admin can cancel. */}
            {cancellable && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                data-testid="order-detail-cancel"
                className="w-full inline-flex items-center justify-center gap-2 bg-white text-rose-600 border border-rose-200 rounded-xl h-12 font-label-md text-label-md active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  cancel
                </span>
                {cancelling ? 'Cancelling…' : 'Cancel Order'}
              </button>
            )}

            {cancelError && (
              <p
                role="alert"
                data-testid="order-detail-cancel-error"
                className="text-sm text-rose-600 text-center mt-1"
              >
                {cancelError}
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
