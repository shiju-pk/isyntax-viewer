import type { BackendProvider } from '../BackendProvider';
import type { IAuthService } from '../interfaces/IAuthService';
import type { IWorklistService } from '../interfaces/IWorklistService';
import type { IStudyService } from '../interfaces/IStudyService';
import type { IImagingService } from '../interfaces/IImagingService';
import type { IPersistenceService } from '../interfaces/IPersistenceService';
import type { ServiceEndpoints } from '../../transport/endpoints/ServiceEndpoints';
import type { AuthCredentials, AuthResult, WorklistQuery, WorklistEntry } from '../IPACSAdapter';
import type { Study } from '../../core/domain/Study';
import type { DicomImageMetadata } from '../../core/types/dicom';
import type { DecodedImage, ProgressCallback } from '../../core/types/imaging';
import type { Annotation } from '../../core/domain/Annotation';
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

const LOG_CAT = 'ISyntaxProvider';

// ─── Auth Service (stub — auth not yet wired for iSyntax backend) ───

class ISyntaxAuthService implements IAuthService {
  private _authenticated = false;

  async authenticate(_credentials: AuthCredentials): Promise<AuthResult> {
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
}

// ─── Worklist Service (stub — worklist not yet wired for iSyntax) ───

class ISyntaxWorklistService implements IWorklistService {
  async examSearch(_query: WorklistQuery): Promise<WorklistEntry[]> {
    Logger.info(LOG_CAT, 'examSearch(): worklist not wired, returning empty');
    return [];
  }
}

// ─── Study Service (wraps existing StudyService functions) ──────────

class ISyntaxStudyServiceImpl implements IStudyService {
  private _cache = new Map<string, Study>();

  async loadStudy(studyUID: string, stackId: string): Promise<Study> {
    const key = `${studyUID}:${stackId}`;
    const cached = this._cache.get(key);
    if (cached) return cached;

    try {
      Logger.info(LOG_CAT, `loadStudy(${studyUID}, ${stackId})`);
      const { studyInfo, imageIds } = await getStudyInfoAndImageIds(studyUID, stackId);
      const metadata = await getAllImageMetadata(studyUID, stackId);
      const seriesGroups = await getSeriesImageGroups(studyUID, stackId, imageIds);
      const study = normalizeStudy(studyInfo, stackId, seriesGroups, metadata);
      this._cache.set(key, study);
      Logger.info(LOG_CAT, `loadStudy complete: ${study.series.length} series`);
      return study;
    } catch (err) {
      throw new PACSError(
        PACSErrorCode.STUDY_NOT_FOUND,
        `Failed to load study ${studyUID}`,
        { recoverable: true, retryable: true, cause: err instanceof Error ? err : undefined },
      );
    }
  }

  async getStudyMetadata(studyUID: string, stackId: string): Promise<Map<string, DicomImageMetadata>> {
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
}

// ─── Imaging Service (wraps existing ISyntaxImageService) ───────────

class ISyntaxImagingServiceImpl implements IImagingService {
  private _services = new Map<string, ISyntaxImageService>();

  private _getOrCreate(studyUID: string, instanceUID: string, stackId: string): ISyntaxImageService {
    const key = `${studyUID}:${instanceUID}:${stackId}`;
    let svc = this._services.get(key);
    if (!svc) {
      svc = new ISyntaxImageService(studyUID, instanceUID, stackId);
      this._services.set(key, svc);
    }
    return svc;
  }

  async initImage(studyUID: string, instanceUID: string, stackId: string): Promise<DecodedImage> {
    const svc = this._getOrCreate(studyUID, instanceUID, stackId);
    try {
      const decoded = await svc.initImage();
      if (!svc.dicomMetadata) {
        const meta = await getAllImageMetadata(studyUID, stackId);
        const instanceMeta = meta.get(instanceUID);
        if (instanceMeta) svc.dicomMetadata = instanceMeta;
      }
      return decoded;
    } catch (err) {
      throw PACSError.imageLoadFailed(instanceUID, err instanceof Error ? err : undefined);
    }
  }

  async loadImageLevel(studyUID: string, instanceUID: string, stackId: string, level: number): Promise<DecodedImage> {
    const svc = this._getOrCreate(studyUID, instanceUID, stackId);
    try {
      return await svc.loadLevel(level);
    } catch (err) {
      throw PACSError.imageLoadFailed(instanceUID, err instanceof Error ? err : undefined);
    }
  }

  async loadAllLevels(studyUID: string, instanceUID: string, stackId: string, onProgress?: ProgressCallback): Promise<DecodedImage> {
    const svc = this._getOrCreate(studyUID, instanceUID, stackId);
    try {
      return await svc.loadAllLevels(onProgress);
    } catch (err) {
      throw PACSError.imageLoadFailed(instanceUID, err instanceof Error ? err : undefined);
    }
  }

  dispose(): void {
    for (const svc of this._services.values()) {
      svc.dispose();
    }
    this._services.clear();
    clearStudyDocCache();
  }
}

// ─── Persistence Service (stubs) ────────────────────────────────────

class ISyntaxPersistenceService implements IPersistenceService {
  async saveAnnotations(_studyUID: string, _annotations: Annotation[]): Promise<void> {
    Logger.warn(LOG_CAT, 'saveAnnotations() not implemented');
  }

  async savePresentationState(_studyUID: string, _state: unknown): Promise<void> {
    Logger.warn(LOG_CAT, 'savePresentationState() not implemented');
  }

  async loadPresentationState(studyUID: string, psName: string): Promise<unknown> {
    const url = getPresentationStateUrl(studyUID, psName);
    Logger.info(LOG_CAT, `loadPresentationState(${studyUID}, ${psName})`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        Logger.warn(LOG_CAT, `PS fetch failed: ${response.status}`);
        return null;
      }
      return await response.arrayBuffer();
    } catch (err) {
      Logger.warn(LOG_CAT, `PS fetch error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}

// ─── Provider ───────────────────────────────────────────────────────

export const ISyntaxProvider: BackendProvider = {
  name: 'isyntax',

  createAuthService(_endpoints: ServiceEndpoints): IAuthService {
    return new ISyntaxAuthService();
  },

  createWorklistService(_endpoints: ServiceEndpoints): IWorklistService {
    return new ISyntaxWorklistService();
  },

  createStudyService(_endpoints: ServiceEndpoints): IStudyService {
    return new ISyntaxStudyServiceImpl();
  },

  createImagingService(_endpoints: ServiceEndpoints): IImagingService {
    return new ISyntaxImagingServiceImpl();
  },

  createPersistenceService(_endpoints: ServiceEndpoints): IPersistenceService {
    return new ISyntaxPersistenceService();
  },
};
