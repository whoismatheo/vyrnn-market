export const SORT_KEYS = Object.freeze(['rank', 'price', 'marketCap', 'volume', 'change']);
export const RANGE_KEYS = Object.freeze(['price', 'marketCap', 'volume', 'change', 'rank']);
export const PAGE_SIZE = 50;

const FIELDS = { rank: 'rank', price: 'price', marketCap: 'marketCap', volume: 'volume24h', change: 'change24h' };

function inRange(value, { min, max }) {
  if (min === undefined && max === undefined) return true;
  if (value === null) return false;
  return (min === undefined || value >= min) && (max === undefined || value <= max);
}

export function filterCoins(coins, { q, ranges }) {
  const needle = q?.toLowerCase();
  return coins.filter(
    (coin) =>
      (!needle || coin.name.toLowerCase().includes(needle) || coin.symbol.toLowerCase().includes(needle)) &&
      RANGE_KEYS.every((key) => inRange(coin[FIELDS[key]], ranges[key] ?? {})),
  );
}

export function sortCoins(coins, sort, dir) {
  const field = FIELDS[sort];
  const factor = dir === 'asc' ? 1 : -1;

  return [...coins].sort((a, b) => {
    const x = a[field];
    const y = b[field];
    if (x === null && y !== null) return 1;
    if (y === null && x !== null) return -1;
    if (x !== null && x !== y) return (x - y) * factor;
    if (a.rank !== b.rank) return (a.rank ?? Infinity) - (b.rank ?? Infinity);
    return a.id < b.id ? -1 : 1;
  });
}

export function paginate(coins, page) {
  const start = (page - 1) * PAGE_SIZE;
  return { coins: coins.slice(start, start + PAGE_SIZE), total: coins.length, pages: Math.ceil(coins.length / PAGE_SIZE) };
}

export function findInvertedRange(ranges) {
  return RANGE_KEYS.find((key) => ranges[key]?.min !== undefined && ranges[key]?.max !== undefined && ranges[key].min > ranges[key].max) ?? null;
}
