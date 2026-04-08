/**
 * Application-wide configuration.
 * Loaded from config.json (deploy-time), env vars (build-time),
 * and localStorage (user-time).
 */
export interface AppConfig {
  // Server
  targetHostname: string;
  apiBasePath: string;

  // Adapter
  adapterType: 'isyntax' | 'mock';

  // Auth
  authEnabled: boolean;
  sessionTimeoutMs: number;

  // Performance
  maxConcurrentRequests: number;
  workerPoolSize: number;
  imageCacheMaxMB: number;

  // Features
  featureOverrides: Record<string, boolean>;

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enablePerformanceLogging: boolean;
  enableAudit: boolean;
}

export const DEFAULT_CONFIG: AppConfig = {
  targetHostname: 'http://localhost:5000',
  apiBasePath: '/ResultsAuthority',
  adapterType: 'isyntax',
  authEnabled: false,
  sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
  maxConcurrentRequests: 6,
  workerPoolSize: navigator?.hardwareConcurrency ?? 4,
  imageCacheMaxMB: 512,
  featureOverrides: {},
  logLevel: 'info',
  enablePerformanceLogging: false,
  enableAudit: false,
};
