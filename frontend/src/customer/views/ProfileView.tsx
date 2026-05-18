/**
 * ProfileView — Customer App profile screen.
 *
 * After the Section-21 auth rewrite the Profile tab is reachable
 * regardless of authentication state. The view renders one of two
 * variants based on `useAuth()`:
 *
 *   - **Guest state** (Requirements 13.1–13.3, 19.1) — centered card
 *     with the VOKAFE logo and a single primary "Sign In or Create
 *     Account" button. The Order History entry is hidden. This is the
 *     entry point a guest taps to upgrade into an authenticated session.
 *
 *   - **Authenticated state** (Requirements 13.5, 13.16) — name + email
 *     + Order History row + Logout. We display the customer's email
 *     instead of NIM to match the email-keyed identifier model.
 *
 * The Customer App shell decides what happens when the guest CTA fires:
 * normally it renders the LoginScreen overlay so the customer can sign
 * in or register without losing their place.
 *
 * Spec references: Requirements 13.1, 13.2, 13.3, 13.5, 13.7, 13.16,
 * 17.5, 19.1.
 */

import { useAuth } from '../auth/useAuth';

export interface ProfileViewProps {
  /**
   * Tap on "Sign In or Create Account" from the guest state. The shell
   * routes to the Login screen (Requirement 13.3).
   */
  onSignIn?: () => void;
  /**
   * Tap on "Order History" from the authenticated state. The shell
   * mounts OrderHistoryView (Requirement 13.5).
   */
  onNavigateToOrderHistory?: () => void;
  /**
   * Optional hook fired after `useAuth().logout()`. The shell can use
   * this to clear local UI state if needed (Requirement 13.16).
   */
  onLoggedOut?: () => void;
}

export default function ProfileView({
  onSignIn,
  onNavigateToOrderHistory,
  onLoggedOut,
}: ProfileViewProps) {
  const { isAuthenticated, user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    onLoggedOut?.();
  };

  // -----------------------------------------------------------------
  // Guest state — Requirements 13.2, 13.3, 19.1
  // -----------------------------------------------------------------
  if (!isAuthenticated || !user) {
    return (
      <div
        data-testid="profile-guest"
        className="flex flex-col items-center justify-center px-margin-mobile py-xl gap-lg min-h-[60vh]"
      >
        <img
          src="/logo-vokafe.svg"
          alt="VOKAFE"
          className="h-12 w-auto"
          data-testid="profile-guest-logo"
        />
        <div className="text-center max-w-xs flex flex-col gap-xs">
          <h2
            className="font-headline-sm text-headline-sm text-on-surface"
            data-testid="profile-guest-headline"
          >
            Save your orders
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Sign in or create an account to track your order history. You can
            keep browsing the menu and ordering as a guest if you prefer.
          </p>
        </div>

        <button
          type="button"
          onClick={onSignIn}
          data-testid="profile-guest-sign-in"
          className={[
            'w-full max-w-xs h-12',
            'inline-flex items-center justify-center gap-sm',
            'bg-primary text-on-primary',
            'rounded-xl',
            'shadow-[0_4px_12px_rgba(225,29,72,0.2)]',
            'font-label-md text-label-md',
            'border-none cursor-pointer',
            'transition-transform active:scale-95',
          ].join(' ')}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            login
          </span>
          Sign In or Create Account
        </button>
      </div>
    );
  }

  // -----------------------------------------------------------------
  // Authenticated state — Requirements 13.5, 13.16
  // -----------------------------------------------------------------
  return (
    <div
      className="px-margin-mobile py-lg pb-24 max-w-2xl mx-auto flex flex-col gap-lg"
      data-testid="profile-view"
    >
      {/* Compact VOKAFE logo at the top of the page (32px) */}
      <div className="flex items-center justify-center" data-testid="profile-logo">
        <img src="/logo-vokafe.svg" alt="VOKAFE" className="h-8 w-auto" />
      </div>

      {/* Profile card — name + email */}
      <section
        className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_4px_12px_rgba(0,0,0,0.04)] flex flex-col items-center text-center gap-xs"
        data-testid="profile-card"
      >
        <h2
          className="font-headline-sm text-headline-sm text-on-surface"
          data-testid="profile-name"
        >
          {user.name}
        </h2>
        <p
          className="font-body-sm text-body-sm text-on-surface-variant break-all"
          data-testid="profile-email"
        >
          {user.email}
        </p>
      </section>

      {/* Account section header + Order History row */}
      <section className="flex flex-col gap-sm" data-testid="profile-account-section">
        <h3 className="font-label-md text-label-md text-on-surface-variant px-2 uppercase tracking-wider">
          Account
        </h3>

        <button
          type="button"
          onClick={onNavigateToOrderHistory}
          className="bg-surface-container-lowest p-md rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-outline-variant/20 flex items-center justify-between hover:bg-surface-container-low transition-colors active:scale-95 w-full text-left"
          data-testid="profile-order-history-link"
          aria-label="Open order history"
        >
          <span className="flex items-center gap-md">
            <span
              className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined">receipt_long</span>
            </span>
            <span className="font-body-md text-body-md text-on-surface">
              Order History
            </span>
          </span>
          <span
            className="material-symbols-outlined text-on-surface-variant"
            aria-hidden="true"
          >
            chevron_right
          </span>
        </button>
      </section>

      {/* Logout button */}
      <button
        type="button"
        onClick={handleLogout}
        className="bg-surface-container-lowest p-md rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-outline-variant/20 flex items-center justify-between hover:bg-error-container/20 transition-colors active:scale-95 w-full text-left"
        data-testid="profile-logout-button"
        aria-label="Log out"
      >
        <span className="flex items-center gap-md">
          <span
            className="w-10 h-10 rounded-full bg-error-container/30 flex items-center justify-center text-error"
            aria-hidden="true"
          >
            <span className="material-symbols-outlined">logout</span>
          </span>
          <span className="font-body-md text-body-md text-error">Logout</span>
        </span>
      </button>
    </div>
  );
}
