export class HttpError extends Error {
  public readonly status: number;
  public readonly code?: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export function notFound(message: string, code = "NOT_FOUND"): HttpError {
  return new HttpError(404, message, code);
}

export function badRequest(message: string, code = "BAD_REQUEST"): HttpError {
  return new HttpError(400, message, code);
}

export function unauthorized(message: string, code = "UNAUTHORIZED"): HttpError {
  return new HttpError(401, message, code);
}

export function forbidden(message: string, code = "FORBIDDEN"): HttpError {
  return new HttpError(403, message, code);
}
