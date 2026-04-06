/**
 * LengthTool — two-point line measurement.
 * Displays distance in world-space pixels.
 */

import { AnnotationTool } from '../base/AnnotationTool';
import type { EditData } from '../base/AnnotationTool';
import type { Annotation, NormalizedPointerEvent, Point2 } from '../base/types';
import type { SVGDrawingHelper } from '../drawing/SVGDrawingHelper';
import { annotationManager, generateAnnotationUID } from '../stateManagement/AnnotationManager';
import { annotationHistory } from '../stateManagement/HistoryMemo';

export class LengthTool extends AnnotationTool {
  static override toolName = 'Length';

  override get cursor(): string {
    return 'crosshair';
  }

  override addNewAnnotation(evt: NormalizedPointerEvent): Annotation {
    const annotation: Annotation = {
      annotationUID: generateAnnotationUID(),
      metadata: {
        toolName: LengthTool.toolName,
        viewportId: this.viewportRef?.viewport.id ?? '',
        imageId: this.viewportRef?.imageId,
      },
      data: {
        handles: {
          points: [
            { ...evt.worldPoint },
            { ...evt.worldPoint },
          ],
          activeHandleIndex: 1,
        },
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
    // Check if we hit an existing annotation handle first
    const annotations = annotationManager.getAnnotations(LengthTool.toolName, this.viewportRef?.imageId);
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

    // Start new annotation
    this.addNewAnnotation(evt);
  }

  override mouseDragCallback(evt: NormalizedPointerEvent): void {
    if (!this.editData) return;

    const { annotation, handleIndex } = this.editData;
    annotation.data.handles.points[handleIndex] = { ...evt.worldPoint };
    annotation.invalidated = true;

    annotationManager.triggerAnnotationModified(annotation);

    // Trigger re-render (engine + overlays)
    this.triggerRender();
  }

  override mouseUpCallback(evt: NormalizedPointerEvent): void {
    if (!this.editData) return;

    const { annotation, isNewAnnotation } = this.editData;
    annotation.data.handles.activeHandleIndex = -1;
    annotation.highlighted = false;
    annotation.invalidated = false;

    // Calculate stats
    const [p0, p1] = annotation.data.handles.points;
    const ps = this.viewportRef?.pixelSpacing;
    const dx = (p1.x - p0.x) * (ps ? ps[1] : 1);
    const dy = (p1.y - p0.y) * (ps ? ps[0] : 1);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const unit = ps ? 'mm' : 'px';
    annotation.data.cachedStats = { length: dist };
    annotation.data.label = `${dist.toFixed(2)} ${unit}`;

    if (isNewAnnotation) {
      annotationHistory.recordAdd(annotation);
    }

    annotationManager.triggerAnnotationCompleted(annotation);
    this.editData = null;

    this.triggerRender();
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

    const p0: Point2 = { x: cx0, y: cy0 };
    const p1: Point2 = { x: cx1, y: cy1 };

    const style = annotation.highlighted ? { ...this.style, color: this.style.highlightColor } : this.style;

    svgHelper.clearGroup(annotation.annotationUID);
    const group = svgHelper.getOrCreateGroup(annotation.annotationUID);

    svgHelper.drawLine(group, p0, p1, style);
    svgHelper.drawHandles(group, [p0, p1], annotation.data.handles.activeHandleIndex, style);

    // Text label near midpoint
    if (annotation.data.label) {
      const mid: Point2 = {
        x: (cx0 + cx1) / 2 + 10,
        y: (cy0 + cy1) / 2 - 10,
      };
      svgHelper.drawText(group, mid, annotation.data.label, style);
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

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}
