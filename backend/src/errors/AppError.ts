export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static validation(details?: unknown, message = "Validation failed") {
    return new AppError(400, "VALIDATION_ERROR", message, details);
  }

  static unauthorized(message = "Missing or invalid token", details?: unknown) {
    return new AppError(401, "UNAUTHORIZED", message, details);
  }

  static forbidden(message = "Insufficient permissions", details?: unknown) {
    return new AppError(403, "FORBIDDEN", message, details);
  }

  static notFound(message = "Not found", details?: unknown) {
    return new AppError(404, "NOT_FOUND", message, details);
  }

  static conflict(message = "Conflict", details?: unknown) {
    return new AppError(409, "CONFLICT", message, details);
  }
}
