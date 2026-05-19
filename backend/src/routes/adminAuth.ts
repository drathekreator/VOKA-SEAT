/**
 * Admin authentication route.
 *
 * `POST /api/auth/admin/login` — body `{ username, password }`. Looks up
 * the AdminUser table only; the customer User table is never consulted
 * here (Requirement 21.8). Returns an admin JWT carrying
 * `{ username, role: 'admin' }` on success, or HTTP 401 with a generic
 * "Invalid credentials" message on any failure.
 *
 * The admin account is seeded by `services/adminSeed.ts` on backend
 * startup from `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars.
 *
 * Validates: Requirements 15.7, 15.9, 21.2, 21.3, 21.7, 21.8.
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import type { PrismaClient } from '@prisma/client';
import { sanitizerMiddleware } from '../middleware/sanitizer';
import { rateLimit } from '../middleware/rateLimit';
import { signAdminToken } from '../middleware/auth';

let prisma: PrismaClient;
export function setAdminAuthPrisma(client: PrismaClient): void {
  prisma = client;
}

/**
 * Tight rate limit (5 attempts/minute/IP) to slow down brute force
 * attacks against the lone admin account. Legitimate operators rarely
 * hit this; attackers spamming credentials get bounced quickly.
 */
const adminLoginLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  message: 'Too many login attempts. Please try again in a minute.',
});

const router = Router();
router.use(sanitizerMiddleware);

router.post('/login', adminLoginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body ?? {};

    if (typeof username !== 'string' || username.length === 0 ||
        typeof password !== 'string' || password.length === 0) {
      // Generic 401 — do not surface "missing field" detail on the admin
      // endpoint; we never reveal which input is wrong.
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const admin = await prisma.adminUser.findUnique({ where: { username } });
    if (!admin) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signAdminToken({ username: admin.username });
    res.status(200).json({
      token,
      admin: {
        username: admin.username,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
