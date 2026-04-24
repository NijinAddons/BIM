type ApiErrorDetails = {
  body?: string;
  cause?: unknown;
  status?: number;
  url?: string;
};

export class ApiError extends Error {
  body?: string;
  cause?: unknown;
  status?: number;
  url?: string;

  constructor(message: string, details: ApiErrorDetails = {}) {
    super(message);
    this.name = 'ApiError';
    this.body = details.body;
    this.cause = details.cause;
    this.status = details.status;
    this.url = details.url;
  }
}
