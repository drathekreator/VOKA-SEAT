/**
 * Admin account seeder.
 *
 * On backend boot, reads the privileged-operator credentials from the
 * environment variables `ADMIN_USERNAME` and `ADMIN_PASSWORD`, hashes
 * the password with bcrypt (cost ≥ 10), and upserts the resulting
 * AdminUser row. The seeded account is the only credential able to
 * authenticate against `POST /api/auth/admin/login` (Requirement 21.7
 * and Property 19).
 *
 * Defaults are friendly for the preview environment but MUST be
 * overridden via .env before any non-preview deployment — see the
 * project README and `deploy/.env.example`.
 */

import bcrypt from 'bcrypt';
import type { PrismaClient } from '@prisma/client';

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'vokafe-admin-2026';
const SALT_ROUNDS = 10;

export interface AdminSeedResult {
  username: string;
  /** True if a new row was created, false if an existing row was updated. */
  created: boolean;
}

export async function seedAdminAccount(prisma: PrismaClient): Promise<AdminSeedResult> {
  const username = process.env.ADMIN_USERNAME?.trim() || DEFAULT_ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD?.trim() || DEFAULT_ADMIN_PASSWORD;

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // We use `upsert` so the seeder is idempotent — repeated boots of the
  // backend simply refresh the password hash with the current env value
  // rather than crashing on a duplicate-key error.
  const existing = await prisma.adminUser.findUnique({ where: { username } });
  await prisma.adminUser.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });

  return { username, created: existing === null };
}
