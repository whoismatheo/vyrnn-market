export function createRateLimiter({ limit, windowMs, maxKeys = 10_000, now = Date.now }) {
  const buckets = new Map();

  function pruneExpired(time) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= time) buckets.delete(key);
    }
  }

  function check(key) {
    const time = now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= time) {
      if (buckets.size >= maxKeys) {
        pruneExpired(time);
        if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value);
      }
      bucket = { count: 0, resetAt: time + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const allowed = bucket.count <= limit;

    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((bucket.resetAt - time) / 1000)),
    };
  }

  return { check };
}
