import { LogLevel } from './LogSink';
import type { LogEntry, LogSink } from './LogSink';

/**
 * Default log sink that writes to the browser console.
 */
export class ConsoleLogSink implements LogSink {
  write(entry: LogEntry): void {
    const prefix = `[${entry.category}]`;
    const args: unknown[] = [prefix, entry.message];
    if (entry.data !== undefined) args.push(entry.data);

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(...args);
        break;
      case LogLevel.INFO:
        console.info(...args);
        break;
      case LogLevel.WARN:
        console.warn(...args);
        break;
      case LogLevel.ERROR:
        console.error(...args);
        break;
    }
  }
}
