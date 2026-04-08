import type { IPACSAdapter, AuthCredentials, AuthResult, WorklistQuery, WorklistEntry } from '../IPACSAdapter';
import type { Study } from '../../core/domain/Study';
import type { CapabilitySet } from '../../core/domain/CapabilitySet';
import { getDefaultCapabilities } from '../../core/domain/CapabilitySet';
import type { DecodedImage, ProgressCallback } from '../../core/types/imaging';
import type { DicomImageMetadata } from '../../core/types/dicom';

/**
 * Mock PACS adapter for development and testing.
 * Returns hardcoded / minimal data without hitting any server.
 */
export class MockPACSAdapter implements IPACSAdapter {
  readonly name = 'MockPACS';

  private _authenticated = false;

  getCapabilities(): CapabilitySet {
    const caps = getDefaultCapabilities();
    // Override capabilities that mock doesn't support
    caps.supportsISyntaxStreaming = false;
    caps.supportsStudyData = false;
    return caps;
  }

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

  async queryWorklist(_query: WorklistQuery): Promise<WorklistEntry[]> {
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
              metadata: this._createMockMetadata(),
            },
          ],
        },
      ],
    };
  }

  async getStudyMetadata(
    _studyUID: string,
    _stackId: string,
  ): Promise<Map<string, DicomImageMetadata>> {
    const map = new Map<string, DicomImageMetadata>();
    map.set('1.2.3.4.5.6.7.8.9.1.1', this._createMockMetadata());
    return map;
  }

  async initImage(
    _studyUID: string,
    _instanceUID: string,
    _stackId: string,
  ): Promise<DecodedImage> {
    const rows = 256;
    const cols = 256;
    const imageData = new ImageData(cols, rows);
    // Fill with a grey gradient for testing
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

    return {
      imageData,
      pixelLevel: 0,
      rows,
      cols,
      planes: 1,
      format: 'MONO',
    };
  }

  async loadImageLevel(
    studyUID: string,
    instanceUID: string,
    stackId: string,
    _level: number,
  ): Promise<DecodedImage> {
    return this.initImage(studyUID, instanceUID, stackId);
  }

  async loadAllLevels(
    studyUID: string,
    instanceUID: string,
    stackId: string,
    onProgress?: ProgressCallback,
  ): Promise<DecodedImage> {
    onProgress?.(1, 1);
    return this.initImage(studyUID, instanceUID, stackId);
  }

  dispose(): void {
    // Nothing to clean up
  }

  private _createMockMetadata(): DicomImageMetadata {
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
