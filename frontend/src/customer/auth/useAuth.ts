/**
 * useAuth — Customer App authentication context and hook.
 *
 * Centralises authenticated session state (JWT + customer profile) so any
 * descendant of `<AuthProvider>` can call `useAuth()` to read state or
 * invoke login / register / logout actions.
 *
 * Auth model after the Section-21 rewrite:
 *   - Customer auth is OPTIONAL (Requirement 13.1). The hook is still
 *     mounted for unauthenticated visitors so views can read
 *     `isAuthenticated === false`, but the Customer App renders all
 *     tabs regardless.
 *   - The customer identifier is `email` (Requirements 13.4–13.6, 14.1),
 *     not the legacy NIM.
 *   - login/register call `/api/auth/login` and `/api/auth/register`,
 *     which return JWTs carrying `role: 'customer'`.
 *
 * Persistence:
 *   - JWT  → localStorage[`vokafe_customer_jwt`]
 *   - User → localStorage[`vokafe_customer_user`] (cached `{ email, name }`
 *           for fast hydration on hard refresh; replaced once `/api/auth/me`
 *           is implemented).
 *
 * Errors are thrown as `AuthError` so screens can render inline messages.
 * Register specifically throws `DUPLICATE_EMAIL` on HTTP 409 so the
 * Register screen can highlight the email field.
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

export const VOKAFE_JWT_STORAGE_KEY = 'vokafe_customer_jwt';
export const VOKAFE_USER_STORAGE_KEY = 'vokafe_customer_user';

/**
 * Legacy storage keys from the NIM-keyed auth model. We clean these up
 * silently on mount so leftover values from a pre-rewrite session do not
 * shadow the new keys.
 */
const LEGACY_JWT_KEYS = ['vokafe_jwt'];
const LEGACY_USER_KEYS = ['vokafe_user'];

export interface AuthUser {
  email: string;
  name: string;
}

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'DUPLICATE_EMAIL'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

interface AuthSuccessResponse {
  token: string;
  user: { email: string; name: string };
}

function isAuthSuccessResponse(value: unknown): value is AuthSuccessResponse {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.token !== 'string') return false;
  const u = v.user as Record<string, unknown> | undefined;
  if (!u || typeof u !== 'object') return false;
  return typeof u.email === 'string' && typeof u.name === 'string';
}

async function readErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (body && typeof body.error === 'string') return body.error;
  } catch {
    // non-JSON body — fall through
  }
  return undefined;
}

interface AuthProviderProps {
  children: ReactNode;
  /**
   * Optional API base URL override, primarily for testing. When omitted, the
   * provider uses VITE_API_BASE_URL (falling back to VITE_API_URL, then
   * http://localhost:4000).
   */
  apiBaseUrl?: string;
}

export function AuthProvider({ children, apiBaseUrl }: AuthProviderProps) {
  const baseUrl = apiBaseUrl ?? API_BASE_URL;
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount.
  useEffect(() => {
    try {
      // Drop any leftover NIM-keyed session blobs so they cannot shadow
      // the email-keyed entries below.
      for (const key of LEGACY_JWT_KEYS) localStorage.removeItem(key);
      for (const key of LEGACY_USER_KEYS) localStorage.removeItem(key);

      const storedToken = localStorage.getItem(VOKAFE_JWT_STORAGE_KEY);
      const storedUserRaw = localStorage.getItem(VOKAFE_USER_STORAGE_KEY);
      if (storedToken && storedUserRaw) {
        const parsed = JSON.parse(storedUserRaw) as Partial<AuthUser>;
        if (
          parsed &&
          typeof parsed.email === 'string' &&
          typeof parsed.name === 'string'
        ) {
          setToken(storedToken);
          setUser({ email: parsed.email, name: parsed.name });
        } else {
          localStorage.removeItem(VOKAFE_JWT_STORAGE_KEY);
          localStorage.removeItem(VOKAFE_USER_STORAGE_KEY);
        }
      }
    } catch {
      // Corrupted storage — clear and start unauthenticated.
      localStorage.removeItem(VOKAFE_JWT_STORAGE_KEY);
      localStorage.removeItem(VOKAFE_USER_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persistSession = useCallback((nextToken: string, nextUser: AuthUser) => {
    localStorage.setItem(VOKAFE_JWT_STORAGE_KEY, nextToken);
    localStorage.setItem(VOKAFE_USER_STORAGE_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(VOKAFE_JWT_STORAGE_KEY);
    localStorage.removeItem(VOKAFE_USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
      } catch {
        throw new AuthError('NETWORK_ERROR', 'Unable to reach the server. Please try again.');
      }

      if (response.status === 401) {
        // Generic — never reveal which field is wrong.
        throw new AuthError('INVALID_CREDENTIALS', 'Invalid credentials');
      }

      if (!response.ok) {
        const message = (await readErrorMessage(response)) ?? 'Login failed';
        throw new AuthError(
          response.status === 400 ? 'VALIDATION_ERROR' : 'UNKNOWN',
          message,
        );
      }

      const body: unknown = await response.json().catch(() => null);
      if (!isAuthSuccessResponse(body)) {
        throw new AuthError('UNKNOWN', 'Unexpected response from server');
      }

      persistSession(body.token, { email: body.user.email, name: body.user.name });
    },
    [baseUrl, persistSession],
  );

  const register = useCallback(
    async (email: string, name: string, password: string): Promise<void> => {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name, password }),
        });
      } catch {
        throw new AuthError('NETWORK_ERROR', 'Unable to reach the server. Please try again.');
      }

      if (response.status === 409) {
        throw new AuthError('DUPLICATE_EMAIL', 'Email is already registered');
      }

      if (response.status === 400) {
        const message = (await readErrorMessage(response)) ?? 'Invalid registration data';
        throw new AuthError('VALIDATION_ERROR', message);
      }

      if (!response.ok) {
        const message = (await readErrorMessage(response)) ?? 'Registration failed';
        throw new AuthError('UNKNOWN', message);
      }

      const body: unknown = await response.json().catch(() => null);
      if (!isAuthSuccessResponse(body)) {
        throw new AuthError('UNKNOWN', 'Unexpected response from server');
      }

      // Backend auto-issues a customer JWT on successful registration so
      // we can drop the user straight into the authenticated shell
      // (Requirement 13.13).
      persistSession(body.token, { email: body.user.email, name: body.user.name });
    },
    [baseUrl, persistSession],
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthState>(
    () => ({
      isAuthenticated: token !== null && user !== null,
      user,
      token,
      isLoading,
      login,
      register,
      logout,
    }),
    [token, user, isLoading, login, register, logout],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
