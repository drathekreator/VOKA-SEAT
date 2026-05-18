/**
 * RegisterScreen — Customer App registration view.
 *
 * After the Section-21 auth rewrite, the form collects email + name +
 * password + confirmation (in that order) instead of the legacy NIM
 * fields (Requirements 20.6–20.10, 13.9).
 *
 * Behavior (Requirements 13.9–13.13):
 *   - Client-side validation BEFORE calling register():
 *       * Email matches /^[^\s@]+@[^\s@]+\.[^\s@]+$/ and is ≤ 254 chars
 *       * Full name trimmed non-empty, ≤ 100 characters
 *       * Password ≥ 8 characters
 *       * Password confirmation matches password
 *   - Submit invokes useAuth().register(email, name, password) which
 *     POSTs /api/auth/register and auto-authenticates on success.
 *   - AuthError mapping:
 *       * DUPLICATE_EMAIL  → inline email-field error
 *         (Requirement 13.11 / "This email is already registered")
 *       * VALIDATION_ERROR → server message attached to the most
 *         relevant field by heuristic, falling back to form-level
 *       * NETWORK_ERROR    → form-level "Unable to reach the server."
 *       * UNKNOWN          → form-level "Registration failed"
 *   - On success: useAuth has already authenticated; we fire
 *     onRegisterSuccess so the parent shell can dismiss the auth
 *     screen and route to the customer app (Requirement 13.13).
 */
import { useState, type FormEvent } from 'react';
import { AuthError, useAuth } from './useAuth';

export interface RegisterScreenProps {
  /** Invoked when the user taps the "Login here" footer link. */
  onNavigateToLogin?: () => void;
  /**
   * Invoked after a successful registration. By the time this fires the
   * useAuth hook has already auto-authenticated the new user, so the shell
   * just needs to dismiss the auth screen (Requirement 13.13).
   */
  onRegisterSuccess?: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;
const NAME_MAX_LENGTH = 100;
const PASSWORD_MIN_LENGTH = 8;

export default function RegisterScreen({
  onNavigateToLogin,
  onRegisterSuccess,
}: RegisterScreenProps) {
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [emailError, setEmailError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearErrors = () => {
    setEmailError(null);
    setNameError(null);
    setPasswordError(null);
    setConfirmError(null);
    setFormError(null);
  };

  /**
   * Run the client-side validation rules listed in Requirement 13.9.
   * Returns true and populates inline errors when invalid.
   */
  const validate = (): { ok: true; email: string } | { ok: false } => {
    clearErrors();
    let invalid = false;

    const normalizedEmail = email.trim().toLowerCase();
    if (
      normalizedEmail.length === 0 ||
      normalizedEmail.length > EMAIL_MAX_LENGTH ||
      !EMAIL_REGEX.test(normalizedEmail)
    ) {
      setEmailError('Please enter a valid email address');
      invalid = true;
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setNameError('Full name is required');
      invalid = true;
    } else if (trimmedName.length > NAME_MAX_LENGTH) {
      setNameError(`Full name must be at most ${NAME_MAX_LENGTH} characters`);
      invalid = true;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setPasswordError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
      invalid = true;
    }

    if (confirmPassword !== password) {
      setConfirmError('Passwords do not match');
      invalid = true;
    }

    return invalid ? { ok: false } : { ok: true, email: normalizedEmail };
  };

  /**
   * Take a backend-returned VALIDATION_ERROR message and try to attach it
   * to the most appropriate field. Falls back to a form-level error.
   */
  const applyServerValidationError = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes('email')) {
      setEmailError(message);
      return;
    }
    if (lower.includes('password')) {
      setPasswordError(message);
      return;
    }
    if (lower.includes('name')) {
      setNameError(message);
      return;
    }
    setFormError(message);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const result = validate();
    if (!result.ok) return;

    setIsSubmitting(true);
    try {
      await register(result.email, name.trim(), password);
      // useAuth has already auto-authenticated the new user.
      onRegisterSuccess?.();
    } catch (err) {
      if (err instanceof AuthError) {
        switch (err.code) {
          case 'DUPLICATE_EMAIL':
            setEmailError('This email is already registered');
            break;
          case 'VALIDATION_ERROR':
            applyServerValidationError(err.message);
            break;
          case 'NETWORK_ERROR':
            setFormError('Unable to reach the server. Please try again.');
            break;
          default:
            setFormError('Registration failed');
            break;
        }
      } else {
        setFormError('Registration failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      data-testid="register-screen"
      className="bg-surface text-on-surface min-h-screen flex flex-col justify-center items-center p-margin-mobile md:p-margin-tablet"
    >
      <section className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-md3-card p-lg md:p-xl flex flex-col gap-lg">
        {/* Header — Requirement 18.11, 20.7 */}
        <header className="flex flex-col items-center gap-sm text-center">
          <img
            src="/logo-vokafe.svg"
            alt="VOKAFE Logo"
            className="h-12 w-auto"
            data-testid="register-screen-logo"
          />
          <h1
            className="font-headline-md text-headline-md text-on-surface"
            data-testid="register-screen-headline"
          >
            Create Account
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Sign up to track your orders at VOKAFE.
          </p>
        </header>

        {/* Form — Requirement 20.8 (email → name → password → confirm) */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-md"
          data-testid="register-form"
          noValidate
        >
          {/* Email — leading "mail" icon */}
          <div className="flex flex-col gap-xs">
            <label
              htmlFor="register-email"
              className="font-label-sm text-label-sm text-on-surface ml-xs"
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
                id="register-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                  setFormError(null);
                }}
                placeholder="you@example.com"
                required
                aria-invalid={emailError !== null}
                aria-describedby={emailError ? 'register-email-error' : undefined}
                data-testid="register-email-input"
                className={`w-full h-12 pl-10 pr-md rounded-lg bg-surface-bright text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant outline-none transition-colors border ${
                  emailError
                    ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
                    : 'border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary'
                }`}
              />
            </div>
            {emailError && (
              <p
                id="register-email-error"
                className="font-body-sm text-body-sm text-error ml-xs"
                data-testid="register-email-error"
              >
                {emailError}
              </p>
            )}
          </div>

          {/* Full name — leading "person" icon */}
          <div className="flex flex-col gap-xs">
            <label
              htmlFor="register-name"
              className="font-label-sm text-label-sm text-on-surface ml-xs"
            >
              Full Name
            </label>
            <div className="relative">
              <span
                aria-hidden="true"
                className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
              >
                person
              </span>
              <input
                id="register-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                  setFormError(null);
                }}
                placeholder="Jane Doe"
                maxLength={NAME_MAX_LENGTH}
                required
                aria-invalid={nameError !== null}
                aria-describedby={nameError ? 'register-name-error' : undefined}
                data-testid="register-name-input"
                className={`w-full h-12 pl-10 pr-md rounded-lg bg-surface-bright text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant outline-none transition-colors border ${
                  nameError
                    ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
                    : 'border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary'
                }`}
              />
            </div>
            {nameError && (
              <p
                id="register-name-error"
                className="font-body-sm text-body-sm text-error ml-xs"
                data-testid="register-name-error"
              >
                {nameError}
              </p>
            )}
          </div>

          {/* Password — leading "lock" icon */}
          <div className="flex flex-col gap-xs">
            <label
              htmlFor="register-password"
              className="font-label-sm text-label-sm text-on-surface ml-xs"
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
                id="register-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(null);
                  setFormError(null);
                }}
                placeholder="At least 8 characters"
                required
                aria-invalid={passwordError !== null}
                aria-describedby={
                  passwordError ? 'register-password-error' : undefined
                }
                data-testid="register-password-input"
                className={`w-full h-12 pl-10 pr-md rounded-lg bg-surface-bright text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant outline-none transition-colors border ${
                  passwordError
                    ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
                    : 'border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary'
                }`}
              />
            </div>
            {passwordError && (
              <p
                id="register-password-error"
                className="font-body-sm text-body-sm text-error ml-xs"
                data-testid="register-password-error"
              >
                {passwordError}
              </p>
            )}
          </div>

          {/* Password confirmation — leading "lock_reset" icon */}
          <div className="flex flex-col gap-xs">
            <label
              htmlFor="register-confirm-password"
              className="font-label-sm text-label-sm text-on-surface ml-xs"
            >
              Confirm Password
            </label>
            <div className="relative">
              <span
                aria-hidden="true"
                className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
              >
                lock_reset
              </span>
              <input
                id="register-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmError(null);
                  setFormError(null);
                }}
                placeholder="Re-enter password"
                required
                aria-invalid={confirmError !== null}
                aria-describedby={
                  confirmError ? 'register-confirm-password-error' : undefined
                }
                data-testid="register-confirm-password-input"
                className={`w-full h-12 pl-10 pr-md rounded-lg bg-surface-bright text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant outline-none transition-colors border ${
                  confirmError
                    ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
                    : 'border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary'
                }`}
              />
            </div>
            {confirmError && (
              <p
                id="register-confirm-password-error"
                className="font-body-sm text-body-sm text-error ml-xs"
                data-testid="register-confirm-password-error"
              >
                {confirmError}
              </p>
            )}
          </div>

          {formError && (
            <p
              role="alert"
              className="font-body-sm text-body-sm text-error text-center"
              data-testid="register-form-error"
            >
              {formError}
            </p>
          )}

          {/* Submit — Requirement 18.17, 20.9 */}
          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="register-submit"
            className="mt-sm w-full h-12 bg-primary text-on-primary font-label-md text-label-md rounded-xl shadow-primary-glow hover:bg-primary-container active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-sm"
          >
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* Footer — Requirement 20.10, 20.12 */}
        <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onNavigateToLogin}
            className="font-label-md text-label-md text-primary hover:text-primary-container transition-colors active:scale-95 bg-transparent border-none p-0 cursor-pointer"
            data-testid="register-navigate-to-login"
          >
            Login here
          </button>
        </p>
      </section>
    </main>
  );
}
