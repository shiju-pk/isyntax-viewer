export type {
  IPACSAdapter,
  AuthCredentials,
  AuthResult,
  WorklistQuery,
  WorklistEntry,
  ExamStudyInfo,
} from './IPACSAdapter';
export { ISyntaxPACSAdapter } from './isyntax/ISyntaxPACSAdapter';
export { MockPACSAdapter } from './mock/MockPACSAdapter';
export { CompositeAdapter } from './CompositeAdapter';
export { ISyntaxProvider } from './isyntax/ISyntaxProvider';
export { ISPACSProvider } from './ispacs/ISPACSProvider';
export { ISPACSAuthService } from './ispacs/ISPACSAuthService';
export { MockProvider } from './mock/MockProvider';
export type { BackendProvider } from './BackendProvider';
export { registerBackendProvider, getBackendProvider, getRegisteredProviders } from './BackendProvider';

// Fine-grained service interfaces
export type {
  IAuthService,
  SecurityContext,
  AccessRight,
  AuthenticationSource,
} from './interfaces/IAuthService';
export type { IWorklistService } from './interfaces/IWorklistService';
export type { IStudyService } from './interfaces/IStudyService';
export type { IImagingService } from './interfaces/IImagingService';
export type { IPersistenceService } from './interfaces/IPersistenceService';
export type { IDiscoveryService, ServiceMap, ServiceMapEntry } from './interfaces/IDiscoveryService';
