export class ApiError extends Error {
  constructor(status, code, message, { details, headers } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.headers = headers ?? {};
  }

  static badRequest(message, details) {
    return new ApiError(400, 'bad_request', message, { details });
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'not_found', message);
  }

  static methodNotAllowed(allowed) {
    return new ApiError(405, 'method_not_allowed', 'Method not allowed', {
      headers: { Allow: allowed.join(', ') },
    });
  }

  static tooManyRequests(retryAfterSeconds) {
    return new ApiError(429, 'rate_limited', 'Too many requests', {
      headers: { 'Retry-After': String(retryAfterSeconds) },
    });
  }

  static upstream(message, code = 'upstream_error') {
    return new ApiError(502, code, message);
  }

  static upstreamTimeout() {
    return new ApiError(504, 'upstream_timeout', 'The market data provider did not respond in time');
  }

  static upstreamRateLimited(retryAfterSeconds) {
    return new ApiError(503, 'upstream_rate_limited', 'The market data provider is rate limiting requests', {
      headers: { 'Retry-After': String(retryAfterSeconds) },
    });
  }

  toBody() {
    const error = { code: this.code, message: this.message };
    if (this.details !== undefined) error.details = this.details;
    return { error };
  }
}

export function isUpstreamError(error) {
  return error instanceof ApiError && error.code.startsWith('upstream_');
}
