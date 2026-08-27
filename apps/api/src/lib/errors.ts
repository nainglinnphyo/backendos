export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const Errors = {
  unauthorized: (msg = "Unauthorized") => new ApiError(401, "UNAUTHORIZED", msg),
  forbidden: (msg = "Forbidden") => new ApiError(403, "FORBIDDEN", msg),
  notFound: (msg = "Not found") => new ApiError(404, "NOT_FOUND", msg),
  badRequest: (msg: string, details?: unknown) => new ApiError(400, "BAD_REQUEST", msg, details),
  conflict: (msg: string) => new ApiError(409, "CONFLICT", msg),
  internal: (msg = "Internal server error") => new ApiError(500, "INTERNAL_ERROR", msg),
};

/** Maps common Postgres error codes to friendly, structured API errors. */
export function fromPgError(err: unknown): ApiError {
  const pgErr = err as { code?: string; message?: string; constraint?: string; column?: string };
  switch (pgErr?.code) {
    case "23505":
      return new ApiError(409, "UNIQUE_VIOLATION", `Unique constraint violated${pgErr.constraint ? ` (${pgErr.constraint})` : ""}`);
    case "23503":
      return new ApiError(409, "FOREIGN_KEY_VIOLATION", `Foreign key constraint violated${pgErr.constraint ? ` (${pgErr.constraint})` : ""}`);
    case "23502":
      return new ApiError(400, "NOT_NULL_VIOLATION", `Column "${pgErr.column ?? "unknown"}" cannot be null`);
    case "22P02":
      return new ApiError(400, "INVALID_INPUT", "Invalid input syntax for one or more values");
    case "42P01":
      return new ApiError(404, "NOT_FOUND", "Table not found");
    case "42703":
      return new ApiError(400, "BAD_REQUEST", "Unknown column");
    default:
      return Errors.internal(pgErr?.message ?? "Unexpected database error");
  }
}
