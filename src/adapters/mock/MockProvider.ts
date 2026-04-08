import type { BackendProvider } from '../BackendProvider';
import type { IAuthService } from '../interfaces/IAuthService';
import type { IWorklistService } from '../interfaces/IWorklistService';
import type { IStudyService } from '../interfaces/IStudyService';
import type { IImagingService } from '../interfaces/IImagingService';
import type { ServiceEndpoints } from '../../transport/endpoints/ServiceEndpoints';
import type { AuthCredentials, AuthResult, WorklistQuery, WorklistEntry } from '../IPACSAdapter';
import type { Study } from '../../core/domain/Study';
import type { DicomImageMetadata } from '../../core/types/dicom';
import type { DecodedImage, ProgressCallback } from '../../core/types/imaging';

// ─── Auth ───────────────────────────────────────────────────────────

class MockAuthService implements IAuthService {
  private _authenticated = false;

  async authenticate(_credentials: AuthCredentials): Promise<AuthResult> {
    this._authenticated = true;
    return { success: true, sessionToken: 'mock-token' };
  }

  async logout(): Promise<void> {
    this._authenticated = false;
  }

  isAuthenticated(): boolean {
    return this._authenticated;
  }
}

// ─── Worklist ───────────────────────────────────────────────────────

class MockWorklistService implements IWorklistService {
  async examSearch(_query: WorklistQuery): Promise<WorklistEntry[]> {
    return [
      {
        examKey: 'mock-exam-1',
        patientName: 'DOE^JOHN',
        patientId: 'MOCK-001',
        accessionNumber: 'ACC-001',
        modality: 'CT',
        studyDate: '20240101',
        studyDescription: 'Mock CT Study',
        studyUIDs: ['1.2.3.4.5.6.7.8.9'],
      },
    ];
  }
}

// ─── Study ──────────────────────────────────────────────────────────

class MockStudyService implements IStudyService {
  async loadStudy(studyUID: string, stackId: string): Promise<Study> {
    return {
      uid: studyUID,
      stackId,
      patientName: 'DOE^JOHN',
      patientId: 'MOCK-001',
      modality: 'CT',
      series: [
        {
          uid: '1.2.3.4.5.6.7.8.9.1',
          seriesNumber: 1,
          modality: 'CT',
          instances: [
            {
              uid: '1.2.3.4.5.6.7.8.9.1.1',
              sopClassUID: '1.2.840.10008.5.1.4.1.1.2',
              instanceNumber: 1,
              metadata: MockStudyService._createMeta(),
            },
          ],
        },
      ],
    };
  }

  async getStudyMetadata(_studyUID: string, _stackId: string): Promise<Map<string, DicomImageMetadata>> {
    const map = new Map<string, DicomImageMetadata>();
    map.set('1.2.3.4.5.6.7.8.9.1.1', MockStudyService._createMeta());
    return map;
  }

  private static _createMeta(): DicomImageMetadata {
    return {
      rows: 256,
      columns: 256,
      bitsAllocated: 16,
      bitsStored: 12,
      highBit: 11,
      pixelRepresentation: 0,
      photometricInterpretation: 'MONOCHROME2',
      samplesPerPixel: 1,
      rescaleSlope: 1,
      rescaleIntercept: -1024,
      windowWidth: 400,
      windowCenter: 40,
      modality: 'CT',
    };
  }
}

// ─── Imaging ────────────────────────────────────────────────────────

class MockImagingService implements IImagingService {
  private _makeImage(): DecodedImage {
    const rows = 256;
    const cols = 256;
    const imageData = new ImageData(cols, rows);
    const data = imageData.data;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = (y * cols + x) * 4;
        const val = Math.round(((x + y) / (rows + cols)) * 255);
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    return { imageData, pixelLevel: 0, rows, cols, planes: 1, format: 'MONO' };
  }

  async initImage(_studyUID: string, _instanceUID: string, _stackId: string): Promise<DecodedImage> {
    return this._makeImage();
  }

  async loadImageLevel(_studyUID: string, _instanceUID: string, _stackId: string, _level: number): Promise<DecodedImage> {
    return this._makeImage();
  }

  async loadAllLevels(_studyUID: string, _instanceUID: string, _stackId: string, onProgress?: ProgressCallback): Promise<DecodedImage> {
    onProgress?.(1, 1);
    return this._makeImage();
  }

  dispose(): void {
    // Nothing to clean up
  }
}

// ─── Provider ───────────────────────────────────────────────────────

export const MockProvider: BackendProvider = {
  name: 'mock',

  createAuthService(_endpoints: ServiceEndpoints): IAuthService {
    return new MockAuthService();
  },

  createWorklistService(_endpoints: ServiceEndpoints): IWorklistService {
    return new MockWorklistService();
  },

  createStudyService(_endpoints: ServiceEndpoints): IStudyService {
    return new MockStudyService();
  },

  createImagingService(_endpoints: ServiceEndpoints): IImagingService {
    return new MockImagingService();
  },
};
