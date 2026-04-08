import type { Annotation } from '../../core/domain/Annotation';

/**
 * Persistence service interface for annotations and presentation state.
 */
export interface IPersistenceService {
  saveAnnotations(studyUID: string, annotations: Annotation[]): Promise<void>;
  savePresentationState(studyUID: string, state: unknown): Promise<void>;
  loadPresentationState(studyUID: string, psName: string): Promise<unknown>;
}
