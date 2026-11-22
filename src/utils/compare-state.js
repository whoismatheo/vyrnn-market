import { CHART_RANGES, DEFAULT_RANGE } from './ranges.js';

export const MIN_ASSETS = 2;
export const MAX_ASSETS = 4;

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const MAX_ID_LENGTH = 100;

export function parseComparison(search) {
  const params = new URLSearchParams(search);
  const ids = (params.get('ids') ?? '').split(',').filter((id) => id.length <= MAX_ID_LENGTH && ID_PATTERN.test(id));
  const range = params.get('range');

  return {
    ids: [...new Set(ids)].slice(0, MAX_ASSETS),
    range: CHART_RANGES.includes(range) ? range : DEFAULT_RANGE,
  };
}

export function buildComparisonUrl({ ids, range }) {
  const parts = [];
  if (ids.length > 0) parts.push(`ids=${ids.join(',')}`);
  if (range !== DEFAULT_RANGE) parts.push(`range=${range}`);
  return parts.length > 0 ? `/compare?${parts.join('&')}` : '/compare';
}
