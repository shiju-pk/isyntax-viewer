import type { Study } from '../../core/domain/Study';
import type { DicomImageMetadata } from '../../core/types/dicom';

/**
 * Study loading service interface.
 * Maps to /ResultsAuthority/ endpoints for study document retrieval.
 */
export interface IStudyService {
  loadStudy(studyUID: string, stackId: string): Promise<Study>;
  getStudyMetadata(studyUID: string, stackId: string): Promise<Map<string, DicomImageMetadata>>;
}
