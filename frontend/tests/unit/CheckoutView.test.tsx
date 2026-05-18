/**
 * CheckoutView unit tests (task 18.2).
 *
 * Spec references:
 *   - Requirement 12.3  — payment method options (e-wallet, bank
 *     transfer, cash on pickup) presented as selectable options before
 *     order submission.
 *   - Requirement 12.11 — "Pay Now" submission action stays disabled
 *     while no payment method is selected.
 *   - Requirement 12.5/12.6/12.7 — submission flow and error handling
 *     (success calls onPaymentConfirmed; failure surfaces inline error
 *     and calls onPaymentFailed).
 *
 * useAuth is mocked to provide a fixed token. fetch is mocked per test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CheckoutView from '../../src/customer/views/CheckoutView';
import type { CartItem } from '../../src/utils/cartCalculator';

vi.mock('../../src/customer/auth/useAuth', () => ({
  useAuth: () => ({
    token: 'test-jwt-token',
    user: { nim: '12345678', name: 'Test User' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

const mockItems: CartItem[] = [
  { id: 1, menuItemId: 10, name: 'Latte', quantity: 2, priceAtOrder: 25000 },
  { id: 2, menuItemId: 11, name: 'Croissant', quantity: 1, priceAtOrder: 15000 },
];

function mockJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('CheckoutView', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders cart summary with each item formatted as "<qty>x <name>" and the totals', () => {
    render(
      <CheckoutView
        items={mockItems}
        onPaymentConfirmed={vi.fn()}
        onPaymentFailed={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId('checkout-item-1')).toHaveTextContent('2x Latte');
    expect(screen.getByTestId('checkout-item-2')).toHaveTextContent('1x Croissant');

    // Per-line totals: 2 × 25000 = 50000, 1 × 15000 = 15000.
    expect(screen.getByTestId('checkout-item-line-total-1')).toHaveTextContent(
      'Rp 50.000',
    );
    expect(screen.getByTestId('checkout-item-line-total-2')).toHaveTextContent(
      'Rp 15.000',
    );

    // Subtotal/Total: 65000.
    expect(screen.getByTestId('checkout-subtotal')).toHaveTextContent('Rp 65.000');
    expect(screen.getByTestId('checkout-total')).toHaveTextContent('Rp 65.000');
  });

  it('renders all three payment method options (Requirement 12.3)', () => {
    render(
      <CheckoutView
        items={mockItems}
        onPaymentConfirmed={vi.fn()}
        onPaymentFailed={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId('payment-method-e_wallet')).toHaveTextContent(
      'E-Wallet',
    );
    expect(screen.getByTestId('payment-method-bank_transfer')).toHaveTextContent(
      'Bank Transfer',
    );
    expect(
      screen.getByTestId('payment-method-cash_on_pickup'),
    ).toHaveTextContent('Cash on Pickup');
  });

  it('keeps "Pay Now" disabled until a payment method is selected (Requirement 12.11)', () => {
    render(
      <CheckoutView
        items={mockItems}
        onPaymentConfirmed={vi.fn()}
        onPaymentFailed={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const payNow = screen.getByTestId('checkout-pay-now') as HTMLButtonElement;
    expect(payNow.disabled).toBe(true);

    // Select a method.
    fireEvent.click(screen.getByTestId('payment-method-e_wallet'));
    expect(payNow.disabled).toBe(false);
  });

  it('does not submit when "Pay Now" is tapped with no method selected', () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    render(
      <CheckoutView
        items={mockItems}
        onPaymentConfirmed={vi.fn()}
        onPaymentFailed={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('checkout-pay-now'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits the order with Authorization header, items, and paymentMethod on success', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { id: 42 }));

    const onPaymentConfirmed = vi.fn();
    render(
      <CheckoutView
        items={mockItems}
        onPaymentConfirmed={onPaymentConfirmed}
        onPaymentFailed={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('payment-method-e_wallet'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('checkout-pay-now'));
    });

    await waitFor(() => {
      expect(onPaymentConfirmed).toHaveBeenCalledTimes(1);
    });

    expect(onPaymentConfirmed).toHaveBeenCalledWith('e_wallet', 42);

    // Verify the request shape.
    const callArgs = fetchMock.mock.calls[0];
    const url = callArgs[0] as string;
    const init = callArgs[1] as RequestInit;
    expect(url).toMatch(/\/api\/orders$/);
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-jwt-token');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string) as {
      items: Array<{ menuItemId: number; quantity: number; priceAtOrder: number }>;
      paymentMethod: string;
    };
    expect(body.paymentMethod).toBe('e_wallet');
    expect(body.items).toEqual([
      { menuItemId: 10, quantity: 2, priceAtOrder: 25000 },
      { menuItemId: 11, quantity: 1, priceAtOrder: 15000 },
    ]);
  });

  it('shows an inline error and calls onPaymentFailed on a 500 response', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(500, { error: 'Internal Server Error' }),
    );

    const onPaymentConfirmed = vi.fn();
    const onPaymentFailed = vi.fn();
    render(
      <CheckoutView
        items={mockItems}
        onPaymentConfirmed={onPaymentConfirmed}
        onPaymentFailed={onPaymentFailed}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('payment-method-bank_transfer'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('checkout-pay-now'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('checkout-submission-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('checkout-submission-error')).toHaveTextContent(
      'Order could not be submitted. Please try again.',
    );
    expect(onPaymentFailed).toHaveBeenCalledTimes(1);
    expect(onPaymentConfirmed).not.toHaveBeenCalled();

    // After failure the Pay Now button should be re-enabled so the user
    // can retry (Requirement 12.7).
    const payNow = screen.getByTestId('checkout-pay-now') as HTMLButtonElement;
    expect(payNow.disabled).toBe(false);
  });

  it('calls onBack when the back arrow is tapped', () => {
    const onBack = vi.fn();
    render(
      <CheckoutView
        items={mockItems}
        onPaymentConfirmed={vi.fn()}
        onPaymentFailed={vi.fn()}
        onBack={onBack}
      />,
    );

    fireEvent.click(screen.getByTestId('checkout-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
