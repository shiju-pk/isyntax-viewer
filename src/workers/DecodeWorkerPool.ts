/**
 * WebWorker decode pool — manages a pool of decode workers with round-robin
 * task dispatch, idle termination, and Transferable zero-copy returns.
 *
 * Pattern inspired by cornerstone3D's webWorkerManager:
 *   - Register workers with configurable pool size
 *   - Load-balance by picking worker with minimum pending tasks
 *   - Auto-terminate idle workers after configurable timeout
 */

export interface DecodeTask {
  type: 'initImage' | 'coefficients';
  buffer: ArrayBuffer;
  level: number;
  /** Opaque state key — workers maintain per-image ISyntaxProcessor state */
  imageKey: string;
  /** Rows/cols hint for InitImage parsing */
  rows?: number;
  cols?: number;
}

export interface DecodeResult {
  /** The decoded pixel data (transferred, not copied) */
  pixelData: ArrayBuffer;
  /** Pixel-level (wavelet level) */
  pixelLevel: number;
  /** Decoded image dimensions */
  rows: number;
  cols: number;
  planes: number;
  format: string;
  /** Bytes per pixel element (2 = Int16, 4 = Int32) */
  bytesPerPixel: number;
  /** Number of transform levels (only on initImage) */
  xformLevels?: number;
}

interface WorkerEntry {
  worker: Worker;
  pendingTasks: number;
  lastActivity: number;
  taskCounter: number;
  pendingCallbacks: Map<number, {
    resolve: (result: DecodeResult) => void;
    reject: (error: Error) => void;
  }>;
}

export interface DecodeWorkerPoolOptions {
  /** Maximum number of workers. Defaults to navigator.hardwareConcurrency or 4. */
  maxWorkers?: number;
  /** Milliseconds before an idle worker is terminated. 0 = never. Default 10000. */
  idleTimeoutMs?: number;
}

export class DecodeWorkerPool {
  private workers: WorkerEntry[] = [];
  private maxWorkers: number;
  private idleTimeoutMs: number;
  private idleCheckInterval: ReturnType<typeof setInterval> | null = null;
  private workerUrl: URL;
  private terminated = false;

  constructor(options: DecodeWorkerPoolOptions = {}) {
    this.maxWorkers = options.maxWorkers ?? (navigator.hardwareConcurrency || 4);
    this.idleTimeoutMs = options.idleTimeoutMs ?? 10_000;

    // Create a URL pointing to the worker module (Vite handles this via `?worker&url`)
    this.workerUrl = new URL('./isyntaxDecodeWorker.ts', import.meta.url);

    // Start idle check if termination is enabled
    if (this.idleTimeoutMs > 0) {
      this.idleCheckInterval = setInterval(() => this._checkIdleWorkers(), this.idleTimeoutMs / 2);
    }
  }

  /**
   * Submit a decode task. Returns a promise with the decoded result.
   * The worker transfers the pixel data buffer (zero-copy).
   */
  async decode(task: DecodeTask): Promise<DecodeResult> {
    if (this.terminated) {
      throw new Error('DecodeWorkerPool has been terminated');
    }

    const entry = this._getOrCreateWorker();
    entry.pendingTasks++;
    entry.lastActivity = performance.now();

    const taskId = ++entry.taskCounter;

    return new Promise<DecodeResult>((resolve, reject) => {
      entry.pendingCallbacks.set(taskId, { resolve, reject });

      entry.worker.postMessage(
        {
          taskId,
          type: task.type,
          buffer: task.buffer,
          level: task.level,
          imageKey: task.imageKey,
          rows: task.rows,
          cols: task.cols,
        },
        [task.buffer] // Transfer the buffer to the worker (zero-copy)
      );
    });
  }

  /**
   * Terminate all workers and stop the idle check.
   */
  terminate(): void {
    this.terminated = true;
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
    for (const entry of this.workers) {
      entry.worker.terminate();
      // Reject all pending
      for (const [, cb] of entry.pendingCallbacks) {
        cb.reject(new Error('Worker pool terminated'));
      }
      entry.pendingCallbacks.clear();
    }
    this.workers = [];
  }

  get workerCount(): number {
    return this.workers.length;
  }

  get totalPendingTasks(): number {
    return this.workers.reduce((sum, w) => sum + w.pendingTasks, 0);
  }

  // --- Private ---

  /**
   * Pick the least-loaded worker, or create a new one if under the limit.
   */
  private _getOrCreateWorker(): WorkerEntry {
    // If we can create more workers, and all existing ones are busy, create one
    if (this.workers.length < this.maxWorkers) {
      const allBusy = this.workers.length === 0 || this.workers.every(w => w.pendingTasks > 0);
      if (allBusy) {
        return this._spawnWorker();
      }
    }

    // Pick worker with fewest pending tasks
    let best = this.workers[0];
    for (let i = 1; i < this.workers.length; i++) {
      if (this.workers[i].pendingTasks < best.pendingTasks) {
        best = this.workers[i];
      }
    }
    return best;
  }

  private _spawnWorker(): WorkerEntry {
    const worker = new Worker(this.workerUrl, { type: 'module' });

    const entry: WorkerEntry = {
      worker,
      pendingTasks: 0,
      lastActivity: performance.now(),
      taskCounter: 0,
      pendingCallbacks: new Map(),
    };

    worker.onmessage = (e: MessageEvent) => {
      const { taskId, error, result } = e.data;
      const cb = entry.pendingCallbacks.get(taskId);
      if (!cb) return;

      entry.pendingCallbacks.delete(taskId);
      entry.pendingTasks = Math.max(0, entry.pendingTasks - 1);
      entry.lastActivity = performance.now();

      if (error) {
        cb.reject(new Error(error));
      } else {
        cb.resolve(result as DecodeResult);
      }
    };

    worker.onerror = (e: ErrorEvent) => {
      // Reject all pending tasks on this worker
      for (const [, cb] of entry.pendingCallbacks) {
        cb.reject(new Error(e.message || 'Worker error'));
      }
      entry.pendingCallbacks.clear();
      entry.pendingTasks = 0;

      // Remove dead worker from pool
      const idx = this.workers.indexOf(entry);
      if (idx !== -1) this.workers.splice(idx, 1);
    };

    this.workers.push(entry);
    return entry;
  }

  /**
   * Terminate workers that have been idle beyond the timeout threshold.
   * Never terminates below 1 worker while pool has been used.
   */
  private _checkIdleWorkers(): void {
    if (this.terminated) return;
    const now = performance.now();

    for (let i = this.workers.length - 1; i >= 0; i--) {
      const entry = this.workers[i];
      const idle = entry.pendingTasks === 0 && (now - entry.lastActivity) > this.idleTimeoutMs;

      // Keep at least one worker alive if pool was ever used
      if (idle && this.workers.length > 1) {
        entry.worker.terminate();
        this.workers.splice(i, 1);
      }
    }
  }
}
