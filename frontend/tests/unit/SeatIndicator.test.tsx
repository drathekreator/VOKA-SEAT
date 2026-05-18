import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SeatIndicator } from '../../src/components/SeatIndicator';

describe('SeatIndicator', () => {
  it('renders seat number inside the indicator', () => {
    render(<SeatIndicator seatId={5} status={0} />);
    const indicator = screen.getByTestId('seat-indicator-5');
    expect(indicator).toHaveTextContent('5');
  });

  it('applies occupied styles when status=1', () => {
    render(<SeatIndicator seatId={3} status={1} />);
    const indicator = screen.getByTestId('seat-indicator-3');
    expect(indicator).toHaveAttribute('data-status', '1');
    expect(indicator.className).toContain('bg-[#D81B60]');
    expect(indicator.className).toContain('text-white');
  });

  it('applies available styles when status=0', () => {
    render(<SeatIndicator seatId={7} status={0} />);
    const indicator = screen.getByTestId('seat-indicator-7');
    expect(indicator).toHaveAttribute('data-status', '0');
    expect(indicator.className).toContain('bg-[#F3F4F6]');
    expect(indicator.className).toContain('border-[#E5E7EB]');
  });

  it('renders with small size', () => {
    render(<SeatIndicator seatId={1} status={0} size="sm" />);
    const indicator = screen.getByTestId('seat-indicator-1');
    expect(indicator.className).toContain('w-8');
    expect(indicator.className).toContain('h-8');
  });

  it('renders with medium size (default)', () => {
    render(<SeatIndicator seatId={2} status={1} />);
    const indicator = screen.getByTestId('seat-indicator-2');
    expect(indicator.className).toContain('w-10');
    expect(indicator.className).toContain('h-10');
  });

  it('renders with large size', () => {
    render(<SeatIndicator seatId={24} status={0} size="lg" />);
    const indicator = screen.getByTestId('seat-indicator-24');
    expect(indicator.className).toContain('w-12');
    expect(indicator.className).toContain('h-12');
  });

  it('sets correct data-testid attribute', () => {
    render(<SeatIndicator seatId={11} status={1} />);
    expect(screen.getByTestId('seat-indicator-11')).toBeInTheDocument();
  });

  it('sets correct data-status attribute for occupied', () => {
    render(<SeatIndicator seatId={15} status={1} />);
    expect(screen.getByTestId('seat-indicator-15')).toHaveAttribute('data-status', '1');
  });

  it('sets correct data-status attribute for available', () => {
    render(<SeatIndicator seatId={20} status={0} />);
    expect(screen.getByTestId('seat-indicator-20')).toHaveAttribute('data-status', '0');
  });
});
