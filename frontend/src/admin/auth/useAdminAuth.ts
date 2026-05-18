/**
 * useAdminAuth — Admin Dashboard authentication hook.
 *
 * Mirrors the customer `useAuth` shape but stores its JWT under a
 * disjoint key (`vokafe_admin_jwt`) so customer and admin sessions can
 * never collide. The admin dashboard is gated behind a hard auth wall
 * (Requirement 21.1): the rest of the admin app does not mount until
 * `isAuthenticated` is true.
 */
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:4000';

export const VOKAFE_ADMIN_JWT_STORAGE_KEY = 'vokafe_admin_jwt';

export type AdminAuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export class AdminAuthError extends Error {
  readonly code: AdminAuthErrorCode;
  constructor(code: AdminAuthErrorCode, message: string) {
    super(message);
    this.name = 'AdminAuthError';
    this.code = code;
  }
}

export interface AdminAuthState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthState | undefined>(undefined);

interface AdminAuthSuccessResponse {
  token: string;
  admin: { username: string };
}

function isAdminAuthSuccessResponse(value: unknown): value is AdminAuthSuccessResponse {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.token !== 'string') return false;
  const a = v.admin as Record<string, unknown> | undefined;
  if (!a || typeof a !== 'object') return false;
  return typeof a.username === 'string';
}

interface AdminAuthProviderProps {
  children: ReactNode;
  apiBaseUrl?: string;
}

export function AdminAuthProvider({ children, apiBaseUrl }: AdminAuthProviderProps) {
  const baseUrl = apiBaseUrl ?? API_BASE_URL;
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(VOKAFE_ADMIN_JWT_STORAGE_KEY);
      if (stored) {
        setToken(stored);
        // We don't have a separate username store; decode from JWT payload.
        // A malformed token simply leaves `username` null but keeps the
        // session active until an admin route 401/403s us out.
        try {
          const parts = stored.split('.');
          if (parts.length === 3) {
            const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
            const payload = JSON.parse(payloadStr) as { username?: string };
            if (typeof payload.username === 'string') {
              setUsername(payload.username);
            }
          }
        } catch {
          // Non-JSON / corrupted JWT — leave username null.
        }
      }
    } catch {
      localStorage.removeItem(VOKAFE_ADMIN_JWT_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(
    async (rawUsername: string, password: string): Promise<void> => {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/api/auth/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: rawUsername, password }),
        });
      } catch {
        throw new AdminAuthError('NETWORK_ERROR', 'Unable to reach the server.');
      }

      if (response.status === 401) {
        throw new AdminAuthError('INVALID_CREDENTIALS', 'Invalid credentials');
      }

      if (!response.ok) {
        throw new AdminAuthError('UNKNOWN', 'Sign in failed');
      }

      const body: unknown = await response.json().catch(() => null);
      if (!isAdminAuthSuccessResponse(body)) {
        throw new AdminAuthError('UNKNOWN', 'Unexpected response from server');
      }

      localStorage.setItem(VOKAFE_ADMIN_JWT_STORAGE_KEY, body.token);
      setToken(body.token);
      setUsername(body.admin.username);
    },
    [baseUrl],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(VOKAFE_ADMIN_JWT_STORAGE_KEY);
    setToken(null);
    setUsername(null);
  }, []);

  const value = useMemo<AdminAuthState>(
    () => ({
      isAuthenticated: token !== null,
      token,
      username,
      isLoading,
      login,
      logout,
    }),
    [token, username, isLoading, login, logout],
  );

  return createElement(AdminAuthContext.Provider, { value }, children);
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within an <AdminAuthProvider>');
  }
  return ctx;
}

/**
 * Read the admin JWT directly from storage. Used by the `adminFetch`
 * helper which runs outside React (e.g. in event handlers). Always
 * prefer `useAdminAuth().token` inside components.
 */
export function readAdminToken(): string | null {
  try {
    return localStorage.getItem(VOKAFE_ADMIN_JWT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Drop the admin token from storage. Used by `adminFetch` on 401/403. */
export function clearAdminToken(): void {
  try {
    localStorage.removeItem(VOKAFE_ADMIN_JWT_STORAGE_KEY);
  } catch {
    /* no-op */
  }
}
