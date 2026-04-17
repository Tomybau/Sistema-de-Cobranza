/**
 * In-memory rate limiter keyed by an arbitrary string (session ID, user ID, etc.).
 * Resets per window. Safe for single-process deployments (dev, single Vercel instance).
 * For multi-instance prod use Upstash Redis instead.
 */

interface Bucket {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()

/**
 * Returns true if the key is within the allowed limit.
 * @param key     Unique identifier (e.g. userId)
 * @param limit   Max requests per window
 * @param windowMs Window size in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (bucket.count >= limit) {
    return false
  }

  bucket.count++
  return true
}
