import type { DicomImageMetadata } from '../types/dicom';

export interface Instance {
  uid: string;
  sopClassUID: string;
  instanceNumber?: number;
  metadata: DicomImageMetadata;
  isDeleted?: boolean;
  isMultiFrame?: boolean;
  numberOfFrames?: number;
  /** Extension point for backend-specific data */
  extra?: Record<string, unknown>;
}
