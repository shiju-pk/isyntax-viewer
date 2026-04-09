import type { BackendProvider } from '../BackendProvider';
import type { IAuthService } from '../interfaces/IAuthService';
import type { IWorklistService } from '../interfaces/IWorklistService';
import type { IStudyService } from '../interfaces/IStudyService';
import type { IImagingService } from '../interfaces/IImagingService';
import type { IPersistenceService } from '../interfaces/IPersistenceService';
import type { ServiceEndpoints } from '../../transport/endpoints/ServiceEndpoints';
// WorklistQuery, WorklistEntry now used only in ISPACSWorklistService
import type { Study } from '../../core/domain/Study';
import type { DicomImageMetadata } from '../../core/types/dicom';
import type { DecodedImage, ProgressCallback } from '../../core/types/imaging';
import type { Annotation } from '../../core/domain/Annotation';
import { ISPACSAuthService } from './ISPACSAuthService';
import { ISPACSWorklistService } from './ISPACSWorklistService';
import { Logger } from '../../core/logging/Logger';

const LOG_CAT = 'ISPACSProvider';

// ISPACSWorklistService is now a real implementation in ./ISPACSWorklistService.ts

// ─── Study (stub — will be wired to ResultsAuthority in Phase 2) ────

class ISPACSStudyService implements IStudyService {
  async loadStudy(_studyUID: string, _stackId: string): Promise<Study> {
    throw new Error('ISPACSStudyService.loadStudy() not yet implemented');
  }

  async getStudyMetadata(_studyUID: string, _stackId: string): Promise<Map<string, DicomImageMetadata>> {
    throw new Error('ISPACSStudyService.getStudyMetadata() not yet implemented');
  }
}

// ─── Imaging (stub — will be wired to ResultsAuthority in Phase 2) ──

class ISPACSImagingService implements IImagingService {
  async initImage(_studyUID: string, _instanceUID: string, _stackId: string): Promise<DecodedImage> {
    throw new Error('ISPACSImagingService.initImage() not yet implemented');
  }

  async loadImageLevel(_studyUID: string, _instanceUID: string, _stackId: string, _level: number): Promise<DecodedImage> {
    throw new Error('ISPACSImagingService.loadImageLevel() not yet implemented');
  }

  async loadAllLevels(_studyUID: string, _instanceUID: string, _stackId: string, _onProgress?: ProgressCallback): Promise<DecodedImage> {
    throw new Error('ISPACSImagingService.loadAllLevels() not yet implemented');
  }

  dispose(): void {
    // no-op
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
