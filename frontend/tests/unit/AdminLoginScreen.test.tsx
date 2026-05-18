/**
 * AdminLoginScreen — Admin Dashboard sign-in screen tests.
 *
 * Visual contract from Requirement 21.1: centered card on flat
 * #F3F4F6 background, VOKAFE logo, username + password inputs, single
 * "Sign In" button. The screen must collapse all auth failures to a
 * generic "Invalid credentials" inline message (Requirement 21.3) and
 * clear the password field after a failed attempt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminLoginScreen from '../../src/admin/auth/AdminLoginScreen';
import { AdminAuthProvider } from '../../src/admin/auth/useAdminAuth';

const TEST_BASE = 'http://test.local';

function renderScreen(props: Partial<React.ComponentProps<typeof AdminLoginScreen>> = {}) {
  return render(
    <AdminAuthProvider apiBaseUrl={TEST_BASE}>
      <AdminLoginScreen {...props} />
    </AdminAuthProvider>,
  );
}

function mockJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('AdminLoginScreen', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders the centered card with logo, headline, and the two inputs', () => {
    renderScreen();

    expect(screen.getByTestId('admin-login-screen')).toBeInTheDocument();
    expect(screen.getByTestId('admin-login-card')).toBeInTheDocument();

    const logo = screen.getByTestId('admin-login-logo') as HTMLImageElement;
    expect(logo.getAttribute('src')).toBe('/logo-vokafe.svg');

    expect(screen.getByTestId('admin-login-headline')).toHaveTextContent(
      'Admin Dashboard',
    );
    expect(screen.getByTestId('admin-login-username-input')).toBeInTheDocument();
    expect(screen.getByTestId('admin-login-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('admin-login-submit')).toHaveTextContent('Sign In');
  });

  it('shows a generic error and does not call fetch when fields are empty', () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    renderScreen();

    fireEvent.click(screen.getByTestId('admin-login-submit'));

    const error = screen.getByTestId('admin-login-form-error');
    expect(error).toHaveTextContent('Invalid credentials');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the generic "Invalid credentials" message on a 401 (Requirement 21.3)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse(401, { error: 'Invalid credentials' }),
    );

    renderScreen();

    fireEvent.change(screen.getByTestId('admin-login-username-input'), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByTestId('admin-login-password-input'), {
      target: { value: 'wrong-password' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-login-submit'));
    });

    const error = await screen.findByTestId('admin-login-form-error');
    expect(error).toHaveTextContent('Invalid credentials');
    // Per Requirement 21.3 we must never reveal which field is wrong.
    expect(error.textContent).not.toMatch(/username/i);
    expect(error.textContent).not.toMatch(/password/i);

    // Password is cleared after a failed attempt.
    const passwordInput = screen.getByTestId(
      'admin-login-password-input',
    ) as HTMLInputElement;
    expect(passwordInput.value).toBe('');
  });

  it('calls onLoginSuccess after a successful login and persists the JWT', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse(200, {
        token: 'admin-jwt',
        admin: { username: 'admin' },
      }),
    );

    const onLoginSuccess = vi.fn();
    renderScreen({ onLoginSuccess });

    fireEvent.change(screen.getByTestId('admin-login-username-input'), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByTestId('admin-login-password-input'), {
      target: { value: 'vokafe-admin-2026' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-login-submit'));
    });

    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalledTimes(1);
    });
    expect(localStorage.getItem('vokafe_admin_jwt')).toBe('admin-jwt');
  });
});
