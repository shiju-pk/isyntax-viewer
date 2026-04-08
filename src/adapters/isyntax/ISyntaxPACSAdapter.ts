import type { IPACSAdapter, AuthCredentials, AuthResult, WorklistQuery, WorklistEntry } from '../IPACSAdapter';
import type { Study } from '../../core/domain/Study';
import type { CapabilitySet } from '../../core/domain/CapabilitySet';
import { getDefaultCapabilities } from '../../core/domain/CapabilitySet';
import type { Annotation } from '../../core/domain/Annotation';
import type { DecodedImage, ProgressCallback } from '../../core/types/imaging';
import type { DicomImageMetadata } from '../../core/types/dicom';
import { Logger } from '../../core/logging/Logger';
import { PACSError, PACSErrorCode } from '../../core/errors/PACSError';
import { ISyntaxImageService } from '../../services/image/ISyntaxImageService';
import {
  getStudyInfoAndImageIds,
  getAllImageMetadata,
  getSeriesImageGroups,
  clearStudyDocCache,
} from '../../services/study/StudyService';
import { normalizeStudy } from './ISyntaxNormalizer';
import { getPresentationStateUrl } from '../../transport/endpoints/config';

const LOG_CAT = 'ISyntaxPACSAdapter';

/**
 * Real PACS adapter backed by the existing iSyntax services.
 * Wraps ISyntaxImageService + StudyService behind the IPACSAdapter interface.
 */
export class ISyntaxPACSAdapter implements IPACSAdapter {
  readonly name = 'ISyntaxPACS';

  /** Active ISyntaxImageService instances keyed by "studyUID:instanceUID:stackId" */
  private _imageServices = new Map<string, ISyntaxImageService>();

  /** Cached Study domain models keyed by "studyUID:stackId" */
  private _studyCache = new Map<string, Study>();

  private _authenticated = false;

  // ─── Capabilities ────────────────────────────────────────────

  getCapabilities(): CapabilitySet {
    return getDefaultCapabilities();
  }

  // ─── Authentication ──────────────────────────────────────────

  async authenticate(_credentials: AuthCredentials): Promise<AuthResult> {
    // Auth not yet wired — always succeeds
    Logger.info(LOG_CAT, 'authenticate(): auth not wired, returning success');
    this._authenticated = true;
    return { success: true };
  }

  async logout(): Promise<void> {
    Logger.info(LOG_CAT, 'logout()');
    this._authenticated = false;
  }

  isAuthenticated(): boolean {
    return this._authenticated;
  }

  // ─── Worklist ────────────────────────────────────────────────

  async queryWorklist(_query: WorklistQuery): Promise<WorklistEntry[]> {
    // Worklist not yet wired — returns empty
    Logger.info(LOG_CAT, 'queryWorklist(): worklist not wired, returning empty');
    return [];
  }

  // ─── Study loading ───────────────────────────────────────────

  async loadStudy(studyUID: string, stackId: string): Promise<Study> {
    const cacheKey = `${studyUID}:${stackId}`;
    const cached = this._studyCache.get(cacheKey);
    if (cached) return cached;

    try {
      Logger.info(LOG_CAT, `loadStudy(${studyUID}, ${stackId})`);

      const { studyInfo, imageIds } = await getStudyInfoAndImageIds(studyUID, stackId);
      const metadata = await getAllImageMetadata(studyUID, stackId);
      const seriesGroups = await getSeriesImageGroups(studyUID, stackId, imageIds);

      const study = normalizeStudy(studyInfo, stackId, seriesGroups, metadata);
      this._studyCache.set(cacheKey, study);

      Logger.info(LOG_CAT, `loadStudy complete: ${study.series.length} series, ${imageIds.length} images`);
      return study;
    } catch (err) {
      throw new PACSError(
        PACSErrorCode.STUDY_NOT_FOUND,
        `Failed to load study ${studyUID}`,
        { recoverable: true, retryable: true, cause: err instanceof Error ? err : undefined },
      );
    }
  }

  async getStudyMetadata(
    studyUID: string,
    stackId: string,
  ): Promise<Map<string, DicomImageMetadata>> {
    try {
      return await getAllImageMetadata(studyUID, stackId);
    } catch (err) {
      throw new PACSError(
        PACSErrorCode.STUDY_NOT_FOUND,
        `Failed to get metadata for study ${studyUID}`,
        { cause: err instanceof Error ? err : undefined },
      );
    }
  }

  // ─── Image retrieval ─────────────────────────────────────────

  async initImage(
    studyUID: string,
    instanceUID: string,
    stackId: string,
  ): Promise<DecodedImage> {
    const svc = this._getOrCreateImageService(studyUID, instanceUID, stackId);

    try {
      const decoded = await svc.initImage();

      // Wire DICOM metadata if available
      if (!svc.dicomMetadata) {
        const meta = await getAllImageMetadata(studyUID, stackId);
        const instanceMeta = meta.get(instanceUID);
        if (instanceMeta) {
          svc.dicomMetadata = instanceMeta;
        }
      }

      return decoded;
    } catch (err) {
      throw PACSError.imageLoadFailed(instanceUID, err instanceof Error ? err : undefined);
    }
  }

  async loadImageLevel(
    studyUID: string,
    instanceUID: string,
    stackId: string,
    level: number,
  ): Promise<DecodedImage> {
    const svc = this._getOrCreateImageService(studyUID, instanceUID, stackId);
    try {
      return await svc.loadLevel(level);
    } catch (err) {
      throw PACSError.imageLoadFailed(instanceUID, err instanceof Error ? err : undefined);
    }
  }

  async loadAllLevels(
    studyUID: string,
    instanceUID: string,
    stackId: string,
    onProgress?: ProgressCallback,
  ): Promise<DecodedImage> {
    const svc = this._getOrCreateImageService(studyUID, instanceUID, stackId);
    try {
      return await svc.loadAllLevels(onProgress);
    } catch (err) {
      throw PACSError.imageLoadFailed(instanceUID, err instanceof Error ? err : undefined);
    }
  }

  // ─── Priors ─────────────────────────────────────────────────

  async queryPriorStudies(patientId: string, currentStudyUID: string): Promise<WorklistEntry[]> {
    const caps = this.getCapabilities();
    if (!caps.supportsPriors) {
      Logger.info(LOG_CAT, 'queryPriorStudies() skipped — supportsPriors is false');
      return [];
    }

    try {
      const all = await this.queryWorklist({ patientId });
      // Filter out the current study, sort by date descending
      return all
        .filter((entry) => !entry.studyUIDs.includes(currentStudyUID))
        .sort((a, b) => (b.studyDate ?? '').localeCompare(a.studyDate ?? ''));
    } catch (err) {
      Logger.warn(LOG_CAT, `queryPriorStudies error: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  // ─── Persistence (stubs) ─────────────────────────────────────

  async saveAnnotations(_studyUID: string, _annotations: Annotation[]): Promise<void> {
    Logger.warn(LOG_CAT, 'saveAnnotations() not implemented');
  }

  async savePresentationState(_studyUID: string, _state: unknown): Promise<void> {
    Logger.warn(LOG_CAT, 'savePresentationState() not implemented');
  }

  async loadPresentationState(studyUID: string, psName: string): Promise<unknown> {
    const caps = this.getCapabilities();
    if (!caps.supportsGSPS) {
      Logger.warn(LOG_CAT, 'loadPresentationState() skipped — supportsGSPS is false');
      return null;
    }

    const url = getPresentationStateUrl(studyUID, psName);
    Logger.info(LOG_CAT, `loadPresentationState(${studyUID}, ${psName})`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        Logger.warn(LOG_CAT, `PS fetch failed: ${response.status} ${response.statusText}`);
        return null;
      }
      return await response.arrayBuffer();
    } catch (err) {
      Logger.warn(LOG_CAT, `PS fetch error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  // ─── Lifecycle ───────────────────────────────────────────────

  dispose(): void {
    Logger.info(LOG_CAT, 'dispose()');
    for (const svc of this._imageServices.values()) {
      svc.dispose();
    }
    this._imageServices.clear();
    this._studyCache.clear();
    clearStudyDocCache();
  }

  /** Release resources for a specific study. */
  disposeStudy(studyUID: string, stackId: string): void {
    const prefix = `${studyUID}:`;
    for (const [key, svc] of this._imageServices) {
      if (key.startsWith(prefix)) {
        svc.dispose();
        this._imageServices.delete(key);
      }
    }
    this._studyCache.delete(`${studyUID}:${stackId}`);
    clearStudyDocCache(studyUID, stackId);
  }

  /** Get the underlying ISyntaxImageService for an instance (for direct access). */
  getImageService(
    studyUID: string,
    instanceUID: string,
    stackId: string,
  ): ISyntaxImageService {
    return this._getOrCreateImageService(studyUID, instanceUID, stackId);
  }

  // ─── Private ─────────────────────────────────────────────────

  private _getOrCreateImageService(
    studyUID: string,
    instanceUID: string,
    stackId: string,
  ): ISyntaxImageService {
    const key = `${studyUID}:${instanceUID}:${stackId}`;
    let svc = this._imageServices.get(key);
    if (!svc) {
      svc = new ISyntaxImageService(studyUID, instanceUID, stackId);
      this._imageServices.set(key, svc);
    }
    return svc;
  }
}
