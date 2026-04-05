/**
 * FreehandTool — draws a freehand polyline/polygon by collecting points
 * during mouse drag. Displays perimeter length in world-space pixels.
 *
 * Mirrors legacy `freehandannotation.js` behavior using the new
 * AnnotationTool framework.
 */

import { AnnotationTool } from '../base/AnnotationTool';
import type { Annotation, NormalizedPointerEvent, Point2 } from '../base/types';
import type { SVGDrawingHelper } from '../drawing/SVGDrawingHelper';
import { annotationManager, generateAnnotationUID } from '../stateManagement/AnnotationManager';
import { annotationHistory } from '../stateManagement/HistoryMemo';

/** Minimum distance (canvas px) between consecutive freehand points to avoid over-sampling. */
const MIN_POINT_DISTANCE = 3;

export class FreehandTool extends AnnotationTool {
  static override toolName = 'Freehand';

  private _lastCanvasPoint: Point2 | null = null;

  override get cursor(): string {
    return 'crosshair';
  }

  override addNewAnnotation(evt: NormalizedPointerEvent): Annotation {
    const annotation: Annotation = {
      annotationUID: generateAnnotationUID(),
      metadata: {
        toolName: FreehandTool.toolName,
        viewportId: this.viewportRef?.viewport.id ?? '',
        imageId: this.viewportRef?.imageId,
      },
      data: {
        handles: {
          points: [{ ...evt.worldPoint }],
          activeHandleIndex: 0,
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
      handleIndex: 0,
      isNewAnnotation: true,
    };
    this._lastCanvasPoint = { ...evt.canvasPoint };
    return annotation;
  }

  override mouseDownCallback(evt: NormalizedPointerEvent): void {
    // Check if clicking near an existing handle first
    const annotations = annotationManager.getAnnotations(FreehandTool.toolName, this.viewportRef?.imageId);
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
    const { annotation, isNewAnnotation } = this.editData;

    if (isNewAnnotation) {
      // Collect points during drag — throttle by minimum distance
      if (this._lastCanvasPoint) {
        const dx = evt.canvasPoint.x - this._lastCanvasPoint.x;
        const dy = evt.canvasPoint.y - this._lastCanvasPoint.y;
        if (Math.sqrt(dx * dx + dy * dy) < MIN_POINT_DISTANCE) return;
      }

      annotation.data.handles.points.push({ ...evt.worldPoint });
      annotation.data.handles.activeHandleIndex = annotation.data.handles.points.length - 1;
      this._lastCanvasPoint = { ...evt.canvasPoint };
    } else {
      // Editing existing handle
      const { handleIndex } = this.editData;
      annotation.data.handles.points[handleIndex] = { ...evt.worldPoint };
    }

    annotation.invalidated = true;
    annotationManager.triggerAnnotationModified(annotation);
    this.triggerRender();
  }

  override mouseUpCallback(_evt: NormalizedPointerEvent): void {
    if (!this.editData) return;
    const { annotation, isNewAnnotation } = this.editData;
    annotation.data.handles.activeHandleIndex = -1;
    annotation.highlighted = false;
    annotation.invalidated = false;

    // Compute perimeter
    const points = annotation.data.handles.points;
    let perimeter = 0;
    for (let i = 1; i < points.length; i++) {
      perimeter += this.worldDistance(points[i - 1], points[i]);
    }
    // Close the polygon
    if (points.length > 2) {
      perimeter += this.worldDistance(points[points.length - 1], points[0]);
    }

    annotation.data.cachedStats = { perimeter, pointCount: points.length };
    annotation.data.label = `${perimeter.toFixed(1)} px`;

    if (isNewAnnotation) annotationHistory.recordAdd(annotation);
    annotationManager.triggerAnnotationCompleted(annotation);
    this.editData = null;
    this._lastCanvasPoint = null;
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

    // Convert world points to canvas points
    const canvasPoints: Point2[] = points.map((p) => {
      const [cx, cy] = camera.worldToCanvas(p.x, p.y, cw, ch, iw, ih);
      return { x: cx, y: cy };
    });

    const style = annotation.highlighted
      ? { ...this.style, color: this.style.highlightColor }
      : this.style;

    svgHelper.clearGroup(annotation.annotationUID);
    const group = svgHelper.getOrCreateGroup(annotation.annotationUID);

    // Draw the freehand polyline/polygon
    const isClosed = canvasPoints.length > 2;
    svgHelper.drawPath(group, canvasPoints, isClosed, style);

    // Draw handles at first and last points
    const handlePoints = [canvasPoints[0], canvasPoints[canvasPoints.length - 1]];
    svgHelper.drawHandles(group, handlePoints, annotation.data.handles.activeHandleIndex, style);

    // Label near centroid
    if (annotation.data.label && canvasPoints.length > 0) {
      const cx = canvasPoints.reduce((s, p) => s + p.x, 0) / canvasPoints.length;
      const cy = canvasPoints.reduce((s, p) => s + p.y, 0) / canvasPoints.length;
      svgHelper.drawText(group, { x: cx + 5, y: cy - 5 }, annotation.data.label, style);
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

    // Check proximity to each line segment
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = camera.worldToCanvas(points[i - 1].x, points[i - 1].y, cw, ch, iw, ih);
      const [bx, by] = camera.worldToCanvas(points[i].x, points[i].y, cw, ch, iw, ih);

      if (distanceToLineSegment(canvasPoint, { x: ax, y: ay }, { x: bx, y: by }) <= proximity) {
        return true;
      }
    }

    // Check closing segment
    if (points.length > 2) {
      const first = points[0];
      const last = points[points.length - 1];
      const [ax, ay] = camera.worldToCanvas(first.x, first.y, cw, ch, iw, ih);
      const [bx, by] = camera.worldToCanvas(last.x, last.y, cw, ch, iw, ih);
      if (distanceToLineSegment(canvasPoint, { x: ax, y: ay }, { x: bx, y: by }) <= proximity) {
        return true;
      }
    }

    return false;
  }

  override cancel(): void {
    if (this.editData?.isNewAnnotation) {
      annotationManager.removeAnnotation(this.editData.annotation.annotationUID);
    }
    this.editData = null;
    this._lastCanvasPoint = null;
  }
}

function distanceToLineSegment(p: Point2, a: Point2, b: Point2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  }

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}
