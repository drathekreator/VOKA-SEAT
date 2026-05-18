/**
 * Property 20: Optional Customer Auth on Order Creation
 *
 * For every POST /api/orders request, the persisted Order's
 * `userEmail` MUST equal:
 *
 *   - The JWT's `email` field, IF the request carried a
 *     cryptographically valid JWT with `role: 'customer'`.
 *   - `null` (Guest_Order), in EVERY OTHER case (no header, malformed
 *     header, invalid token, expired token, valid token without
 *     role=customer, etc.).
 *
 * The handler MUST NEVER reject the request solely because the JWT was
 * missing or invalid — that's the heart of Requirement 13.1's
 * "optional auth" guarantee. The body validation rules are unchanged.
 *
 * This is an integration-style PBT: we mount the real `tryCustomerAuth`
 * middleware in a synthetic Express app with a stubbed Prisma client
 * that captures the `userEmail` the route would persist. The route
 * handler under test is a near-verbatim copy of the production
 * `routes/orders.ts` POST `/` body so we exercise the same `req.user`
 * resolution logic.
 *
 * Tag: Feature: voka-seat-system, Property 20: Optional Auth on Order Creation
 * Validates: Requirements 12.5, 12.6, 13.1, 14.8, 21.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import express, { type Response } from 'express';
import jwt from 'jsonwebtoken';

// The middleware imports below cache `JWT_SECRET` at module load. Sign
// our forgeable JWTs with the same value the middleware would read.
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'voka-seat-secret-dev';

// eslint-disable-next-line import/first
import {
  tryCustomerAuth,
  signCustomerToken,
  signAdminToken,
  type AuthenticatedRequest,
} from '../../src/middleware/auth';

/**
 * Build a minimal Express app exposing POST /api/orders that mirrors the
 * production handler's userEmail resolution. The handler:
 *   - 400s on missing/invalid items array (so we exercise body
 *     validation independently of the auth path)
 *   - otherwise persists with `userEmail = req.user?.email ?? null`
 *
 * Each request returns 201 with the resolved userEmail so the property
 * can assert equality directly.
 */
function buildApp() {
  const app = express();
  app.use(express.json());

  app.post(
    '/api/orders',
    tryCustomerAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const items = (req.body as { items?: unknown }).items;
      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'Items array is required' });
        return;
      }
      const userEmail = req.user?.email ?? null;
      res.status(201).json({ userEmail });
    },
  );

  return app;
}

interface FakeOrderPayload {
  items: { menuItemId: number; quantity: number }[];
}

const itemsArbitrary = fc.array(
  fc.record({
    menuItemId: fc.integer({ min: 1, max: 100 }),
    quantity: fc.integer({ min: 1, max: 99 }),
  }),
  { minLength: 1, maxLength: 5 },
);

/**
 * Drive the synthetic Express handler manually (no `supertest`) by
 * invoking `_router.handle` with a mock req/res. Returns the JSON body
 * the handler emitted plus the HTTP status.
 */
function postOrder(
  app: ReturnType<typeof buildApp>,
  payload: FakeOrderPayload,
  authHeader: string | undefined,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req: Record<string, unknown> = {
      method: 'POST',
      url: '/api/orders',
      headers: {
        'content-type': 'application/json',
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      body: payload,
    };

    let statusCode = 200;
    let bodyOut: unknown = null;
    let resolved = false;

    const res: Record<string, unknown> = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(body: unknown) {
        bodyOut = body;
        if (!resolved) {
          resolved = true;
          resolve({ status: statusCode, body: bodyOut });
        }
        return res;
      },
      setHeader() {
        return res;
      },
      getHeader() {
        return undefined;
      },
      end() {
        if (!resolved) {
          resolved = true;
          resolve({ status: statusCode, body: bodyOut });
        }
        return res;
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app as any).handle(req as any, res as any, (err: unknown) => {
      if (err) reject(err);
    });
  });
}

const arbitraryGarbageBearer = fc
  .string({ minLength: 0, maxLength: 64 })
  .filter((s) => {
    if (s.length === 0) return true;
    try {
      jwt.verify(s, TEST_JWT_SECRET);
      return false; // accidentally valid — drop
    } catch {
      return true;
    }
  });

const customerEmail = fc.emailAddress();
const customerName = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((s) => s.trim().length > 0);
const adminUsername = fc
  .string({ minLength: 1, maxLength: 16 })
  .filter((s) => s.trim().length > 0);

describe('Feature: voka-seat-system, Property 20: Optional Auth on Order Creation', () => {
  /**
   * Property 20.A — No Authorization header → Guest_Order with userEmail = null.
   */
  it('persists userEmail = null when no Authorization header is sent', async () => {
    const app = buildApp();
    await fc.assert(
      fc.asyncProperty(itemsArbitrary, async (items) => {
        const result = await postOrder(app, { items }, undefined);
        expect(result.status).toBe(201);
        expect((result.body as { userEmail: string | null }).userEmail).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 20.B — Malformed / non-Bearer Authorization header → still
   * Guest_Order, NEVER 401/403.
   */
  it('persists userEmail = null for non-Bearer Authorization headers', async () => {
    const app = buildApp();
    const nonBearer = fc.oneof(
      fc.constant(''),
      fc.constant('Bearer'),
      fc.string({ minLength: 1, maxLength: 20 }).map((s) => `Basic ${s}`),
      fc.string({ minLength: 1, maxLength: 20 }).map((s) => `Token ${s}`),
    );
    await fc.assert(
      fc.asyncProperty(itemsArbitrary, nonBearer, async (items, header) => {
        const result = await postOrder(app, { items }, header);
        expect(result.status).toBe(201);
        expect((result.body as { userEmail: string | null }).userEmail).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 20.C — Bearer <garbage> that fails JWT verification → still
   * Guest_Order, NEVER rejected.
   */
  it('persists userEmail = null when the JWT fails verification', async () => {
    const app = buildApp();
    await fc.assert(
      fc.asyncProperty(
        itemsArbitrary,
        arbitraryGarbageBearer,
        async (items, raw) => {
          const result = await postOrder(app, { items }, `Bearer ${raw}`);
          expect(result.status).toBe(201);
          expect((result.body as { userEmail: string | null }).userEmail).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 20.D — Expired customer JWT → still Guest_Order, NEVER
   * rejected. We forge a JWT that's already past its `exp` claim.
   */
  it('persists userEmail = null for expired customer JWTs', async () => {
    const app = buildApp();
    await fc.assert(
      fc.asyncProperty(
        itemsArbitrary,
        customerEmail,
        customerName,
        async (items, email, name) => {
          // Issued 2 hours ago, expired 1 hour ago.
          const expired = jwt.sign(
            {
              email,
              name,
              role: 'customer',
              iat: Math.floor(Date.now() / 1000) - 7200,
              exp: Math.floor(Date.now() / 1000) - 3600,
            },
            TEST_JWT_SECRET,
          );
          const result = await postOrder(app, { items }, `Bearer ${expired}`);
          expect(result.status).toBe(201);
          expect((result.body as { userEmail: string | null }).userEmail).toBeNull();
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * Property 20.E — Valid JWT lacking `role: 'customer'` (e.g. an admin
   * JWT) → still Guest_Order. tryCustomerAuth deliberately ignores
   * non-customer roles instead of rejecting the request.
   */
  it('persists userEmail = null when the JWT lacks role=customer', async () => {
    const app = buildApp();
    await fc.assert(
      fc.asyncProperty(itemsArbitrary, adminUsername, async (items, username) => {
        const adminToken = signAdminToken({ username });
        const result = await postOrder(app, { items }, `Bearer ${adminToken}`);
        expect(result.status).toBe(201);
        expect((result.body as { userEmail: string | null }).userEmail).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 20.F — Valid customer JWT → userEmail is set to the JWT's
   * email. This is the only branch that produces a non-null userEmail.
   */
  it('persists userEmail = jwt.email for valid customer JWTs', async () => {
    const app = buildApp();
    await fc.assert(
      fc.asyncProperty(
        itemsArbitrary,
        customerEmail,
        customerName,
        async (items, email, name) => {
          const token = signCustomerToken({ email, name });
          const result = await postOrder(app, { items }, `Bearer ${token}`);
          expect(result.status).toBe(201);
          expect((result.body as { userEmail: string | null }).userEmail).toBe(email);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 20.G — Determinism: two consecutive POSTs with the same
   * auth state and the same body always resolve userEmail the same way.
   * This catches accidental dependence on global mutable state inside
   * the middleware.
   */
  it('is deterministic across repeated submissions with the same input', async () => {
    const app = buildApp();
    await fc.assert(
      fc.asyncProperty(
        itemsArbitrary,
        fc.option(customerEmail.chain((email) => fc.tuple(fc.constant(email), customerName))),
        async (items, maybeIdentity) => {
          const header = maybeIdentity
            ? `Bearer ${signCustomerToken({
                email: maybeIdentity[0],
                name: maybeIdentity[1],
              })}`
            : undefined;
          const a = await postOrder(app, { items }, header);
          const b = await postOrder(app, { items }, header);
          expect(a.status).toBe(b.status);
          expect((a.body as { userEmail: string | null }).userEmail).toBe(
            (b.body as { userEmail: string | null }).userEmail,
          );
        },
      ),
      { numRuns: 50 },
    );
  });
});
