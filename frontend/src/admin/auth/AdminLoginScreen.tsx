/**
 * AdminLoginScreen — Admin Dashboard sign-in screen.
 *
 * Visual contract per Requirement 21.1: centered card, VOKAFE logo,
 * username + password fields, single "Sign In" button. The screen
 * never reveals which field is wrong on a 401 (Requirement 21.3) — the
 * error collapses to a generic "Invalid credentials" inline message.
 *
 * The Admin_Dashboard's flat utility palette is used here (white
 * surface, slate text, magenta primary) to keep the admin chrome
 * visually consistent with the rest of the dashboard.
 */
import { useState, type FormEvent } from 'react';
import { AdminAuthError, useAdminAuth } from './useAdminAuth';

export interface AdminLoginScreenProps {
  /** Optional hook fired after a successful login. */
  onLoginSuccess?: () => void;
}

const GENERIC_LOGIN_ERROR = 'Invalid credentials';

export default function AdminLoginScreen({ onLoginSuccess }: AdminLoginScreenProps) {
  const { login } = useAdminAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (username.trim().length === 0 || password.length === 0) {
      // Generic error — Requirement 21.3 forbids field-specific hints.
      setFormError(GENERIC_LOGIN_ERROR);
      return;
    }

    setIsSubmitting(true);
    try {
      await login(username.trim(), password);
      onLoginSuccess?.();
    } catch (err) {
      // Any AdminAuthError collapses to the generic message. Network
      // errors get the same treatment so the admin login screen is
      // intentionally indistinguishable across failure modes.
      setFormError(err instanceof AdminAuthError ? GENERIC_LOGIN_ERROR : GENERIC_LOGIN_ERROR);
      // Clear the password field after a failed attempt per the
      // error-handling matrix in design.md.
      setPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#F3F4F6] flex items-center justify-center px-4 py-8"
      data-testid="admin-login-screen"
    >
      <div
        className="w-full max-w-md bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] p-6 sm:p-8 flex flex-col items-center gap-5"
        data-testid="admin-login-card"
      >
        <img
          src="/logo-vokafe.svg"
          alt="VOKAFE"
          className="h-12 w-auto"
          data-testid="admin-login-logo"
        />

        <div className="text-center">
          <h1
            className="text-xl font-semibold text-[#1E293B]"
            data-testid="admin-login-headline"
          >
            Admin Dashboard
          </h1>
          <p className="text-sm text-[#475569] mt-1">
            Sign in with your operator credentials.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="w-full flex flex-col gap-4"
          data-testid="admin-login-form"
          noValidate
        >
          <div>
            <label
              htmlFor="admin-login-username"
              className="block text-sm font-medium text-[#1E293B] mb-1"
            >
              Username
            </label>
            <input
              id="admin-login-username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setFormError(null);
              }}
              placeholder="admin"
              disabled={isSubmitting}
              data-testid="admin-login-username-input"
              className="w-full h-11 px-3 rounded-lg bg-white text-[#1E293B] border border-[#E5E7EB] focus:border-[#D81B60] focus:ring-1 focus:ring-[#D81B60] outline-none transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="admin-login-password"
              className="block text-sm font-medium text-[#1E293B] mb-1"
            >
              Password
            </label>
            <input
              id="admin-login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFormError(null);
              }}
              placeholder="••••••••"
              disabled={isSubmitting}
              data-testid="admin-login-password-input"
              className="w-full h-11 px-3 rounded-lg bg-white text-[#1E293B] border border-[#E5E7EB] focus:border-[#D81B60] focus:ring-1 focus:ring-[#D81B60] outline-none transition-colors"
            />
          </div>

          {formError && (
            <p
              role="alert"
              className="text-sm text-red-600 text-center"
              data-testid="admin-login-form-error"
            >
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="admin-login-submit"
            className="w-full h-11 mt-2 rounded-lg bg-[#D81B60] text-white font-semibold shadow-[0_4px_12px_rgba(216,27,96,0.18)] hover:bg-[#B91553] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-xs text-[#475569] text-center">
          Default admin account is seeded from <code className="px-1 bg-[#F3F4F6] rounded">ADMIN_USERNAME</code> and
          <code className="px-1 bg-[#F3F4F6] rounded ml-1">ADMIN_PASSWORD</code> in <code className="px-1 bg-[#F3F4F6] rounded">backend/.env</code>.
        </p>
      </div>
    </div>
  );
}
