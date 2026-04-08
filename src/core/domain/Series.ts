import type { Instance } from './Instance';

export interface Series {
  uid: string;
  seriesNumber: number;
  seriesDescription?: string;
  modality: string;
  frameOfReferenceUID?: string;
  instances: Instance[];
  /** Extension point for backend-specific data */
  extra?: Record<string, unknown>;
}
