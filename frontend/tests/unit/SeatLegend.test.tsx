import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import SeatLegend from '../../src/customer/components/SeatLegend';

/**
 * Unit tests for SeatLegend (task 18.1).
 *
 * Spec references:
 *   - Requirement 11.11 (legend below the toggle: mint Available + magenta Occupied)
 *   - Customer_MD3_Tokens hex values: #6cf8bb (secondary-container), #D81B60 (primary)
 */
describe('SeatLegend', () => {
  it('renders the legend container with both entries', () => {
    render(<SeatLegend />);
    expect(screen.getByTestId('seat-legend')).toBeInTheDocument();
    expect(screen.getByTestId('seat-legend-available')).toBeInTheDocument();
    expect(screen.getByTestId('seat-legend-occupied')).toBeInTheDocument();
  });

  it('renders the Available label and a mint-green (#6cf8bb) swatch', () => {
    render(<SeatLegend />);
    expect(screen.getByText('Available')).toBeInTheDocument();

    const swatch = screen.getByTestId('seat-legend-swatch-available');
    expect(swatch.className).toContain('bg-[#6cf8bb]');
  });

  it('renders the Occupied label and a magenta (#D81B60) swatch', () => {
    render(<SeatLegend />);
    expect(screen.getByText('Occupied')).toBeInTheDocument();

    const swatch = screen.getByTestId('seat-legend-swatch-occupied');
    expect(swatch.className).toContain('bg-[#D81B60]');
  });

  it('uses on-surface-variant text-xs for both labels', () => {
    render(<SeatLegend />);
    const available = screen.getByText('Available');
    const occupied = screen.getByText('Occupied');
    expect(available.className).toContain('text-on-surface-variant');
    expect(available.className).toContain('text-xs');
    expect(occupied.className).toContain('text-on-surface-variant');
    expect(occupied.className).toContain('text-xs');
  });

  it('exposes a list role with both entries as list items', () => {
    render(<SeatLegend />);
    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(2);
  });
});
