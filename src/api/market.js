import { apiGet } from './client.js';

export function fetchGlobal({ signal } = {}) {
  return apiGet('/api/global', { signal });
}

export function fetchMarkets({ page = 1, perPage = 50, order = 'market_cap_desc', signal } = {}) {
  return apiGet('/api/markets', { params: { page, perPage, order }, signal });
}

export function fetchChart({ id, days, signal }) {
  return apiGet('/api/chart', { params: { id, days }, signal });
}

export function fetchTrending({ signal } = {}) {
  return apiGet('/api/trending', { signal });
}
