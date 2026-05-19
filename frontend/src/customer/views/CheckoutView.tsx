/**
 * CheckoutView — Customer App Checkout screen with payment method selection.
 *
 * Standalone view (task 18.2): this is a NEW screen wired by the
 * CustomerApp shell (task 16.4) as a separate overlay reached from the
 * Cart tab. The existing CartView retains its inline checkout flow for
 * now. CheckoutView is intentionally a controlled, prop-driven component
 * with no global state — the parent shell owns the cart, navigation, and
 * post-success behavior (cart-clear and PaymentSuccessView routing).
 *
 * Visual contract follows the cart_payment design reference and the
 * Customer_MD3_Tokens design system:
 *   - Sticky 64px-equivalent header with back arrow + "Checkout" title
 *   - Read-only cart summary card on bg-surface-container-lowest with
 *     each line rendered as `<quantity>x <name>` plus a per-line IDR
 *     subtotal computed from quantity × priceAtOrder, followed by a
 *     subtotal/total row formatted with formatIDR.
 *   - Payment Methods section with three radio-card options:
 *     E-Wallet (account_balance_wallet), Bank Transfer (account_balance),
 *     Cash on Pickup (payments). Selected card gets a 2px primary border
 *     plus a primary-tinted background; unselected cards use
 *     bg-surface-container-lowest with an outline-variant border.
 *     A hidden radio input drives a11y; the visible card carries
 *     role/aria-checked for screen readers.
 *   - Sticky bottom primary "Pay Now" button. Disabled (true `disabled`
 *     attribute + visual disabled styling) until a payment method is
 *     selected (Requirement 12.11). Submission shows "Processing…"
 *     and is also disabled while in flight.
 *   - active:scale-95 tactile feedback on every touchable.
 *
 * Submission:
 *   - POST ${API_BASE_URL}/api/orders with header
 *     `Authorization: Bearer <token>` from useAuth(). Body shape:
 *       { items: [{ menuItemId, quantity, priceAtOrder }], paymentMethod }
 *   - On 2xx with { id }: invokes onPaymentConfirmed(method, id). Parent
 *     navigates to PaymentSuccessView and clears the cart.
 *   - On non-OK or network failure: shows an inline error in the view
 *     and calls onPaymentFailed(reason) if provided. The cart is NOT
 *     cleared (Requirement 12.6 / 12.7).
 *
 * Spec references:
 *   - Requirement 12.3  (selectable payment methods at minimum:
 *     e-wallet, bank transfer, cash on pickup)
 *   - Requirement 12.11 ("Pay Now" disabled until a method is selected)
 *   - design.md "Customer App Component Architecture" / Cart_Summary_Bar
 *     and Payment_Success_Screen flow
 *   - mobile_webapp_ui/cart_payment/code.html (visual reference)
 */

import { useMemo, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import type { CartItem } from '../../utils/cartCalculator';
import { calculateTotal } from '../../utils/cartCalculator';
import { formatIDR } from './MenuView';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:4000';

/**
 * Supported payment methods at MVP scope (Requirement 12.3). The string
 * values are sent verbatim to the backend `paymentMethod` field.
 */
export type PaymentMethod = 'e_wallet' | 'bank_transfer' | 'cash_on_pickup';

interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  /** Material Symbols Outlined icon name. */
  icon: string;
}

const PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  { value: 'e_wallet', label: 'E-Wallet', icon: 'account_balance_wallet' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: 'account_balance' },
  { value: 'cash_on_pickup', label: 'Cash on Pickup', icon: 'payments' },
] as const;

export interface CheckoutViewProps {
  /** Read-only cart contents to display and submit. */
  items: CartItem[];
  /**
   * Fired after a successful order submission. Parent should navigate
   * to PaymentSuccessView and clear the cart.
   */
  onPaymentConfirmed: (paymentMethod: PaymentMethod, orderNumber: number) => void;
  /** Optional error toast / analytics hook fired on submission failure. */
  onPaymentFailed?: (reason?: string) => void;
  /** Tap on the back arrow → navigate back to the Cart tab. */
  onBack?: () => void;
}

const SUBMISSION_ERROR_MESSAGE =
  'Order could not be submitted. Please try again.';

export default function CheckoutView({
  items,
  onPaymentConfirmed,
  onPaymentFailed,
  onBack,
}: CheckoutViewProps) {
  const { token } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Stable idempotency key per Checkout mount. Survives accidental
  // double-taps on Pay Now (handler is also guarded by `isSubmitting`,
  // but a transport retry that arrives at the backend twice can still
  // produce duplicate orders without server-side dedup).
  const idempotencyKey = useMemo(() => {
    // crypto.randomUUID is widely supported in modern browsers; we
    // fall back to a Math.random-based id for older runtimes.
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `voka-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }, []);

  const total = calculateTotal(items);
  const isPayDisabled = selectedMethod === null || isSubmitting;

  const handleSelectMethod = (method: PaymentMethod) => {
    if (isSubmitting) return;
    setSelectedMethod(method);
    // Clear any prior error once the user adjusts the form.
    if (submissionError) setSubmissionError(null);
  };

  const handlePayNow = async () => {
    if (!selectedMethod || isSubmitting) return;
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            priceAtOrder: item.priceAtOrder,
          })),
          paymentMethod: selectedMethod,
        }),
      });

      if (!response.ok) {
        setSubmissionError(SUBMISSION_ERROR_MESSAGE);
        onPaymentFailed?.(`HTTP ${response.status}`);
        setIsSubmitting(false);
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | { id?: number; orderId?: number }
        | null;
      const orderNumber = body?.id ?? body?.orderId;
      if (typeof orderNumber !== 'number') {
        setSubmissionError(SUBMISSION_ERROR_MESSAGE);
        onPaymentFailed?.('Malformed response');
        setIsSubmitting(false);
        return;
      }

      onPaymentConfirmed(selectedMethod, orderNumber);
      // Intentionally leave isSubmitting true — the parent typically unmounts
      // this view after onPaymentConfirmed, and we don't want a brief
      // "Pay Now" re-enable flash.
    } catch (err) {
      setSubmissionError(SUBMISSION_ERROR_MESSAGE);
      onPaymentFailed?.(err instanceof Error ? err.message : 'Network error');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="checkout-view"
      className="min-h-screen w-full bg-surface text-on-surface flex flex-col pb-32"
    >
      {/* Header */}
      <header
        data-testid="checkout-header"
        className="sticky top-0 z-30 flex items-center gap-sm bg-surface px-margin-mobile h-16 border-b border-outline-variant"
      >
        <button
          type="button"
          aria-label="Back to cart"
          data-testid="checkout-back"
          onClick={() => onBack?.()}
          className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors active:scale-95"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            arrow_back
          </span>
        </button>
        <h1
          className="font-headline-sm text-headline-sm text-on-surface"
          data-testid="checkout-title"
        >
          Checkout
        </h1>
      </header>

      <main className="w-full max-w-2xl mx-auto px-margin-mobile pt-lg flex flex-col gap-xl">
        {/* Read-only cart summary */}
        <section
          data-testid="checkout-cart-summary"
          className="bg-surface-container-lowest rounded-xl shadow-md3-card px-md py-md flex flex-col gap-md"
        >
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Your Order
          </h2>
          {items.length === 0 ? (
            <p
              className="font-body-md text-body-md text-on-surface-variant"
              data-testid="checkout-empty"
            >
              Your cart is empty.
            </p>
          ) : (
            <ul
              data-testid="checkout-items"
              className="flex flex-col gap-sm list-none m-0 p-0"
            >
              {items.map((item) => (
                <li
                  key={item.id}
                  data-testid={`checkout-item-${item.id}`}
                  className="flex items-center justify-between gap-md"
                >
                  <span className="font-body-md text-body-md text-on-surface">
                    {item.quantity}x {item.name}
                  </span>
                  <span
                    className="font-label-md text-label-md text-on-surface"
                    data-testid={`checkout-item-line-total-${item.id}`}
                  >
                    {formatIDR(item.quantity * item.priceAtOrder)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <hr className="border-0 border-t border-outline-variant" />

          <div className="flex items-center justify-between">
            <span className="font-body-md text-body-md text-on-surface-variant">
              Subtotal
            </span>
            <span
              className="font-body-md text-body-md text-on-surface"
              data-testid="checkout-subtotal"
            >
              {formatIDR(total)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Total
            </span>
            <span
              className="font-headline-md text-headline-md text-primary font-bold"
              data-testid="checkout-total"
            >
              {formatIDR(total)}
            </span>
          </div>
        </section>

        {/* Payment Methods */}
        <section
          data-testid="checkout-payment-methods"
          className="flex flex-col gap-md"
        >
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Payment Method
          </h2>

          <div
            role="radiogroup"
            aria-label="Payment Method"
            className="flex flex-col gap-sm"
          >
            {PAYMENT_METHODS.map((option) => {
              const isSelected = selectedMethod === option.value;
              return (
                <label
                  key={option.value}
                  data-testid={`payment-method-${option.value}`}
                  data-selected={isSelected ? 'true' : 'false'}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => handleSelectMethod(option.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSelectMethod(option.value);
                    }
                  }}
                  className={[
                    'cursor-pointer select-none',
                    'flex items-center gap-md',
                    'rounded-xl px-md py-md',
                    'transition-all active:scale-[0.98]',
                    isSelected
                      ? 'bg-primary-container/10 border-primary border-2'
                      : 'bg-surface-container-lowest border border-outline-variant',
                  ].join(' ')}
                >
                  {/* Hidden, keyboard-friendly radio for accessibility. */}
                  <input
                    type="radio"
                    name="payment-method"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => handleSelectMethod(option.value)}
                    className="sr-only"
                    data-testid={`payment-method-input-${option.value}`}
                  />
                  <span
                    className={[
                      'w-10 h-10 flex items-center justify-center rounded-full',
                      isSelected
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface-variant',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    <span className="material-symbols-outlined">{option.icon}</span>
                  </span>
                  <span className="flex-1 font-label-md text-label-md text-on-surface">
                    {option.label}
                  </span>
                  {isSelected && (
                    <span
                      className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                      aria-hidden="true"
                      data-testid={`payment-method-check-${option.value}`}
                    >
                      <span
                        className="material-symbols-outlined text-on-primary text-base"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check
                      </span>
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </section>

        {/* Inline submission error */}
        {submissionError && (
          <div
            data-testid="checkout-submission-error"
            role="alert"
            className="bg-error-container border border-error rounded-xl px-md py-sm flex items-start gap-sm"
          >
            <span
              className="material-symbols-outlined text-on-error-container"
              aria-hidden="true"
            >
              error
            </span>
            <p className="font-body-sm text-body-sm text-on-error-container font-medium">
              {submissionError}
            </p>
          </div>
        )}
      </main>

      {/* Sticky Pay Now bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-margin-mobile py-sm bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <div className="w-full max-w-2xl mx-auto">
          <button
            type="button"
            data-testid="checkout-pay-now"
            disabled={isPayDisabled}
            aria-disabled={isPayDisabled}
            onClick={handlePayNow}
            className={[
              'w-full h-14',
              'inline-flex items-center justify-center gap-sm',
              'bg-primary text-on-primary',
              'rounded-xl',
              'shadow-[0_4px_12px_rgba(225,29,72,0.2)]',
              'font-label-md text-label-md',
              'border-none',
              'transition-transform active:scale-95',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
            ].join(' ')}
          >
            {isSubmitting ? (
              <span data-testid="checkout-pay-now-label">Processing…</span>
            ) : (
              <>
                <span data-testid="checkout-pay-now-label">Pay Now</span>
                <span
                  className="material-symbols-outlined text-base"
                  aria-hidden="true"
                >
                  arrow_forward
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
