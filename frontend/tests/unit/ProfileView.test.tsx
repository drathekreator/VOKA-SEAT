/**
 * ProfileView unit tests after the Section-21 rewrite.
 *
 * Covers two states (Requirement 13.1–13.7, 19.1):
 *
 *   - **Guest** — the Profile tab is reachable when unauthenticated and
 *     renders a centered VOKAFE logo + "Sign In or Create Account" CTA.
 *     The CTA invokes the `onSignIn` prop so the parent shell can route
 *     to the LoginScreen.
 *
 *   - **Authenticated** — the profile card shows name + email (NOT NIM,
 *     since NIM was removed from the schema). The Order History row
 *     navigates via `onNavigateToOrderHistory`. Logout calls
 *     `useAuth().logout()` plus the optional `onLoggedOut` hook.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProfileView from '../../src/customer/views/ProfileView';
import type { AuthState } from '../../src/customer/auth/useAuth';

// ---------------------------------------------------------------------------
// useAuth mock — mutated per test by overwriting `mockAuthState`.
// ---------------------------------------------------------------------------
const mockLogout = vi.fn();

let mockAuthState: AuthState = {
  isAuthenticated: true,
  user: { email: 'jane@example.com', name: 'John Doe' },
  token: 'test-jwt-token',
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: mockLogout,
};

vi.mock('../../src/customer/auth/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

function setAuthenticated(name = 'John Doe', email = 'jane@example.com') {
  mockAuthState = {
    isAuthenticated: true,
    user: { email, name },
    token: 'test-jwt-token',
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: mockLogout,
  };
}

function setUnauthenticated() {
  mockAuthState = {
    isAuthenticated: false,
    user: null,
    token: null,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: mockLogout,
  };
}

describe('ProfileView', () => {
  beforeEach(() => {
    mockLogout.mockReset();
    setAuthenticated();
  });

  describe('authenticated', () => {
    it('renders the profile card with the user name and email', () => {
      setAuthenticated('Alex Mercer', 'alex@example.com');

      render(<ProfileView onNavigateToOrderHistory={vi.fn()} />);

      expect(screen.getByTestId('profile-view')).toBeInTheDocument();
      expect(screen.getByTestId('profile-card')).toBeInTheDocument();
      expect(screen.getByTestId('profile-name')).toHaveTextContent('Alex Mercer');
      expect(screen.getByTestId('profile-email')).toHaveTextContent('alex@example.com');
    });

    it('renders the VOKAFE logo', () => {
      render(<ProfileView onNavigateToOrderHistory={vi.fn()} />);

      const logoContainer = screen.getByTestId('profile-logo');
      const img = logoContainer.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('alt')).toBe('VOKAFE');
      expect(img?.getAttribute('src')).toBe('/logo-vokafe.svg');
    });

    it('renders an Order History navigation entry', () => {
      render(<ProfileView onNavigateToOrderHistory={vi.fn()} />);

      const link = screen.getByTestId('profile-order-history-link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveTextContent('Order History');
      expect(link.textContent).toContain('receipt_long');
    });

    it('calls onNavigateToOrderHistory when the Order History entry is tapped', () => {
      const onNavigateToOrderHistory = vi.fn();

      render(
        <ProfileView onNavigateToOrderHistory={onNavigateToOrderHistory} />,
      );

      fireEvent.click(screen.getByTestId('profile-order-history-link'));
      expect(onNavigateToOrderHistory).toHaveBeenCalledTimes(1);
    });

    it('calls useAuth().logout() when Logout is tapped', () => {
      render(<ProfileView onNavigateToOrderHistory={vi.fn()} />);

      fireEvent.click(screen.getByTestId('profile-logout-button'));
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    it('calls onLoggedOut after logout when provided', () => {
      const onLoggedOut = vi.fn();

      render(
        <ProfileView
          onNavigateToOrderHistory={vi.fn()}
          onLoggedOut={onLoggedOut}
        />,
      );

      fireEvent.click(screen.getByTestId('profile-logout-button'));
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(onLoggedOut).toHaveBeenCalledTimes(1);
    });

    it('does not throw when onLoggedOut is omitted', () => {
      render(<ProfileView onNavigateToOrderHistory={vi.fn()} />);

      expect(() =>
        fireEvent.click(screen.getByTestId('profile-logout-button')),
      ).not.toThrow();
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('guest (unauthenticated)', () => {
    beforeEach(() => {
      setUnauthenticated();
    });

    it('renders the guest CTA card with logo and Sign In button', () => {
      render(<ProfileView onSignIn={vi.fn()} onNavigateToOrderHistory={vi.fn()} />);

      const guest = screen.getByTestId('profile-guest');
      expect(guest).toBeInTheDocument();
      expect(screen.getByTestId('profile-guest-logo')).toBeInTheDocument();
      expect(screen.getByTestId('profile-guest-headline')).toBeInTheDocument();
      expect(screen.getByTestId('profile-guest-sign-in')).toHaveTextContent(
        /Sign In or Create Account/i,
      );

      // None of the authenticated chrome should render.
      expect(screen.queryByTestId('profile-view')).not.toBeInTheDocument();
      expect(screen.queryByTestId('profile-card')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('profile-order-history-link'),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId('profile-logout-button')).not.toBeInTheDocument();
    });

    it('invokes onSignIn when the guest CTA is tapped', () => {
      const onSignIn = vi.fn();
      render(<ProfileView onSignIn={onSignIn} onNavigateToOrderHistory={vi.fn()} />);

      fireEvent.click(screen.getByTestId('profile-guest-sign-in'));
      expect(onSignIn).toHaveBeenCalledTimes(1);
    });
  });
});
