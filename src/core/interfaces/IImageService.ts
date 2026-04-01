import type { DecodedImage, ProgressCallback, DicomImageMetadata } from '../types';

export interface IImageService {
  readonly totalLevels: number;
  readonly currentLevel: number;
  readonly isInitialized: boolean;
  readonly isFullyLoaded: boolean;
  readonly cachedResult: DecodedImage | null;
  dicomMetadata: DicomImageMetadata | null;

  initImage(rows?: number, cols?: number): Promise<DecodedImage>;
  loadLevel(level: number): Promise<DecodedImage>;
  loadAllLevels(onProgress?: ProgressCallback): Promise<DecodedImage>;
  dispose(): void;
}
