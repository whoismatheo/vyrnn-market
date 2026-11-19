import { getConfig } from './config.js';
import { getCoinGeckoClient } from './coingecko.js';
import { isUpstreamError } from './errors.js';
import { createHandler } from './handler.js';
import { oneOf, validateQuery } from './validation.js';

const UPSTREAM_CHECK_TTL_MS = 30_000;

async function checkUpstream(client) {
  try {
    const { source } = await client.get('/ping', { ttlMs: UPSTREAM_CHECK_TTL_MS, staleMs: 0 });
    return { reachable: true, source };
  } catch (error) {
    if (isUpstreamError(error)) return { reachable: false, error: error.code };
    throw error;
  }
}

export function createHealthHandler({ getClient = getCoinGeckoClient, limiter } = {}) {
  return createHandler(
    async ({ query }) => {
      const { check } = validateQuery(query, { check: oneOf(['upstream']) });
      const { environment, commit, coingecko } = getConfig();

      const data = {
        status: 'ok',
        environment,
        commit,
        timestamp: new Date().toISOString(),
        provider: { name: 'coingecko', plan: coingecko.plan },
      };

      if (check === 'upstream') {
        data.upstream = await checkUpstream(getClient());
        if (!data.upstream.reachable) data.status = 'degraded';
      }

      return { data };
    },
    { limiter },
  );
}
