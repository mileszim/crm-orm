export class AuthError extends Error { constructor(message = 'Unauthorized', public status = 401) { super(message); this.name = 'AuthError'; } }
export class ForbiddenError extends Error { constructor(message = 'Forbidden', public status = 403) { super(message); this.name = 'ForbiddenError'; } }
export class NotFoundError extends Error { constructor(message = 'Not Found', public status = 404) { super(message); this.name = 'NotFoundError'; } }
export class MethodError extends Error { constructor(message = 'Method Not Allowed', public status = 405) { super(message); this.name = 'MethodError'; } }
export class RateLimitError extends Error { constructor(message = 'Rate Limited', public status = 429, public retryAfterMs?: number) { super(message); this.name = 'RateLimitError'; } }
export class BadRequestError extends Error { constructor(message = 'Bad Request', public status = 400) { super(message); this.name = 'BadRequestError'; } }
export class ServerError extends Error { constructor(message = 'Server Error', public status = 500) { super(message); this.name = 'ServerError'; } }
export class UnknownProviderError extends Error { constructor(message = 'Unknown Provider') { super(message); this.name = 'UnknownProviderError'; } }

export function mapHttpError(status: number, message?: string): Error {
  if (status === 400) return new BadRequestError(message);
  if (status === 401) return new AuthError(message);
  if (status === 403) return new ForbiddenError(message);
  if (status === 404) return new NotFoundError(message);
  if (status === 405) return new MethodError(message);
  if (status === 429) return new RateLimitError(message);
  if (status >= 500) return new ServerError(message, status);
  return new Error(message || `HTTP ${status}`);
}


