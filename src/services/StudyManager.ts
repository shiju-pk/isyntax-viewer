import type { IPACSAdapter } from '../adapters/IPACSAdapter';
import type { Study } from '../core/domain/Study';
import type { DicomImageMetadata } from '../core/types/dicom';
import { Logger } from '../core/logging/Logger';

const LOG_CAT = 'StudyManager';

/**
 * High-level study lifecycle manager.
 * Delegates to the active PACS adapter for all server interactions.
 */
export class StudyManager {
  private _adapter: IPACSAdapter;

  /** Currently loaded study (if any). */
  private _currentStudy: Study | null = null;

  constructor(adapter: IPACSAdapter) {
    this._adapter = adapter;
  }

  get currentStudy(): Study | null {
    return this._currentStudy;
  }

  /** Load a study and make it current. */
  async openStudy(studyUID: string, stackId: string): Promise<Study> {
    Logger.info(LOG_CAT, `openStudy(${studyUID}, ${stackId})`);
    const study = await this._adapter.loadStudy(studyUID, stackId);
    this._currentStudy = study;
    return study;
  }

  /** Get metadata for all instances in a study. */
  async getMetadata(
    studyUID: string,
    stackId: string,
  ): Promise<Map<string, DicomImageMetadata>> {
    return this._adapter.getStudyMetadata(studyUID, stackId);
  }

  /** Close the current study and release resources. */
  closeCurrentStudy(): void {
    if (this._currentStudy) {
      Logger.info(LOG_CAT, `closeStudy(${this._currentStudy.uid})`);
      this._currentStudy = null;
    }
  }

  /** Replace the adapter (e.g. switching between real and mock). */
  setAdapter(adapter: IPACSAdapter): void {
    this._adapter = adapter;
  }
}
