import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import TopAppBar from '../../src/customer/components/TopAppBar';

/**
 * Unit tests for the Customer_Top_App_Bar component.
 *
 * Spec references:
 *   - Requirement 13.13: persistent top app bar when authenticated, with the
 *     VOKAFE logo on the left and a search icon button on the right.
 *   - Requirement 13.14: hide the bar entirely when unauthenticated.
 *   - Requirement 18.11: VOKAFE logo on the left at 32px height.
 *   - Glossary: Customer_Top_App_Bar (64px tall, surface background, sticky).
 */
describe('TopAppBar (Customer_Top_App_Bar)', () => {
  it('renders the bar when authenticated', () => {
    render(<TopAppBar isAuthenticated={true} />);
    expect(screen.getByTestId('customer-top-app-bar')).toBeDefined();
  });

  it('returns null when unauthenticated (Requirement 13.14)', () => {
    const { container } = render(<TopAppBar isAuthenticated={false} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('customer-top-app-bar')).toBeNull();
  });

  it('defaults isAuthenticated to true when the prop is omitted', () => {
    render(<TopAppBar />);
    expect(screen.getByTestId('customer-top-app-bar')).toBeDefined();
  });

  it('renders the VOKAFE logo on the left referencing /logo-vokafe.svg (Requirement 18.11)', () => {
    render(<TopAppBar isAuthenticated={true} />);
    const logo = screen.getByTestId('top-app-bar-logo') as HTMLImageElement;
    expect(logo).toBeDefined();
    expect(logo.tagName).toBe('IMG');
    expect(logo.getAttribute('src')).toBe('/logo-vokafe.svg');
    expect(logo.getAttribute('alt')).toBe('VOKAFE');
    // 32px height = Tailwind h-8
    expect(logo.className).toContain('h-8');
  });

  it('renders a Material Symbols Outlined "search" icon button on the right (Requirement 13.13)', () => {
    render(<TopAppBar isAuthenticated={true} />);
    const button = screen.getByTestId('top-app-bar-search');
    expect(button).toBeDefined();
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('aria-label')).toBe('Search');

    const icon = button.querySelector('span.material-symbols-outlined');
    expect(icon).not.toBeNull();
    expect(icon!.textContent).toBe('search');
  });

  it('invokes onSearchClick when the search button is tapped', () => {
    const onSearchClick = vi.fn();
    render(<TopAppBar isAuthenticated={true} onSearchClick={onSearchClick} />);

    fireEvent.click(screen.getByTestId('top-app-bar-search'));
    expect(onSearchClick).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the search button is tapped without an onSearchClick handler', () => {
    render(<TopAppBar isAuthenticated={true} />);
    expect(() =>
      fireEvent.click(screen.getByTestId('top-app-bar-search'))
    ).not.toThrow();
  });

  it('is sticky to the top with 64px (h-16) height and surface background', () => {
    render(<TopAppBar isAuthenticated={true} />);
    const bar = screen.getByTestId('customer-top-app-bar');
    expect(bar.className).toContain('sticky');
    expect(bar.className).toContain('top-0');
    expect(bar.className).toContain('h-16');
    expect(bar.className).toContain('bg-surface');
  });

  it('exposes a banner role with an accessible label', () => {
    render(<TopAppBar isAuthenticated={true} />);
    const banner = screen.getByRole('banner');
    expect(banner).toBeDefined();
    expect(banner.getAttribute('aria-label')).toBe('VOKAFE top app bar');
  });
});
