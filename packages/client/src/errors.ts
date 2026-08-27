export class BackendOSError extends Error {
  code?: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string | undefined, status: number, details?: unknown) {
    super(message);
    this.name = "BackendOSError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
