/**
 * adminFetch — fetch wrapper for admin-scoped API calls.
 *
 * Every request automatically attaches `Authorization: Bearer <jwt>`
 * read from `localStorage[vokafe_admin_jwt]`. If the response comes
 * back with HTTP 401 (missing/invalid JWT) or 403 (valid JWT lacking
 * admin role), we drop the stored token and reload the page so the
 * AdminAppShell falls back to the login screen — see Requirement 21.5.
 *
 * Use this helper everywhere the admin app talks to the backend.
 */
import { clearAdminToken, readAdminToken } from './auth/useAdminAuth';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:4000';

export interface AdminFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: HeadersInit;
}

/**
 * Fetch an API endpoint with the admin JWT attached.
 *
 * @param path Either a relative path (`'/api/orders/pending'`) or a
 * fully-qualified URL. Relative paths are resolved against
 * `VITE_API_BASE_URL`.
 */
export async function adminFetch(path: string, options: AdminFetchOptions = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const token = readAdminToken();

  const headers = new Headers(options.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    // Token is no longer trusted by the backend — drop it and bounce
    // the operator to the login screen. We use a soft reload rather
    // than a router redirect because the admin app is mounted inside
    // a shell that re-evaluates auth state on mount.
    clearAdminToken();
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  return response;
}

export { API_BASE_URL as ADMIN_API_BASE_URL };
