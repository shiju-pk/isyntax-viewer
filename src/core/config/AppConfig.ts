/**
 * Application-wide configuration.
 * Loaded from config.json (deploy-time), env vars (build-time),
 * and localStorage (user-time).
 */
import type { ServiceEndpoints } from '../../transport/endpoints/ServiceEndpoints';
import { DEFAULT_SERVICE_ENDPOINTS } from '../../transport/endpoints/ServiceEndpoints';

export interface AppConfig {
  // Server
  targetHostname: string;
  apiBasePath: string;

  // Service endpoints (3-service architecture)
  serviceEndpoints: ServiceEndpoints;

  // Adapter
  adapterType: 'isyntax' | 'ispacs' | 'mock';

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
  serviceEndpoints: { ...DEFAULT_SERVICE_ENDPOINTS },
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
