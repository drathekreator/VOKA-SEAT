/**
 * AdminAppShell — auth gate that wraps the existing Admin Dashboard.
 *
 * Renders the AdminLoginScreen until the operator authenticates, then
 * mounts the existing `<App />` (the Admin Dashboard root). All admin
 * API calls inside `<App />` reach the backend through the shared
 * `adminFetch` helper, which automatically attaches the `Authorization`
 * header from `localStorage[vokafe_admin_jwt]` and triggers a logout on
 * 401/403 responses (Requirement 21.5).
 *
 * The login state lives in `<AdminAuthProvider>`, separate from the
 * customer auth context — there is no shared identity between the two
 * apps.
 */
import App from '../App';
import AdminLoginScreen from './auth/AdminLoginScreen';
import { AdminAuthProvider, useAdminAuth } from './auth/useAdminAuth';

export default function AdminAppShell() {
  return (
    <AdminAuthProvider>
      <AdminAppGate />
    </AdminAuthProvider>
  );
}

function AdminAppGate() {
  const { isAuthenticated, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div
        className="min-h-screen w-full bg-[#F3F4F6] flex items-center justify-center"
        role="status"
        aria-label="Loading"
        data-testid="admin-app-loading"
      >
        <div
          className="w-10 h-10 border-4 border-[#D81B60] border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLoginScreen />;
  }

  return <App />;
}
