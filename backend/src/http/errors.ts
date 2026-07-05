import type { ApiHandler, ApiNext, ApiRequest, ApiResponse } from "./types";

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, message: string, code = "http_error", details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown): HttpError {
  return new HttpError(400, message, "bad_request", details);
}

export function unauthorized(message = "Authentication is required."): HttpError {
  return new HttpError(401, message, "unauthorized");
}

export function notFound(message = "Resource not found."): HttpError {
  return new HttpError(404, message, "not_found");
}

export function forbidden(message = "You do not have access to this resource."): HttpError {
  return new HttpError(403, message, "forbidden");
}

export function conflict(message: string): HttpError {
  return new HttpError(409, message, "conflict");
}

export function asyncHandler<TBody = unknown>(handler: ApiHandler<TBody>): ApiHandler<TBody> {
  return (req: ApiRequest<TBody>, res: ApiResponse, next: ApiNext) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
