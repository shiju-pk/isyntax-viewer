import type { ServiceEndpoints } from '../../transport/endpoints/ServiceEndpoints';

/**
 * Service discovery interface.
 * Maps to /InfrastructureServices/DiscoveryService/ in ISPACS.
 * Resolves dynamic service endpoints from the backend.
 */
export interface IDiscoveryService {
  discoverServices(): Promise<ServiceMap>;
  resolveEndpoints(): Promise<ServiceEndpoints>;
}

export interface ServiceMapEntry {
  name: string;
  absolutePath: string;
  scheme?: string;
  type?: string;
  isAnonymous?: boolean;
}

export type ServiceMap = Map<string, ServiceMapEntry>;
