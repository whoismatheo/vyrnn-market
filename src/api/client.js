export class ApiRequestError extends Error {
  constructor(message, { status = null, code }) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

function withTimeout(signal, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const forward = () => controller.abort();

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', forward, { once: true });
  }

  return {
    signal: controller.signal,
    release() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forward);
    },
  };
}

export async function apiGet(path, { params, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const query = params ? `?${new URLSearchParams(params)}` : '';
  const request = withTimeout(signal, timeoutMs);

  try {
    let response;
    try {
      response = await fetch(`${path}${query}`, {
        headers: { accept: 'application/json' },
        signal: request.signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ApiRequestError('The request failed', { code: request.signal.aborted ? 'timeout' : 'network' });
    }

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiRequestError(body?.error?.message ?? response.statusText, {
        status: response.status,
        code: body?.error?.code ?? 'http_error',
      });
    }
    if (body === null || typeof body !== 'object' || !('data' in body)) {
      throw new ApiRequestError('The response was not understood', { status: response.status, code: 'invalid_response' });
    }
    return body;
  } finally {
    request.release();
  }
}
