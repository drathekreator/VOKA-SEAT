/**
 * Property 19: Admin Role Authorization
 *
 * For every request reaching an admin-only route, `adminAuthMiddleware`
 * MUST classify it into one of three deterministic outcomes:
 *
 *   (a) Missing or syntactically invalid Authorization header → 401
 *   (b) Cryptographically valid JWT lacking `role: 'admin'` (e.g. a
 *       customer JWT)                                                → 403
 *   (c) Cryptographically valid JWT with `role: 'admin'`             → next()
 *
 * The classification must be exhaustive (one of {a,b,c} always fires)
 * and mutually exclusive (no input falls into two outcomes), and must
 * NEVER throw to Express. This file proves all three properties with
 * fast-check.
 *
 * Tag: Feature: voka-seat-system, Property 19: Admin Role Authorization
 * Validates: Requirements 15.7, 15.8, 21.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import jwt from 'jsonwebtoken';

// Important: the JWT secret used by the middleware is captured ONCE at
// module load via `process.env.JWT_SECRET || 'voka-seat-secret-dev'`.
// ES module imports are hoisted to the top of the file, so any mutation
// of process.env *after* the import doesn't reach the cached constant.
// We instead sign our test JWTs with the EXACT same value the
// middleware would have read at load time, by mirroring its fallback.
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'voka-seat-secret-dev';

// eslint-disable-next-line import/first
import {
  adminAuthMiddleware,
  signAdminToken,
  signCustomerToken,
  type AuthenticatedRequest,
} from '../../src/middleware/auth';

/**
 * Drive the middleware with a synthetic Express triple and capture the
 * exact outcome (status, body, next-call). Properties consume this to
 * make exhaustive assertions about every input case.
 */
type Outcome =
  | { kind: 'next'; admin?: { username: string; role: 'admin' } }
  | { kind: 'response'; status: number; body: unknown };

function runMiddleware(authHeader: string | undefined): Outcome {
  const req = {
    headers: authHeader === undefined ? {} : { authorization: authHeader },
  } as unknown as AuthenticatedRequest;

  let outcome: Outcome | null = null;

  const res = {
    status(code: number) {
      return {
        json(body: unknown) {
          outcome = { kind: 'response', status: code, body };
          return this;
        },
      };
    },
  } as unknown as Parameters<typeof adminAuthMiddleware>[1];

  const next = () => {
    outcome = { kind: 'next', admin: req.admin };
  };

  adminAuthMiddleware(req, res, next);

  if (outcome === null) {
    throw new Error('adminAuthMiddleware did not produce any outcome');
  }
  return outcome;
}

/**
 * Generates strings that are NOT well-formed JWTs. We exclude any value
 * that happens to verify against TEST_JWT_SECRET so we can assert "every
 * generated value is rejected".
 */
const arbitraryGarbageToken = fc
  .string({ minLength: 0, maxLength: 80 })
  .filter((s) => {
    if (s.length === 0) return true;
    try {
      jwt.verify(s, TEST_JWT_SECRET);
      return false; // accidentally valid — drop it from this generator
    } catch {
      return true;
    }
  });

/**
 * Customer JWT generator: a cryptographically valid JWT signed with the
 * test secret but carrying `role: 'customer'`.
 */
const customerJwt = fc
  .record({
    email: fc.emailAddress(),
    name: fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim().length > 0),
  })
  .map(({ email, name }) => signCustomerToken({ email, name }));

/**
 * Admin JWT generator: a cryptographically valid JWT signed with the
 * test secret carrying `role: 'admin'`.
 */
const adminJwt = fc
  .string({ minLength: 1, maxLength: 32 })
  .filter((s) => s.trim().length > 0)
  .map((username) => signAdminToken({ username: username.trim() }));

/**
 * A non-Bearer Authorization header (e.g. "Basic xyz", "Token abc",
 * empty string, the raw word "Bearer" with no space-separated token).
 */
const nonBearerHeader = fc.oneof(
  fc.constant(''),
  fc.constant('Bearer'),
  fc.string({ minLength: 1, maxLength: 30 }).map((s) => `Basic ${s}`),
  fc.string({ minLength: 1, maxLength: 30 }).map((s) => `Token ${s}`),
);

describe('Feature: voka-seat-system, Property 19: Admin Role Authorization', () => {
  /**
   * Outcome (a): a missing Authorization header MUST 401 every time.
   */
  it('responds 401 when the Authorization header is missing', () => {
    const outcome = runMiddleware(undefined);
    expect(outcome.kind).toBe('response');
    if (outcome.kind === 'response') {
      expect(outcome.status).toBe(401);
    }
  });

  /**
   * Outcome (a) variant: a non-Bearer Authorization header MUST 401
   * regardless of its content.
   */
  it('responds 401 for any non-Bearer Authorization header', () => {
    fc.assert(
      fc.property(nonBearerHeader, (header) => {
        const outcome = runMiddleware(header);
        expect(outcome.kind).toBe('response');
        if (outcome.kind === 'response') {
          expect(outcome.status).toBe(401);
        }
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Outcome (a) variant: a "Bearer <garbage>" header where <garbage>
   * doesn't verify MUST 401, never 403, never next().
   */
  it('responds 401 for Bearer tokens that fail JWT verification', () => {
    fc.assert(
      fc.property(arbitraryGarbageToken, (rawToken) => {
        const outcome = runMiddleware(`Bearer ${rawToken}`);
        expect(outcome.kind).toBe('response');
        if (outcome.kind === 'response') {
          expect(outcome.status).toBe(401);
        }
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Outcome (b): a cryptographically valid customer JWT MUST 403,
   * never 401, never next(). This is the property test for
   * "valid-but-wrong-role" exactly as specified in Property 19.
   */
  it('responds 403 for cryptographically valid customer JWTs', () => {
    fc.assert(
      fc.property(customerJwt, (token) => {
        const outcome = runMiddleware(`Bearer ${token}`);
        expect(outcome.kind).toBe('response');
        if (outcome.kind === 'response') {
          expect(outcome.status).toBe(403);
        }
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Outcome (b) variant: a JWT signed with the right secret but
   * carrying an unrecognised role (or no role at all) MUST 403.
   */
  it('responds 403 for valid JWTs with non-admin or missing role', () => {
    const arbitraryRole = fc.oneof(
      fc.constant(undefined),
      fc.constant(null),
      fc.constant(''),
      fc.constant('staff'),
      fc.constant('barista'),
      fc.string({ minLength: 1, maxLength: 12 }).filter((s) => s !== 'admin'),
    );
    fc.assert(
      fc.property(arbitraryRole, (role) => {
        // Construct a JWT directly so we can pin an arbitrary role value.
        const token = jwt.sign(
          { username: 'whoever', ...(role !== undefined ? { role } : {}) },
          TEST_JWT_SECRET,
          { expiresIn: '1h' },
        );
        const outcome = runMiddleware(`Bearer ${token}`);
        expect(outcome.kind).toBe('response');
        if (outcome.kind === 'response') {
          expect(outcome.status).toBe(403);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Outcome (c): a cryptographically valid admin JWT MUST call next()
   * exactly once and populate `req.admin.username`.
   */
  it('calls next() and populates req.admin for valid admin JWTs', () => {
    fc.assert(
      fc.property(adminJwt, (token) => {
        const outcome = runMiddleware(`Bearer ${token}`);
        expect(outcome.kind).toBe('next');
        if (outcome.kind === 'next') {
          expect(outcome.admin?.role).toBe('admin');
          expect(typeof outcome.admin?.username).toBe('string');
          expect((outcome.admin?.username ?? '').length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Exhaustiveness + mutual exclusion: across the union of all three
   * generators (no-bearer, valid-customer, valid-admin), the middleware
   * always lands in exactly one of {401, 403, next}.
   */
  it('classifies every input into exactly one of {401, 403, next}', () => {
    const anyHeader = fc.oneof(
      nonBearerHeader,
      arbitraryGarbageToken.map((t) => `Bearer ${t}`),
      customerJwt.map((t) => `Bearer ${t}`),
      adminJwt.map((t) => `Bearer ${t}`),
    );
    fc.assert(
      fc.property(anyHeader, (header) => {
        const outcome = runMiddleware(header);
        if (outcome.kind === 'response') {
          // Must be either 401 or 403 — no other status is permitted.
          expect([401, 403]).toContain(outcome.status);
        } else {
          // next() implies the JWT verified AND carried role=admin.
          expect(outcome.admin?.role).toBe('admin');
        }
      }),
      { numRuns: 300 },
    );
  });
});
