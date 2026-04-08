export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3. */
  maxAttempts?: number;
  /** Initial delay in ms before first retry. Default: 500. */
  initialDelayMs?: number;
  /** Multiplier applied to delay after each retry. Default: 2. */
  backoffMultiplier?: number;
  /** Maximum delay cap in ms. Default: 10000. */
  maxDelayMs?: number;
  /** Optional AbortSignal to cancel retries. */
  signal?: AbortSignal;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'signal'>> = {
  maxAttempts: 3,
  initialDelayMs: 500,
  backoffMultiplier: 2,
  maxDelayMs: 10_000,
};

/**
 * Execute an async operation with exponential-backoff retries.
 * Only retries if `shouldRetry` returns true for the caught error.
 */
export async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  shouldRetry: (error: unknown, attempt: number) => boolean,
  options?: RetryOptions,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt >= opts.maxAttempts || !shouldRetry(error, attempt)) {
        throw error;
      }
      // Check abort signal
      if (opts.signal?.aborted) {
        throw error;
      }
      // Wait before retry
      await sleep(delay, opts.signal);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  // Should not reach here, but satisfy TS
  throw new Error('Retry exhausted');
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

/**
 * Simple circuit-breaker: tracks consecutive failures and opens
 * the circuit (throws immediately) when the threshold is exceeded.
 */
export class CircuitBreaker {
  private failures = 0;
  private open = false;
  private halfOpenTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeoutMs: number = 30_000,
  ) {}

  /** Record a successful call — resets the failure counter. */
  recordSuccess(): void {
    this.failures = 0;
    this.open = false;
    if (this.halfOpenTimer) {
      clearTimeout(this.halfOpenTimer);
      this.halfOpenTimer = null;
    }
  }

  /** Record a failed call — may trip the circuit. */
  recordFailure(): void {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.open = true;
      // Auto-recover after timeout (half-open state)
      if (!this.halfOpenTimer) {
        this.halfOpenTimer = setTimeout(() => {
          this.open = false;
          this.halfOpenTimer = null;
        }, this.resetTimeoutMs);
      }
    }
  }

  /** Check if the circuit is open (should not make calls). */
  isOpen(): boolean {
    return this.open;
  }

  /** Reset the circuit breaker state. */
  reset(): void {
    this.failures = 0;
    this.open = false;
    if (this.halfOpenTimer) {
      clearTimeout(this.halfOpenTimer);
      this.halfOpenTimer = null;
    }
  }
}
