export const CACHE_CONTROL = Object.freeze({
  noStore: 'no-store',
  edge: (sMaxAgeSeconds, staleWhileRevalidateSeconds) =>
    `public, max-age=0, s-maxage=${sMaxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`,
});

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  if (first) return first;

  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.trim()) return real.trim();

  return req.socket?.remoteAddress ?? 'unknown';
}

export function readQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query;

  const query = Object.create(null);
  for (const [name, value] of new URL(req.url, 'http://localhost').searchParams) {
    if (name in query) {
      query[name] = [].concat(query[name], value);
    } else {
      query[name] = value;
    }
  }
  return query;
}

export function sendJson(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}
