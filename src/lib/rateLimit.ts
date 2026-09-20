/**
 * Tiny in-memory sliding-window rate limiter.
 *
 * NOTE: this state lives in the memory of a single serverless function
 * instance. On platforms like Vercel that means the limit is per-instance,
 * not truly global across all instances/regions. That is an accepted
 * tradeoff for v1 - it still stops a single client from hammering an
 * endpoint within one warm instance, which is the main risk we care about
 * here. A shared store (e.g. Redis) would be needed for a hard global cap.
 */

interface Bucket {
  /** Timestamps (ms) of requests within the current window. */
  hits: number[];
}

const buckets = new Map<string, Bucket>();

// Periodically prune buckets with no recent activity so the map doesn't
// grow without bound. We only need to do this occasionally, not on every
// call, so we throttle it with a simple counter.
let callsSinceSweep = 0;
const SWEEP_INTERVAL_CALLS = 200;

function sweep(now: number, windowMs: number) {
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
    if (bucket.hits.length === 0) {
      buckets.delete(key);
    }
  }
}

/**
 * Returns true if the request identified by `key` is allowed under a
 * sliding window of `windowMs` milliseconds capped at `limit` requests.
 * Returns false when the caller is over the limit.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  callsSinceSweep += 1;
  if (callsSinceSweep >= SWEEP_INTERVAL_CALLS) {
    callsSinceSweep = 0;
    sweep(now, windowMs);
  }

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    return false;
  }

  bucket.hits.push(now);
  return true;
}
