import { useState, type FormEvent } from 'react';
import { AuthError, useAuth } from './useAuth';

/**
 * LoginScreen — Customer App login screen.
 *
 * After the Section-21 auth rewrite, the first field is **email**
 * (Requirements 13.4, 13.6, 20.3). The legacy NIM identifier is gone.
 *
 * Visual contract follows design.md "Additional views (outside the tab
 * bar)" / Requirement 20.1–20.5 / 20.11:
 *   - Centered card on bg-surface, surface-container-lowest background,
 *     xl rounded corners, ambient shadow.
 *   - VOKAFE_Brand_Logo at the top of the card.
 *   - Headline "Welcome Back" + subline "Please enter your details to
 *     sign in." in font-headline-md / font-body-md.
 *   - Email input with leading "mail" icon, password input with leading
 *     "lock" icon. Both 48px tall on bg-surface-bright with
 *     outline-variant border.
 *   - Primary "Login" button with the rounded-xl glow-shadow style from
 *     Requirement 18.17.
 *   - Footer "Don't have an account? Sign Up" link.
 *
 * Behavior:
 *   - Client-side validates email against `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
 *     (Requirement 13.6 / Property 12) before calling the API.
 *   - All AuthError codes collapse to a single generic "Invalid
 *     credentials" form-level error to avoid revealing which field is
 *     wrong (Requirement 13.2).
 *   - Calls onLoginSuccess after a successful login so the parent shell
 *     can dismiss the auth screen.
 *   - Calls onNavigateToRegister when the Sign Up footer link is tapped.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;
const EMAIL_FORMAT_ERROR = 'Please enter a valid email address';
const GENERIC_LOGIN_ERROR = 'Invalid credentials';

export interface LoginScreenProps {
  /**
   * Invoked after a successful login completes. The parent shell uses
   * this hook to dismiss the auth screen and route to the customer app.
   */
  onLoginSuccess?: () => void;
  /**
   * Invoked when the customer taps the "Sign Up" footer link. The shell
   * uses this hook to navigate to the Register screen within 300ms per
   * Requirement 20.11.
   */
  onNavigateToRegister?: () => void;
}

export default function LoginScreen({
  onLoginSuccess,
  onNavigateToRegister,
}: LoginScreenProps) {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setEmailError(null);

    const normalized = email.trim().toLowerCase();
    if (normalized.length === 0 || normalized.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(normalized)) {
      setEmailError(EMAIL_FORMAT_ERROR);
      return;
    }

    setIsSubmitting(true);
    try {
      await login(normalized, password);
      onLoginSuccess?.();
    } catch (err) {
      // Per Requirement 13.2 we never reveal which field is wrong, so
      // INVALID_CREDENTIALS, NETWORK_ERROR, VALIDATION_ERROR, etc. all
      // collapse to the same generic message below the form.
      setFormError(err instanceof AuthError ? GENERIC_LOGIN_ERROR : GENERIC_LOGIN_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUpClick = () => {
    onNavigateToRegister?.();
  };

  return (
    <div
      className="min-h-screen w-full bg-surface flex items-center justify-center p-margin-mobile"
      data-testid="login-screen"
    >
      <div
        className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-md3-card p-margin-tablet flex flex-col items-center"
        data-testid="login-card"
      >
        {/* VOKAFE_Brand_Logo at top of card (Requirement 20.2 / 18.11) */}
        <div className="mb-xl flex justify-center w-full">
          <img
            src="/logo-vokafe.svg"
            alt="VOKAFE"
            className="h-12 w-auto"
            data-testid="login-logo"
          />
        </div>

        {/* Headline + subline (Requirement 20.2) */}
        <h1
          className="font-headline-md text-headline-md text-on-surface mb-sm text-center w-full"
          data-testid="login-headline"
        >
          Welcome Back
        </h1>
        <p
          className="font-body-md text-body-md text-on-surface-variant mb-lg text-center w-full"
          data-testid="login-subline"
        >
          Please enter your details to sign in.
        </p>

        <form
          className="w-full space-y-md"
          onSubmit={handleSubmit}
          data-testid="login-form"
          noValidate
        >
          {/* Email input with leading "mail" icon (Requirement 20.3) */}
          <div className="w-full">
            <label
              htmlFor="login-email"
              className="block font-label-md text-label-md text-on-surface mb-xs"
            >
              Email
            </label>
            <div className="relative">
              <span
                aria-hidden="true"
                className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
              >
                mail
              </span>
              <input
                id="login-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailError(null);
                  setFormError(null);
                }}
                placeholder="you@example.com"
                disabled={isSubmitting}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? 'login-email-error' : undefined}
                data-testid="login-email-input"
                className={`w-full h-12 pl-10 pr-sm py-sm rounded-lg bg-surface-bright text-on-surface font-body-md text-body-md border outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${
                  emailError ? 'border-error' : 'border-outline-variant'
                }`}
              />
            </div>
            {emailError && (
              <p
                id="login-email-error"
                role="alert"
                className="mt-xs font-body-sm text-body-sm text-error"
                data-testid="login-email-error"
              >
                {emailError}
              </p>
            )}
          </div>

          {/* Password input with leading "lock" icon (Requirement 20.3) */}
          <div className="w-full">
            <label
              htmlFor="login-password"
              className="block font-label-md text-label-md text-on-surface mb-xs"
            >
              Password
            </label>
            <div className="relative">
              <span
                aria-hidden="true"
                className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
              >
                lock
              </span>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFormError(null);
                }}
                placeholder="Enter your password"
                disabled={isSubmitting}
                data-testid="login-password-input"
                className="w-full h-12 pl-10 pr-sm py-sm rounded-lg bg-surface-bright text-on-surface font-body-md text-body-md border border-outline-variant outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Generic form-level error (Requirement 13.2) */}
          {formError && (
            <p
              role="alert"
              className="font-body-sm text-body-sm text-error text-center"
              data-testid="login-form-error"
            >
              {formError}
            </p>
          )}

          {/* Primary "Login" button (Requirements 20.4, 18.17, 18.18) */}
          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="login-submit"
            className="w-full h-12 mt-lg rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-primary-glow hover:bg-primary-container active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Footer "Sign Up" link (Requirement 20.5, 20.11) */}
        <p
          className="mt-lg font-body-sm text-body-sm text-on-surface-variant text-center w-full"
          data-testid="login-footer"
        >
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={handleSignUpClick}
            className="font-label-md text-label-md text-primary hover:text-primary-container active:scale-95 transition-colors bg-transparent border-none cursor-pointer p-0"
            data-testid="login-signup-link"
          >
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );
}
