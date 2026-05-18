import { Router } from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { validateEmail } from '../validators/emailValidator';
import { sanitizerMiddleware } from '../middleware/sanitizer';
import { signCustomerToken } from '../middleware/auth';

const router = Router();
router.use(sanitizerMiddleware);

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

let prisma: PrismaClient;
export function setAuthPrisma(client: PrismaClient): void {
  prisma = client;
}

/**
 * POST /api/auth/register
 * Body: { email, name, password }
 *
 * Creates a customer User with hashed password. Validates email format
 * (RFC 5322), name length (1–100), and password length (≥ 8).
 * Returns a customer JWT and the user info (without passwordHash) on
 * success. On duplicate email (Prisma P2002), returns HTTP 409.
 *
 * Validates: Requirements 13.6, 13.9–13.13, 14.1, 15.7.
 */
router.post('/register', async (req, res) => {
  try {
    const { email: rawEmail, name, password } = req.body ?? {};

    if (!rawEmail || !name || !password) {
      res.status(400).json({ error: 'Missing required fields: email, name, password' });
      return;
    }

    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      res.status(400).json({ error: emailResult.error });
      return;
    }

    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
      res.status(400).json({ error: 'Name must be 1 to 100 characters' });
      return;
    }

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        name: name.trim(),
        passwordHash,
      },
    });

    const token = signCustomerToken({ email: user.email, name: user.name });

    res.status(201).json({
      token,
      user: {
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    });
  } catch (error: unknown) {
    // Duplicate email — Prisma P2002 unique constraint violation.
    const code = (error as { code?: string } | null)?.code;
    if (code === 'P2002') {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Authenticates a customer via email + password. Returns a customer JWT
 * on success. On any failure (missing user, wrong password) returns
 * HTTP 401 with a generic "Invalid credentials" message — never reveals
 * which field is wrong (Requirement 13.2 / Error-handling matrix).
 *
 * Validates: Requirements 13.4, 13.6, 15.7.
 */
router.post('/login', async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body ?? {};

    if (!rawEmail || !password) {
      res.status(400).json({ error: 'Missing required fields: email, password' });
      return;
    }

    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      // Generic error — do not reveal that the email is malformed vs
      // missing. The same response is returned for any login failure.
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signCustomerToken({ email: user.email, name: user.name });

    res.status(200).json({
      token,
      user: {
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
