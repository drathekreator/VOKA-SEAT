/**
 * Unit tests for the OrderStatusPill component and its pure helper.
 *
 * Validates the task 19.2 color mapping table:
 *   pending   → #FEF3C7 / #92400E / "Pending"
 *   preparing → #b80035 / #ffffff / "Preparing"
 *   ready     → #006855 / #ffffff / "Ready"
 *   completed → #6cf8bb / #00714d / "Completed"
 *   cancelled → #ffdad6 / #93000a / "Cancelled"
 *
 * Plus the defensive fallback to a neutral gray pill for any value outside
 * the OrderStatus union.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderStatusPill, {
  getStatusPillStyle,
  type OrderStatus,
} from '../../src/customer/components/OrderStatusPill';

describe('getStatusPillStyle', () => {
  it('maps pending to amber colors and "Pending" label', () => {
    const style = getStatusPillStyle('pending');
    expect(style.bg).toBe('bg-[#FEF3C7]');
    expect(style.text).toBe('text-[#92400E]');
    expect(style.label).toBe('Pending');
  });

  it('maps preparing to primary background with white text', () => {
    const style = getStatusPillStyle('preparing');
    expect(style.bg).toBe('bg-[#b80035]');
    expect(style.text).toBe('text-[#ffffff]');
    expect(style.label).toBe('Preparing');
  });

  it('maps ready to tertiary green with white text', () => {
    const style = getStatusPillStyle('ready');
    expect(style.bg).toBe('bg-[#006855]');
    expect(style.text).toBe('text-[#ffffff]');
    expect(style.label).toBe('Ready');
  });

  it('maps completed to mint container with deep green text', () => {
    const style = getStatusPillStyle('completed');
    expect(style.bg).toBe('bg-[#6cf8bb]');
    expect(style.text).toBe('text-[#00714d]');
    expect(style.label).toBe('Completed');
  });

  it('maps cancelled to error-container with on-error-container text', () => {
    const style = getStatusPillStyle('cancelled');
    expect(style.bg).toBe('bg-[#ffdad6]');
    expect(style.text).toBe('text-[#93000a]');
    expect(style.label).toBe('Cancelled');
  });

  it('falls back to a neutral gray pill for unknown status values', () => {
    // Cast through unknown to simulate a backend-supplied status outside the
    // declared OrderStatus union (e.g. a future "refunded" status). The
    // helper must not throw and must return the neutral fallback so the UI
    // can still render.
    const style = getStatusPillStyle('refunded' as unknown as OrderStatus);
    expect(style.bg).toBe('bg-[#E5E7EB]');
    expect(style.text).toBe('text-[#374151]');
    expect(style.label).toBe('Unknown');
  });
});

describe('<OrderStatusPill />', () => {
  it('renders the human-readable label for each known status', () => {
    const statuses: { status: OrderStatus; label: string }[] = [
      { status: 'pending', label: 'Pending' },
      { status: 'preparing', label: 'Preparing' },
      { status: 'ready', label: 'Ready' },
      { status: 'completed', label: 'Completed' },
      { status: 'cancelled', label: 'Cancelled' },
    ];

    for (const { status, label } of statuses) {
      const { unmount } = render(<OrderStatusPill status={status} />);
      const pill = screen.getByTestId(`order-status-pill-${status}`);
      expect(pill.textContent).toBe(label);
      expect(pill.getAttribute('aria-label')).toBe(`Order status: ${label}`);
      unmount();
    }
  });

  it('applies the pill base classes (rounded-full + px-3 py-1)', () => {
    render(<OrderStatusPill status="pending" />);
    const pill = screen.getByTestId('order-status-pill-pending');
    expect(pill.className).toContain('rounded-full');
    expect(pill.className).toContain('px-3');
    expect(pill.className).toContain('py-1');
    expect(pill.className).toContain('inline-flex');
  });

  it('applies the mapped background and text classes for "completed"', () => {
    render(<OrderStatusPill status="completed" />);
    const pill = screen.getByTestId('order-status-pill-completed');
    // Tailwind arbitrary-value classes; assert presence rather than exact
    // class string ordering.
    expect(pill.className).toContain('bg-[#6cf8bb]');
    expect(pill.className).toContain('text-[#00714d]');
  });

  it('appends the optional className prop without dropping base classes', () => {
    render(<OrderStatusPill status="ready" className="ml-2 shrink-0" />);
    const pill = screen.getByTestId('order-status-pill-ready');
    expect(pill.className).toContain('rounded-full');
    expect(pill.className).toContain('ml-2');
    expect(pill.className).toContain('shrink-0');
  });

  it('renders gracefully for an out-of-enum status value', () => {
    // Confirms the component itself does not throw when the API hands it a
    // status outside the OrderStatus union (defensive guard described in
    // the task prompt).
    const renderUnknown = () =>
      render(
        <OrderStatusPill status={'refunded' as unknown as OrderStatus} />,
      );
    expect(renderUnknown).not.toThrow();

    const pill = screen.getByTestId('order-status-pill-refunded');
    expect(pill.textContent).toBe('Unknown');
    expect(pill.className).toContain('bg-[#E5E7EB]');
    expect(pill.className).toContain('text-[#374151]');
  });
});
