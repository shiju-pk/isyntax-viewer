import type { DecodedImage, ProgressCallback } from '../../core/types/imaging';

/**
 * Image retrieval service interface.
 * Maps to /ResultsAuthority/ endpoints for iSyntax image data.
 */
export interface IImagingService {
  initImage(studyUID: string, instanceUID: string, stackId: string): Promise<DecodedImage>;
  loadImageLevel(studyUID: string, instanceUID: string, stackId: string, level: number): Promise<DecodedImage>;
  loadAllLevels(studyUID: string, instanceUID: string, stackId: string, onProgress?: ProgressCallback): Promise<DecodedImage>;
  dispose(): void;
}
