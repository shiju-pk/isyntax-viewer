/**
 * Lightweight performance instrumentation for the iSyntax decode/render pipeline.
 * Gated behind a DEBUG_PERF flag — zero cost when disabled.
 *
 * Usage:
 *   PerfMonitor.begin('rice-decode');
 *   // ... hot path ...
 *   PerfMonitor.end('rice-decode');
 *   PerfMonitor.dump(); // logs all metrics to console
 */

interface PerfEntry {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  lastMs: number;
}

class PerfMonitorImpl {
  private enabled: boolean;
  private entries = new Map<string, PerfEntry>();
  private marks = new Map<string, number>();

  constructor() {
    this.enabled =
      typeof globalThis !== 'undefined' &&
      ((globalThis as any).__DEBUG_PERF__ === true ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('DEBUG_PERF') === '1'));
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  begin(label: string): void {
    if (!this.enabled) return;
    this.marks.set(label, performance.now());
  }

  end(label: string): number {
    if (!this.enabled) return 0;
    const start = this.marks.get(label);
    if (start === undefined) return 0;

    const elapsed = performance.now() - start;
    this.marks.delete(label);

    let entry = this.entries.get(label);
    if (!entry) {
      entry = { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, lastMs: 0 };
      this.entries.set(label, entry);
    }

    entry.count++;
    entry.totalMs += elapsed;
    entry.lastMs = elapsed;
    if (elapsed < entry.minMs) entry.minMs = elapsed;
    if (elapsed > entry.maxMs) entry.maxMs = elapsed;

    return elapsed;
  }

  /**
   * Measure a synchronous block. Returns the block's return value.
   */
  measure<T>(label: string, fn: () => T): T {
    if (!this.enabled) return fn();
    this.begin(label);
    const result = fn();
    this.end(label);
    return result;
  }

  /**
   * Measure an async block. Returns the block's return value.
   */
  async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) return fn();
    this.begin(label);
    const result = await fn();
    this.end(label);
    return result;
  }

  getStats(label: string): PerfEntry | undefined {
    return this.entries.get(label);
  }

  reset(): void {
    this.entries.clear();
    this.marks.clear();
  }

  dump(): void {
    if (this.entries.size === 0) {
      console.log('[PerfMonitor] No data recorded.');
      return;
    }

    console.group('[PerfMonitor] Pipeline Metrics');
    for (const [label, e] of this.entries) {
      const avgMs = e.count > 0 ? (e.totalMs / e.count).toFixed(2) : '0.00';
      console.log(
        `  ${label}: count=${e.count} avg=${avgMs}ms min=${e.minMs.toFixed(2)}ms max=${e.maxMs.toFixed(2)}ms last=${e.lastMs.toFixed(2)}ms total=${e.totalMs.toFixed(1)}ms`
      );
    }
    console.groupEnd();
  }
}

export const PerfMonitor = new PerfMonitorImpl();
