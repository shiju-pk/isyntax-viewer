/**
 * Describes the capabilities exposed by a PACS backend adapter.
 * Used by FeatureFlagService to gate UI features.
 */
export interface CapabilitySet {
  // Study & metadata
  supportsStudyQuery: boolean;
  supportsSeriesMetadata: boolean;
  supportsStudyData: boolean;

  // Image retrieval
  supportsISyntaxStreaming: boolean;
  supportsClientJPEGDecode: boolean;
  supportsMultiFrame: boolean;

  // Clinical features
  supportsPriors: boolean;
  supportsGSPS: boolean;
  supportsOverlays: boolean;

  // Persistence
  supportsSaveAnnotations: boolean;
  supportsSavePresentationState: boolean;
  supportsAudit: boolean;

  // Volume
  supportsVolumeMetadata: boolean;
  supportsSegmentation: boolean;
}

/**
 * Default capability set — assumes a fully featured iSyntax PACS backend.
 */
export function getDefaultCapabilities(): CapabilitySet {
  return {
    supportsStudyQuery: true,
    supportsSeriesMetadata: true,
    supportsStudyData: false,
    supportsISyntaxStreaming: true,
    supportsClientJPEGDecode: true,
    supportsMultiFrame: false,
    supportsPriors: false,
    supportsGSPS: true,
    supportsOverlays: true,
    supportsSaveAnnotations: false,
    supportsSavePresentationState: false,
    supportsAudit: false,
    supportsVolumeMetadata: false,
    supportsSegmentation: false,
  };
}
