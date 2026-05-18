import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  CustomerSeatIndicator,
  CUSTOMER_SEAT_COLORS,
  getCustomerSeatColors,
} from '../../src/customer/components/CustomerSeatIndicator';

/**
 * Unit tests for the Customer App seat indicator.
 *
 * Validates Requirements 11.5, 18.4, 18.18 — the customer-specific
 * mint-green available state, the shared Magenta occupied state, and the
 * `active:scale-95` tactile feedback.
 */

describe('getCustomerSeatColors / CUSTOMER_SEAT_COLORS', () => {
  it('maps status=0 to mint-green secondary-container with on-secondary-container text and no border', () => {
    expect(getCustomerSeatColors(0)).toEqual({
      bg: '#6cf8bb',
      text: '#00714d',
      border: null,
    });
  });

  it('maps status=1 to Magenta with white text and no border', () => {
    expect(getCustomerSeatColors(1)).toEqual({
      bg: '#D81B60',
      text: '#ffffff',
      border: null,
    });
  });

  it('exports a frozen-shape mapping with both keys', () => {
    expect(Object.keys(CUSTOMER_SEAT_COLORS).sort()).toEqual(['0', '1']);
  });
});

describe('CustomerSeatIndicator', () => {
  it('renders the seat number inside the indicator', () => {
    render(<CustomerSeatIndicator id={5} status={0} />);
    const indicator = screen.getByTestId('customer-seat-indicator-5');
    expect(indicator).toHaveTextContent('5');
  });

  it('applies mint-green available styling when status=0', () => {
    render(<CustomerSeatIndicator id={7} status={0} />);
    const indicator = screen.getByTestId('customer-seat-indicator-7');
    expect(indicator).toHaveAttribute('data-status', '0');
    expect(indicator.className).toContain('bg-[#6cf8bb]');
    expect(indicator.className).toContain('text-[#00714d]');
    // Requirement 18.4: no border on the available state.
    expect(indicator.className).not.toMatch(/\bborder(-|\s|$)/);
  });

  it('applies Magenta occupied styling when status=1', () => {
    render(<CustomerSeatIndicator id={3} status={1} />);
    const indicator = screen.getByTestId('customer-seat-indicator-3');
    expect(indicator).toHaveAttribute('data-status', '1');
    expect(indicator.className).toContain('bg-[#D81B60]');
    expect(indicator.className).toContain('text-white');
  });

  it('applies the active:scale-95 tactile-feedback class (Requirement 18.18)', () => {
    render(<CustomerSeatIndicator id={1} status={0} />);
    const indicator = screen.getByTestId('customer-seat-indicator-1');
    expect(indicator.className).toContain('active:scale-95');
  });

  it('renders a non-interactive <div> by default', () => {
    render(<CustomerSeatIndicator id={11} status={0} />);
    const indicator = screen.getByTestId('customer-seat-indicator-11');
    expect(indicator.tagName).toBe('DIV');
    expect(indicator).toHaveAttribute('role', 'img');
  });

  it('renders a <button> and fires onClick when an onClick handler is supplied', () => {
    const handleClick = vi.fn();
    render(
      <CustomerSeatIndicator id={24} status={1} onClick={handleClick} />,
    );
    const indicator = screen.getByTestId('customer-seat-indicator-24');
    expect(indicator.tagName).toBe('BUTTON');
    fireEvent.click(indicator);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('exposes an accessible label describing the seat status', () => {
    render(<CustomerSeatIndicator id={20} status={1} />);
    expect(
      screen.getByLabelText('Seat 20 occupied'),
    ).toBeInTheDocument();
    render(<CustomerSeatIndicator id={21} status={0} />);
    expect(
      screen.getByLabelText('Seat 21 available'),
    ).toBeInTheDocument();
  });
});
