import { LogLevel } from './LogSink';
import type { LogEntry, LogSink } from './LogSink';
import { ConsoleLogSink } from './ConsoleLogSink';

const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

/**
 * Centralized structured logger.
 * Singleton — use `Logger.debug(...)`, `Logger.info(...)`, etc.
 */
class LoggerImpl {
  private level: LogLevel = LogLevel.INFO;
  private sinks: LogSink[] = [new ConsoleLogSink()];

  setLevel(level: LogLevel | string): void {
    if (typeof level === 'string') {
      this.level = LOG_LEVEL_MAP[level.toLowerCase()] ?? LogLevel.INFO;
    } else {
      this.level = level;
    }
  }

  addSink(sink: LogSink): void {
    this.sinks.push(sink);
  }

  removeSink(sink: LogSink): void {
    const idx = this.sinks.indexOf(sink);
    if (idx >= 0) this.sinks.splice(idx, 1);
  }

  clearSinks(): void {
    this.sinks.length = 0;
  }

  debug(category: string, message: string, data?: unknown): void {
    this._log(LogLevel.DEBUG, category, message, data);
  }

  info(category: string, message: string, data?: unknown): void {
    this._log(LogLevel.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: unknown): void {
    this._log(LogLevel.WARN, category, message, data);
  }

  error(category: string, message: string, data?: unknown): void {
    this._log(LogLevel.ERROR, category, message, data);
  }

  private _log(level: LogLevel, category: string, message: string, data?: unknown): void {
    if (level < this.level) return;

    const entry: LogEntry = {
      level,
      category,
      message,
      timestamp: Date.now(),
      data,
    };

    for (const sink of this.sinks) {
      try {
        sink.write(entry);
      } catch {
        // Never let a sink crash the app
      }
    }
  }
}

export const Logger = new LoggerImpl();
