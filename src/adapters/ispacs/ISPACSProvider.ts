import type { BackendProvider } from '../BackendProvider';
import type { IAuthService } from '../interfaces/IAuthService';
import type { IWorklistService } from '../interfaces/IWorklistService';
import type { IStudyService } from '../interfaces/IStudyService';
import type { IImagingService } from '../interfaces/IImagingService';
import type { IPersistenceService } from '../interfaces/IPersistenceService';
import type { ServiceEndpoints } from '../../transport/endpoints/ServiceEndpoints';
import type { Study } from '../../core/domain/Study';
import type { DicomImageMetadata } from '../../core/types/dicom';
import type { DecodedImage, ProgressCallback } from '../../core/types/imaging';
import type { Annotation } from '../../core/domain/Annotation';
import { ISPACSAuthService } from './ISPACSAuthService';
import { ISPACSWorklistService } from './ISPACSWorklistService';
import { ISyntaxImageService } from '../../services/image/ISyntaxImageService';
import {
  getStudyInfoAndImageIds,
  getAllImageMetadata,
  getSeriesImageGroups,
} from '../../services/study/StudyService';
import { normalizeStudy } from '../isyntax/ISyntaxNormalizer';
import { Logger } from '../../core/logging/Logger';

const LOG_CAT = 'ISPACSProvider';

// ISPACSWorklistService is now a real implementation in ./ISPACSWorklistService.ts

// ─── Study (delegates to ResultsAuthority StudyService) ────

class ISPACSStudyService implements IStudyService {
  private _studyCache = new Map<string, Study>();

  async loadStudy(studyUID: string, stackId: string): Promise<Study> {
    const key = `${studyUID}:${stackId}`;
    const cached = this._studyCache.get(key);
    if (cached) return cached;

    Logger.info(LOG_CAT, `ISPACSStudyService.loadStudy(${studyUID}, ${stackId})`);
    const { studyInfo, imageIds } = await getStudyInfoAndImageIds(studyUID, stackId);
    const metadata = await getAllImageMetadata(studyUID, stackId);
    const seriesGroups = await getSeriesImageGroups(studyUID, stackId, imageIds);
    const study = normalizeStudy(studyInfo, stackId, seriesGroups, metadata);
    this._studyCache.set(key, study);
    Logger.info(LOG_CAT, `loadStudy complete: ${study.series.length} series, ${imageIds.length} images`);
    return study;
  }

  async getStudyMetadata(studyUID: string, stackId: string): Promise<Map<string, DicomImageMetadata>> {
    return getAllImageMetadata(studyUID, stackId);
  }
}

// ─── Imaging (delegates to ISyntaxImageService for ResultsAuthority) ──

class ISPACSImagingService implements IImagingService {
  private _imageServices = new Map<string, ISyntaxImageService>();

  private _getOrCreate(studyUID: string, instanceUID: string, stackId: string): ISyntaxImageService {
    const key = `${studyUID}:${instanceUID}:${stackId}`;
    let svc = this._imageServices.get(key);
    if (!svc) {
      svc = new ISyntaxImageService(studyUID, instanceUID, stackId);
      this._imageServices.set(key, svc);
    }
    return svc;
  }

  async initImage(studyUID: string, instanceUID: string, stackId: string): Promise<DecodedImage> {
    const svc = this._getOrCreate(studyUID, instanceUID, stackId);
    return svc.initImage();
  }

  async loadImageLevel(studyUID: string, instanceUID: string, stackId: string, level: number): Promise<DecodedImage> {
    const svc = this._getOrCreate(studyUID, instanceUID, stackId);
    return svc.loadLevel(level);
  }

  async loadAllLevels(studyUID: string, instanceUID: string, stackId: string, onProgress?: ProgressCallback): Promise<DecodedImage> {
    const svc = this._getOrCreate(studyUID, instanceUID, stackId);
    return svc.loadAllLevels(onProgress);
  }

  dispose(): void {
    for (const svc of this._imageServices.values()) {
      svc.dispose();
    }
    this._imageServices.clear();
  }
}

// ─── Persistence (stub) ─────────────────────────────────────────────

class ISPACSPersistenceService implements IPersistenceService {
  async saveAnnotations(_studyUID: string, _annotations: Annotation[]): Promise<void> {
    Logger.warn(LOG_CAT, 'saveAnnotations() not yet implemented');
  }

  async savePresentationState(_studyUID: string, _state: unknown): Promise<void> {
    Logger.warn(LOG_CAT, 'savePresentationState() not yet implemented');
  }

  async loadPresentationState(_studyUID: string, _psName: string): Promise<unknown> {
    Logger.warn(LOG_CAT, 'loadPresentationState() not yet implemented');
    return null;
  }
}

// ─── Provider ───────────────────────────────────────────────────────

// Module-level reference so worklist can share the auth service's
// transport (HMAC) and discovered service map.
let _sharedAuthService: ISPACSAuthService | null = null;

export const ISPACSProvider: BackendProvider = {
  name: 'ispacs',

  createAuthService(endpoints: ServiceEndpoints): IAuthService {
    _sharedAuthService = new ISPACSAuthService(endpoints.infrastructure);
    return _sharedAuthService;
  },

  createWorklistService(_endpoints: ServiceEndpoints): IWorklistService {
    if (!_sharedAuthService) {
      throw new Error('ISPACSProvider: createAuthService() must be called before createWorklistService()');
    }
    return new ISPACSWorklistService(_sharedAuthService);
  },

  createStudyService(_endpoints: ServiceEndpoints): IStudyService {
    return new ISPACSStudyService();
  },

  createImagingService(_endpoints: ServiceEndpoints): IImagingService {
    return new ISPACSImagingService();
  },

  createPersistenceService(_endpoints: ServiceEndpoints): IPersistenceService {
    return new ISPACSPersistenceService();
  },
};
