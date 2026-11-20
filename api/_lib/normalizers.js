import { ApiError } from './errors.js';
import { downsample } from './downsample.js';

const IMAGE_HOSTS = new Set(['coin-images.coingecko.com', 'assets.coingecko.com']);
const SPARKLINE_POINTS = 32;
const CHART_POINTS = 180;
const MAX_TRENDING = 10;

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
