const COINGECKO_PLANS = {
  public: { baseUrl: 'https://api.coingecko.com/api/v3', keyHeader: null, requestsPerMinute: 10 },
  demo: { baseUrl: 'https://api.coingecko.com/api/v3', keyHeader: 'x-cg-demo-api-key', requestsPerMinute: 25 },
  pro: { baseUrl: 'https://pro-api.coingecko.com/api/v3', keyHeader: 'x-cg-pro-api-key', requestsPerMinute: 300 },
};

const DEFAULT_API_RATE_LIMIT = 60;
const UPSTREAM_TIMEOUT_MS = 8000;

function readString(env, name) {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function readPositiveInteger(env, name, fallback) {
  const value = readString(env, name);
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return Number(value);
}

export function loadConfig(env = process.env) {
  const apiKey = readString(env, 'COINGECKO_API_KEY');
  const requestedPlan = readString(env, 'COINGECKO_API_PLAN') ?? 'demo';

  if (requestedPlan !== 'demo' && requestedPlan !== 'pro') {
    throw new Error('COINGECKO_API_PLAN must be "demo" or "pro"');
  }

  const plan = apiKey ? requestedPlan : 'public';
  const { baseUrl, keyHeader, requestsPerMinute } = COINGECKO_PLANS[plan];

  return Object.freeze({
    environment: env.VERCEL_ENV ?? (env.NODE_ENV === 'production' ? 'production' : 'development'),
    commit: readString(env, 'VERCEL_GIT_COMMIT_SHA')?.slice(0, 7) ?? null,
    coingecko: Object.freeze({
      plan,
      apiKey,
      baseUrl,
      keyHeader,
      timeoutMs: UPSTREAM_TIMEOUT_MS,
      requestsPerMinute: readPositiveInteger(env, 'COINGECKO_RATE_LIMIT_PER_MINUTE', requestsPerMinute),
    }),
    rateLimit: Object.freeze({
      limit: readPositiveInteger(env, 'API_RATE_LIMIT_PER_MINUTE', DEFAULT_API_RATE_LIMIT),
      windowMs: 60_000,
    }),
  });
}

let cachedConfig;

export function getConfig() {
  cachedConfig ??= loadConfig();
  return cachedConfig;
}
