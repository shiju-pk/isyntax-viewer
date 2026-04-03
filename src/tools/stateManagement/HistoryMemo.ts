/**
 * HistoryMemo — stack-based undo/redo for annotations.
 */

import type { Annotation, Point2 } from '../base/types';
import { annotationManager } from './AnnotationManager';

interface MemoEntry {
  type: 'add' | 'modify' | 'remove';
  annotation: Annotation;
  /** Previous state (for modify/remove) */
  previousData?: Annotation['data'];
}

export class HistoryMemo {
  private undoStack: MemoEntry[] = [];
  private redoStack: MemoEntry[] = [];
  private _maxSize: number;

  constructor(maxSize = 100) {
    this._maxSize = maxSize;
  }

  /**
   * Record an annotation addition.
   */
  recordAdd(annotation: Annotation): void {
    this._push({ type: 'add', annotation });
  }

  /**
   * Record an annotation modification (capture previous state).
   */
  recordModify(annotation: Annotation, previousData: Annotation['data']): void {
    this._push({
      type: 'modify',
      annotation,
      previousData: structuredClone(previousData),
    });
  }

  /**
   * Record an annotation removal.
   */
  recordRemove(annotation: Annotation): void {
    this._push({
      type: 'remove',
      annotation: structuredClone(annotation) as Annotation,
    });
  }

  /**
   * Undo the last action.
   */
  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) return false;

    this.redoStack.push(entry);

    switch (entry.type) {
      case 'add':
        annotationManager.removeAnnotation(entry.annotation.annotationUID);
        break;
      case 'modify':
        if (entry.previousData) {
          entry.annotation.data = structuredClone(entry.previousData) as Annotation['data'];
          annotationManager.triggerAnnotationModified(entry.annotation);
        }
        break;
      case 'remove':
        annotationManager.addAnnotation(entry.annotation);
        break;
    }
    return true;
  }

  /**
   * Redo the last undone action.
   */
  redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) return false;

    this.undoStack.push(entry);

    switch (entry.type) {
      case 'add':
        annotationManager.addAnnotation(entry.annotation);
        break;
      case 'modify':
        // Re-apply — the annotation object has been restored by undo,
        // so we need the current state as "forward"
        annotationManager.triggerAnnotationModified(entry.annotation);
        break;
      case 'remove':
        annotationManager.removeAnnotation(entry.annotation.annotationUID);
        break;
    }
    return true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  private _push(entry: MemoEntry): void {
    this.undoStack.push(entry);
    this.redoStack = []; // Clear redo on new action
    if (this.undoStack.length > this._maxSize) {
      this.undoStack.shift();
    }
  }
}

/** Singleton history instance */
export const annotationHistory = new HistoryMemo();
