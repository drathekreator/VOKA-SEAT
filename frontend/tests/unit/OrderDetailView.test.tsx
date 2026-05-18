/**
 * OrderDetailView unit tests.
 *
 * Covers (task 19.4):
 *   - Loading state shows the spinner before the fetch resolves
 *   - Renders order number, items (each with `<qty>x <name>` and IDR line
 *     subtotal), subtotal, total (Requirements 19.4)
 *   - Renders OrderStatusPill for the current status (design.md "Order
 *     Detail view" — uses OrderStatusPill for current status)
 *   - Renders "Seat #N" when seatId is non-null (Requirement 19.4)
 *   - Renders "No seat assigned" when seatId is null (Requirement 19.5)
 *   - Renders the statusHistory entries in chronological order
 *     (Requirement 19.4 — timestamp of each status change in chronological
 *     order)
 *   - Tap on back arrow calls onBack
 *   - 401 response triggers logout()
 *   - 404 response shows "Order not found"
 *   - Sends `Authorization: Bearer <token>` header to `/api/orders/<id>`
 *
 * The test mocks useAuth via vi.mock so we can supply a token without
 * standing up an <AuthProvider>. fetch is mocked per test, mirroring the
 * pattern used by OrderHistoryView.test.tsx.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OrderDetailView from '../../src/customer/views/OrderDetailView';

const mockLogout = vi.fn();

vi.mock('../../src/customer/auth/useAuth', () => ({
  useAuth: () => ({
    token: 'test-jwt-token',
    user: { nim: '12345678', name: 'Test User' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: mockLogout,
  }),
}));

interface MockOrderItem {
  id: number;
  menuItemId: number;
  quantity: number;
  priceAtOrder: number;
  menuItem: { name: string };
}

interface MockStatusHistoryEntry {
  id: number;
  status: string;
  changedAt: string;
}

interface MockOrder {
  id: number;
  status: string;
  seatId: number | null;
  totalAmount: number;
  createdAt: string;
  items: MockOrderItem[];
  statusHistory: MockStatusHistoryEntry[];
}

function makeOrder(partial: Partial<MockOrder> & { id: number }): MockOrder {
  return {
    status: 'preparing',
    seatId: 5,
    totalAmount: 43000,
    createdAt: '2024-01-15T10:30:00Z',
    items: [
      {
        id: 1,
        menuItemId: 1,
        quantity: 2,
        priceAtOrder: 18000,
        menuItem: { name: 'Iced Latte' },
      },
      {
        id: 2,
        menuItemId: 3,
        quantity: 1,
        priceAtOrder: 7000,
        menuItem: { name: 'Croissant' },
      },
    ],
    statusHistory: [
      { id: 10, status: 'pending', changedAt: '2024-01-15T10:30:00Z' },
      { id: 11, status: 'preparing', changedAt: '2024-01-15T10:35:00Z' },
    ],
    ...partial,
  };
}

function mockOrderResponse(order: MockOrder, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => order,
  } as unknown as Response;
}

describe('OrderDetailView', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mockLogout.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the loading spinner before the fetch resolves', async () => {
    let resolveFetch: ((value: Response) => void) | null = null;
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<OrderDetailView orderId={1} onBack={vi.fn()} />);

    expect(screen.getByTestId('order-detail-loading')).toBeInTheDocument();

    // Resolve to clean up.
    resolveFetch?.(mockOrderResponse(makeOrder({ id: 1 })));
    await waitFor(() => {
      expect(screen.queryByTestId('order-detail-loading')).not.toBeInTheDocument();
    });
  });

  it('renders order number, items, subtotal, and total in IDR', async () => {
    const order = makeOrder({ id: 42 });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockOrderResponse(order),
    );

    render(<OrderDetailView orderId={42} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('order-detail-order-number')).toBeInTheDocument();
    });

    expect(screen.getByTestId('order-detail-order-number')).toHaveTextContent(
      'Order #42',
    );

    // Items rendered with `<qty>x <name>`.
    expect(screen.getByTestId('order-detail-item-1')).toHaveTextContent(
      '2x Iced Latte',
    );
    expect(screen.getByTestId('order-detail-item-2')).toHaveTextContent(
      '1x Croissant',
    );

    // Per-line subtotal in IDR with thousands separator (id-ID dot).
    expect(
      screen.getByTestId('order-detail-item-1-line-total'),
    ).toHaveTextContent('Rp 36.000');
    expect(
      screen.getByTestId('order-detail-item-2-line-total'),
    ).toHaveTextContent('Rp 7.000');

    // Subtotal sums all line totals = 36000 + 7000 = 43000.
    expect(screen.getByTestId('order-detail-subtotal')).toHaveTextContent(
      'Rp 43.000',
    );
    // Total uses the backend's totalAmount field.
    expect(screen.getByTestId('order-detail-total')).toHaveTextContent(
      'Rp 43.000',
    );
  });

  it('renders the OrderStatusPill for the current status', async () => {
    const order = makeOrder({ id: 1, status: 'preparing' });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockOrderResponse(order),
    );

    render(<OrderDetailView orderId={1} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByTestId('order-status-pill-preparing'),
      ).toBeInTheDocument();
    });
  });

  it('renders "Seat #N" when the order has an assigned seat', async () => {
    const order = makeOrder({ id: 1, seatId: 5 });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockOrderResponse(order),
    );

    render(<OrderDetailView orderId={1} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByTestId('order-detail-seat-assigned'),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId('order-detail-seat-assigned')).toHaveTextContent(
      'Seat #5',
    );
    // The "no seat" placeholder must not appear when seatId is non-null.
    expect(
      screen.queryByTestId('order-detail-seat-none'),
    ).not.toBeInTheDocument();
  });

  it('renders "No seat assigned" when seatId is null (Requirement 19.5)', async () => {
    const order = makeOrder({ id: 1, seatId: null });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockOrderResponse(order),
    );

    render(<OrderDetailView orderId={1} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByTestId('order-detail-seat-none'),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId('order-detail-seat-none')).toHaveTextContent(
      'No seat assigned',
    );
    expect(
      screen.queryByTestId('order-detail-seat-assigned'),
    ).not.toBeInTheDocument();
  });

  it('renders the statusHistory entries in chronological (ascending) order', async () => {
    // Intentionally pass entries out-of-order so we can verify the view
    // sorts them ascending by changedAt before rendering.
    const order = makeOrder({
      id: 1,
      statusHistory: [
        { id: 11, status: 'preparing', changedAt: '2024-01-15T10:35:00Z' },
        { id: 10, status: 'pending', changedAt: '2024-01-15T10:30:00Z' },
        { id: 12, status: 'ready', changedAt: '2024-01-15T10:50:00Z' },
      ],
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockOrderResponse(order),
    );

    render(<OrderDetailView orderId={1} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByTestId('order-detail-status-history-0'),
      ).toBeInTheDocument();
    });

    // Earliest entry (pending) should appear first.
    expect(
      screen.getByTestId('order-detail-status-history-0'),
    ).toHaveTextContent('Pending');
    expect(
      screen.getByTestId('order-detail-status-history-1'),
    ).toHaveTextContent('Preparing');
    expect(
      screen.getByTestId('order-detail-status-history-2'),
    ).toHaveTextContent('Ready');
  });

  it('calls onBack when the back arrow is tapped', async () => {
    const order = makeOrder({ id: 1 });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockOrderResponse(order),
    );
    const onBack = vi.fn();

    render(<OrderDetailView orderId={1} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByTestId('order-detail-back')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('order-detail-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('logs the user out on a 401 response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    } as unknown as Response);

    render(<OrderDetailView orderId={1} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('shows "Order not found" on a 404 response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Order not found' }),
    } as unknown as Response);

    render(<OrderDetailView orderId={999} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByTestId('order-detail-not-found'),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Order not found')).toBeInTheDocument();
  });

  it('sends Authorization: Bearer <token> header to /api/orders/<id>', async () => {
    const order = makeOrder({ id: 77 });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockOrderResponse(order),
    );

    render(<OrderDetailView orderId={77} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = callArgs[0] as string;
    const init = callArgs[1] as RequestInit;
    expect(url).toContain('/api/orders/77');
    expect(init.headers).toEqual({ Authorization: 'Bearer test-jwt-token' });
  });
});
