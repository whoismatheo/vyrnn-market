import { createCache } from './cache.js';
import { getConfig } from './config.js';
import { ApiError, isUpstreamError } from './errors.js';
import { createRateLimiter } from './rate-limit.js';

const PATH_PATTERN = /^\/[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*$/i;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 300;
const DEFAULT_COOLDOWN_SECONDS = 60;
const MAX_COOLDOWN_SECONDS = 300;
const DEFAULT_TTL_MS = 30_000;
const DEFAULT_STALE_MS = 300_000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isTimeout(error) {
  return error?.name === 'TimeoutError' || error?.name === 'AbortError';
}

function parseRetryAfter(response) {
  const seconds = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
  if (!Number.isFinite(seconds) || seconds < 1) return DEFAULT_COOLDOWN_SECONDS;
  return Math.min(seconds, MAX_COOLDOWN_SECONDS);
}

function serializeParams(params) {
  const search = new URLSearchParams();
  for (const name of Object.keys(params).sort()) {
    const value = params[name];
    if (value === undefined || value === null) continue;
    search.set(name, Array.isArray(value) ? value.join(',') : String(value));
  }
  return search.toString();
}

export function createCoinGeckoClient({
  config,
  fetchImpl = globalThis.fetch,
  cache = createCache({ maxEntries: 500 }),
  now = Date.now,
  sleep = wait,
}) {
  const { baseUrl, apiKey, keyHeader, requestsPerMinute, timeoutMs } = config;
  const budget = createRateLimiter({ limit: requestsPerMinute, windowMs: 60_000, maxKeys: 1, now });
  const inflight = new Map();
  let cooldownUntil = 0;

  function buildUrl(path, params) {
    if (!PATH_PATTERN.test(path) || path.split('/').includes('..')) {
      throw new Error(`Invalid CoinGecko path: ${path}`);
    }
    const query = serializeParams(params);
    return `${baseUrl}${path}${query ? `?${query}` : ''}`;
  }

  async function interpret(response) {
    if (response.status === 429) {
      const seconds = parseRetryAfter(response);
      cooldownUntil = now() + seconds * 1000;
      throw ApiError.upstreamRateLimited(seconds);
    }
    if (response.status === 401 || response.status === 403) {
      throw ApiError.upstream('The market data provider rejected the configured credentials', 'upstream_unauthorized');
    }
    if (response.status === 404) throw ApiError.notFound();
    if (!response.ok) throw ApiError.upstream(`The market data provider responded with status ${response.status}`);

    try {
      return await response.json();
    } catch {
      throw ApiError.upstream('The market data provider returned an invalid response');
    }
  }

  async function request(url) {
    const headers = { accept: 'application/json' };
    if (apiKey) headers[keyHeader] = apiKey;

    for (let attempt = 1; ; attempt += 1) {
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      let response;

      try {
        response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
      } catch (error) {
        if (isTimeout(error)) throw ApiError.upstreamTimeout();
        if (isLastAttempt) throw ApiError.upstream('Unable to reach the market data provider');
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      if (response.status >= 500 && !isLastAttempt) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      return interpret(response);
    }
  }

  async function load(url) {
    const time = now();
    if (time < cooldownUntil) {
      throw ApiError.upstreamRateLimited(Math.ceil((cooldownUntil - time) / 1000));
    }

    const slot = budget.check('upstream');
    if (!slot.allowed) throw ApiError.upstreamRateLimited(slot.retryAfterSeconds);

    return request(url);
  }

  function loadShared(url, ttlMs, staleMs) {
    let pending = inflight.get(url);
    if (!pending) {
      pending = load(url)
        .then((data) => {
          const entry = { data, fetchedAt: now() };
          cache.set(url, entry, { ttlMs, staleMs });
          return entry;
        })
        .finally(() => inflight.delete(url));
      inflight.set(url, pending);
    }
    return pending;
  }

  async function get(path, { params = {}, ttlMs = DEFAULT_TTL_MS, staleMs = DEFAULT_STALE_MS } = {}) {
    const url = buildUrl(path, params);
    const cached = cache.get(url);
    if (cached?.fresh) return { ...cached.value, source: 'cache' };

    try {
      return { ...(await loadShared(url, ttlMs, staleMs)), source: 'upstream' };
    } catch (error) {
      if (cached && isUpstreamError(error)) return { ...cached.value, source: 'stale' };
      throw error;
    }
  }

  return { get };
}

let defaultClient;

export function getCoinGeckoClient() {
  defaultClient ??= createCoinGeckoClient({ config: getConfig().coingecko });
  return defaultClient;
}
