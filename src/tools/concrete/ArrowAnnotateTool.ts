/**
 * ArrowAnnotateTool — draws an arrow from start to end with a text label.
 */

import { AnnotationTool } from '../base/AnnotationTool';
import type { Annotation, NormalizedPointerEvent, Point2 } from '../base/types';
import type { SVGDrawingHelper } from '../drawing/SVGDrawingHelper';
import { annotationManager, generateAnnotationUID } from '../stateManagement/AnnotationManager';
import { annotationHistory } from '../stateManagement/HistoryMemo';

export class ArrowAnnotateTool extends AnnotationTool {
  static override toolName = 'ArrowAnnotate';

  override get cursor(): string {
    return 'crosshair';
  }

  override addNewAnnotation(evt: NormalizedPointerEvent): Annotation {
    const annotation: Annotation = {
      annotationUID: generateAnnotationUID(),
      metadata: {
        toolName: ArrowAnnotateTool.toolName,
        viewportId: this.viewportRef?.viewport.id ?? '',
      },
      data: {
        handles: {
          points: [
            { ...evt.worldPoint }, // tail
            { ...evt.worldPoint }, // head (arrow tip)
          ],
          activeHandleIndex: 1,
        },
        label: (this.configuration as any).defaultLabel ?? '',
        cachedStats: {},
      },
      highlighted: true,
      isLocked: false,
      isVisible: true,
      invalidated: false,
    };

    annotationManager.addAnnotation(annotation);
    this.editData = {
      annotation,
      viewportId: annotation.metadata.viewportId,
      handleIndex: 1,
      isNewAnnotation: true,
    };
    return annotation;
  }

  override mouseDownCallback(evt: NormalizedPointerEvent): void {
    const annotations = annotationManager.getAnnotations(ArrowAnnotateTool.toolName);
    for (const ann of annotations) {
      const handleIdx = this.getHandleNearCanvasPoint(ann, evt.canvasPoint, 6);
      if (handleIdx !== -1) {
        this.editData = {
          annotation: ann,
          viewportId: ann.metadata.viewportId,
          handleIndex: handleIdx,
          isNewAnnotation: false,
        };
        return;
      }
    }
    this.addNewAnnotation(evt);
  }

  override mouseDragCallback(evt: NormalizedPointerEvent): void {
    if (!this.editData) return;
    const { annotation, handleIndex } = this.editData;
    annotation.data.handles.points[handleIndex] = { ...evt.worldPoint };
    annotation.invalidated = true;
    annotationManager.triggerAnnotationModified(annotation);
    this.viewportRef?.viewport.render();
  }

  override mouseUpCallback(evt: NormalizedPointerEvent): void {
    if (!this.editData) return;
    const { annotation, isNewAnnotation } = this.editData;
    annotation.data.handles.activeHandleIndex = -1;
    annotation.highlighted = false;
    annotation.invalidated = false;

    if (isNewAnnotation) {
      annotationHistory.recordAdd(annotation);
      // Prompt user for label (simple default)
      if (!annotation.data.label) {
        annotation.data.label = 'Annotation';
      }
    }

    annotationManager.triggerAnnotationCompleted(annotation);
    this.editData = null;
    this.viewportRef?.viewport.render();
  }

  override renderAnnotation(svgHelper: SVGDrawingHelper, annotation: Annotation): void {
    if (!annotation.isVisible || !this.viewportRef) return;

    const { viewport, canvas } = this.viewportRef;
    const camera = viewport.getCamera();
    const imageData = viewport.getImageData();
    if (!imageData) return;
    const { width: iw, height: ih } = imageData;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;

    const points = annotation.data.handles.points;
    if (points.length < 2) return;

    const [cx0, cy0] = camera.worldToCanvas(points[0].x, points[0].y, cw, ch, iw, ih);
    const [cx1, cy1] = camera.worldToCanvas(points[1].x, points[1].y, cw, ch, iw, ih);

    const tail: Point2 = { x: cx0, y: cy0 };
    const head: Point2 = { x: cx1, y: cy1 };

    const style = annotation.highlighted ? { ...this.style, color: this.style.highlightColor } : this.style;

    svgHelper.clearGroup(annotation.annotationUID);
    const group = svgHelper.getOrCreateGroup(annotation.annotationUID);

    svgHelper.drawArrow(group, tail, head, 10, style);
    svgHelper.drawHandles(group, [tail, head], annotation.data.handles.activeHandleIndex, style);

    if (annotation.data.label) {
      svgHelper.drawText(group, { x: cx0 + 10, y: cy0 - 10 }, annotation.data.label, style);
    }
  }

  override isPointNearTool(annotation: Annotation, canvasPoint: Point2, proximity: number): boolean {
    if (!this.viewportRef) return false;

    const { viewport, canvas } = this.viewportRef;
    const camera = viewport.getCamera();
    const imageData = viewport.getImageData();
    if (!imageData) return false;
    const { width: iw, height: ih } = imageData;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;

    const points = annotation.data.handles.points;
    if (points.length < 2) return false;

    const [cx0, cy0] = camera.worldToCanvas(points[0].x, points[0].y, cw, ch, iw, ih);
    const [cx1, cy1] = camera.worldToCanvas(points[1].x, points[1].y, cw, ch, iw, ih);

    return distanceToLineSegment(canvasPoint, { x: cx0, y: cy0 }, { x: cx1, y: cy1 }) <= proximity;
  }

  override cancel(): void {
    if (this.editData?.isNewAnnotation) {
      annotationManager.removeAnnotation(this.editData.annotation.annotationUID);
    }
    this.editData = null;
  }
}

function distanceToLineSegment(p: Point2, a: Point2, b: Point2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
