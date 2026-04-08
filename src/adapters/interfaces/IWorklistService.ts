import type { WorklistQuery, WorklistEntry } from '../IPACSAdapter';

/**
 * Worklist service interface.
 * Maps to /ClinicalServices/ endpoints in ISPACS.
 */
export interface IWorklistService {
  examSearch(query: WorklistQuery): Promise<WorklistEntry[]>;
  patientSearch?(query: WorklistQuery): Promise<WorklistEntry[]>;
  quickSearch?(searchString: string, maxResults?: number): Promise<WorklistEntry[]>;
}
