import type { Request, Response, NextFunction } from 'express';

/**
 * Dangerous characters and sequences to strip from input strings.
 * These enable SQL injection or XSS attacks.
 */
const DANGEROUS_PATTERNS: Array<string | RegExp> = [
  /<script>/gi,
  /<\/script>/gi,
  /--/g,
  /</g,
  />/g,
  /'/g,
  /"/g,
  /;/g,
];

/**
 * Sanitizes a single string input by removing dangerous characters/sequences
 * that could enable SQL injection or XSS attacks.
 *
 * Characters/sequences removed:
 * - `<script>` and `</script>` tags (XSS)
 * - `--` (SQL comment injection)
 * - `<` and `>` (XSS)
 * - `'` and `"` (SQL injection)
 * - `;` (SQL injection)
 */
export function sanitize(input: string): string {
  let result = input;
  for (const pattern of DANGEROUS_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result;
}

/**
 * Recursively sanitizes all string values in an object or array.
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitize(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }
  return value;
}

/**
 * Sanitizes string values in-place on an existing object (mutates the object).
 * This is necessary because in Express 5 some request properties (e.g. req.query)
 * are read-only getters and cannot be reassigned.
 */
function sanitizeInPlace(target: Record<string, unknown>): void {
  for (const key of Object.keys(target)) {
    const value = target[key];
    if (typeof value === 'string') {
      target[key] = sanitize(value);
    } else if (Array.isArray(value)) {
      target[key] = value.map(sanitizeValue);
    } else if (value !== null && typeof value === 'object') {
      sanitizeInPlace(value as Record<string, unknown>);
    }
  }
}

/**
 * Express middleware that recursively sanitizes all string values
 * in req.body, req.query, and req.params before they reach
 * the database layer or are broadcast to clients.
 */
export function sanitizerMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  // In Express 5, req.query and req.params are read-only getters — mutate in place.
  if (req.query && typeof req.query === 'object') {
    sanitizeInPlace(req.query as Record<string, unknown>);
  }
  if (req.params && typeof req.params === 'object') {
    sanitizeInPlace(req.params as Record<string, unknown>);
  }
  next();
}
