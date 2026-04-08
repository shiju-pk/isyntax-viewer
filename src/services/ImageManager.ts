import type { IPACSAdapter } from '../adapters/IPACSAdapter';
import type { DecodedImage, ProgressCallback } from '../core/types/imaging';
import { Logger } from '../core/logging/Logger';

const LOG_CAT = 'ImageManager';

/**
 * Manages image loading through the PACS adapter.
 * Orchestrates init → progressive level loading per viewport.
 */
export class ImageManager {
  private _adapter: IPACSAdapter;

  constructor(adapter: IPACSAdapter) {
    this._adapter = adapter;
  }

  /** Initialize an image (lowest resolution). */
  async initImage(
    studyUID: string,
    instanceUID: string,
    stackId: string,
  ): Promise<DecodedImage> {
    Logger.debug(LOG_CAT, `initImage(${instanceUID})`);
    return this._adapter.initImage(studyUID, instanceUID, stackId);
  }

  /** Load a specific resolution level. */
  async loadLevel(
    studyUID: string,
    instanceUID: string,
    stackId: string,
    level: number,
  ): Promise<DecodedImage> {
    Logger.debug(LOG_CAT, `loadLevel(${instanceUID}, level=${level})`);
    return this._adapter.loadImageLevel(studyUID, instanceUID, stackId, level);
  }

  /** Progressively load all levels to full resolution. */
  async loadAllLevels(
    studyUID: string,
    instanceUID: string,
    stackId: string,
    onProgress?: ProgressCallback,
  ): Promise<DecodedImage> {
    Logger.debug(LOG_CAT, `loadAllLevels(${instanceUID})`);
    return this._adapter.loadAllLevels(studyUID, instanceUID, stackId, onProgress);
  }

  /** Replace the adapter. */
  setAdapter(adapter: IPACSAdapter): void {
    this._adapter = adapter;
  }
}
