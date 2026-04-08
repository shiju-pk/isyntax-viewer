import type { IAuthService } from './interfaces/IAuthService';
import type { IWorklistService } from './interfaces/IWorklistService';
import type { IStudyService } from './interfaces/IStudyService';
import type { IImagingService } from './interfaces/IImagingService';
import type { IPersistenceService } from './interfaces/IPersistenceService';
import type { ServiceEndpoints } from '../transport/endpoints/ServiceEndpoints';

/**
 * A BackendProvider creates the fine-grained service implementations
 * for a specific backend type (isyntax, ispacs, mock).
 */
export interface BackendProvider {
  readonly name: string;
  createAuthService(endpoints: ServiceEndpoints): IAuthService;
  createWorklistService(endpoints: ServiceEndpoints): IWorklistService;
  createStudyService(endpoints: ServiceEndpoints): IStudyService;
  createImagingService(endpoints: ServiceEndpoints): IImagingService;
  createPersistenceService?(endpoints: ServiceEndpoints): IPersistenceService;
}

// ─── Provider Registry ──────────────────────────────────────────

const _registry = new Map<string, BackendProvider>();

/**
 * Register a backend provider by name.
 */
export function registerBackendProvider(provider: BackendProvider): void {
  _registry.set(provider.name, provider);
}

/**
 * Get a registered backend provider by name.
 * Throws if not found.
 */
export function getBackendProvider(name: string): BackendProvider {
  const provider = _registry.get(name);
  if (!provider) {
    throw new Error(
      `Backend provider '${name}' not registered. Available: [${Array.from(_registry.keys()).join(', ')}]`,
    );
  }
  return provider;
}

/**
 * List all registered provider names.
 */
export function getRegisteredProviders(): string[] {
  return Array.from(_registry.keys());
}
