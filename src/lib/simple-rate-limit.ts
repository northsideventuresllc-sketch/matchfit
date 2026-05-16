const buckets = new Map<string, { n: number; resetAt: number }>();

/** Fixed-window limiter (best-effort; resets per instance in serverless). */
export function simpleRateLimitAllow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now > cur.resetAt) {
    buckets.set(key, { n: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.n >= max) return false;
  cur.n += 1;
  return true;
}
