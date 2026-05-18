import { formatIDR } from '../views/MenuView';

/**
 * Cart_Summary_Bar
 *
 * Sticky bar floating above the bottom navigation on the Customer App's
 * Menu tab when the cart has at least one item.
 *
 * Layout:
 *   - Left column: item count text (e.g. "2 items") + IDR total directly
 *     below it in primary (#b80035) color and bold weight
 *   - Right column: primary "View Cart" button (rounded-xl, glow shadow)
 *
 * Visibility logic is intentionally a pure conditional: the component
 * returns `null` when `itemCount < 1` so the parent can mount it
 * unconditionally and pass `isMenuTab && cartCount >= 1` as the gate.
 * The hide-on-non-Menu-tab behaviour (Requirement 17.9) is therefore the
 * responsibility of the CustomerApp shell (task 16.4); from this
 * component's perspective, it only enforces the cart-count rule
 * (Requirement 17.10).
 *
 * The "View Cart" button calls the supplied `onViewCart` prop. The actual
 * tab-switching logic (Requirement 17.11, "switch to Cart tab within
 * 300 ms") lives in the CustomerApp shell — synchronous setState on the
 * active tab comfortably stays under that budget.
 *
 * Positioning:
 *   `fixed bottom-[88px]` clears the 64px-tall bottom nav with a small
 *   gap, matching the home_menu mockup. `z-40` keeps it above page
 *   content but below toasts/dialogs.
 *
 * Spec references:
 *   - Requirement 17.8 (item count + IDR total + View Cart button)
 *   - Requirement 17.9 (hidden on non-Menu tabs — enforced by parent)
 *   - Requirement 17.10 (hidden when cart is empty — enforced here)
 *   - Requirement 17.11 (tap "View Cart" → switch to Cart tab within 300 ms)
 *   - Requirement 18.17 (primary action button styling)
 *   - Glossary: Cart_Summary_Bar
 *   - design.md "Cart Summary Bar"
 */

export interface CartSummaryBarProps {
  /** Total number of items currently in the cart. Bar is hidden when < 1. */
  itemCount: number;
  /** Total cart price in IDR (Indonesian Rupiah, integer minor units). */
  totalIdr: number;
  /** Invoked when the customer taps the "View Cart" button. */
  onViewCart: () => void;
}

export default function CartSummaryBar({
  itemCount,
  totalIdr,
  onViewCart,
}: CartSummaryBarProps) {
  // Requirement 17.10: hide entirely when the cart is empty.
  if (itemCount < 1) {
    return null;
  }

  const itemLabel = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;

  return (
    <div
      role="region"
      aria-label="Cart summary"
      data-testid="cart-summary-bar"
      className={[
        // Sticky above the 64px bottom nav with a small breathing gap.
        'fixed bottom-[88px] left-0 right-0 z-40',
        // Card container — surface-container-lowest (#ffffff) + xl radius +
        // soft shadow consistent with the MD3 surfaces used elsewhere in
        // the customer app.
        'mx-md',
        'bg-surface-container-lowest',
        'rounded-xl',
        'shadow-md3-card',
        'px-md py-sm',
        'flex items-center justify-between gap-md',
      ].join(' ')}
    >
      {/* Left column: item count + IDR total */}
      <div className="flex flex-col leading-tight">
        <span
          className="font-body-sm text-body-sm text-on-surface-variant"
          data-testid="cart-summary-count"
        >
          {itemLabel}
        </span>
        <span
          className="font-label-md text-label-md font-bold text-primary"
          data-testid="cart-summary-total"
        >
          {formatIDR(totalIdr)}
        </span>
      </div>

      {/* Right column: primary "View Cart" CTA per Requirement 18.17. */}
      <button
        type="button"
        onClick={onViewCart}
        data-testid="cart-summary-view-cart"
        aria-label="View cart"
        className={[
          'inline-flex items-center justify-center gap-xs',
          'bg-primary text-on-primary',
          'rounded-xl',
          'shadow-primary-glow',
          'px-md py-sm',
          'font-label-md text-label-md',
          'border-none cursor-pointer',
          'transition-transform active:scale-95',
        ].join(' ')}
      >
        <span>View Cart</span>
        <span aria-hidden="true" className="material-symbols-outlined text-base leading-none">
          arrow_forward
        </span>
      </button>
    </div>
  );
}
