/**
 * AnnotationManager — global store for annotations.
 *
 * Stores annotations grouped by imageId and toolName.
 * Fires events on add/modify/complete/remove.
 */

import { eventBus } from '../../rendering/events/EventBus';
import type { Annotation, Point2 } from '../base/types';

export const AnnotationEvents = {
  ANNOTATION_ADDED: 'ANNOTATION:ADDED',
  ANNOTATION_MODIFIED: 'ANNOTATION:MODIFIED',
  ANNOTATION_COMPLETED: 'ANNOTATION:COMPLETED',
  ANNOTATION_REMOVED: 'ANNOTATION:REMOVED',
} as const;

let uidCounter = 0;
export function generateAnnotationUID(): string {
  return `ann-${Date.now()}-${++uidCounter}`;
}

class AnnotationManagerSingleton {
  /** imageId → toolName → Annotation[] */
  private store = new Map<string, Map<string, Annotation[]>>();

  /**
   * Add an annotation.
   */
  addAnnotation(annotation: Annotation): void {
    const imageId = annotation.metadata.imageId ?? '__global__';
    const toolName = annotation.metadata.toolName;

    let imageMap = this.store.get(imageId);
    if (!imageMap) {
      imageMap = new Map();
      this.store.set(imageId, imageMap);
    }

    let toolList = imageMap.get(toolName);
    if (!toolList) {
      toolList = [];
      imageMap.set(toolName, toolList);
    }

    toolList.push(annotation);

    eventBus.emit(AnnotationEvents.ANNOTATION_ADDED as any, {
      annotation,
    });
  }

  /**
   * Get annotations for a given tool on a given image (or globally).
   */
  getAnnotations(toolName: string, imageId?: string): Annotation[] {
    const key = imageId ?? '__global__';
    const imageMap = this.store.get(key);
    if (!imageMap) return [];
    return imageMap.get(toolName) ?? [];
  }

  /**
   * Get ALL annotations for a given image (across all tools).
   */
  getAllAnnotationsForImage(imageId?: string): Annotation[] {
    const key = imageId ?? '__global__';
    const imageMap = this.store.get(key);
    if (!imageMap) return [];

    const result: Annotation[] = [];
    for (const list of imageMap.values()) {
      result.push(...list);
    }
    return result;
  }

  /**
   * Find an annotation by UID.
   */
  getAnnotationByUID(uid: string): Annotation | undefined {
    for (const imageMap of this.store.values()) {
      for (const list of imageMap.values()) {
        const found = list.find(a => a.annotationUID === uid);
        if (found) return found;
      }
    }
    return undefined;
  }

  /**
   * Remove an annotation by UID.
   */
  removeAnnotation(uid: string): boolean {
    for (const imageMap of this.store.values()) {
      for (const [toolName, list] of imageMap) {
        const idx = list.findIndex(a => a.annotationUID === uid);
        if (idx !== -1) {
          const [removed] = list.splice(idx, 1);
          eventBus.emit(AnnotationEvents.ANNOTATION_REMOVED as any, {
            annotation: removed,
          });
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Signal that an annotation was modified (fires event for renderers).
   */
  triggerAnnotationModified(annotation: Annotation): void {
    eventBus.emit(AnnotationEvents.ANNOTATION_MODIFIED as any, {
      annotation,
    });
  }

  /**
   * Signal that annotation creation was completed (mouseUp after drawing).
   */
  triggerAnnotationCompleted(annotation: Annotation): void {
    eventBus.emit(AnnotationEvents.ANNOTATION_COMPLETED as any, {
      annotation,
    });
  }

  /**
   * Toggle visibility for all annotations on a specific image.
   * Returns the new visibility state.
   */
  toggleVisibility(imageId: string, visible?: boolean): boolean {
    const key = imageId ?? '__global__';
    const imageMap = this.store.get(key);
    if (!imageMap) return true;

    // Determine target state: if not explicitly given, toggle based on first annotation
    let targetVisible = visible;
    if (targetVisible === undefined) {
      for (const list of imageMap.values()) {
        if (list.length > 0) {
          targetVisible = !list[0].isVisible;
          break;
        }
      }
    }
    if (targetVisible === undefined) targetVisible = true;

    for (const list of imageMap.values()) {
      for (const ann of list) {
        ann.isVisible = targetVisible;
        eventBus.emit(AnnotationEvents.ANNOTATION_MODIFIED as any, { annotation: ann });
      }
    }
    return targetVisible;
  }

  /**
   * Clear all annotations.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Clear annotations for a specific image.
   */
  clearImage(imageId: string): void {
    this.store.delete(imageId);
  }
}

export const annotationManager = new AnnotationManagerSingleton();
