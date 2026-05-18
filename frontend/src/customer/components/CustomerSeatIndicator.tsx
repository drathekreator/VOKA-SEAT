import React from 'react';

/**
 * CustomerSeatIndicator
 *
 * Customer App seat status indicator. Distinct from the Admin Dashboard's
 * `frontend/src/components/SeatIndicator.tsx`:
 *   - Occupied (status=1): solid Magenta (#D81B60) background, white text.
 *     Same hex as admin per Requirement 11.5 / 18.4.
 *   - Available (status=0): mint-green secondary-container (#6cf8bb) with
 *     on-secondary-container (#00714d) text and NO border, conforming to the
 *     Customer_MD3_Tokens.
 *
 * Touchable elements scale to 95% during press (Requirement 18.18). When an
 * `onClick` handler is supplied the indicator renders as a <button> so the
 * `active:` pseudo-class fires for both pointer and keyboard activation;
 * otherwise it renders as a non-interactive <div> consistent with the static
 * tile usage on the Tables view.
 *
 * Implementation note: literal-hex Tailwind arbitrary values
 * (`bg-[#6cf8bb]`, `text-[#00714d]`, `bg-[#D81B60]`) are used so the color
 * mapping is verifiable by inspecting `className` directly — this mirrors the
 * pattern in the admin SeatIndicator and means the component renders
 * correctly even if the MD3 Tailwind theme extension from task 15.1 has not
 * yet been built into the running CSS bundle.
 *
 * Spec references:
 *   - Requirement 11.5 (Customer App live seat availability colors)
 *   - Requirement 18.4 (Customer_App seat indicator design)
 *   - Requirement 18.18 (tactile press feedback at 95%)
 */

/**
 * Pure status→colors mapping. Exported so it can be reused without rendering
 * (e.g. by the optional property test for Property 18 in task 15.3) and so
 * the contract is testable as a pure object.
 *
 * `border` is intentionally `null` to encode Requirement 18.4's "no border"
 * rule for the available state.
 */
export interface CustomerSeatColors {
  bg: string;
  text: string;
  border: string | null;
}

export const CUSTOMER_SEAT_COLORS: Record<0 | 1, CustomerSeatColors> = {
  // Available — secondary-container / on-secondary-container, no border.
  0: { bg: '#6cf8bb', text: '#00714d', border: null },
  // Occupied — primary (#D81B60) / white. Same as admin per Requirement 18.4.
  1: { bg: '#D81B60', text: '#ffffff', border: null },
} as const;

/**
 * Returns the colors for a given seat status. Pure function — no side effects,
 * no React, safe to import from property tests.
 */
export function getCustomerSeatColors(status: 0 | 1): CustomerSeatColors {
  return CUSTOMER_SEAT_COLORS[status];
}

export interface CustomerSeatIndicatorProps {
  /** Seat number (1–24). Rendered inside the indicator. */
  id: number;
  /** Live occupancy status: 0 = available, 1 = occupied. */
  status: 0 | 1;
  /** Optional press handler. When provided the indicator renders as a button. */
  onClick?: () => void;
}

const BASE_CLASSES =
  'flex items-center justify-center w-10 h-10 rounded text-label font-label ' +
  'transition-transform active:scale-95';

const OCCUPIED_CLASSES = 'bg-[#D81B60] text-white';
// secondary-container = #6cf8bb, on-secondary-container = #00714d.
// No border per Requirement 18.4.
const AVAILABLE_CLASSES = 'bg-[#6cf8bb] text-[#00714d]';

export const CustomerSeatIndicator: React.FC<CustomerSeatIndicatorProps> = ({
  id,
  status,
  onClick,
}) => {
  const isOccupied = status === 1;
  const statusClasses = isOccupied ? OCCUPIED_CLASSES : AVAILABLE_CLASSES;
  const className = `${BASE_CLASSES} ${statusClasses}`;
  const ariaLabel = `Seat ${id} ${isOccupied ? 'occupied' : 'available'}`;

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        data-testid={`customer-seat-indicator-${id}`}
        data-status={status}
        aria-label={ariaLabel}
      >
        {id}
      </button>
    );
  }

  return (
    <div
      className={className}
      data-testid={`customer-seat-indicator-${id}`}
      data-status={status}
      aria-label={ariaLabel}
      role="img"
    >
      {id}
    </div>
  );
};

export default CustomerSeatIndicator;
