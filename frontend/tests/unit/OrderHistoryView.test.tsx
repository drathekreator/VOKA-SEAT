/**
 * OrderHistoryView unit tests.
 *
 * Covers:
 *   - Empty state renders when API returns 0 orders, "Browse Menu" CTA
 *     fires onBrowseMenu (Requirements 13.6, 19.6, 19.7)
 *   - Order cards render date, items summary, IDR total, and the
 *     OrderStatusPill (Requirements 13.5, 19.1, 19.8)
 *   - Tap on a card calls onSelectOrder(order.id) (Requirement 19.3)
 *   - Loading state shows spinner before fetch completes
 *   - Pagination only renders when totalPages > 1; Previous disabled on
 *     page 1, Next disabled on last page; clicking Next refetches with
 *     page+1 (Property 13)
 *   - Sends Authorization: Bearer <token> header (Requirement 13.5)
 *
 * The test mocks useAuth via vi.mock so we can supply a token without
 * standing up an <AuthProvider>. fetch is mocked per test.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OrderHistoryView from '../../src/customer/views/OrderHistoryView';

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

interface MockOrder {
  id: number;
  createdAt: string;
  totalAmount: number;
  status: string;
  items: { id: number; menuItemId: number; quantity: number; priceAtOrder: number; menuItem: { name: string } }[];
}

function makeOrder(partial: Partial<MockOrder> & { id: number }): MockOrder {
  return {
    createdAt: '2024-01-15T10:30:00Z',
    totalAmount: 43000,
    status: 'completed',
    items: [
      { id: 1, menuItemId: 1, quantity: 2, priceAtOrder: 18000, menuItem: { name: 'Iced Latte' } },
      { id: 2, menuItemId: 3, quantity: 1, priceAtOrder: 7000, menuItem: { name: 'Croissant' } },
    ],
    ...partial,
  };
}

function mockHistoryResponse(
  orders: MockOrder[],
  page = 1,
  totalPages = 1,
): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ orders, page, totalPages, totalOrders: orders.length }),
  } as unknown as Response;
}

describe('OrderHistoryView', () => {
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

    render(
      <OrderHistoryView onSelectOrder={vi.fn()} onBrowseMenu={vi.fn()} />,
    );

    expect(screen.getByTestId('order-history-loading')).toBeInTheDocument();

    // Resolve to clean up.
    resolveFetch?.(mockHistoryResponse([]));
    await waitFor(() => {
      expect(screen.queryByTestId('order-history-loading')).not.toBeInTheDocument();
    });
  });

  it('renders the empty state and fires onBrowseMenu when the CTA is clicked', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockHistoryResponse([], 1, 1),
    );
    const onBrowseMenu = vi.fn();

    render(
      <OrderHistoryView onSelectOrder={vi.fn()} onBrowseMenu={onBrowseMenu} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-history-empty')).toBeInTheDocument();
    });
    expect(screen.getByText('No orders yet')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('browse-menu-cta'));
    expect(onBrowseMenu).toHaveBeenCalledTimes(1);
  });

  it('renders order cards with date, items summary, total, and status pill', async () => {
    const order = makeOrder({ id: 42, status: 'completed' });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockHistoryResponse([order], 1, 1),
    );

    render(
      <OrderHistoryView onSelectOrder={vi.fn()} onBrowseMenu={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-history-card-42')).toBeInTheDocument();
    });

    // Items summary is comma-separated.
    expect(screen.getByTestId('order-history-items-42')).toHaveTextContent(
      '2x Iced Latte, 1x Croissant',
    );

    // IDR total.
    expect(screen.getByTestId('order-history-total-42')).toHaveTextContent(
      'Rp 43.000',
    );

    // OrderStatusPill is rendered using the convention from the component.
    expect(screen.getByTestId('order-status-pill-completed')).toBeInTheDocument();

    // Date is rendered (assert it isn't empty rather than a locale-specific
    // string so the test doesn't depend on the system locale).
    const dateEl = screen.getByTestId('order-history-date-42');
    expect(dateEl.textContent?.length ?? 0).toBeGreaterThan(0);
  });

  it('calls onSelectOrder with the order id when a card is tapped', async () => {
    const order = makeOrder({ id: 7 });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockHistoryResponse([order], 1, 1),
    );
    const onSelectOrder = vi.fn();

    render(
      <OrderHistoryView
        onSelectOrder={onSelectOrder}
        onBrowseMenu={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-history-card-7')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('order-history-card-7'));
    expect(onSelectOrder).toHaveBeenCalledWith(7);
  });

  it('sends Authorization: Bearer <token> header when fetching', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockHistoryResponse([], 1, 1),
    );

    render(
      <OrderHistoryView onSelectOrder={vi.fn()} onBrowseMenu={vi.fn()} />,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = callArgs[0] as string;
    const init = callArgs[1] as RequestInit;
    expect(url).toContain('/api/orders/history?page=1');
    expect(init.headers).toEqual({ Authorization: 'Bearer test-jwt-token' });
  });

  it('does not render pagination when totalPages is 1', async () => {
    const order = makeOrder({ id: 1 });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockHistoryResponse([order], 1, 1),
    );

    render(
      <OrderHistoryView onSelectOrder={vi.fn()} onBrowseMenu={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-history-card-1')).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId('order-history-pagination'),
    ).not.toBeInTheDocument();
  });

  it('renders pagination with Previous disabled on page 1 and refetches with page+1 on Next', async () => {
    const ordersPage1 = [makeOrder({ id: 1 })];
    const ordersPage2 = [makeOrder({ id: 21 })];

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(mockHistoryResponse(ordersPage1, 1, 3))
      .mockResolvedValueOnce(mockHistoryResponse(ordersPage2, 2, 3));

    render(
      <OrderHistoryView onSelectOrder={vi.fn()} onBrowseMenu={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-history-pagination')).toBeInTheDocument();
    });

    expect(screen.getByTestId('order-history-page-info')).toHaveTextContent(
      'Page 1 of 3',
    );

    const prev = screen.getByTestId('order-history-prev') as HTMLButtonElement;
    const next = screen.getByTestId('order-history-next') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    fireEvent.click(next);

    await waitFor(() => {
      expect(screen.getByTestId('order-history-page-info')).toHaveTextContent(
        'Page 2 of 3',
      );
    });

    // Verify the second fetch hit page=2.
    const secondCall = fetchMock.mock.calls[1];
    expect(secondCall[0] as string).toContain('page=2');
  });

  it('disables Next on the last page', async () => {
    const orders = [makeOrder({ id: 99 })];
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockHistoryResponse(orders, 3, 3),
    );

    render(
      <OrderHistoryView onSelectOrder={vi.fn()} onBrowseMenu={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('order-history-pagination')).toBeInTheDocument();
    });
    const next = screen.getByTestId('order-history-next') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it('logs the user out on a 401 response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    } as unknown as Response);

    render(
      <OrderHistoryView onSelectOrder={vi.fn()} onBrowseMenu={vi.fn()} />,
    );

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });
});
