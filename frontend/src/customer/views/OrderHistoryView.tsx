/**
 * OrderHistoryView — Customer App past-orders list with empty state.
 *
 * Renders a paginated list of the authenticated customer's past orders.
 * Reached from the Profile tab. Each card surfaces the order's date/time,
 * an items summary, the IDR total, and an OrderStatusPill. Tapping a card
 * navigates to the OrderDetailView for that order. When the user has no
 * past orders we render an empty state with a "Browse Menu" CTA that
 * jumps back to the Menu tab.
 *
 * Data flow:
 *   - Reads the JWT from useAuth() and sends it as `Authorization: Bearer`.
 *   - Fetches GET ${API_BASE_URL}/api/orders/history?page=N. The backend
 *     returns { orders, page, totalPages, totalOrders } already sorted by
 *     createdAt desc and capped at 20 per page (backend route + Property
 *     13).
 *   - Re-fetches whenever currentPage or token changes.
 *   - On 401 we log the user out via useAuth().logout(); the auth gate in
 *     CustomerApp will then bounce them to Login.
 *
 * Spec references:
 *   - Requirement 13.5 (paginated 20/page, most recent first, fields shown)
 *   - Requirement 13.6 (empty state when no orders)
 *   - Requirement 19.1 (card content: date+time, items summary, IDR total,
 *     OrderStatusPill)
 *   - Requirement 19.6 (empty state: illustration + "No orders yet" +
 *     "Browse Menu" CTA)
 *   - Requirement 19.7 (CTA navigates to Menu within 300ms)
 *   - Requirement 19.8 (card uses surface-container-lowest, xl radius,
 *     subtle shadow)
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import OrderStatusPill, { type OrderStatus } from '../components/OrderStatusPill';
import { formatIDR } from './MenuView';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:4000';

export interface OrderHistoryItem {
  id: number;
  menuItemId: number;
  quantity: number;
  priceAtOrder: number | string;
  menuItem: { name: string };
}

export interface OrderHistoryEntry {
  id: number;
  createdAt: string;
  totalAmount: number | string;
  status: string;
  items: OrderHistoryItem[];
}

interface OrderHistoryResponse {
  orders: OrderHistoryEntry[];
  page: number;
  totalPages: number;
  totalOrders: number;
}

export interface OrderHistoryViewProps {
  /** Tap on a card → navigate to OrderDetailView for that order id. */
  onSelectOrder: (orderId: number) => void;
  /** Empty-state CTA → switch to the Menu tab. */
  onBrowseMenu: () => void;
}

/**
 * Format an ISO timestamp to "15 Jan 2024, 10:30" using the id-ID locale
 * so customers see Indonesian month abbreviations (Jan, Feb, ...). The
 * implementation tolerates malformed dates by falling back to the raw
 * value rather than throwing.
 */
function formatOrderDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Build the comma-separated items summary, e.g. "2x Iced Latte, 1x Croissant".
 */
function formatItemsSummary(items: OrderHistoryItem[]): string {
  return items
    .map((item) => `${item.quantity}x ${item.menuItem.name}`)
    .join(', ');
}

/**
 * Defensive coerce of an unknown order status string into the OrderStatus
 * union expected by OrderStatusPill. Unknown values fall through to a
 * neutral "Unknown" pill (handled inside getStatusPillStyle).
 */
function coerceStatus(status: string): OrderStatus {
  return status as OrderStatus;
}

export default function OrderHistoryView({
  onSelectOrder,
  onBrowseMenu,
}: OrderHistoryViewProps) {
  const { token, logout } = useAuth();

  const [orders, setOrders] = useState<OrderHistoryEntry[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(
    async (page: number, authToken: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/orders/history?page=${page}`,
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

        if (!response.ok) {
          throw new Error('Failed to load order history');
        }

        const data: OrderHistoryResponse = await response.json();
        setOrders(data.orders);
        setCurrentPage(data.page);
        setTotalPages(Math.max(1, data.totalPages));
      } catch {
        setError('Failed to load order history');
      } finally {
        setLoading(false);
      }
    },
    [logout],
  );

  useEffect(() => {
    if (!token) return;
    fetchHistory(currentPage, token);
  }, [token, currentPage, fetchHistory]);

  const handlePrev = () => {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage((p) => p + 1);
    }
  };

  // Defensive: in practice OrderHistoryView is only mounted from inside an
  // authenticated CustomerApp shell, so token will be non-null. We keep
  // this branch so the component is renderable in isolation (e.g. from
  // Storybook or a unit test that hasn't seeded a token).
  if (!token) {
    return (
      <div
        className="flex items-center justify-center py-16 px-4"
        data-testid="order-history-unauthenticated"
      >
        <p className="text-sm text-on-surface-variant">
          Please log in to see your orders
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-16"
        data-testid="order-history-loading"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-on-surface-variant">Loading orders…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 px-4 gap-3"
        data-testid="order-history-error"
      >
        <p className="text-sm text-error">Failed to load order history</p>
        <button
          type="button"
          onClick={() => token && fetchHistory(currentPage, token)}
          className="px-4 py-2 text-sm bg-primary text-on-primary rounded-lg active:scale-95 transition-transform"
          data-testid="order-history-retry"
        >
          Retry
        </button>
      </div>
    );
  }

  if (orders.length === 0) {
    // Empty state per Requirement 19.6 / 19.7. Tapping the CTA fires
    // onBrowseMenu synchronously, which lets the parent flip to the Menu
    // tab well within the 300ms budget.
    return (
      <div
        className="flex flex-col items-center justify-center py-16 px-margin-mobile gap-md text-center"
        data-testid="order-history-empty"
      >
        <div
          className="w-24 h-24 rounded-full bg-secondary-container/40 flex items-center justify-center"
          aria-hidden="true"
        >
          <span
            className="material-symbols-outlined text-on-surface-variant/70"
            style={{ fontSize: '64px' }}
          >
            receipt_long
          </span>
        </div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">
          No orders yet
        </h2>
        <p className="text-sm text-on-surface-variant max-w-xs">
          Your past orders will appear here once you place one.
        </p>
        <button
          type="button"
          onClick={onBrowseMenu}
          className="mt-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-label-md text-label-md shadow-[0_4px_12px_rgba(225,29,72,0.2)] active:scale-95 transition-transform"
          data-testid="browse-menu-cta"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div
      className="px-margin-mobile py-md flex flex-col gap-md pb-24"
      data-testid="order-history-view"
    >
      <div className="flex flex-col gap-md" data-testid="order-history-list">
        {orders.map((order) => {
          const itemsSummary = formatItemsSummary(order.items);
          const formattedDate = formatOrderDate(order.createdAt);
          return (
            <button
              key={order.id}
              type="button"
              onClick={() => onSelectOrder(order.id)}
              className="bg-surface-container-lowest rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-outline-variant/20 p-4 flex flex-col gap-2 text-left active:scale-[0.98] transition-transform hover:shadow-md"
              data-testid={`order-history-card-${order.id}`}
              aria-label={`View details for order ${order.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="text-xs text-on-surface-variant"
                  data-testid={`order-history-date-${order.id}`}
                >
                  {formattedDate}
                </span>
                <OrderStatusPill status={coerceStatus(order.status)} />
              </div>

              <p
                className="font-body-md text-body-md text-on-surface line-clamp-2"
                data-testid={`order-history-items-${order.id}`}
              >
                {itemsSummary}
              </p>

              <div className="flex justify-end">
                <span
                  className="font-semibold text-on-surface"
                  data-testid={`order-history-total-${order.id}`}
                >
                  {formatIDR(Number(order.totalAmount))}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div
          className="flex items-center justify-center gap-3 mt-2"
          data-testid="order-history-pagination"
        >
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentPage <= 1}
            className="px-3 py-1 text-sm border border-outline-variant rounded-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
            data-testid="order-history-prev"
            aria-label="Previous page"
          >
            Previous
          </button>
          <span
            className="text-sm text-on-surface-variant"
            data-testid="order-history-page-info"
          >
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 text-sm border border-outline-variant rounded-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
            data-testid="order-history-next"
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
