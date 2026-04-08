import type { BackendProvider } from '../BackendProvider';
import type { IAuthService } from '../interfaces/IAuthService';
import type { IWorklistService } from '../interfaces/IWorklistService';
import type { IStudyService } from '../interfaces/IStudyService';
import type { IImagingService } from '../interfaces/IImagingService';
import type { IPersistenceService } from '../interfaces/IPersistenceService';
import type { ServiceEndpoints } from '../../transport/endpoints/ServiceEndpoints';
import type { WorklistQuery, WorklistEntry } from '../IPACSAdapter';
import type { Study } from '../../core/domain/Study';
import type { DicomImageMetadata } from '../../core/types/dicom';
import type { DecodedImage, ProgressCallback } from '../../core/types/imaging';
import type { Annotation } from '../../core/domain/Annotation';
import { ISPACSAuthService } from './ISPACSAuthService';
import { Logger } from '../../core/logging/Logger';

const LOG_CAT = 'ISPACSProvider';

// ─── Worklist (stub — will be wired to ClinicalServices in Phase 2) ──

class ISPACSWorklistService implements IWorklistService {
  async examSearch(_query: WorklistQuery): Promise<WorklistEntry[]> {
    Logger.info(LOG_CAT, 'examSearch(): worklist not yet wired for ISPACS');
    return [];
  }
}

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

export const ISPACSProvider: BackendProvider = {
  name: 'ispacs',

  createAuthService(endpoints: ServiceEndpoints): IAuthService {
    // Auth service connects to /InfrastructureServices
    return new ISPACSAuthService(endpoints.infrastructure);
  },

  createWorklistService(_endpoints: ServiceEndpoints): IWorklistService {
    return new ISPACSWorklistService();
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
