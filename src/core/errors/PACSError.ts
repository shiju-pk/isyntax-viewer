export enum PACSErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_FAILED = 'AUTH_FAILED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  STUDY_NOT_FOUND = 'STUDY_NOT_FOUND',
  IMAGE_LOAD_FAILED = 'IMAGE_LOAD_FAILED',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  CAPABILITY_NOT_SUPPORTED = 'CAPABILITY_NOT_SUPPORTED',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT = 'TIMEOUT',
  PARSE_ERROR = 'PARSE_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export interface PACSErrorOptions {
  recoverable?: boolean;
  retryable?: boolean;
  details?: unknown;
  cause?: Error;
}

/**
 * Structured error type for all PACS-related failures.
 * Carries a machine-readable code, recovery hints, and optional details.
 */
export class PACSError extends Error {
  readonly code: PACSErrorCode;
  readonly recoverable: boolean;
  readonly retryable: boolean;
  readonly details?: unknown;

  readonly cause?: Error;

  constructor(code: PACSErrorCode, message: string, options: PACSErrorOptions = {}) {
    super(message);
    this.name = 'PACSError';
    this.code = code;
    this.recoverable = options.recoverable ?? false;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
    this.cause = options.cause;
  }

  /** Create a network error (retryable by default). */
  static network(message: string, cause?: Error): PACSError {
    return new PACSError(PACSErrorCode.NETWORK_ERROR, message, {
      recoverable: true,
      retryable: true,
      cause,
    });
  }

  /** Create a study-not-found error (not retryable). */
  static studyNotFound(studyUID: string): PACSError {
    return new PACSError(
      PACSErrorCode.STUDY_NOT_FOUND,
      `Study not found: ${studyUID}`,
      { recoverable: false, retryable: false, details: { studyUID } },
    );
  }

  /** Create an image load failure (retryable). */
  static imageLoadFailed(instanceUID: string, cause?: Error): PACSError {
    return new PACSError(
      PACSErrorCode.IMAGE_LOAD_FAILED,
      `Failed to load image: ${instanceUID}`,
      { recoverable: true, retryable: true, cause, details: { instanceUID } },
    );
  }

  /** Create a session-expired error. */
  static sessionExpired(): PACSError {
    return new PACSError(
      PACSErrorCode.SESSION_EXPIRED,
      'Session has expired. Please log in again.',
      { recoverable: true, retryable: false },
    );
  }
}
