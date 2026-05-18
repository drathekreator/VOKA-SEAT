import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AuthError,
  AuthProvider,
  useAuth,
  VOKAFE_JWT_STORAGE_KEY,
  VOKAFE_USER_STORAGE_KEY,
} from '../../src/customer/auth/useAuth';

/**
 * useAuth — Customer App auth hook tests.
 *
 * After the Section-21 rewrite the hook is keyed by **email** rather
 * than NIM. These tests cover the new shape:
 *   - storage keys: `vokafe_customer_jwt` and `vokafe_customer_user`
 *   - login(email, password) / register(email, name, password)
 *   - AuthError code DUPLICATE_EMAIL on 409
 *   - user shape `{ email, name }`
 */

const TEST_BASE = 'http://test.local';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider apiBaseUrl={TEST_BASE}>{children}</AuthProvider>;
}

function mockJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('throws when used outside of an AuthProvider', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      /useAuth must be used within an <AuthProvider>/,
    );
    errSpy.mockRestore();
  });

  it('starts unauthenticated and finishes loading', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it('restores session from localStorage on mount', async () => {
    localStorage.setItem(VOKAFE_JWT_STORAGE_KEY, 'cached-token');
    localStorage.setItem(
      VOKAFE_USER_STORAGE_KEY,
      JSON.stringify({ email: 'jane@example.com', name: 'Cached User' }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe('cached-token');
    expect(result.current.user).toEqual({
      email: 'jane@example.com',
      name: 'Cached User',
    });
  });

  it('clears corrupted user data from localStorage', async () => {
    localStorage.setItem(VOKAFE_JWT_STORAGE_KEY, 'cached-token');
    localStorage.setItem(VOKAFE_USER_STORAGE_KEY, '{not json');

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem(VOKAFE_JWT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(VOKAFE_USER_STORAGE_KEY)).toBeNull();
  });

  it('cleans up legacy NIM-keyed session blobs on mount', async () => {
    // Old keys from before the rewrite.
    localStorage.setItem('vokafe_jwt', 'old-token');
    localStorage.setItem(
      'vokafe_user',
      JSON.stringify({ nim: '12345678', name: 'Legacy' }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Legacy entries are scrubbed silently. The hook does not
    // accidentally adopt them as the new session.
    expect(localStorage.getItem('vokafe_jwt')).toBeNull();
    expect(localStorage.getItem('vokafe_user')).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('login() persists token + user and updates state on success', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse(200, {
        token: 'jwt-abc',
        user: { email: 'jane@example.com', name: 'Jane' },
      }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('jane@example.com', 'pw');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe('jwt-abc');
    expect(result.current.user).toEqual({
      email: 'jane@example.com',
      name: 'Jane',
    });
    expect(localStorage.getItem(VOKAFE_JWT_STORAGE_KEY)).toBe('jwt-abc');
    expect(localStorage.getItem(VOKAFE_USER_STORAGE_KEY)).toBe(
      JSON.stringify({ email: 'jane@example.com', name: 'Jane' }),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      `${TEST_BASE}/api/auth/login`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'jane@example.com', password: 'pw' }),
      }),
    );
  });

  it('login() throws AuthError(INVALID_CREDENTIALS) on 401', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse(401, { error: 'Invalid credentials' }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(
        result.current.login('jane@example.com', 'bad'),
      ).rejects.toBeInstanceOf(AuthError);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem(VOKAFE_JWT_STORAGE_KEY)).toBeNull();
  });

  it('login() throws AuthError(NETWORK_ERROR) when fetch rejects', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.login('jane@example.com', 'pw');
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toBeInstanceOf(AuthError);
    expect((caught as AuthError).code).toBe('NETWORK_ERROR');
  });

  it('register() persists session and authenticates on success', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse(201, {
        token: 'new-jwt',
        user: { email: 'new@example.com', name: 'New User' },
      }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.register('new@example.com', 'New User', 'password123');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe('new-jwt');
    expect(result.current.user).toEqual({
      email: 'new@example.com',
      name: 'New User',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${TEST_BASE}/api/auth/register`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'new@example.com',
          name: 'New User',
          password: 'password123',
        }),
      }),
    );
  });

  it('register() throws AuthError(DUPLICATE_EMAIL) on 409', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse(409, { error: 'User with this email already exists' }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.register('jane@example.com', 'Dup', 'password123');
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toBeInstanceOf(AuthError);
    expect((caught as AuthError).code).toBe('DUPLICATE_EMAIL');
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('register() throws AuthError(VALIDATION_ERROR) on 400', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse(400, { error: 'Email is invalid' }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.register('not-an-email', 'Short', 'password123');
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toBeInstanceOf(AuthError);
    expect((caught as AuthError).code).toBe('VALIDATION_ERROR');
  });

  it('logout() clears localStorage and state', async () => {
    localStorage.setItem(VOKAFE_JWT_STORAGE_KEY, 'cached-token');
    localStorage.setItem(
      VOKAFE_USER_STORAGE_KEY,
      JSON.stringify({ email: 'jane@example.com', name: 'Cached' }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem(VOKAFE_JWT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(VOKAFE_USER_STORAGE_KEY)).toBeNull();
  });

  it('exposes auth state to descendant components via context', async () => {
    function Probe() {
      const { isAuthenticated, user } = useAuth();
      return (
        <div data-testid="probe">
          {isAuthenticated ? `auth:${user?.name}` : 'guest'}
        </div>
      );
    }

    localStorage.setItem(VOKAFE_JWT_STORAGE_KEY, 'cached-token');
    localStorage.setItem(
      VOKAFE_USER_STORAGE_KEY,
      JSON.stringify({ email: 'probe@example.com', name: 'Probe User' }),
    );

    render(
      <AuthProvider apiBaseUrl={TEST_BASE}>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('probe')).toHaveTextContent('auth:Probe User');
    });
  });
});
