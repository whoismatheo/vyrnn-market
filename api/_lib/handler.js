import { getConfig } from './config.js';
import { ApiError } from './errors.js';
import { CACHE_CONTROL, getClientIp, readQuery, sendJson } from './http.js';
import { createRateLimiter } from './rate-limit.js';

let sharedLimiter;

function getSharedLimiter() {
  if (!sharedLimiter) {
    const { limit, windowMs } = getConfig().rateLimit;
    sharedLimiter = createRateLimiter({ limit, windowMs });
  }
  return sharedLimiter;
}

function rateLimitHeaders(result) {
  return {
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))),
  };
}

function sendError(res, error) {
  if (error instanceof ApiError) {
    sendJson(res, error.status, error.toBody(), { 'Cache-Control': CACHE_CONTROL.noStore, ...error.headers });
    return;
  }

  console.error(error);
  sendJson(
    res,
    500,
    { error: { code: 'internal_error', message: 'Internal server error' } },
    { 'Cache-Control': CACHE_CONTROL.noStore },
  );
}

export function createHandler(resolve, { methods = ['GET'], limiter } = {}) {
  return async function handler(req, res) {
    try {
      if (!methods.includes(req.method)) throw ApiError.methodNotAllowed(methods);

      const config = getConfig();
      const result = (limiter ?? getSharedLimiter()).check(getClientIp(req));
      for (const [name, value] of Object.entries(rateLimitHeaders(result))) res.setHeader(name, value);
      if (!result.allowed) throw ApiError.tooManyRequests(result.retryAfterSeconds);

      const { data, meta, cache = CACHE_CONTROL.noStore } = await resolve({
        req,
        query: readQuery(req),
        config,
      });

      sendJson(res, 200, meta === undefined ? { data } : { data, meta }, { 'Cache-Control': cache });
    } catch (error) {
      sendError(res, error);
    }
  };
}
