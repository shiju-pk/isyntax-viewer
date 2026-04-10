import type { IPACSAdapter, AuthCredentials, AuthResult, WorklistQuery, WorklistEntry, ExamStudyInfo } from './IPACSAdapter';
import type { IAuthService } from './interfaces/IAuthService';
import type { IWorklistService } from './interfaces/IWorklistService';
import type { IStudyService } from './interfaces/IStudyService';
import type { IImagingService } from './interfaces/IImagingService';
import type { IPersistenceService } from './interfaces/IPersistenceService';
import type { Study } from '../core/domain/Study';
import type { CapabilitySet } from '../core/domain/CapabilitySet';
import { getDefaultCapabilities } from '../core/domain/CapabilitySet';
import type { Annotation } from '../core/domain/Annotation';
import type { DecodedImage, ProgressCallback } from '../core/types/imaging';
import type { DicomImageMetadata } from '../core/types/dicom';
import { Logger } from '../core/logging/Logger';

const LOG_CAT = 'CompositeAdapter';

/**
 * Facade adapter that implements IPACSAdapter by delegating to
 * fine-grained service interfaces (IAuthService, IWorklistService, etc.).
 *
 * This preserves full backward compatibility with all existing UI code
 * that depends on IPACSAdapter while allowing the underlying services
 * to be swapped per-backend.
 */
export class CompositeAdapter implements IPACSAdapter {
  readonly name: string;

  private _auth: IAuthService;
  private _worklist: IWorklistService;
  private _study: IStudyService;
  private _imaging: IImagingService;
  private _persistence: IPersistenceService | null;
  private _capabilities: CapabilitySet;

  constructor(params: {
    name: string;
    auth: IAuthService;
    worklist: IWorklistService;
    study: IStudyService;
    imaging: IImagingService;
    persistence?: IPersistenceService;
    capabilities?: CapabilitySet;
  }) {
    this.name = params.name;
    this._auth = params.auth;
    this._worklist = params.worklist;
    this._study = params.study;
    this._imaging = params.imaging;
    this._persistence = params.persistence ?? null;
    this._capabilities = params.capabilities ?? getDefaultCapabilities();
    Logger.info(LOG_CAT, `Created composite adapter: ${this.name}`);
  }

  /** Direct access to the underlying auth service for discovery/authSources. */
  get authService(): IAuthService {
    return this._auth;
  }

  /** Direct access to the underlying worklist service for quickSearch/patientSearch. */
  get worklistService(): IWorklistService {
    return this._worklist;
  }

  // ─── Capabilities ────────────────────────────────────────────

  getCapabilities(): CapabilitySet {
    return this._capabilities;
  }

  // ─── Authentication (delegates to IAuthService) ───────────────

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    return this._auth.authenticate(credentials);
  }

  async logout(): Promise<void> {
    return this._auth.logout();
  }

  isAuthenticated(): boolean {
    return this._auth.isAuthenticated();
  }

  // ─── Worklist (delegates to IWorklistService) ─────────────────

  async queryWorklist(query: WorklistQuery): Promise<WorklistEntry[]> {
    return this._worklist.examSearch(query);
  }

  async getExamStudies(examKey: string): Promise<ExamStudyInfo[]> {
    if (!this._worklist.getExamStudies) {
      throw new Error('getExamStudies not supported by this worklist service');
    }
    return this._worklist.getExamStudies(examKey);
  }

  // ─── Study loading (delegates to IStudyService) ───────────────

  async loadStudy(studyUID: string, stackId: string): Promise<Study> {
    return this._study.loadStudy(studyUID, stackId);
  }

  async getStudyMetadata(
    studyUID: string,
    stackId: string,
  ): Promise<Map<string, DicomImageMetadata>> {
    return this._study.getStudyMetadata(studyUID, stackId);
  }

  // ─── Image retrieval (delegates to IImagingService) ───────────

  async initImage(
    studyUID: string,
    instanceUID: string,
    stackId: string,
  ): Promise<DecodedImage> {
    return this._imaging.initImage(studyUID, instanceUID, stackId);
  }

  async loadImageLevel(
    studyUID: string,
    instanceUID: string,
    stackId: string,
    level: number,
  ): Promise<DecodedImage> {
    return this._imaging.loadImageLevel(studyUID, instanceUID, stackId, level);
  }

  async loadAllLevels(
    studyUID: string,
    instanceUID: string,
    stackId: string,
    onProgress?: ProgressCallback,
  ): Promise<DecodedImage> {
    return this._imaging.loadAllLevels(studyUID, instanceUID, stackId, onProgress);
  }

  // ─── Priors ──────────────────────────────────────────────────

  async queryPriorStudies(patientId: string, currentStudyUID: string): Promise<WorklistEntry[]> {
    const caps = this.getCapabilities();
    if (!caps.supportsPriors) {
      return [];
    }
    try {
      const all = await this._worklist.examSearch({ patientId });
      return all
        .filter((entry) => !entry.studyUIDs.includes(currentStudyUID))
        .sort((a, b) => (b.studyDate ?? '').localeCompare(a.studyDate ?? ''));
    } catch (err) {
      Logger.warn(LOG_CAT, `queryPriorStudies error: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  // ─── Persistence (delegates to IPersistenceService if available) ──

  async saveAnnotations(studyUID: string, annotations: Annotation[]): Promise<void> {
    if (this._persistence) {
      return this._persistence.saveAnnotations(studyUID, annotations);
    }
    Logger.warn(LOG_CAT, 'saveAnnotations(): no persistence service configured');
  }

  async savePresentationState(studyUID: string, state: unknown): Promise<void> {
    if (this._persistence) {
      return this._persistence.savePresentationState(studyUID, state);
    }
    Logger.warn(LOG_CAT, 'savePresentationState(): no persistence service configured');
  }

  async loadPresentationState(studyUID: string, psName: string): Promise<unknown> {
    if (this._persistence) {
      return this._persistence.loadPresentationState(studyUID, psName);
    }
    Logger.warn(LOG_CAT, 'loadPresentationState(): no persistence service configured');
    return null;
  }

  // ─── Lifecycle ───────────────────────────────────────────────

  dispose(): void {
    Logger.info(LOG_CAT, `dispose() — ${this.name}`);
    this._imaging.dispose();
  }
}
