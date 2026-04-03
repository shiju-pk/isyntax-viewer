/**
 * RectangleROITool — draws a rectangle defined by two corner points.
 * Displays area in world-space pixels².
 */

import { AnnotationTool } from '../base/AnnotationTool';
import type { Annotation, NormalizedPointerEvent, Point2 } from '../base/types';
import type { SVGDrawingHelper } from '../drawing/SVGDrawingHelper';
import { annotationManager, generateAnnotationUID } from '../stateManagement/AnnotationManager';
import { annotationHistory } from '../stateManagement/HistoryMemo';

export class RectangleROITool extends AnnotationTool {
  static override toolName = 'RectangleROI';

  override get cursor(): string {
    return 'crosshair';
  }

  override addNewAnnotation(evt: NormalizedPointerEvent): Annotation {
    const annotation: Annotation = {
      annotationUID: generateAnnotationUID(),
      metadata: {
        toolName: RectangleROITool.toolName,
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
    const annotations = annotationManager.getAnnotations(RectangleROITool.toolName, this.viewportRef?.imageId);
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
    this.triggerRender();
  }

  override mouseUpCallback(evt: NormalizedPointerEvent): void {
    if (!this.editData) return;
    const { annotation, isNewAnnotation } = this.editData;
    annotation.data.handles.activeHandleIndex = -1;
    annotation.highlighted = false;
    annotation.invalidated = false;

    const [p0, p1] = annotation.data.handles.points;
    const w = Math.abs(p1.x - p0.x);
    const h = Math.abs(p1.y - p0.y);
    const area = w * h;
    annotation.data.cachedStats = { area, width: w, height: h };
    annotation.data.label = `${area.toFixed(1)} px²`;

    if (isNewAnnotation) annotationHistory.recordAdd(annotation);
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

    const left = Math.min(cx0, cx1);
    const top = Math.min(cy0, cy1);
    const width = Math.abs(cx1 - cx0);
    const height = Math.abs(cy1 - cy0);

    const style = annotation.highlighted ? { ...this.style, color: this.style.highlightColor } : this.style;

    svgHelper.clearGroup(annotation.annotationUID);
    const group = svgHelper.getOrCreateGroup(annotation.annotationUID);

    svgHelper.drawRect(group, { x: left, y: top }, width, height, style);
    svgHelper.drawHandles(
      group,
      [{ x: cx0, y: cy0 }, { x: cx1, y: cy1 }],
      annotation.data.handles.activeHandleIndex,
      style,
    );

    if (annotation.data.label) {
      svgHelper.drawText(group, { x: left + width + 5, y: top }, annotation.data.label, style);
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

    const left = Math.min(cx0, cx1);
    const top = Math.min(cy0, cy1);
    const right = Math.max(cx0, cx1);
    const bottom = Math.max(cy0, cy1);
    const px = canvasPoint.x;
    const py = canvasPoint.y;

    // Near any edge of the rectangle
    const nearLeft = Math.abs(px - left) <= proximity && py >= top - proximity && py <= bottom + proximity;
    const nearRight = Math.abs(px - right) <= proximity && py >= top - proximity && py <= bottom + proximity;
    const nearTop = Math.abs(py - top) <= proximity && px >= left - proximity && px <= right + proximity;
    const nearBottom = Math.abs(py - bottom) <= proximity && px >= left - proximity && px <= right + proximity;

    return nearLeft || nearRight || nearTop || nearBottom;
  }

  override cancel(): void {
    if (this.editData?.isNewAnnotation) {
      annotationManager.removeAnnotation(this.editData.annotation.annotationUID);
    }
    this.editData = null;
  }
}
