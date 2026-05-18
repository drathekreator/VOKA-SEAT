import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginScreen from '../../src/customer/auth/LoginScreen';
import { AuthProvider } from '../../src/customer/auth/useAuth';

/**
 * Unit tests for LoginScreen after the Section-21 rewrite.
 *
 * Validates:
 *   - Visual contract from Requirement 20.1–20.5 (centered card,
 *     headline, subline, email + password fields with leading icons,
 *     primary submit, Sign Up footer).
 *   - Behaviour from Requirements 13.1, 13.2, 13.6:
 *     - Client-side email format validation surfaces an inline error.
 *     - 401 response collapses to a generic "Invalid credentials" form
 *       error that never reveals which field is wrong.
 *     - Successful login fires `onLoginSuccess`.
 *     - "Sign Up" footer link calls `onNavigateToRegister`.
 */

const TEST_BASE = 'http://test.local';

function renderLogin(options: {
  onLoginSuccess?: () => void;
  onNavigateToRegister?: () => void;
} = {}) {
  return render(
    <AuthProvider apiBaseUrl={TEST_BASE}>
      <LoginScreen
        onLoginSuccess={options.onLoginSuccess}
        onNavigateToRegister={options.onNavigateToRegister}
      />
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

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders the centered card with logo, headline, subline and the two inputs', () => {
    renderLogin();

    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    expect(screen.getByTestId('login-card')).toBeInTheDocument();

    const logo = screen.getByTestId('login-logo') as HTMLImageElement;
    expect(logo.getAttribute('src')).toBe('/logo-vokafe.svg');
    expect(logo.getAttribute('alt')).toBe('VOKAFE');

    expect(screen.getByTestId('login-headline')).toHaveTextContent('Welcome Back');
    expect(screen.getByTestId('login-subline')).toHaveTextContent(
      'Please enter your details to sign in.',
    );

    const emailInput = screen.getByTestId('login-email-input') as HTMLInputElement;
    expect(emailInput).toBeInTheDocument();
    expect(emailInput.type).toBe('email');
    expect(emailInput.inputMode).toBe('email');

    expect(screen.getByTestId('login-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit')).toHaveTextContent('Login');

    // Leading icons are rendered as Material Symbols Outlined spans.
    const card = screen.getByTestId('login-card');
    const iconNames = Array.from(
      card.querySelectorAll('span.material-symbols-outlined'),
    ).map((el) => el.textContent);
    expect(iconNames).toEqual(expect.arrayContaining(['mail', 'lock']));
  });

  it('shows an inline email-format error when the email is malformed', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    renderLogin();

    fireEvent.change(screen.getByTestId('login-email-input'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.change(screen.getByTestId('login-password-input'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByTestId('login-submit'));

    const error = await screen.findByTestId('login-email-error');
    expect(error).toHaveTextContent(/valid email/i);

    // No form-level error and no network call for a client-side rejection.
    expect(screen.queryByTestId('login-form-error')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the generic "Invalid credentials" form error on a 401 response (Requirement 13.2)', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(401, { error: 'Invalid credentials' }),
    );

    renderLogin();

    fireEvent.change(screen.getByTestId('login-email-input'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByTestId('login-password-input'), {
      target: { value: 'wrong-password' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('login-submit'));
    });

    const formError = await screen.findByTestId('login-form-error');
    expect(formError).toHaveTextContent('Invalid credentials');

    // Per Requirement 13.2 the message must not reveal which field is wrong.
    expect(formError.textContent).not.toMatch(/password/i);
    expect(formError.textContent).not.toMatch(/email/i);

    // No inline email-format error here (the email was valid).
    expect(screen.queryByTestId('login-email-error')).toBeNull();

    expect(fetchMock).toHaveBeenCalledWith(
      `${TEST_BASE}/api/auth/login`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('calls onLoginSuccess after a successful login', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(200, {
        token: 'jwt-token',
        user: { email: 'jane@example.com', name: 'Jane' },
      }),
    );

    const onLoginSuccess = vi.fn();
    renderLogin({ onLoginSuccess });

    fireEvent.change(screen.getByTestId('login-email-input'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByTestId('login-password-input'), {
      target: { value: 'password123' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('login-submit'));
    });

    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByTestId('login-form-error')).toBeNull();
  });

  it('calls onNavigateToRegister when the Sign Up footer link is tapped', () => {
    const onNavigateToRegister = vi.fn();
    renderLogin({ onNavigateToRegister });

    const signUpLink = screen.getByTestId('login-signup-link');
    expect(signUpLink).toHaveTextContent('Sign Up');

    fireEvent.click(signUpLink);

    expect(onNavigateToRegister).toHaveBeenCalledTimes(1);
  });
});
