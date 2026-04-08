/**
 * Per-service endpoint configuration for the 3-service ISPACS architecture.
 * Can be auto-populated via DiscoveryService or statically configured.
 */
export interface ServiceEndpoints {
  /** /InfrastructureServices — Auth, Discovery, Session */
  infrastructure: string;
  /** /ClinicalServices — Worklist */
  clinical: string;
  /** /ResultsAuthority — StudyDoc, iSyntax images, PresentationState */
  resultsAuthority: string;
}

export const DEFAULT_SERVICE_ENDPOINTS: ServiceEndpoints = {
  infrastructure: '/InfrastructureServices',
  clinical: '/ClinicalServices',
  resultsAuthority: '/ResultsAuthority',
};
