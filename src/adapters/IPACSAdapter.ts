import type { Study } from '../core/domain/Study';
import type { CapabilitySet } from '../core/domain/CapabilitySet';
import type { Annotation } from '../core/domain/Annotation';
import type { DecodedImage, ProgressCallback } from '../core/types/imaging';
import type { DicomImageMetadata } from '../core/types/dicom';

// ─── Authentication ──────────────────────────────────────────

export interface AuthCredentials {
  username: string;
  password: string;
  authSource?: string;
  culture?: string;
}

export interface AuthResult {
  success: boolean;
  sessionToken?: string;
  errorMessage?: string;
}

// ─── Worklist ────────────────────────────────────────────────

export interface WorklistQuery {
  patientName?: string;
  patientId?: string;
  accessionNumber?: string;
  modality?: string;
  dateRange?: { from: string; to: string };
  maxResults?: number;
}

export interface WorklistEntry {
  examKey: string;
  patientName: string;
  patientId: string;
  accessionNumber: string;
  modality: string;
  studyDate: string;
  studyDescription?: string;
  studyUIDs: string[];
  stackId?: string;
  // Extended fields (populated by ISPACS worklist)
  imageCount?: number;
  bodyPart?: string;
  examStatus?: string;
  referringProvider?: string;
  patientKey?: string;
}

export interface ExamStudyInfo {
  examKey: string;
  studyKey: string;
  studyUid: string;
  studyStackUid: string;
  studyDateTime: string;
  imageCount: number;
  studyHost?: string;
  studyUrl?: string;
}

// ─── Adapter Interface ───────────────────────────────────────

/**
 * Abstraction layer over a PACS backend.
 * All server communication flows through this interface so the UI
 * and service layers remain backend-agnostic.
 */
export interface IPACSAdapter {
  /** Human-readable adapter name (for logging / diagnostics). */
  readonly name: string;

  // --- Capabilities ---
  getCapabilities(): CapabilitySet;

  // --- Authentication ---
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;
  logout(): Promise<void>;
  isAuthenticated(): boolean;

  // --- Worklist ---
  queryWorklist(query: WorklistQuery): Promise<WorklistEntry[]>;

  // --- Study loading ---
  loadStudy(studyUID: string, stackId: string): Promise<Study>;
  getStudyMetadata(
    studyUID: string,
    stackId: string,
  ): Promise<Map<string, DicomImageMetadata>>;

  // --- Image retrieval ---
  initImage(
    studyUID: string,
    instanceUID: string,
    stackId: string,
  ): Promise<DecodedImage>;

  loadImageLevel(
    studyUID: string,
    instanceUID: string,
    stackId: string,
    level: number,
  ): Promise<DecodedImage>;

  loadAllLevels(
    studyUID: string,
    instanceUID: string,
    stackId: string,
    onProgress?: ProgressCallback,
  ): Promise<DecodedImage>;

  // --- Priors (optional — gated by supportsPriors capability) ---
  queryPriorStudies?(
    patientId: string,
    currentStudyUID: string,
  ): Promise<WorklistEntry[]>;

  // --- Persistence (optional — gated by capabilities) ---
  saveAnnotations?(studyUID: string, annotations: Annotation[]): Promise<void>;
  savePresentationState?(studyUID: string, state: unknown): Promise<void>;
  loadPresentationState?(studyUID: string, psName: string): Promise<unknown>;

  // --- Lifecycle ---
  dispose(): void;
}
