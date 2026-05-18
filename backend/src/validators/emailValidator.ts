/**
 * Email format validator. Replaces the prior NIM validator.
 *
 * Validates that an input string conforms to a permissive RFC 5322-style
 * regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) and is at most 254 characters,
 * matching Requirement 13.6 / 14.1 / Property 12.
 *
 * The regex is intentionally simple — it matches the same shape as the
 * Customer App client-side validator, so the two never disagree about
 * what counts as a "valid email" for VOKA-SEAT preview purposes.
 */

export type EmailValidationResult =
  | { valid: true }
  | { valid: false; error: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export function validateEmail(input: unknown): EmailValidationResult {
  if (typeof input !== 'string') {
    return { valid: false, error: 'Email must be a string' };
  }
  if (input.length === 0) {
    return { valid: false, error: 'Email must not be empty' };
  }
  if (input.length > MAX_EMAIL_LENGTH) {
    return { valid: false, error: `Email must be at most ${MAX_EMAIL_LENGTH} characters` };
  }
  if (!EMAIL_REGEX.test(input)) {
    return { valid: false, error: 'Email format is invalid' };
  }
  return { valid: true };
}

export const EMAIL_FORMAT_REGEX = EMAIL_REGEX;
export const EMAIL_MAX_LENGTH = MAX_EMAIL_LENGTH;
