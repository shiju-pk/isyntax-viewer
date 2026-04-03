/**
 * Priority-based request pool manager.
 *
 * Pattern inspired by cornerstone3D's requestPoolManager:
 *   - 4 priority channels: Interaction, Thumbnail, Prefetch, Compute
 *   - Per-channel concurrency limits
 *   - FIFO within each channel, channels drained in priority order
 *   - Cancellation support
 */

export enum RequestType {
  /** User-initiated requests (highest priority) — visible tiles, clicked images */
  Interaction = 'interaction',
  /** Thumbnail requests */
  Thumbnail = 'thumbnail',
  /** Prefetch — adjacent tiles, nearby images */
  Prefetch = 'prefetch',
  /** Background compute tasks (lowest priority) */
  Compute = 'compute',
}

/** Priority ordering (lower index = higher priority) */
const REQUEST_PRIORITY: RequestType[] = [
  RequestType.Interaction,
  RequestType.Thumbnail,
  RequestType.Prefetch,
  RequestType.Compute,
];

export interface RequestEntry {
  id: string;
  type: RequestType;
  execute: () => Promise<unknown>;
  abortController: AbortController;
}

interface ChannelConfig {
  maxConcurrent: number;
}

interface ChannelState {
  queue: RequestEntry[];
  active: Set<string>;
  config: ChannelConfig;
}

export interface RequestPoolOptions {
  /** Concurrent request limits per channel */
  maxConcurrent?: Partial<Record<RequestType, number>>;
}

const DEFAULT_CONCURRENCY: Record<RequestType, number> = {
  [RequestType.Interaction]: 6,
  [RequestType.Thumbnail]: 6,
  [RequestType.Prefetch]: 5,
  [RequestType.Compute]: 2,
};

let requestCounter = 0;

export class RequestPoolManager {
  private channels: Map<RequestType, ChannelState>;
  private _drainScheduled = false;

  constructor(options: RequestPoolOptions = {}) {
    this.channels = new Map();

    for (const type of REQUEST_PRIORITY) {
      this.channels.set(type, {
        queue: [],
        active: new Set(),
        config: {
          maxConcurrent: options.maxConcurrent?.[type] ?? DEFAULT_CONCURRENCY[type],
        },
      });
    }
  }

  /**
   * Add a request to the pool. Returns a promise that resolves when the
   * request completes, and an AbortController to cancel it.
   */
  addRequest<T>(
    executeFn: (signal: AbortSignal) => Promise<T>,
    type: RequestType = RequestType.Interaction,
  ): { promise: Promise<T>; abort: () => void } {
    const id = `req-${++requestCounter}`;
    const abortController = new AbortController();

    const { promise, resolve, reject } = createDeferred<T>();

    const entry: RequestEntry = {
      id,
      type,
      execute: async () => {
        try {
          const result = await executeFn(abortController.signal);
          resolve(result);
        } catch (err) {
          reject(err as Error);
        }
      },
      abortController,
    };

    const channel = this.channels.get(type)!;
    channel.queue.push(entry);

    this._scheduleDrain();

    return {
      promise,
      abort: () => {
        abortController.abort();
        // Remove from queue if still waiting
        const idx = channel.queue.findIndex(e => e.id === id);
        if (idx !== -1) {
          channel.queue.splice(idx, 1);
          reject(new DOMException('Request aborted', 'AbortError'));
        }
      },
    };
  }

  /**
   * Cancel all pending requests of a specific type.
   */
  clearRequestType(type: RequestType): void {
    const channel = this.channels.get(type);
    if (!channel) return;

    for (const entry of channel.queue) {
      entry.abortController.abort();
    }
    channel.queue = [];
  }

  /**
   * Cancel all pending requests across all channels.
   */
  clearAll(): void {
    for (const type of REQUEST_PRIORITY) {
      this.clearRequestType(type);
    }
  }

  /**
   * Get the count of pending + active requests per type.
   */
  getStats(): Record<RequestType, { queued: number; active: number }> {
    const stats = {} as Record<RequestType, { queued: number; active: number }>;
    for (const [type, channel] of this.channels) {
      stats[type] = {
        queued: channel.queue.length,
        active: channel.active.size,
      };
    }
    return stats;
  }

  // --- Private ---

  private _scheduleDrain(): void {
    if (this._drainScheduled) return;
    this._drainScheduled = true;
    // Use queueMicrotask for immediate scheduling without yielding to RAF
    queueMicrotask(() => {
      this._drainScheduled = false;
      this._drain();
    });
  }

  /**
   * Drain queues in priority order, respecting concurrency limits.
   */
  private _drain(): void {
    for (const type of REQUEST_PRIORITY) {
      const channel = this.channels.get(type)!;

      while (
        channel.queue.length > 0 &&
        channel.active.size < channel.config.maxConcurrent
      ) {
        const entry = channel.queue.shift()!;

        // Skip if already aborted
        if (entry.abortController.signal.aborted) continue;

        channel.active.add(entry.id);

        entry.execute().finally(() => {
          channel.active.delete(entry.id);
          // After a slot frees up, try to drain again
          this._scheduleDrain();
        });
      }
    }
  }
}

/** Helper to create an externally-resolvable promise */
function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Singleton default request pool instance.
 */
export const requestPool = new RequestPoolManager();
