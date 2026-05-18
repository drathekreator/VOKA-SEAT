/**
 * OrderStatusPill
 *
 * Pill-shaped status indicator used on order history list items in the
 * Customer App (Requirement 19.2 / Glossary: Order_Status_Pill).
 *
 * The MD3 theme is not yet wired into Tailwind utility classes for every
 * surface (task 15.1 covers theme wiring in a separate stream), so each
 * status renders its background and text using Tailwind arbitrary value
 * classes (e.g. `bg-[#6cf8bb]`). This keeps the component self-contained and
 * accurate even before global theme tokens are available.
 *
 * Color mapping (authoritative for task 19.2):
 *   - pending    → bg #FEF3C7 (amber-100)            + text #92400E (amber-800)
 *   - preparing  → bg #b80035 (primary)              + text #ffffff (on-primary)
 *   - ready      → bg #006855 (tertiary)             + text #ffffff (on-tertiary)
 *   - completed  → bg #6cf8bb (secondary-container)  + text #00714d (on-secondary-container)
 *   - cancelled  → bg #ffdad6 (error-container)      + text #93000a (on-error-container)
 *
 * Unknown / out-of-enum statuses (e.g. a future backend status) fall back to
 * a neutral gray pill so the UI never crashes if the API returns a value
 * outside the OrderStatus union.
 *
 * Spec references:
 *   - Requirement 19.2 (Order_Status_Pill color mapping)
 *   - design.md "Order Status Pill color mapping"
 *   - design.md "Customer App Component Architecture"
 */

import type { CSSProperties } from 'react';

export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

/**
 * Pure styling descriptor returned by {@link getStatusPillStyle}. Exported as
 * a Tailwind class fragment plus a human-readable label so consumers (and
 * unit tests) can verify color mapping without rendering the component.
 *
 * `bg` and `text` are Tailwind arbitrary-value class strings (e.g.
 * `bg-[#6cf8bb]`) — combining them produces the full color treatment for
 * the pill background and label color respectively.
 */
export interface StatusPillStyle {
  /** Tailwind background color class (arbitrary value, e.g. `bg-[#b80035]`). */
  bg: string;
  /** Tailwind text color class (arbitrary value, e.g. `text-[#ffffff]`). */
  text: string;
  /** Human-readable label rendered inside the pill. */
  label: string;
}

/** Neutral fallback used when an unknown status string is passed in. */
const UNKNOWN_STATUS_STYLE: StatusPillStyle = {
  bg: 'bg-[#E5E7EB]',
  text: 'text-[#374151]',
  label: 'Unknown',
};

/**
 * Internal lookup table. Kept as a plain object literal so the mapping is
 * trivially auditable side-by-side with the design.md table.
 */
const STATUS_PILL_STYLES: Record<OrderStatus, StatusPillStyle> = {
  pending: {
    bg: 'bg-[#FEF3C7]',
    text: 'text-[#92400E]',
    label: 'Pending',
  },
  preparing: {
    bg: 'bg-[#b80035]',
    text: 'text-[#ffffff]',
    label: 'Preparing',
  },
  ready: {
    bg: 'bg-[#006855]',
    text: 'text-[#ffffff]',
    label: 'Ready',
  },
  completed: {
    bg: 'bg-[#6cf8bb]',
    text: 'text-[#00714d]',
    label: 'Completed',
  },
  cancelled: {
    bg: 'bg-[#ffdad6]',
    text: 'text-[#93000a]',
    label: 'Cancelled',
  },
};

/**
 * Pure helper that maps an order status to its pill styling.
 *
 * Exported separately from the component so it can be unit-tested in
 * isolation (no React rendering required) and reused by any other
 * component that needs to display the same status label/color, e.g. the
 * status timeline on OrderDetailView (task 19.4).
 *
 * Defensive: if `status` is anything other than a member of the
 * {@link OrderStatus} union (for instance, a future backend value or an
 * unexpected payload), a neutral gray "Unknown" pill is returned rather
 * than throwing.
 */
export function getStatusPillStyle(status: OrderStatus): StatusPillStyle {
  // Hash lookup with a defensive fallback so the component never crashes
  // on values outside the declared union.
  return STATUS_PILL_STYLES[status] ?? UNKNOWN_STATUS_STYLE;
}

export interface OrderStatusPillProps {
  /** Order lifecycle status. Drives the color mapping and pill label. */
  status: OrderStatus;
  /**
   * Optional extra Tailwind classes appended to the pill (e.g. for layout
   * concerns like `ml-2` from a parent component). Kept optional so most
   * call sites can omit it.
   */
  className?: string;
  /**
   * Optional inline style. Currently unused internally but accepted so
   * downstream consumers can override e.g. width without forking the
   * component.
   */
  style?: CSSProperties;
}

/**
 * Pill-shaped status indicator. See file header for the full color mapping
 * and design references.
 */
export default function OrderStatusPill({
  status,
  className = '',
  style,
}: OrderStatusPillProps) {
  const { bg, text, label } = getStatusPillStyle(status);

  // Base classes per task 19.2: pill shape + px-3 py-1 + small label
  // styling. `inline-flex items-center` keeps the pill aligned with adjacent
  // text on the order history card.
  const baseClasses =
    'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold';

  const composed = `${baseClasses} ${bg} ${text} ${className}`.trim();

  return (
    <span
      data-testid={`order-status-pill-${status}`}
      data-status={status}
      role="status"
      aria-label={`Order status: ${label}`}
      className={composed}
      style={style}
    >
      {label}
    </span>
  );
}
