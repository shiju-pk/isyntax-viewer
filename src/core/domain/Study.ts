import type { Series } from './Series';
import type { PresentationStateDescriptor } from './PresentationStateDescriptor';

export interface Study {
  uid: string;
  stackId: string;
  patientName: string;
  patientId: string;
  accessionNumber?: string;
  studyDate?: string;
  studyDescription?: string;
  modality: string;
  series: Series[];
  psDescriptors?: PresentationStateDescriptor[];
  /** Extension point for backend-specific data */
  extra?: Record<string, unknown>;
}
