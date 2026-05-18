/**
 * @deprecated NIM validation is no longer used. The auth model rewrite
 * (Section 21 of tasks.md) replaced NIM with email as the customer
 * identifier. Use `validateEmail` from `./emailValidator` instead.
 *
 * This file remains as a thin deprecation shim so any stale imports
 * still compile during the cutover. Remove this file once all callers
 * have been migrated.
 */

import { validateEmail, type EmailValidationResult } from './emailValidator';

/** @deprecated Use {@link EmailValidationResult} from `./emailValidator`. */
export type NIMValidationResult = EmailValidationResult;

/**
 * @deprecated Use {@link validateEmail} instead. Forwards the call so
 * legacy callers do not crash; new code should not use this export.
 */
export function validateNIM(input: string): NIMValidationResult {
  return validateEmail(input);
}
