import { ApiError } from './errors.js';
import { downsample } from './downsample.js';

const IMAGE_HOSTS = new Set(['coin-images.coingecko.com', 'assets.coingecko.com']);
const SPARKLINE_POINTS = 32;
const CHART_POINTS = 180;
const MAX_TRENDING = 10;
const MAX_SEARCH_RESULTS = 10;
const ASSET_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

function toNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function safeImageUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && IMAGE_HOSTS.has(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

function unexpected(what) {
  return ApiError.upstream(`The market data provider returned an unexpected ${what} response`);
}

function requireObject(value, what) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw unexpected(what);
  return value;
}

function requireArray(value, what) {
  if (!Array.isArray(value)) throw unexpected(what);
  return value;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function normalizeSparkline(values) {
  if (!Array.isArray(values)) return null;
  const prices = values.filter((value) => toNumber(value) !== null);
  return prices.length >= 2 ? downsample(prices, SPARKLINE_POINTS) : null;
}

export function normalizeGlobal(raw) {
  const data = requireObject(requireObject(raw, 'global').data, 'global');
  const marketCap = toNumber(data.total_market_cap?.usd);
  const volume24h = toNumber(data.total_volume?.usd);
  if (marketCap === null || volume24h === null) throw unexpected('global');

  const updated = toNumber(data.updated_at);

  return {
    marketCap,
    volume24h,
    marketCapChange24h: toNumber(data.market_cap_change_percentage_24h_usd),
    btcDominance: toNumber(data.market_cap_percentage?.btc),
    ethDominance: toNumber(data.market_cap_percentage?.eth),
    activeCryptocurrencies: toNumber(data.active_cryptocurrencies),
    updatedAt: updated === null ? null : new Date(updated * 1000).toISOString(),
  };
}

function normalizeCoin(raw) {
  if (raw === null || typeof raw !== 'object') return null;
  const id = nonEmptyString(raw.id);
  const name = nonEmptyString(raw.name);
  const symbol = nonEmptyString(raw.symbol);
  if (!id || !name || !symbol) return null;

  return {
    id,
    name,
    symbol: symbol.toUpperCase(),
    image: safeImageUrl(raw.image),
    rank: toNumber(raw.market_cap_rank),
    price: toNumber(raw.current_price),
    marketCap: toNumber(raw.market_cap),
    volume24h: toNumber(raw.total_volume),
    change24h: toNumber(raw.price_change_percentage_24h ?? raw.price_change_percentage_24h_in_currency),
    sparkline: normalizeSparkline(raw.sparkline_in_7d?.price),
  };
}

export function normalizeMarkets(raw) {
  return requireArray(raw, 'markets').map(normalizeCoin).filter(Boolean);
}

function normalizeDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
}

export function normalizeCoinDetail(raw) {
  const [entry] = requireArray(raw, 'asset');
  const coin = normalizeCoin(entry);
  if (!coin) return null;

  return {
    ...coin,
    sparkline: null,
    high24h: toNumber(entry.high_24h),
    low24h: toNumber(entry.low_24h),
    marketCapChange24h: toNumber(entry.market_cap_change_percentage_24h),
    fullyDilutedValuation: toNumber(entry.fully_diluted_valuation),
    circulatingSupply: toNumber(entry.circulating_supply),
    totalSupply: toNumber(entry.total_supply),
    maxSupply: toNumber(entry.max_supply),
    ath: toNumber(entry.ath),
    athChange: toNumber(entry.ath_change_percentage),
    athDate: normalizeDate(entry.ath_date),
    atl: toNumber(entry.atl),
    atlChange: toNumber(entry.atl_change_percentage),
    atlDate: normalizeDate(entry.atl_date),
    change7d: toNumber(entry.price_change_percentage_7d_in_currency),
    change30d: toNumber(entry.price_change_percentage_30d_in_currency),
    change1y: toNumber(entry.price_change_percentage_1y_in_currency),
  };
}

export function normalizeChart(raw) {
  const prices = requireArray(requireObject(raw, 'chart').prices, 'chart');
  const points = prices.filter(
    (entry) => Array.isArray(entry) && toNumber(entry[0]) !== null && toNumber(entry[1]) !== null,
  );
  return { points: downsample(points, CHART_POINTS).map(([time, price]) => [time, price]) };
}

export function extractTrendingIds(raw) {
  const coins = requireArray(requireObject(raw, 'trending').coins, 'trending');
  const ids = coins.map((entry) => nonEmptyString(entry?.item?.id)).filter(Boolean);
  return [...new Set(ids)].slice(0, MAX_TRENDING);
}

export function normalizeSearch(raw) {
  const coins = requireArray(requireObject(raw, 'search').coins, 'search');
  const results = [];

  for (const entry of coins) {
    const id = nonEmptyString(entry?.id);
    const name = nonEmptyString(entry?.name);
    const symbol = nonEmptyString(entry?.symbol);
    if (!id || !name || !symbol || id.length > 100 || !ASSET_ID_PATTERN.test(id)) continue;

    results.push({
      id,
      name,
      symbol: symbol.toUpperCase(),
      rank: toNumber(entry.market_cap_rank),
      image: safeImageUrl(entry.thumb ?? entry.large),
    });
    if (results.length === MAX_SEARCH_RESULTS) break;
  }

  return { coins: results };
}

const MAX_CATEGORIES = 60;

export function normalizeCategories(raw) {
  const categories = [];
  for (const entry of requireArray(raw, 'categories')) {
    const id = nonEmptyString(entry?.id);
    const name = nonEmptyString(entry?.name);
    if (!id || !name || id.length > 100 || !ASSET_ID_PATTERN.test(id)) continue;
    categories.push({ id, name, marketCap: toNumber(entry.market_cap) });
    if (categories.length === MAX_CATEGORIES) break;
  }
  return { categories };
}
