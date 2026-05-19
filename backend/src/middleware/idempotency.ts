/**
 * Idempotency middleware for write endpoints.
 *
 * Customers double-tapping "Pay Now" or retrying after a flaky network
 * connection should never cause duplicate orders. Clients send an
 * `Idempotency-Key` header with a stable identifier per logical
 * operation (e.g. a UUID generated when the form is rendered). The
 * first request with a given key is processed normally; subsequent
 * requests with the same key (within `windowMs`) are short-circuited
 * with the cached response.
 *
 * Limitations:
 *   - In-memory cache, single replica only (matches our deployment).
 *   - Stores serialized JSON responses for `windowMs` (default 5 min).
 *   - Body capture relies on `res.json()` — handlers that use
 *     `res.send()` directly are not covered.
 *
 * Usage:
 *   router.post('/orders', idempotency({ windowMs: 5 * 60_000 }), handler);
 */
import type { Request, Response, NextFunction } from 'express';

export interface IdempotencyOptions {
  /** How long to remember responses for repeat keys. Defaults to 5 minutes. */
  windowMs?: number;
  /** Maximum keys retained in memory (LRU-ish trim). Defaults to 1000. */
  maxEntries?: number;
}

interface CachedResponse {
  status: number;
  body: unknown;
  expiresAt: number;
}

export function idempotency(opts: IdempotencyOptions = {}) {
  const windowMs = opts.windowMs ?? 5 * 60_000;
  const maxEntries = opts.maxEntries ?? 1000;
  const cache = new Map<string, CachedResponse>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const rawKey = req.headers['idempotency-key'];
    // No header → behave like a normal request. Idempotency is opt-in.
    if (typeof rawKey !== 'string' || rawKey.length === 0) {
      next();
      return;
    }
    if (rawKey.length > 255) {
      res.status(400).json({ error: 'Idempotency-Key too long (max 255 chars)' });
      return;
    }

    // Scope the cache key by HTTP method + URL so the same idempotency
    // key can't bridge different endpoints.
    const key = `${req.method}:${req.originalUrl}:${rawKey}`;
    const now = Date.now();

    const cached = cache.get(key);
    if (cached && now < cached.expiresAt) {
      res.status(cached.status).json(cached.body);
      return;
    }

    // Wrap res.json so we can capture the response body before it's
    // flushed to the client. We fall through to the original method
    // afterwards so behaviour is otherwise unchanged.
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown): Response {
      cache.set(key, {
        status: res.statusCode,
        body,
        expiresAt: now + windowMs,
      });

      // Trim cache when it grows past `maxEntries` (drop oldest 20%).
      if (cache.size > maxEntries) {
        const drop = Math.ceil(maxEntries * 0.2);
        const keys = Array.from(cache.keys()).slice(0, drop);
        for (const k of keys) cache.delete(k);
      }

      return originalJson(body);
    } as typeof res.json;

    next();
  };
}
