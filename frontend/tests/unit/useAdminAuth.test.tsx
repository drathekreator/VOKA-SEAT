/**
 * useAdminAuth — Admin Dashboard auth hook tests.
 *
 * Mirrors the customer useAuth shape but stores its JWT under the
 * disjoint `vokafe_admin_jwt` key. Login posts to
 * /api/auth/admin/login and expects `{ token, admin: { username } }`.
 *
 * Validates: Requirement 21.1, 21.2, 21.3.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AdminAuthError,
  AdminAuthProvider,
  useAdminAuth,
  VOKAFE_ADMIN_JWT_STORAGE_KEY,
  readAdminToken,
  clearAdminToken,
} from '../../src/admin/auth/useAdminAuth';

/**
 * Build a fake unsigned JWT (header.payload.signature) carrying the
 * given payload. The hook only base64-decodes the payload — it does
 * NOT verify the signature — so we don't need a real signing key.
 */
function fakeJwt(payload: Record<string, unknown>): string {
  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  return `${enc({ alg: 'none', typ: 'JWT' })}.${enc(payload)}.test-signature`;
}

const TEST_BASE = 'http://test.local';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AdminAuthProvider apiBaseUrl={TEST_BASE}>{children}</AdminAuthProvider>;
}

function mockJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('useAdminAuth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('throws when used outside of an AdminAuthProvider', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAdminAuth())).toThrow(
      /useAdminAuth must be used within an <AdminAuthProvider>/,
    );
    errSpy.mockRestore();
  });

  it('starts unauthenticated with no token', async () => {
    const { result } = renderHook(() => useAdminAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.username).toBeNull();
  });

  it('restores session from localStorage and decodes username from JWT payload', async () => {
    const cachedToken = fakeJwt({ username: 'cached-admin', role: 'admin' });
    localStorage.setItem(VOKAFE_ADMIN_JWT_STORAGE_KEY, cachedToken);

    const { result } = renderHook(() => useAdminAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe(cachedToken);
    expect(result.current.username).toBe('cached-admin');
  });

  it('login() persists the token and updates state on success', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse(200, {
        token: 'admin-jwt',
        admin: { username: 'admin' },
      }),
    );

    const { result } = renderHook(() => useAdminAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('admin', 'pw');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe('admin-jwt');
    expect(result.current.username).toBe('admin');
    expect(localStorage.getItem(VOKAFE_ADMIN_JWT_STORAGE_KEY)).toBe('admin-jwt');

    expect(global.fetch).toHaveBeenCalledWith(
      `${TEST_BASE}/api/auth/admin/login`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'pw' }),
      }),
    );
  });

  it('login() throws AdminAuthError(INVALID_CREDENTIALS) on 401', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse(401, { error: 'Invalid credentials' }),
    );

    const { result } = renderHook(() => useAdminAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.login('admin', 'bad')).rejects.toBeInstanceOf(
        AdminAuthError,
      );
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem(VOKAFE_ADMIN_JWT_STORAGE_KEY)).toBeNull();
  });

  it('login() throws AdminAuthError(NETWORK_ERROR) when fetch rejects', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useAdminAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.login('admin', 'pw');
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toBeInstanceOf(AdminAuthError);
    expect((caught as AdminAuthError).code).toBe('NETWORK_ERROR');
  });

  it('logout() clears localStorage and state', async () => {
    localStorage.setItem(VOKAFE_ADMIN_JWT_STORAGE_KEY, 'cached-token');

    const { result } = renderHook(() => useAdminAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.username).toBeNull();
    expect(localStorage.getItem(VOKAFE_ADMIN_JWT_STORAGE_KEY)).toBeNull();
  });

  it('readAdminToken / clearAdminToken work outside React', () => {
    expect(readAdminToken()).toBeNull();
    localStorage.setItem(VOKAFE_ADMIN_JWT_STORAGE_KEY, 'standalone-token');
    expect(readAdminToken()).toBe('standalone-token');
    clearAdminToken();
    expect(readAdminToken()).toBeNull();
  });
});
