import { apiGet } from './client.js';

export async function fetchHealth({ signal, checkUpstream = false } = {}) {
  const { data } = await apiGet('/api/health', {
    params: checkUpstream ? { check: 'upstream' } : undefined,
    signal,
  });
  return data;
}
