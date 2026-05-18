# syntax=docker/dockerfile:1.7
# =====================================================================
# VOKA-SEAT Backend — Node.js + Express + Prisma
# Multi-stage build; final image runs `ts-node src/server.ts` on Node 20
# alpine. The container listens on 3000; compose republishes it as 3100.
#
# The entrypoint (docker-entrypoint.sh):
#   1. Runs `prisma db push` to sync schema on every boot.
#   2. Seeds seats / menu / inventory IF the seat table is empty.
#   3. Hands off to `ts-node src/server.ts`.
# The admin account is seeded inside the Node process (services/adminSeed.ts).
# =====================================================================

# ---------- Stage 1: install deps + generate Prisma client ----------
FROM node:20-alpine AS deps

WORKDIR /app

# OpenSSL is required by the Prisma engine on Alpine.
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

# ---------- Stage 2: runtime ----------------------------------------
FROM node:20-alpine AS runtime

WORKDIR /app

# curl is used by the docker-compose healthcheck.
# openssl is required by the Prisma runtime engine.
RUN apk add --no-cache curl openssl

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json* tsconfig.json prisma.config.ts ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY src ./src
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
