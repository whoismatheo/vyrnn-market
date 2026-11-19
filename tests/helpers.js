export function createResponse() {
  const headers = {};
  return {
    statusCode: 200,
    headers,
    body: '',
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    end(chunk) {
      this.body = chunk ?? '';
    },
    json() {
      return JSON.parse(this.body);
    },
  };
}

export function createRequest({ method = 'GET', url = '/', headers = {}, query } = {}) {
  return { method, url, headers, query, socket: { remoteAddress: '127.0.0.1' } };
}

export function createFetchMock(responses) {
  const calls = [];
  const queue = [...responses];

  async function fetchMock(url, options) {
    calls.push({ url, options });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) throw next;
    return next.clone();
  }

  fetchMock.calls = calls;
  return fetchMock;
}

export function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}
