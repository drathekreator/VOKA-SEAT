import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import PaymentSuccessView from '../../src/customer/views/PaymentSuccessView';

/**
 * Unit tests for the Customer App PaymentSuccessView (Payment_Success_Screen).
 *
 * Spec references:
 *   - Requirement 12.5  — display Payment_Success_Screen with an order
 *     number after payment confirmation
 *   - Requirement 12.8  — order number, items summary (name + quantity),
 *     IDR total with thousands separator, and the two action buttons
 *   - Requirement 12.9  — "View Order Status" → OrderDetail navigation
 *   - Requirement 12.10 — "Back to Menu" → Menu tab + clear cart
 *     (cart-clear and tab-switch are parent shell concerns; this test
 *     only verifies the prop callback fires)
 *   - Glossary: Payment_Success_Screen
 */
describe('PaymentSuccessView', () => {
  const baseProps = {
    orderNumber: 42,
    items: [
      { name: 'Iced Latte', quantity: 2 },
      { name: 'Almond Croissant', quantity: 1 },
    ],
    totalIdr: 65000,
    onViewOrderStatus: vi.fn(),
    onBackToMenu: vi.fn(),
  };

  it('renders the order number prefixed with # (Requirement 12.8)', () => {
    render(<PaymentSuccessView {...baseProps} onViewOrderStatus={vi.fn()} onBackToMenu={vi.fn()} />);
    const orderNumber = screen.getByTestId('payment-success-order-number');
    expect(orderNumber.textContent).toBe('#42');
  });

  it('accepts a string order number and still prefixes it with # (Requirement 12.8)', () => {
    render(
      <PaymentSuccessView
        {...baseProps}
        orderNumber="A-1024"
        onViewOrderStatus={vi.fn()}
        onBackToMenu={vi.fn()}
      />
    );
    expect(screen.getByTestId('payment-success-order-number').textContent).toBe('#A-1024');
  });

  it('renders each item as "<quantity>x <name>" (Requirement 12.8)', () => {
    render(<PaymentSuccessView {...baseProps} onViewOrderStatus={vi.fn()} onBackToMenu={vi.fn()} />);
    const list = screen.getByTestId('payment-success-items');
    const items = list.querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('2x Iced Latte');
    expect(items[1].textContent).toBe('1x Almond Croissant');
  });

  it('renders the total as "Rp 65.000" with a thousands separator (Requirement 12.8)', () => {
    render(<PaymentSuccessView {...baseProps} onViewOrderStatus={vi.fn()} onBackToMenu={vi.fn()} />);
    const total = screen.getByTestId('payment-success-total');
    expect(total.textContent).toBe('Rp 65.000');
  });

  it('calls onViewOrderStatus when the View Order Status button is tapped (Requirement 12.9)', () => {
    const onViewOrderStatus = vi.fn();
    render(
      <PaymentSuccessView
        {...baseProps}
        onViewOrderStatus={onViewOrderStatus}
        onBackToMenu={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('payment-success-view-order'));
    expect(onViewOrderStatus).toHaveBeenCalledTimes(1);
  });

  it('calls onBackToMenu when the Back to Menu button is tapped (Requirement 12.10)', () => {
    const onBackToMenu = vi.fn();
    render(
      <PaymentSuccessView
        {...baseProps}
        onViewOrderStatus={vi.fn()}
        onBackToMenu={onBackToMenu}
      />
    );
    fireEvent.click(screen.getByTestId('payment-success-back-to-menu'));
    expect(onBackToMenu).toHaveBeenCalledTimes(1);
  });

  it('renders a check_circle Material Symbols Outlined icon as the success indicator', () => {
    render(<PaymentSuccessView {...baseProps} onViewOrderStatus={vi.fn()} onBackToMenu={vi.fn()} />);
    const icon = screen.getByTestId('payment-success-icon');
    expect(icon.tagName).toBe('SPAN');
    expect(icon.className).toContain('material-symbols-outlined');
    expect(icon.textContent).toBe('check_circle');
  });
});
