export const SORTS = Object.freeze(['rank', 'price', 'marketCap', 'volume', 'change']);
export const DEPTHS = Object.freeze(['250', '500', '1000']);
export const RANGE_FIELDS = Object.freeze({
  price: { min: 0, max: 1e9, integer: false, suffixes: true },
  marketCap: { min: 0, max: 1e15, integer: false, suffixes: true },
  volume: { min: 0, max: 1e14, integer: false, suffixes: true },
  change: { min: -100, max: 100_000, integer: false, suffixes: false },
  rank: { min: 1, max: 1000, integer: true, suffixes: false },
});

const MAX_PAGE = 100;
const MAX_QUERY_LENGTH = 40;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const QUERY_PATTERN = /^[\p{L}\p{N} ._-]+$/u;
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;
const MULTIPLIERS = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };

export const defaultDirection = (sort) => (sort === 'rank' ? 'asc' : 'desc');

const capitalize = (key) => key[0].toUpperCase() + key.slice(1);
const boundName = (side, key) => `${side}${capitalize(key)}`;

export function plainNumber(value) {
  return value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 12 });
}

function inBounds(value, field) {
  return Number.isFinite(value) && value >= field.min && value <= field.max && (!field.integer || Number.isInteger(value));
}

export function parseAmount(text, field) {
  const match = /^(-?\d+(?:\.\d+)?)([kmbt])?$/i.exec(text.trim());
  if (!match) return null;
  const suffix = match[2]?.toLowerCase();
  if (suffix && !field.suffixes) return null;
  const value = Number(match[1]) * (suffix ? MULTIPLIERS[suffix] : 1);
  return inBounds(value, field) ? value : null;
}

function readBound(raw, field) {
  if (raw === null || !DECIMAL_PATTERN.test(raw)) return undefined;
  const value = Number(raw);
  return inBounds(value, field) ? value : undefined;
}

function normalizeQuery(raw) {
  const text = (raw ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  return text.length > 0 && text.length <= MAX_QUERY_LENGTH && QUERY_PATTERN.test(text) ? text : '';
}

export function parseScreener(search) {
  const params = new URLSearchParams(search);
  const sort = SORTS.includes(params.get('sort')) ? params.get('sort') : 'rank';
  const dir = ['asc', 'desc'].includes(params.get('dir')) ? params.get('dir') : defaultDirection(sort);
  const page = Number(params.get('page'));
  const category = params.get('category') ?? '';

  const ranges = {};
  for (const [key, field] of Object.entries(RANGE_FIELDS)) {
    let min = readBound(params.get(boundName('min', key)), field);
    let max = readBound(params.get(boundName('max', key)), field);
    if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
    if (min !== undefined || max !== undefined) ranges[key] = { min, max };
  }

  return {
    q: normalizeQuery(params.get('q')),
    category: category.length <= 100 && ID_PATTERN.test(category) ? category : '',
    sort,
    dir,
    depth: DEPTHS.includes(params.get('depth')) ? params.get('depth') : '250',
    page: Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1,
    ranges,
  };
}

export function buildScreenerSearch(state, { includePage = true } = {}) {
  const parts = [];
  if (state.q) parts.push(`q=${encodeURIComponent(state.q)}`);
  if (state.category) parts.push(`category=${state.category}`);
  if (state.sort !== 'rank') parts.push(`sort=${state.sort}`);
  if (state.dir !== defaultDirection(state.sort)) parts.push(`dir=${state.dir}`);
  if (state.depth !== '250') parts.push(`depth=${state.depth}`);
  for (const key of Object.keys(RANGE_FIELDS)) {
    const { min, max } = state.ranges[key] ?? {};
    if (min !== undefined) parts.push(`${boundName('min', key)}=${plainNumber(min)}`);
    if (max !== undefined) parts.push(`${boundName('max', key)}=${plainNumber(max)}`);
  }
  if (includePage && state.page > 1) parts.push(`page=${state.page}`);
  return parts.join('&');
}

export function buildScreenerUrl(state) {
  const search = buildScreenerSearch(state);
  return search ? `/screener?${search}` : '/screener';
}

export function activeFilters(state) {
  const filters = [];
  if (state.q) filters.push({ type: 'q' });
  if (state.category) filters.push({ type: 'category' });
  for (const key of Object.keys(RANGE_FIELDS)) if (state.ranges[key]) filters.push({ type: 'range', key });
  return filters;
}

export function clearFilters(state) {
  return { ...state, q: '', category: '', ranges: {}, page: 1 };
}
