const buckets = new Map();

function createRateLimiter({
  key = (req) => `${req.auth?.sub || req.ip}:${req.method}:${req.route?.path || req.path}`,
  windowMs = 15 * 1000,
  limit = 20,
  message = "Слишком много действий подряд. Попробуйте чуть позже.",
} = {}) {
  return (req, res, next) => {
    const bucketKey = key(req);
    const now = Date.now();
    const current = buckets.get(bucketKey);

    if (!current || current.resetAt <= now) {
      buckets.set(bucketKey, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    if (current.count >= limit) {
      const retryAfterMs = Math.max(0, current.resetAt - now);
      res.setHeader("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
      return res.status(429).json({
        ok: false,
        error: message,
        message,
        retryAfterMs,
      });
    }

    current.count += 1;
    return next();
  };
}

module.exports = {
  createRateLimiter,
};
