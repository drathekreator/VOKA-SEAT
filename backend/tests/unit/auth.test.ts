/**
 * Unit tests for the auth middleware module.
 *
 * After the Section-21 rewrite the middleware exposes three flavours:
 *   - authMiddleware:        customer JWT required (role=customer)
 *   - tryCustomerAuth:       optional customer JWT (never rejects)
 *   - adminAuthMiddleware:   admin JWT required (401 missing, 403 wrong role)
 *
 * The legacy `adminMiddleware` and `signToken` exports are retained as
 * back-compat shims; we cover both new and shim shapes here so any
 * accidental drift in the customer/admin separation surfaces fast.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  adminAuthMiddleware,
  adminMiddleware,
  authMiddleware,
  signAdminToken,
  signCustomerToken,
  signToken,
  tryCustomerAuth,
} from '../../src/middleware/auth';
import type { AuthenticatedRequest } from '../../src/middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'voka-seat-secret-dev';

function createMockReq(authHeader?: string): AuthenticatedRequest {
  return {
    headers: authHeader === undefined ? {} : { authorization: authHeader },
  } as unknown as AuthenticatedRequest;
}

function createMockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('authMiddleware (customer JWT required)', () => {
  let next: NextFunction;
  beforeEach(() => {
    next = vi.fn();
  });

  it('returns 401 when the Authorization header is missing', () => {
    const req = createMockReq(undefined);
    const res = createMockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for non-Bearer authorization schemes', () => {
    const req = createMockReq('Basic abc123');
    const res = createMockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer token fails to verify', () => {
    const req = createMockReq('Bearer not-a-real-jwt');
    const res = createMockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is expired', () => {
    const expired = jwt.sign(
      { email: 'expired@example.com', name: 'Test', role: 'customer' },
      JWT_SECRET,
      { expiresIn: '-1h' },
    );
    const req = createMockReq(`Bearer ${expired}`);
    const res = createMockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and attaches req.user for a valid customer JWT', () => {
    const token = signCustomerToken({ email: 'jane@example.com', name: 'Jane' });
    const req = createMockReq(`Bearer ${token}`);
    const res = createMockRes();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({
      email: 'jane@example.com',
      name: 'Jane',
      role: 'customer',
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when a valid JWT lacks role=customer (admin JWT must not pass)', () => {
    const adminToken = signAdminToken({ username: 'admin' });
    const req = createMockReq(`Bearer ${adminToken}`);
    const res = createMockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('tryCustomerAuth (optional customer JWT)', () => {
  let next: NextFunction;
  beforeEach(() => {
    next = vi.fn();
  });

  it('calls next without populating req.user when no Authorization header', () => {
    const req = createMockReq(undefined);
    const res = createMockRes();
    tryCustomerAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next without rejecting when the token fails verification', () => {
    const req = createMockReq('Bearer garbage');
    const res = createMockRes();
    tryCustomerAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('populates req.user for a valid customer JWT', () => {
    const token = signCustomerToken({ email: 'bob@example.com', name: 'Bob' });
    const req = createMockReq(`Bearer ${token}`);
    const res = createMockRes();
    tryCustomerAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({
      email: 'bob@example.com',
      name: 'Bob',
      role: 'customer',
    });
  });

  it('does NOT populate req.user for an admin JWT but still calls next', () => {
    const adminToken = signAdminToken({ username: 'admin' });
    const req = createMockReq(`Bearer ${adminToken}`);
    const res = createMockRes();
    tryCustomerAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});

describe('adminAuthMiddleware (admin JWT required)', () => {
  let next: NextFunction;
  beforeEach(() => {
    next = vi.fn();
  });

  it('returns 401 when the Authorization header is missing', () => {
    const req = createMockReq(undefined);
    const res = createMockRes();
    adminAuthMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an unverifiable bearer token', () => {
    const req = createMockReq('Bearer not-a-jwt');
    const res = createMockRes();
    adminAuthMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when a valid customer JWT is presented (role mismatch)', () => {
    const customerToken = signCustomerToken({
      email: 'jane@example.com',
      name: 'Jane',
    });
    const req = createMockReq(`Bearer ${customerToken}`);
    const res = createMockRes();
    adminAuthMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and attaches req.admin for a valid admin JWT', () => {
    const token = signAdminToken({ username: 'admin' });
    const req = createMockReq(`Bearer ${token}`);
    const res = createMockRes();
    adminAuthMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.admin).toEqual({ username: 'admin', role: 'admin' });
  });

  it('legacy adminMiddleware shim points at adminAuthMiddleware', () => {
    expect(adminMiddleware).toBe(adminAuthMiddleware);
  });
});

describe('signCustomerToken', () => {
  it('returns a customer-role JWT carrying email + name', () => {
    const token = signCustomerToken({ email: 'jane@example.com', name: 'Jane' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    expect(decoded.email).toBe('jane@example.com');
    expect(decoded.name).toBe('Jane');
    expect(decoded.role).toBe('customer');
  });

  it('sets the token expiry roughly 24 hours into the future', () => {
    const token = signCustomerToken({ email: 'a@b.cc', name: 'X' });
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, number>;
    const expectedExpiry = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    expect(decoded.exp).toBeGreaterThan(expectedExpiry - 5);
    expect(decoded.exp).toBeLessThanOrEqual(expectedExpiry + 5);
  });
});

describe('signAdminToken', () => {
  it('returns an admin-role JWT carrying username', () => {
    const token = signAdminToken({ username: 'admin' });
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    expect(decoded.username).toBe('admin');
    expect(decoded.role).toBe('admin');
  });
});

describe('signToken (legacy shim)', () => {
  it('coerces { nim, name } into a customer-role JWT for back-compat', () => {
    const token = signToken({ nim: '12345678', name: 'Legacy User' });
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    expect(decoded.role).toBe('customer');
    // Old payload's nim is mirrored into the email field by the shim.
    expect(decoded.email).toBe('12345678');
    expect(decoded.name).toBe('Legacy User');
  });

  it('prefers email when both email and nim are passed', () => {
    const token = signToken({
      email: 'jane@example.com',
      nim: '12345678',
      name: 'Jane',
    });
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    expect(decoded.email).toBe('jane@example.com');
  });
});
