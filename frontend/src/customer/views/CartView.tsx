import { useState, useMemo } from 'react';
import { calculateTotal, adjustQuantity } from '../../utils/cartCalculator';
import type { CartItem } from '../../utils/cartCalculator';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:4000';

export interface CartViewProps {
  items: CartItem[];
  onUpdateCart: (items: CartItem[]) => void;
  /**
   * Optional callback invoked when the customer taps "Checkout".
   *
   * When provided (e.g. by the CustomerApp shell, task 16.4), the inline
   * payment / order-submission flow inside CartView is bypassed entirely
   * and the parent shell is responsible for mounting the dedicated
   * `CheckoutView` overlay (task 18.2). When omitted, CartView falls back
   * to the legacy inline checkout flow so the component remains usable
   * in isolation (Storybook, unit tests).
   */
  onCheckout?: () => void;
}

type CheckoutState =
  | { step: 'idle' }
  | { step: 'payment' }
  | { step: 'submitting' }
  | { step: 'confirmed'; orderNumber: number }
  | { step: 'payment-error'; message: string }
  | { step: 'submission-error'; message: string };

/**
 * CartView displays the shopping cart with quantity adjustment,
 * total computation, and a checkout flow including payment and
 * order submission handling.
 *
 * MD3 token migration (task 15.4): surface backgrounds use the
 * Customer_MD3_Tokens (`bg-surface-container-lowest`, `text-on-surface`,
 * `text-on-surface-variant`); primary actions use `bg-primary` /
 * `text-on-primary`; iconography uses Material Symbols Outlined
 * (`add` / `remove` / `delete` / `check_circle` / `error`).
 */
export default function CartView({ items, onUpdateCart, onCheckout }: CartViewProps) {
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ step: 'idle' });
  const [emptyCartError, setEmptyCartError] = useState(false);

  const total = useMemo(() => calculateTotal(items), [items]);

  const handleIncrease = (itemId: number) => {
    const updated = adjustQuantity(items, itemId, 'increase');
    onUpdateCart(updated);
  };

  const handleDecrease = (itemId: number) => {
    const updated = adjustQuantity(items, itemId, 'decrease');
    onUpdateCart(updated);
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      setEmptyCartError(true);
      return;
    }
    setEmptyCartError(false);
    // When the parent shell wires up its own CheckoutView overlay
    // (task 16.4 → task 18.2), defer to it instead of running the
    // legacy inline payment flow.
    if (onCheckout) {
      onCheckout();
      return;
    }
    setCheckoutState({ step: 'payment' });
  };

  const handlePaymentConfirm = async () => {
    setCheckoutState({ step: 'submitting' });
    try {
      const token = localStorage.getItem('vokafe_customer_jwt');
      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            priceAtOrder: item.priceAtOrder,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Order submission failed');
      }

      const data = await response.json();
      setCheckoutState({ step: 'confirmed', orderNumber: data.id ?? data.orderId });
      onUpdateCart([]);
    } catch {
      setCheckoutState({
        step: 'submission-error',
        message: 'Order could not be submitted. Please retry.',
      });
    }
  };

  const handlePaymentFailure = () => {
    setCheckoutState({
      step: 'payment-error',
      message: 'Payment was unsuccessful. Please try again.',
    });
  };

  const handleRetrySubmission = () => {
    handlePaymentConfirm();
  };

  const handleBackToCart = () => {
    setCheckoutState({ step: 'idle' });
  };

  // Order confirmed view
  if (checkoutState.step === 'confirmed') {
    return (
      <div className="flex flex-col items-center justify-center p-6 min-h-[300px] bg-surface-container-lowest">
        <span
          className="material-symbols-outlined text-6xl text-tertiary mb-4"
          aria-hidden="true"
        >
          check_circle
        </span>
        <h2 className="text-xl font-semibold text-on-surface mb-2">Order Confirmed!</h2>
        <p className="text-on-surface-variant" data-testid="order-number">
          Order #{checkoutState.orderNumber}
        </p>
      </div>
    );
  }

  // Payment step view
  if (checkoutState.step === 'payment') {
    return (
      <div className="p-4 bg-surface-container-lowest">
        <h2 className="text-lg font-semibold text-on-surface mb-4">Payment</h2>
        <div className="bg-surface-container rounded-lg p-4 mb-4">
          <p className="text-on-surface-variant mb-2">Total to pay:</p>
          <p className="text-2xl font-bold text-on-surface">
            Rp {total.toLocaleString('id-ID')}
          </p>
        </div>
        <div className="space-y-3">
          <button
            onClick={handlePaymentConfirm}
            className="w-full py-3 bg-primary text-on-primary rounded-lg font-medium active:scale-95 transition-transform"
            data-testid="confirm-payment-btn"
          >
            Confirm Payment
          </button>
          <button
            onClick={handlePaymentFailure}
            className="w-full py-3 bg-surface-container-high text-on-surface-variant rounded-lg font-medium active:scale-95 transition-transform"
            data-testid="simulate-payment-failure-btn"
          >
            Simulate Payment Failure
          </button>
          <button
            onClick={handleBackToCart}
            className="w-full py-2 text-on-surface-variant text-sm hover:text-on-surface transition-colors"
          >
            Back to Cart
          </button>
        </div>
      </div>
    );
  }

  // Payment error view
  if (checkoutState.step === 'payment-error') {
    return (
      <div className="p-4 bg-surface-container-lowest">
        <div
          className="bg-error-container border border-error rounded-lg p-4 mb-4 flex items-start gap-2"
          data-testid="payment-error"
        >
          <span className="material-symbols-outlined text-on-error-container" aria-hidden="true">
            error
          </span>
          <p className="text-on-error-container font-medium">{checkoutState.message}</p>
        </div>
        <button
          onClick={handleBackToCart}
          className="w-full py-3 bg-primary text-on-primary rounded-lg font-medium active:scale-95 transition-transform"
        >
          Back to Cart
        </button>
      </div>
    );
  }

  // Submission error view with retry
  if (checkoutState.step === 'submission-error') {
    return (
      <div className="p-4 bg-surface-container-lowest">
        <div
          className="bg-error-container border border-error rounded-lg p-4 mb-4 flex items-start gap-2"
          data-testid="submission-error"
        >
          <span className="material-symbols-outlined text-on-error-container" aria-hidden="true">
            error
          </span>
          <p className="text-on-error-container font-medium">{checkoutState.message}</p>
        </div>
        <div className="space-y-3">
          <button
            onClick={handleRetrySubmission}
            className="w-full py-3 bg-primary text-on-primary rounded-lg font-medium active:scale-95 transition-transform"
            data-testid="retry-submission-btn"
          >
            Retry Submission
          </button>
          <button
            onClick={handleBackToCart}
            className="w-full py-2 text-on-surface-variant text-sm hover:text-on-surface transition-colors"
          >
            Back to Cart
          </button>
        </div>
      </div>
    );
  }

  // Submitting state
  if (checkoutState.step === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center p-6 min-h-[300px] bg-surface-container-lowest">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4" />
        <p className="text-on-surface-variant">Submitting your order...</p>
      </div>
    );
  }

  // Main cart view (idle state)
  return (
    <div className="p-4 pb-24 bg-surface-container-lowest min-h-screen">
      <h2 className="text-lg font-semibold text-on-surface mb-4">Your Cart</h2>

      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-on-surface-variant">Your cart is empty</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-surface-container-lowest rounded-lg p-3 shadow-sm border border-outline-variant"
              data-testid={`cart-item-${item.id}`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-on-surface truncate">{item.name}</p>
                <p className="text-sm text-on-surface-variant">
                  Rp {item.priceAtOrder.toLocaleString('id-ID')}
                </p>
              </div>

              <div className="flex items-center gap-2 ml-3">
                <button
                  onClick={() => handleDecrease(item.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-container text-on-surface-variant active:scale-95 transition-transform"
                  aria-label={`Decrease quantity of ${item.name}`}
                  data-testid={`decrease-${item.id}`}
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    {item.quantity === 1 ? 'delete' : 'remove'}
                  </span>
                </button>
                <span
                  className="w-8 text-center font-medium text-on-surface"
                  data-testid={`quantity-${item.id}`}
                >
                  {item.quantity}
                </span>
                <button
                  onClick={() => handleIncrease(item.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-container text-on-surface-variant active:scale-95 transition-transform"
                  aria-label={`Increase quantity of ${item.name}`}
                  data-testid={`increase-${item.id}`}
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    add
                  </span>
                </button>
              </div>

              <div className="ml-3 text-right min-w-[80px]">
                <p className="font-medium text-on-surface">
                  Rp {(item.quantity * item.priceAtOrder).toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grand total and checkout */}
      <div className="fixed bottom-16 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-on-surface-variant font-medium">Total</span>
          <span className="text-xl font-bold text-on-surface" data-testid="cart-total">
            Rp {total.toLocaleString('id-ID')}
          </span>
        </div>

        {emptyCartError && (
          <p className="text-error text-sm mb-2" data-testid="empty-cart-error">
            Cart is empty. Add items before checkout.
          </p>
        )}

        <button
          onClick={handleCheckout}
          className="w-full py-3 bg-primary text-on-primary rounded-lg font-medium active:scale-95 transition-transform"
          data-testid="checkout-btn"
        >
          Checkout
        </button>
      </div>
    </div>
  );
}
