import { formatIDR } from './MenuView';

/**
 * PaymentSuccessView (Payment_Success_Screen)
 *
 * Full-screen confirmation shown after a successful payment in the
 * Customer App. Reached from the Checkout flow once payment is confirmed
 * and the order has been submitted to the Backend_Server.
 *
 * Contents (per Requirement 12.8 / 12.13):
 *   - Order number, prefixed with `#` (e.g. `#42`)
 *   - Items summary listing each line as `<quantity>x <name>`
 *   - Total amount paid in IDR formatted with thousands separator
 *   - Two primary action buttons:
 *       • "View Order Status" → navigate to OrderDetail (Requirement 12.9)
 *       • "Back to Menu"      → navigate to Menu and clear cart (12.10)
 *   - Optional secondary CTA "Save Order to Account" — rendered ONLY
 *     when the order was placed in guest mode (Requirement 12.13). The
 *     CTA is hidden once the customer authenticates so they cannot
 *     re-claim an already-claimed order (Requirement 12.14).
 *
 * Side-effects (cart-clear, tab-switch in 12.10; claim retroactive in
 * 12.13) are the responsibility of the parent CustomerApp shell. This
 * component is intentionally pure: it renders the summary and invokes
 * the supplied callbacks.
 */

export interface PaymentSuccessItem {
  /** Display name of the menu item. */
  name: string;
  /** Quantity ordered. Rendered as `<quantity>x <name>`. */
  quantity: number;
}

export interface PaymentSuccessViewProps {
  /**
   * Order number assigned by the backend after successful submission.
   * Displayed prefixed with `#` (e.g. `#42`). Accepts number or string so
   * callers can pass either the raw `Order.id` or a formatted variant.
   */
  orderNumber: number | string;
  /** Line items summarised on the success screen. */
  items: PaymentSuccessItem[];
  /** Total amount paid, in IDR (whole rupiah, integer). */
  totalIdr: number;
  /**
   * True when the order was placed without an authenticated customer
   * session (Guest_Order). When true the optional "Save Order to
   * Account" CTA is rendered; when false (or omitted) the CTA is
   * hidden (Requirement 12.14).
   */
  wasGuestCheckout?: boolean;
  /**
   * Invoked when the customer taps "View Order Status". Parent should
   * navigate to the OrderDetail view for the newly created order
   * (Requirement 12.9).
   */
  onViewOrderStatus: () => void;
  /**
   * Invoked when the customer taps "Back to Menu". Parent should clear
   * the cart and switch the active tab to Menu (Requirement 12.10).
   */
  onBackToMenu: () => void;
  /**
   * Invoked when the customer taps "Save Order to Account". Parent
   * routes to the Login screen and on success calls PATCH
   * /api/orders/:id/claim (Requirement 12.13). Only meaningful when
   * `wasGuestCheckout` is true.
   */
  onSaveOrderToAccount?: () => void;
}

export default function PaymentSuccessView({
  orderNumber,
  items,
  totalIdr,
  wasGuestCheckout = false,
  onViewOrderStatus,
  onBackToMenu,
  onSaveOrderToAccount,
}: PaymentSuccessViewProps) {
  return (
    <div
      data-testid="payment-success-view"
      role="region"
      aria-label="Payment successful"
      className={[
        'min-h-screen w-full',
        'bg-surface text-on-surface',
        'flex flex-col items-center',
        'px-md py-xl gap-lg',
      ].join(' ')}
    >
      {/* Hero: success icon halo + headline + subline */}
      <section className="flex flex-col items-center text-center gap-sm mt-lg">
        <div
          aria-hidden="true"
          className={[
            'rounded-full p-md',
            'bg-tertiary-container/30',
            'flex items-center justify-center',
          ].join(' ')}
          data-testid="payment-success-halo"
        >
          <span
            className="material-symbols-outlined text-tertiary text-6xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
            data-testid="payment-success-icon"
          >
            check_circle
          </span>
        </div>
        <h1
          className="font-headline-md text-headline-md text-on-surface"
          data-testid="payment-success-headline"
        >
          Payment Successful!
        </h1>
        <p
          className="font-body-md text-body-md text-on-surface-variant"
          data-testid="payment-success-subline"
        >
          Your order has been received.
        </p>
      </section>

      {/* Summary card */}
      <section
        data-testid="payment-success-summary"
        className={[
          'w-full max-w-md',
          'bg-surface-container-lowest',
          'rounded-xl shadow-md3-card',
          'px-md py-md',
          'flex flex-col gap-md',
        ].join(' ')}
      >
        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
            Order Number
          </span>
          <span
            className="font-label-md text-label-md font-bold text-on-surface"
            data-testid="payment-success-order-number"
          >
            #{orderNumber}
          </span>
        </div>

        <hr className="border-0 border-t border-outline-variant" />

        <div className="flex flex-col gap-sm">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
            Items
          </span>
          <ul
            data-testid="payment-success-items"
            className="flex flex-col gap-xs list-none m-0 p-0"
          >
            {items.map((item, index) => (
              <li
                key={`${item.name}-${index}`}
                data-testid={`payment-success-item-${index}`}
                className="font-body-md text-body-md text-on-surface"
              >
                {item.quantity}x {item.name}
              </li>
            ))}
          </ul>
        </div>

        <hr className="border-0 border-t border-outline-variant" />

        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
            Total Paid
          </span>
          <span
            className="font-label-md text-label-md font-bold text-primary"
            data-testid="payment-success-total"
          >
            {formatIDR(totalIdr)}
          </span>
        </div>
      </section>

      {/* Action buttons */}
      <section
        data-testid="payment-success-actions"
        className="w-full max-w-md flex flex-col gap-sm mt-auto"
      >
        <button
          type="button"
          onClick={onViewOrderStatus}
          data-testid="payment-success-view-order"
          aria-label="View Order Status"
          className={[
            'w-full',
            'inline-flex items-center justify-center',
            'bg-primary text-on-primary',
            'rounded-xl',
            'shadow-[0_4px_12px_rgba(225,29,72,0.2)]',
            'px-md py-sm h-12',
            'font-label-md text-label-md',
            'border-none cursor-pointer',
            'transition-transform active:scale-95',
          ].join(' ')}
        >
          View Order Status
        </button>
        <button
          type="button"
          onClick={onBackToMenu}
          data-testid="payment-success-back-to-menu"
          aria-label="Back to Menu"
          className={[
            'w-full',
            'inline-flex items-center justify-center',
            'bg-surface-container-lowest text-on-surface',
            'border border-outline-variant',
            'rounded-xl',
            'px-md py-sm h-12',
            'font-label-md text-label-md',
            'cursor-pointer',
            'transition-transform active:scale-95',
          ].join(' ')}
        >
          Back to Menu
        </button>

        {/* Optional guest-only "Save Order to Account" CTA (Req 12.13/12.14) */}
        {wasGuestCheckout && (
          <div
            data-testid="payment-success-save-cta"
            className="mt-sm flex flex-col items-center gap-1 px-2 text-center"
          >
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Want to keep this in your order history?
            </p>
            <button
              type="button"
              onClick={onSaveOrderToAccount}
              data-testid="payment-success-save-button"
              aria-label="Save this order to a new or existing account"
              className={[
                'w-full',
                'inline-flex items-center justify-center gap-1',
                'bg-transparent text-primary',
                'border border-primary',
                'rounded-xl',
                'px-md py-sm h-11',
                'font-label-md text-label-md',
                'cursor-pointer',
                'transition-transform active:scale-95',
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                bookmark_add
              </span>
              Save Order to Account
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
