/** Errors whose message is safe to show to the client. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (msg = "Invalid request", details?: Record<string, unknown>) =>
  new AppError(400, "bad_request", msg, details);
export const unauthorized = (msg = "Please sign in to continue") => new AppError(401, "unauthorized", msg);
export const forbidden = (msg = "You do not have permission to do that") => new AppError(403, "forbidden", msg);
export const notFound = (msg = "Not found") => new AppError(404, "not_found", msg);
export const conflict = (msg: string) => new AppError(409, "conflict", msg);
export const tooManyRequests = (retryAfterSeconds: number) =>
  new AppError(429, "rate_limited", "Too many attempts. Please wait and try again.", { retryAfterSeconds });
export const serviceUnavailable = (msg: string) => new AppError(503, "service_unavailable", msg);
