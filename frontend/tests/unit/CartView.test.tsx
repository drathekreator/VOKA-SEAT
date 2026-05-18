import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CartView from '../../src/customer/views/CartView';
import type { CartItem } from '../../src/utils/cartCalculator';

const mockItems: CartItem[] = [
  { id: 1, menuItemId: 10, name: 'Latte', quantity: 2, priceAtOrder: 25000 },
  { id: 2, menuItemId: 11, name: 'Croissant', quantity: 1, priceAtOrder: 15000 },
];

describe('CartView', () => {
  it('displays cart items with name, quantity, and price', () => {
    const onUpdateCart = vi.fn();
    render(<CartView items={mockItems} onUpdateCart={onUpdateCart} />);

    expect(screen.getByText('Latte')).toBeInTheDocument();
    expect(screen.getByText('Croissant')).toBeInTheDocument();
    expect(screen.getByTestId('quantity-1')).toHaveTextContent('2');
    expect(screen.getByTestId('quantity-2')).toHaveTextContent('1');
  });

  it('displays the correct total', () => {
    const onUpdateCart = vi.fn();
    render(<CartView items={mockItems} onUpdateCart={onUpdateCart} />);

    // Total = (2 * 25000) + (1 * 15000) = 65000
    expect(screen.getByTestId('cart-total')).toHaveTextContent('65.000');
  });

  it('calls onUpdateCart with increased quantity on + button click', () => {
    const onUpdateCart = vi.fn();
    render(<CartView items={mockItems} onUpdateCart={onUpdateCart} />);

    fireEvent.click(screen.getByTestId('increase-1'));
    expect(onUpdateCart).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, quantity: 3 }),
      ])
    );
  });

  it('calls onUpdateCart with decreased quantity on - button click', () => {
    const onUpdateCart = vi.fn();
    render(<CartView items={mockItems} onUpdateCart={onUpdateCart} />);

    fireEvent.click(screen.getByTestId('decrease-1'));
    expect(onUpdateCart).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, quantity: 1 }),
      ])
    );
  });

  it('removes item when decreasing quantity from 1', () => {
    const onUpdateCart = vi.fn();
    render(<CartView items={mockItems} onUpdateCart={onUpdateCart} />);

    fireEvent.click(screen.getByTestId('decrease-2'));
    const updatedItems = onUpdateCart.mock.calls[0][0];
    expect(updatedItems.find((i: CartItem) => i.id === 2)).toBeUndefined();
    expect(updatedItems.length).toBe(1);
  });

  it('shows empty cart message when no items', () => {
    const onUpdateCart = vi.fn();
    render(<CartView items={[]} onUpdateCart={onUpdateCart} />);

    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
  });

  it('shows error message when checkout is attempted with empty cart', () => {
    const onUpdateCart = vi.fn();
    render(<CartView items={[]} onUpdateCart={onUpdateCart} />);

    fireEvent.click(screen.getByTestId('checkout-btn'));
    expect(screen.getByTestId('empty-cart-error')).toBeInTheDocument();
  });

  it('navigates to payment step on checkout with items', () => {
    const onUpdateCart = vi.fn();
    render(<CartView items={mockItems} onUpdateCart={onUpdateCart} />);

    fireEvent.click(screen.getByTestId('checkout-btn'));
    expect(screen.getByText('Payment')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-payment-btn')).toBeInTheDocument();
  });

  it('shows payment error and retains cart on payment failure', () => {
    const onUpdateCart = vi.fn();
    render(<CartView items={mockItems} onUpdateCart={onUpdateCart} />);

    fireEvent.click(screen.getByTestId('checkout-btn'));
    fireEvent.click(screen.getByTestId('simulate-payment-failure-btn'));

    expect(screen.getByTestId('payment-error')).toBeInTheDocument();
    // Cart should not have been cleared
    expect(onUpdateCart).not.toHaveBeenCalled();
  });

  it('prevents progression to payment when cart is empty', () => {
    const onUpdateCart = vi.fn();
    render(<CartView items={[]} onUpdateCart={onUpdateCart} />);

    fireEvent.click(screen.getByTestId('checkout-btn'));
    // Should show error, not navigate to payment
    expect(screen.getByTestId('empty-cart-error')).toBeInTheDocument();
    expect(screen.queryByText('Payment')).not.toBeInTheDocument();
  });
});
