import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import BottomNav from '../../src/customer/components/BottomNav';

describe('BottomNav', () => {
  it('renders four tabs: Menu, Tables, Cart, Profile', () => {
    render(<BottomNav activeTab="menu" onTabChange={() => {}} cartCount={0} />);

    expect(screen.getByTestId('tab-menu')).toBeDefined();
    expect(screen.getByTestId('tab-tables')).toBeDefined();
    expect(screen.getByTestId('tab-cart')).toBeDefined();
    expect(screen.getByTestId('tab-profile')).toBeDefined();
  });

  it('marks the active tab with aria-current="page"', () => {
    render(<BottomNav activeTab="menu" onTabChange={() => {}} cartCount={0} />);

    const menuButton = screen.getByTestId('tab-menu');
    const tablesButton = screen.getByTestId('tab-tables');

    expect(menuButton.getAttribute('aria-current')).toBe('page');
    expect(tablesButton.getAttribute('aria-current')).toBeNull();
  });

  it('renders the active tab pill with primary-container colors (#e11d48 / #fffaf9)', () => {
    render(<BottomNav activeTab="menu" onTabChange={() => {}} cartCount={0} />);

    // The pill is the inner span inside the active tab button.
    const menuButton = screen.getByTestId('tab-menu');
    const pill = menuButton.querySelector('span');
    expect(pill).not.toBeNull();
    expect(pill?.className).toContain('bg-[#e11d48]');
    expect(pill?.className).toContain('text-[#fffaf9]');
    expect(pill?.className).toContain('rounded-full');
  });

  it('renders inactive tabs in on-surface-variant (#5c3f40)', () => {
    render(<BottomNav activeTab="menu" onTabChange={() => {}} cartCount={0} />);

    const tablesButton = screen.getByTestId('tab-tables');
    const pill = tablesButton.querySelector('span');
    expect(pill?.className).toContain('text-[#5c3f40]');
    expect(pill?.className).toContain('bg-transparent');
  });

  it('uses Material Symbols Outlined icons (home, grid_view, shopping_cart, person)', () => {
    render(<BottomNav activeTab="menu" onTabChange={() => {}} cartCount={0} />);

    const expected: Record<string, string> = {
      menu: 'home',
      tables: 'grid_view',
      cart: 'shopping_cart',
      profile: 'person',
    };

    for (const [tabId, iconName] of Object.entries(expected)) {
      const button = screen.getByTestId(`tab-${tabId}`);
      const iconSpan = button.querySelector('.material-symbols-outlined');
      expect(iconSpan).not.toBeNull();
      expect(iconSpan?.textContent?.trim()).toBe(iconName);
    }
  });

  it('applies active:scale-90 tactile feedback to every tab button', () => {
    render(<BottomNav activeTab="menu" onTabChange={() => {}} cartCount={0} />);

    for (const tabId of ['menu', 'tables', 'cart', 'profile']) {
      const button = screen.getByTestId(`tab-${tabId}`);
      expect(button.className).toContain('active:scale-90');
    }
  });

  it('calls onTabChange when a tab is clicked', () => {
    const onTabChange = vi.fn();
    render(<BottomNav activeTab="menu" onTabChange={onTabChange} cartCount={0} />);

    fireEvent.click(screen.getByTestId('tab-tables'));
    expect(onTabChange).toHaveBeenCalledWith('tables');

    fireEvent.click(screen.getByTestId('tab-profile'));
    expect(onTabChange).toHaveBeenCalledWith('profile');
  });

  it('shows cart badge when cartCount is between 1 and 99', () => {
    render(<BottomNav activeTab="menu" onTabChange={() => {}} cartCount={5} />);

    const badge = screen.getByTestId('cart-badge');
    expect(badge.textContent).toBe('5');
  });

  it('shows "99+" badge when cartCount exceeds 99', () => {
    render(<BottomNav activeTab="menu" onTabChange={() => {}} cartCount={150} />);

    const badge = screen.getByTestId('cart-badge');
    expect(badge.textContent).toBe('99+');
  });

  it('hides cart badge when cartCount is 0', () => {
    render(<BottomNav activeTab="menu" onTabChange={() => {}} cartCount={0} />);

    expect(screen.queryByTestId('cart-badge')).toBeNull();
  });

  it('hides cart badge when cartCount is omitted (defaults to 0)', () => {
    render(<BottomNav activeTab="menu" onTabChange={() => {}} />);

    expect(screen.queryByTestId('cart-badge')).toBeNull();
  });

  it('is fixed to the bottom of the viewport', () => {
    render(<BottomNav activeTab="menu" onTabChange={() => {}} cartCount={0} />);

    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('fixed');
    expect(nav.className).toContain('bottom-0');
  });
});
