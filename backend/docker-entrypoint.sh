#!/bin/sh
# =====================================================================
# VOKA-SEAT Backend container entrypoint
#
# Runs once per container start:
#   1. `prisma db push` — ensures the Postgres schema matches schema.prisma.
#      Idempotent: skips if already in sync.
#   2. Conditional first-boot seed of seats / menu / inventory.
#      Triggered ONLY when the seat table is empty (count == 0) so
#      restarts don't reseed live data.
#   3. Hands off to `ts-node src/server.ts`.
#
# The admin account is seeded inside the Node process at startup
# (services/adminSeed.ts) so it's NOT handled here.
# =====================================================================
set -e

echo "📦 [entrypoint] Syncing Prisma schema with database..."
# Note: Prisma 7 dropped the legacy `--skip-generate` flag. The client
# was already generated at build time inside the deps stage, so we
# just push the schema (idempotent — no-op if already in sync).
npx prisma db push --accept-data-loss

# Conditional first-boot seed: only when seats table is empty.
SEAT_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
prisma.seat.count()
  .then(c => { console.log(c); pool.end(); })
  .catch(() => { console.log(0); pool.end(); });
" 2>/dev/null || echo 0)

# Strip non-digit chars defensively (e.g. dotenvx banner output on first boot).
SEAT_COUNT=$(echo "$SEAT_COUNT" | tr -cd '0-9' | head -c 4)
SEAT_COUNT=${SEAT_COUNT:-0}

if [ "$SEAT_COUNT" = "0" ]; then
  echo "🌱 [entrypoint] Seeding initial seats / menu / inventory..."
  npx prisma db seed || {
    echo "⚠️  [entrypoint] Seed step failed — continuing boot anyway."
    echo "    Re-run manually with: docker exec voka_seat_backend npx prisma db seed"
  }
else
  echo "✅ [entrypoint] Seat table already populated ($SEAT_COUNT rows). Skipping seed."
fi

echo "🚀 [entrypoint] Launching backend server..."
exec npx ts-node src/server.ts
