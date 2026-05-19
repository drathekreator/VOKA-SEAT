/**
 * In-memory rate limiter middleware.
 *
 * MVP-grade implementation suitable for a single-instance deployment.
 * For multi-replica setups this would need to be backed by Redis or a
 * shared store, but VOKA-SEAT runs as a single backend container so an
 * in-process Map is sufficient and avoids an external dependency.
 *
 * Usage:
 *   router.post('/login', rateLimit({ windowMs: 60_000, max: 5 }), handler);
 *
 * Each unique key (default: client IP) gets a sliding window. When the
 * configured `max` is exceeded the next request returns 429.
 */
import type { Request, Response, NextFunction } from 'express';

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed per window per key. */
  max: number;
  /** Friendly error message returned in the 429 body. */
  message?: string;
  /**
   * Build a custom key per request (defaults to client IP). Useful for
   * per-route limits (e.g. include the route name) or per-user limits
   * (include the JWT subject).
   */
  keyGenerator?: (req: Request) => string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Best-effort client identifier. Uses `X-Forwarded-For` first hop (set
 * by host nginx) so requests behind a reverse proxy are bucketed by
 * the real client IP, with `req.ip` as a defensible fallback.
 */
function defaultKeyGenerator(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim();
  }
  return req.ip || 'unknown';
}

export function rateLimit(opts: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const message = opts.message ?? 'Too many requests, please try again later.';
  const keyOf = opts.keyGenerator ?? defaultKeyGenerator;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyOf(req);
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > opts.max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({ error: message, retryAfterSeconds: retryAfterSec });
      return;
    }

    next();
  };
}

/**
 * Periodic sweep that drops expired buckets so memory doesn't grow
 * unbounded over the lifetime of the process. Safe to call multiple
 * times — only the first call schedules the interval.
 *
 * The default sweep cadence (60s) is fine for the request volumes
 * VOKAFE will see in practice.
 */
let sweepHandle: ReturnType<typeof setInterval> | null = null;
const allBuckets: Array<Map<string, Bucket>> = [];

export function registerForSweep(buckets: Map<string, Bucket>): void {
  allBuckets.push(buckets);
  if (sweepHandle === null) {
    sweepHandle = setInterval(() => {
      const now = Date.now();
      for (const m of allBuckets) {
        for (const [k, v] of m.entries()) {
          if (now >= v.resetAt) m.delete(k);
        }
      }
    }, 60_000);
    // Allow Node to exit even with the interval pending.
    if (typeof sweepHandle === 'object' && 'unref' in sweepHandle) {
      (sweepHandle as { unref: () => void }).unref();
    }
  }
}
