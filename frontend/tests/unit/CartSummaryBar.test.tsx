import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import CartSummaryBar from '../../src/customer/components/CartSummaryBar';

describe('CartSummaryBar', () => {
  it('renders nothing when itemCount is 0 (Requirement 17.10)', () => {
    const { container } = render(
      <CartSummaryBar itemCount={0} totalIdr={0} onViewCart={() => {}} />
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('cart-summary-bar')).toBeNull();
  });

  it('renders nothing when itemCount is negative (defensive)', () => {
    const { container } = render(
      <CartSummaryBar itemCount={-1} totalIdr={0} onViewCart={() => {}} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders the bar when cart has at least one item (Requirement 17.8)', () => {
    render(
      <CartSummaryBar itemCount={1} totalIdr={25000} onViewCart={() => {}} />
    );

    expect(screen.getByTestId('cart-summary-bar')).toBeDefined();
  });

  it('uses singular "item" label for exactly 1 item', () => {
    render(
      <CartSummaryBar itemCount={1} totalIdr={25000} onViewCart={() => {}} />
    );

    expect(screen.getByTestId('cart-summary-count').textContent).toBe('1 item');
  });

  it('uses plural "items" label for counts greater than 1', () => {
    render(
      <CartSummaryBar itemCount={2} totalIdr={50000} onViewCart={() => {}} />
    );

    expect(screen.getByTestId('cart-summary-count').textContent).toBe('2 items');
  });

  it('formats the IDR total with thousands separator', () => {
    render(
      <CartSummaryBar itemCount={3} totalIdr={125000} onViewCart={() => {}} />
    );

    expect(screen.getByTestId('cart-summary-total').textContent).toBe('Rp 125.000');
  });

  it('renders the IDR total in primary color, bold (Requirement 17.8)', () => {
    render(
      <CartSummaryBar itemCount={2} totalIdr={50000} onViewCart={() => {}} />
    );

    const total = screen.getByTestId('cart-summary-total');
    expect(total.className).toContain('text-primary');
    expect(total.className).toContain('font-bold');
  });

  it('renders a "View Cart" button with primary styling (Requirement 18.17)', () => {
    render(
      <CartSummaryBar itemCount={2} totalIdr={50000} onViewCart={() => {}} />
    );

    const button = screen.getByTestId('cart-summary-view-cart');
    expect(button.textContent).toContain('View Cart');
    expect(button.className).toContain('bg-primary');
    expect(button.className).toContain('text-on-primary');
    expect(button.className).toContain('rounded-xl');
    expect(button.className).toContain('shadow-primary-glow');
  });

  it('calls onViewCart when the View Cart button is tapped (Requirement 17.11)', () => {
    const onViewCart = vi.fn();
    render(
      <CartSummaryBar itemCount={2} totalIdr={50000} onViewCart={onViewCart} />
    );

    fireEvent.click(screen.getByTestId('cart-summary-view-cart'));
    expect(onViewCart).toHaveBeenCalledTimes(1);
  });

  it('is positioned above the bottom navigation', () => {
    render(
      <CartSummaryBar itemCount={2} totalIdr={50000} onViewCart={() => {}} />
    );

    const bar = screen.getByTestId('cart-summary-bar');
    expect(bar.className).toContain('fixed');
    // bottom-[88px] clears the 64px bottom nav with a small gap.
    expect(bar.className).toContain('bottom-[88px]');
  });
});
