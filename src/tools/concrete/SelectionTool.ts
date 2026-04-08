/**
 * SelectionTool — click to select annotations, drag handles to edit.
 *
 * Iterates all annotations on the current image, delegates hit-testing
 * to each AnnotationTool, and allows moving handles by dragging.
 */

import { BaseTool } from '../base/BaseTool';
import { AnnotationTool } from '../base/AnnotationTool';
import type {
  NormalizedPointerEvent,
  Point2,
  Annotation,
} from '../base/types';
import { annotationManager } from '../stateManagement/AnnotationManager';

export interface SelectionState {
  selectedAnnotationUID: string | null;
  activeHandleIndex: number;
  isDragging: boolean;
}

export class SelectionTool extends BaseTool {
  static override toolName = 'SelectionTool';

  private _state: SelectionState = {
    selectedAnnotationUID: null,
    activeHandleIndex: -1,
    isDragging: false,
  };

  private _toolRegistry: Map<string, AnnotationTool> = new Map();

  get cursor(): string {
    return this._state.selectedAnnotationUID ? 'move' : 'default';
  }

  get selectedAnnotationUID(): string | null {
    return this._state.selectedAnnotationUID;
  }

  /**
   * Register annotation tools so the selection tool can delegate hit-testing.
   */
  registerAnnotationTool(tool: AnnotationTool): void {
    this._toolRegistry.set(tool.toolName, tool);
  }

  /**
   * Register multiple annotation tools.
   */
  registerAnnotationTools(tools: AnnotationTool[]): void {
    for (const tool of tools) {
      this._toolRegistry.set(tool.toolName, tool);
    }
  }

  /**
   * Deselect the currently selected annotation.
   */
  deselect(): void {
    if (this._state.selectedAnnotationUID) {
      const ann = annotationManager.getAnnotationByUID(this._state.selectedAnnotationUID);
      if (ann) {
        ann.highlighted = false;
        annotationManager.triggerAnnotationModified(ann);
      }
    }
    this._state.selectedAnnotationUID = null;
    this._state.activeHandleIndex = -1;
    this._state.isDragging = false;
  }

  override mouseDownCallback(evt: NormalizedPointerEvent): void {
    if (!this.viewportRef) return;
    const imageId = this.viewportRef.imageId;
    const canvasPoint = evt.canvasPoint;
    const proximity = 8;

    // First: check if clicking near a handle of already-selected annotation
    if (this._state.selectedAnnotationUID) {
      const ann = annotationManager.getAnnotationByUID(this._state.selectedAnnotationUID);
      if (ann) {
        const tool = this._toolRegistry.get(ann.metadata.toolName);
        if (tool) {
          const handleIdx = tool.getHandleNearCanvasPoint(ann, canvasPoint, proximity);
          if (handleIdx >= 0) {
            this._state.activeHandleIndex = handleIdx;
            this._state.isDragging = true;
            return;
          }
        }
      }
    }

    // Second: try to select a new annotation by hit-testing all
    const allAnnotations = annotationManager.getAllAnnotationsForImage(imageId);
    let found: Annotation | null = null;

    for (const ann of allAnnotations) {
      if (!ann.isVisible || ann.isLocked) continue;
      const tool = this._toolRegistry.get(ann.metadata.toolName);
      if (!tool) continue;

      // Check handle proximity first (more precise)
      const handleIdx = tool.getHandleNearCanvasPoint(ann, canvasPoint, proximity);
      if (handleIdx >= 0) {
        found = ann;
        this._state.activeHandleIndex = handleIdx;
        this._state.isDragging = true;
        break;
      }

      // Then check general tool proximity
      if (tool.isPointNearTool(ann, canvasPoint, proximity)) {
        found = ann;
        this._state.activeHandleIndex = -1;
        break;
      }
    }

    // Deselect previous
    this.deselect();

    if (found) {
      this._state.selectedAnnotationUID = found.annotationUID;
      found.highlighted = true;
      annotationManager.triggerAnnotationModified(found);
      this.triggerRender();
    }
  }

  override mouseDragCallback(evt: NormalizedPointerEvent): void {
    if (!this._state.isDragging || this._state.activeHandleIndex < 0) return;
    if (!this._state.selectedAnnotationUID) return;

    const ann = annotationManager.getAnnotationByUID(this._state.selectedAnnotationUID);
    if (!ann) return;

    const handle = ann.data.handles.points[this._state.activeHandleIndex];
    if (!handle) return;

    // Move handle in world space
    handle.x = evt.worldPoint.x;
    handle.y = evt.worldPoint.y;
    ann.invalidated = true;

    annotationManager.triggerAnnotationModified(ann);
    this.triggerRender();
  }

  override mouseUpCallback(_evt: NormalizedPointerEvent): void {
    if (this._state.isDragging && this._state.selectedAnnotationUID) {
      const ann = annotationManager.getAnnotationByUID(this._state.selectedAnnotationUID);
      if (ann) {
        ann.invalidated = true;
        annotationManager.triggerAnnotationCompleted(ann);
      }
    }
    this._state.isDragging = false;
    this._state.activeHandleIndex = -1;
  }
}
