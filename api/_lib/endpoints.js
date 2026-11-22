import { createMarketHandler } from './market-handler.js';
import { ApiError } from './errors.js';
import {
  extractTrendingIds,
  normalizeChart,
  normalizeCoinDetail,
  normalizeGlobal,
  normalizeMarkets,
  normalizeSearch,
} from './normalizers.js';
import { identifier, identifierList, integer, oneOf, searchText } from './validation.js';

const GLOBAL_TTL_MS = 60_000;
const MARKETS_TTL_MS = 60_000;
const TRENDING_TTL_MS = 300_000;
const CHART_RANGES = Object.freeze({
  1: { ttlMs: 120_000 },
  7: { ttlMs: 300_000 },
  30: { ttlMs: 600_000 },
  90: { ttlMs: 900_000 },
  365: { ttlMs: 1_800_000 },
});
const MARKET_ORDERS = ['market_cap_desc', 'volume_desc'];
const MAX_WATCHLIST_IDS = 50;
const COIN_TTL_MS = 60_000;
const SEARCH_TTL_MS = 600_000;

export function createGlobalHandler(options) {
  return createMarketHandler({
    ...options,
    edgeSeconds: GLOBAL_TTL_MS / 1000,
    async load(client) {
      const result = await client.get('/global', { ttlMs: GLOBAL_TTL_MS });
      return { data: normalizeGlobal(result.data), results: [result] };
    },
  });
}

export function createMarketsHandler(options) {
  return createMarketHandler({
    ...options,
    schema: {
      page: integer({ min: 1, max: 100, fallback: 1 }),
      perPage: integer({ min: 1, max: 100, fallback: 50 }),
      order: oneOf(MARKET_ORDERS, { fallback: 'market_cap_desc' }),
      ids: identifierList({ max: MAX_WATCHLIST_IDS }),
    },
    edgeSeconds: MARKETS_TTL_MS / 1000,
    async load(client, { page, perPage, order, ids }) {
      const selection = ids ? { ids, per_page: ids.length, page: 1 } : { per_page: perPage, page };
      const result = await client.get('/coins/markets', {
        params: { vs_currency: 'usd', order, sparkline: true, ...selection },
        ttlMs: MARKETS_TTL_MS,
      });
      return { data: { coins: normalizeMarkets(result.data) }, results: [result] };
    },
  });
}

export function createCoinHandler(options) {
  return createMarketHandler({
    ...options,
    schema: { id: identifier({ required: true }) },
    edgeSeconds: COIN_TTL_MS / 1000,
    async load(client, { id }) {
      const result = await client.get('/coins/markets', {
        params: { vs_currency: 'usd', ids: [id], per_page: 1, sparkline: false, price_change_percentage: '7d,30d,1y' },
        ttlMs: COIN_TTL_MS,
      });
      const coin = normalizeCoinDetail(result.data);
      if (!coin) throw ApiError.notFound('Asset not found');
      return { data: { coin }, results: [result] };
    },
  });
}

export function createSearchHandler(options) {
  return createMarketHandler({
    ...options,
    schema: { q: searchText({ required: true }) },
    edgeSeconds: SEARCH_TTL_MS / 1000,
    async load(client, { q }) {
      const result = await client.get('/search', { params: { query: q }, ttlMs: SEARCH_TTL_MS });
      return { data: normalizeSearch(result.data), results: [result] };
    },
  });
}

export function createChartHandler(options) {
  return createMarketHandler({
    ...options,
    schema: {
      id: identifier({ required: true }),
      days: oneOf(Object.keys(CHART_RANGES), { fallback: '7' }),
    },
    edgeSeconds: ({ days }) => CHART_RANGES[days].ttlMs / 1000,
    async load(client, { id, days }) {
      const result = await client.get(`/coins/${id}/market_chart`, {
        params: { vs_currency: 'usd', days },
        ttlMs: CHART_RANGES[days].ttlMs,
      });
      return { data: normalizeChart(result.data), results: [result] };
    },
  });
}

export function createTrendingHandler(options) {
  return createMarketHandler({
    ...options,
    edgeSeconds: TRENDING_TTL_MS / 1000,
    async load(client) {
      const trending = await client.get('/search/trending', { ttlMs: TRENDING_TTL_MS });
      const ids = extractTrendingIds(trending.data);
      if (ids.length === 0) return { data: { coins: [] }, results: [trending] };

      const markets = await client.get('/coins/markets', {
        params: { vs_currency: 'usd', ids, per_page: ids.length, sparkline: false },
        ttlMs: TRENDING_TTL_MS,
      });
      const byId = new Map(normalizeMarkets(markets.data).map((coin) => [coin.id, coin]));
      const coins = ids.map((id) => byId.get(id)).filter(Boolean);
      return { data: { coins }, results: [trending, markets] };
    },
  });
}
