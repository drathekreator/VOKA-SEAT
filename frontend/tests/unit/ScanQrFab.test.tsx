import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import ScanQrFab from '../../src/customer/components/ScanQrFab';

/**
 * Unit tests for ScanQrFab (task 18.1).
 *
 * Spec references:
 *   - Requirement 11.12 (FAB anchored bottom-right above bottom nav, primary,
 *     glow shadow, Material Symbol qr_code_scanner)
 *   - Requirement 11.13 (tap shows "Coming soon" toast; no backend call)
 *   - Requirement 18.18 (active:scale tactile feedback)
 */
describe('ScanQrFab', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the FAB button with correct positioning and styling', () => {
    render(<ScanQrFab />);
    const fab = screen.getByTestId('scan-qr-fab');
    expect(fab).toBeInTheDocument();
    expect(fab.tagName).toBe('BUTTON');
    expect(fab.getAttribute('aria-label')).toBe('Scan QR code');

    // 56×56 round button positioned bottom-right above the bottom nav.
    expect(fab.className).toContain('w-14');
    expect(fab.className).toContain('h-14');
    expect(fab.className).toContain('rounded-full');
    expect(fab.className).toContain('fixed');
    expect(fab.className).toContain('bottom-24');
    expect(fab.className).toContain('right-4');

    // Primary background + glow shadow + tactile feedback.
    expect(fab.className).toContain('bg-primary');
    expect(fab.className).toContain('text-on-primary');
    expect(fab.className).toContain('shadow-[0_8px_24px_rgba(225,29,72,0.3)]');
    expect(fab.className).toContain('active:scale-90');
  });

  it('renders the Material Symbols Outlined qr_code_scanner icon', () => {
    render(<ScanQrFab />);
    const fab = screen.getByTestId('scan-qr-fab');
    const icon = fab.querySelector('span.material-symbols-outlined');
    expect(icon).not.toBeNull();
    expect(icon!.textContent).toBe('qr_code_scanner');
  });

  it('does not show the toast on initial render', () => {
    render(<ScanQrFab />);
    expect(screen.queryByTestId('scan-qr-toast')).toBeNull();
  });

  it('shows a "Coming soon" toast when the FAB is tapped (Requirement 11.13)', () => {
    render(<ScanQrFab />);
    fireEvent.click(screen.getByTestId('scan-qr-fab'));

    const toast = screen.getByTestId('scan-qr-toast');
    expect(toast).toBeInTheDocument();
    expect(toast.textContent).toBe('Coming soon');
    expect(toast.getAttribute('role')).toBe('status');
  });

  it('auto-dismisses the toast after the configured duration', () => {
    render(<ScanQrFab toastDurationMs={2000} />);

    fireEvent.click(screen.getByTestId('scan-qr-fab'));
    expect(screen.getByTestId('scan-qr-toast')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByTestId('scan-qr-toast')).toBeNull();
  });

  it('resets the dismiss timer when tapped repeatedly', () => {
    render(<ScanQrFab toastDurationMs={2000} />);
    const fab = screen.getByTestId('scan-qr-fab');

    fireEvent.click(fab);
    expect(screen.getByTestId('scan-qr-toast')).toBeInTheDocument();

    // Advance 1.5s, still visible.
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByTestId('scan-qr-toast')).toBeInTheDocument();

    // Tap again — timer should reset, so the toast remains visible 1.5s
    // after the first tap (only 0s after the second tap).
    fireEvent.click(fab);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByTestId('scan-qr-toast')).toBeInTheDocument();

    // After another 0.5s (total 2s since the second tap) it should disappear.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByTestId('scan-qr-toast')).toBeNull();
  });
});
