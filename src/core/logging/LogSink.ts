export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  category: string;
  message: string;
  timestamp: number;
  data?: unknown;
}

/**
 * A log sink receives structured log entries.
 * Implement this interface to route logs to different destinations
 * (console, remote service, file, etc.).
 */
export interface LogSink {
  write(entry: LogEntry): void;
}
