import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'voka-seat-secret-dev';

/** Roles carried by JWT payloads. Customer JWTs are issued by
 *  POST /api/auth/login and POST /api/auth/register; admin JWTs are
 *  issued by POST /api/auth/admin/login (Requirement 15.7).
 */
export type AuthRole = 'customer' | 'admin';

/** Customer JWT payload — issued on login/register. */
export interface CustomerAuthPayload {
  email: string;
  name: string;
  role: 'customer';
}

/** Admin JWT payload — issued on admin login. */
export interface AdminAuthPayload {
  username: string;
  role: 'admin';
}

export type AuthPayload = CustomerAuthPayload | AdminAuthPayload;

/**
 * Extends Express Request to include decoded JWT payload.
 * `user` is the legacy customer-shaped payload (populated by `authMiddleware`).
 * `admin` is set by `adminAuthMiddleware`.
 */
export interface AuthenticatedRequest extends Request {
  user?: CustomerAuthPayload;
  admin?: AdminAuthPayload;
}

/**
 * Customer JWT authentication middleware.
 *
 * Required only on customer-scoped routes that read user-specific data
 * (Order History, Order Detail, claim-guest-order). Order creation
 * accepts requests with or without this JWT — see {@link tryCustomerAuth}.
 *
 * Returns 401 on missing or invalid token, or when the JWT does not
 * carry `role: 'customer'`.
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    if (decoded.role !== 'customer') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = {
      email: decoded.email,
      name: decoded.name,
      role: 'customer',
    };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * Try to attach customer auth to the request without rejecting on failure.
 *
 * Used by routes (notably `POST /api/orders`) where authentication is
 * optional — see Property 20 ("Optional Customer Auth on Order
 * Creation"). If a valid `role: 'customer'` JWT is present, `req.user`
 * is populated; otherwise the request continues unauthenticated and
 * downstream handlers persist the order as a Guest_Order.
 */
export function tryCustomerAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    if (decoded.role === 'customer') {
      req.user = {
        email: decoded.email,
        name: decoded.name,
        role: 'customer',
      };
    }
  } catch {
    // Swallow invalid/expired tokens silently — the request continues
    // as a guest. Property 20 forbids rejecting solely for missing auth.
  }
  next();
}

/**
 * Admin role middleware.
 *
 * Returns 401 if no/invalid JWT, 403 if the JWT is valid but does not
 * carry `role: 'admin'` (Requirement 15.8 / Property 19). Unlike the
 * customer middleware, this middleware is the sole authentication step
 * for admin routes — there is no separate authMiddleware before it.
 */
export function adminAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    if (decoded.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden — admin role required' });
      return;
    }
    req.admin = { username: decoded.username, role: 'admin' };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * @deprecated Legacy alias for {@link adminAuthMiddleware}. Existing
 * routes that called `adminMiddleware` after `authMiddleware` are being
 * migrated to call `adminAuthMiddleware` directly so the customer
 * middleware never fires on admin routes (and 403 is correctly
 * distinguished from 401).
 */
export const adminMiddleware = adminAuthMiddleware;

/** Sign a customer JWT (24-hour expiry). */
export function signCustomerToken(payload: { email: string; name: string }): string {
  return jwt.sign({ ...payload, role: 'customer' }, JWT_SECRET, { expiresIn: '24h' });
}

/** Sign an admin JWT (24-hour expiry). */
export function signAdminToken(payload: { username: string }): string {
  return jwt.sign({ ...payload, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
}

/**
 * @deprecated Use {@link signCustomerToken}. Retained as a thin wrapper
 * so legacy callers continue to compile. Defaults to a customer JWT.
 */
export function signToken(payload: { email?: string; nim?: string; name: string }): string {
  // Old callers passed `{ nim, name }`. We coerce to email-shaped payload
  // for the cutover; new code should call `signCustomerToken` directly.
  const email = payload.email ?? payload.nim ?? 'unknown@local';
  return signCustomerToken({ email, name: payload.name });
}
