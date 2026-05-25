import { LRUCache } from "lru-cache";

type Bucket = { count: number; resetAt: number };

const buckets = new LRUCache<string, Bucket>({ max: 5000, ttl: 60_000 });

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
};

/**
 * Sliding-fixed-window rate limiter (in-memory, per serverless instance).
 * Sufficient for the public portal traffic; migrate to Redis if/when needed.
 */
export function rateLimit(key: string, limit: number, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt };
  }

  if (bucket.count >= limit) {
    return { success: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count++;
  return { success: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

/** Reset a bucket (mainly for tests). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
