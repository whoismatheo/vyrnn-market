import { apiGet } from './client.js';

export function fetchGlobal({ signal } = {}) {
  return apiGet('/api/global', { signal });
}

export function fetchMarkets({ page = 1, perPage = 50, order = 'market_cap_desc', ids, signal } = {}) {
  const params = ids ? { ids: ids.join(','), order } : { page, perPage, order };
  return apiGet('/api/markets', { params, signal });
}

export function fetchCoin({ id, signal }) {
  return apiGet('/api/coin', { params: { id }, signal });
}

export function fetchChart({ id, days, signal }) {
  return apiGet('/api/chart', { params: { id, days }, signal });
}

export function fetchTrending({ signal } = {}) {
  return apiGet('/api/trending', { signal });
}

export function fetchSearch({ q, signal }) {
  return apiGet('/api/search', { params: { q }, signal });
}
