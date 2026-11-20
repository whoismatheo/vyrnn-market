import { getCoinGeckoClient } from './coingecko.js';
import { createHandler } from './handler.js';
import { CACHE_CONTROL } from './http.js';
import { validateQuery } from './validation.js';

const STALE_EDGE_SECONDS = 5;

function summarize(results) {
  const stale = results.some((result) => result.source === 'stale');
  const source = stale ? 'stale' : results.some((result) => result.source === 'upstream') ? 'upstream' : 'cache';
  const oldest = Math.min(...results.map((result) => result.fetchedAt));
  return { source, stale, updatedAt: new Date(oldest).toISOString() };
}

export function createMarketHandler({ schema = {}, load, edgeSeconds, getClient = getCoinGeckoClient, limiter }) {
  return createHandler(
    async ({ query }) => {
      const params = validateQuery(query, schema);
      const { data, results } = await load(getClient(), params);
      const meta = summarize(results);
      const seconds = typeof edgeSeconds === 'function' ? edgeSeconds(params) : edgeSeconds;

      return {
        data,
        meta,
        cache: meta.stale ? CACHE_CONTROL.edge(STALE_EDGE_SECONDS, 0) : CACHE_CONTROL.edge(seconds, seconds * 2),
      };
    },
    { limiter },
  );
}
