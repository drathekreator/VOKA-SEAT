/**
 * RegisterScreen unit tests after the Section-21 rewrite.
 *
 * Field order is **email → name → password → confirm**; identifier is
 * email (Requirement 13.6 / 20.8). DUPLICATE_EMAIL on the server maps
 * to an inline email-field error.
 *
 * Validates: Requirements 13.8–13.13, 20.6–20.10, 20.12.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterScreen from '../../src/customer/auth/RegisterScreen';
import {
  AuthProvider,
  VOKAFE_JWT_STORAGE_KEY,
} from '../../src/customer/auth/useAuth';

const TEST_BASE = 'http://test.local';

function renderScreen(props: Partial<React.ComponentProps<typeof RegisterScreen>> = {}) {
  return render(
    <AuthProvider apiBaseUrl={TEST_BASE}>
      <RegisterScreen {...props} />
    </AuthProvider>,
  );
}

function mockJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('RegisterScreen', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders the logo, headline, four icon-prefixed fields, submit button, and footer link', () => {
    renderScreen();

    const logo = screen.getByTestId('register-screen-logo') as HTMLImageElement;
    expect(logo).toBeDefined();
    expect(logo.getAttribute('src')).toBe('/logo-vokafe.svg');

    expect(screen.getByTestId('register-screen-headline').textContent).toBe('Create Account');

    expect(screen.getByTestId('register-email-input')).toBeDefined();
    expect(screen.getByTestId('register-name-input')).toBeDefined();
    expect(screen.getByTestId('register-password-input')).toBeDefined();
    expect(screen.getByTestId('register-confirm-password-input')).toBeDefined();

    // Material Symbols Outlined icons in field order: mail, person, lock, lock_reset
    const icons = Array.from(
      document.querySelectorAll('span.material-symbols-outlined'),
    ).map((el) => el.textContent);
    expect(icons).toEqual(['mail', 'person', 'lock', 'lock_reset']);

    const submit = screen.getByTestId('register-submit');
    expect(submit.textContent).toContain('Create Account');

    expect(screen.getByTestId('register-navigate-to-login').textContent).toBe('Login here');
  });

  it('shows an inline email error and does NOT call register when the email is malformed', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.type(screen.getByTestId('register-email-input'), 'not-an-email');
    await user.type(screen.getByTestId('register-name-input'), 'Jane Doe');
    await user.type(screen.getByTestId('register-password-input'), 'password123');
    await user.type(screen.getByTestId('register-confirm-password-input'), 'password123');

    await user.click(screen.getByTestId('register-submit'));

    expect(screen.getByTestId('register-email-error').textContent).toMatch(/valid email/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows a confirmation-mismatch error when password and confirmation differ', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.type(screen.getByTestId('register-email-input'), 'jane@example.com');
    await user.type(screen.getByTestId('register-name-input'), 'Jane Doe');
    await user.type(screen.getByTestId('register-password-input'), 'password123');
    await user.type(screen.getByTestId('register-confirm-password-input'), 'mismatched');

    await user.click(screen.getByTestId('register-submit'));

    expect(screen.getByTestId('register-confirm-password-error').textContent).toMatch(
      /Passwords do not match/,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows a "password too short" error when password is < 8 characters', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.type(screen.getByTestId('register-email-input'), 'jane@example.com');
    await user.type(screen.getByTestId('register-name-input'), 'Jane Doe');
    await user.type(screen.getByTestId('register-password-input'), 'short');
    await user.type(screen.getByTestId('register-confirm-password-input'), 'short');

    await user.click(screen.getByTestId('register-submit'));

    expect(screen.getByTestId('register-password-error').textContent).toMatch(
      /at least 8 characters/,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('maps a 409 DUPLICATE_EMAIL response to an inline email-field error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse(409, { error: 'User with this email already exists' }),
    );

    const user = userEvent.setup();
    const onRegisterSuccess = vi.fn();
    renderScreen({ onRegisterSuccess });

    await user.type(screen.getByTestId('register-email-input'), 'jane@example.com');
    await user.type(screen.getByTestId('register-name-input'), 'Jane Doe');
    await user.type(screen.getByTestId('register-password-input'), 'password123');
    await user.type(screen.getByTestId('register-confirm-password-input'), 'password123');

    await user.click(screen.getByTestId('register-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('register-email-error').textContent).toMatch(
        /already registered/i,
      );
    });
    expect(onRegisterSuccess).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      `${TEST_BASE}/api/auth/register`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'jane@example.com',
          name: 'Jane Doe',
          password: 'password123',
        }),
      }),
    );
  });

  it('fires onRegisterSuccess after a successful register response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse(201, {
        token: 'jwt-new',
        user: { email: 'jane@example.com', name: 'Jane Doe' },
      }),
    );

    const user = userEvent.setup();
    const onRegisterSuccess = vi.fn();
    renderScreen({ onRegisterSuccess });

    await user.type(screen.getByTestId('register-email-input'), 'jane@example.com');
    await user.type(screen.getByTestId('register-name-input'), 'Jane Doe');
    await user.type(screen.getByTestId('register-password-input'), 'password123');
    await user.type(screen.getByTestId('register-confirm-password-input'), 'password123');

    await user.click(screen.getByTestId('register-submit'));

    await waitFor(() => {
      expect(onRegisterSuccess).toHaveBeenCalledTimes(1);
    });
    // Auto-authentication side-effect: the token should now be persisted
    // under the email-keyed storage key.
    expect(localStorage.getItem(VOKAFE_JWT_STORAGE_KEY)).toBe('jwt-new');
  });

  it('invokes onNavigateToLogin when the "Login here" footer link is clicked', async () => {
    const user = userEvent.setup();
    const onNavigateToLogin = vi.fn();
    renderScreen({ onNavigateToLogin });

    await user.click(screen.getByTestId('register-navigate-to-login'));

    expect(onNavigateToLogin).toHaveBeenCalledTimes(1);
  });
});
