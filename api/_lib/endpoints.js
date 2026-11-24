import { createMarketHandler } from './market-handler.js';
import { ApiError } from './errors.js';
import {
  extractTrendingIds,
  normalizeChart,
  normalizeCategories,
  normalizeCoinDetail,
  normalizeGlobal,
  normalizeMarkets,
  normalizeSearch,
} from './normalizers.js';
import { PAGE_SIZE, RANGE_KEYS, SORT_KEYS, filterCoins, findInvertedRange, paginate, sortCoins } from './screener.js';
import { identifier, identifierList, integer, number, oneOf, searchText } from './validation.js';

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
const SCREENER_TTL_MS = 120_000;
const CATEGORIES_TTL_MS = 3_600_000;
const CATEGORIES_STALE_MS = 86_400_000;
const UNIVERSE_PAGE_SIZE = 250;
const RANGE_RULES = {
  price: number({ min: 0, max: 1e9 }),
  marketCap: number({ min: 0, max: 1e15 }),
  volume: number({ min: 0, max: 1e14 }),
  change: number({ min: -100, max: 100_000 }),
  rank: integer({ min: 1, max: 1000 }),
};

function rangeSchema() {
  const schema = {};
  for (const key of RANGE_KEYS) {
    const suffix = key[0].toUpperCase() + key.slice(1);
    schema[`min${suffix}`] = RANGE_RULES[key];
    schema[`max${suffix}`] = RANGE_RULES[key];
  }
  return schema;
}

function readRanges(params) {
  return Object.fromEntries(
    RANGE_KEYS.map((key) => {
      const suffix = key[0].toUpperCase() + key.slice(1);
      return [key, { min: params[`min${suffix}`], max: params[`max${suffix}`] }];
    }),
  );
}

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

export function createCategoriesHandler(options) {
  return createMarketHandler({
    ...options,
    edgeSeconds: CATEGORIES_TTL_MS / 1000,
    async load(client) {
      const result = await client.get('/coins/categories', {
        params: { order: 'market_cap_desc' },
        ttlMs: CATEGORIES_TTL_MS,
        staleMs: CATEGORIES_STALE_MS,
      });
      return { data: normalizeCategories(result.data), results: [result] };
    },
  });
}

export function createScreenerHandler(options) {
  return createMarketHandler({
    ...options,
    schema: {
      q: searchText({ min: 1 }),
      category: identifier(),
      sort: oneOf(SORT_KEYS, { fallback: 'rank' }),
      dir: oneOf(['asc', 'desc']),
      depth: oneOf(['250', '500', '1000'], { fallback: '250' }),
      page: integer({ min: 1, max: 100, fallback: 1 }),
      ...rangeSchema(),
    },
    edgeSeconds: SCREENER_TTL_MS / 1000,
    async load(client, params) {
      const ranges = readRanges(params);
      const inverted = findInvertedRange(ranges);
      if (inverted) throw ApiError.badRequest(`The minimum for "${inverted}" is greater than its maximum`, { filter: inverted });

      const pages = Number(params.depth) / UNIVERSE_PAGE_SIZE;
      const settled = await Promise.allSettled(
        Array.from({ length: pages }, (_, index) =>
          client.get('/coins/markets', {
            params: {
              vs_currency: 'usd',
              order: 'market_cap_desc',
              per_page: UNIVERSE_PAGE_SIZE,
              page: index + 1,
              sparkline: false,
              ...(params.category ? { category: params.category } : {}),
            },
            ttlMs: SCREENER_TTL_MS,
          }),
        ),
      );
      if (settled[0].status === 'rejected') throw settled[0].reason;

      const results = settled.filter(({ status }) => status === 'fulfilled').map(({ value }) => value);
      const universe = [...new Map(results.flatMap(({ data }) => normalizeMarkets(data)).map((coin) => [coin.id, coin])).values()];
      const dir = params.dir ?? (params.sort === 'rank' ? 'asc' : 'desc');
      const matches = sortCoins(filterCoins(universe, { q: params.q, ranges }), params.sort, dir);
      const page = paginate(matches, params.page);

      return {
        data: { coins: page.coins, total: page.total, pages: page.pages, page: params.page, pageSize: PAGE_SIZE, scanned: universe.length, complete: results.length === pages },
        results,
      };
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
