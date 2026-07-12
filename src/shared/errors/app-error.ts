export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) { super(400, message); }
}

export class NotFoundError extends AppError {
  constructor(message: string) { super(404, message); }
}

export class ConflictError extends AppError {
  constructor(message: string) { super(409, message); }
}

export class RateLimitError extends AppError {
  constructor(message = 'GitHub API rate limit exceeded. Try again later.') {
    super(429, message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'External service temporarily unavailable') {
    super(503, message);
  }
}
