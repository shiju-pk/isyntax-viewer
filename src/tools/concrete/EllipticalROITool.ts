/**
 * EllipticalROITool — draws an ellipse defined by two corner points of its bounding box.
 * Displays area in world-space pixels².
 */

import { AnnotationTool } from '../base/AnnotationTool';
import type { Annotation, NormalizedPointerEvent, Point2 } from '../base/types';
import type { SVGDrawingHelper } from '../drawing/SVGDrawingHelper';
import { annotationManager, generateAnnotationUID } from '../stateManagement/AnnotationManager';
import { annotationHistory } from '../stateManagement/HistoryMemo';

export class EllipticalROITool extends AnnotationTool {
  static override toolName = 'EllipticalROI';

  override get cursor(): string {
    return 'crosshair';
  }

  override addNewAnnotation(evt: NormalizedPointerEvent): Annotation {
    const annotation: Annotation = {
      annotationUID: generateAnnotationUID(),
      metadata: {
        toolName: EllipticalROITool.toolName,
        viewportId: this.viewportRef?.viewport.id ?? '',
        imageId: this.viewportRef?.imageId,
      },
      data: {
        handles: {
          points: [
            { ...evt.worldPoint }, // corner 1
            { ...evt.worldPoint }, // corner 2 (opposite)
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
    const annotations = annotationManager.getAnnotations(EllipticalROITool.toolName, this.viewportRef?.imageId);
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
    const rx = Math.abs(p1.x - p0.x) / 2;
    const ry = Math.abs(p1.y - p0.y) / 2;
    const area = Math.PI * rx * ry;
    annotation.data.cachedStats = { area, rx, ry };
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

    const centerX = (cx0 + cx1) / 2;
    const centerY = (cy0 + cy1) / 2;
    const rx = Math.abs(cx1 - cx0) / 2;
    const ry = Math.abs(cy1 - cy0) / 2;

    const style = annotation.highlighted ? { ...this.style, color: this.style.highlightColor } : this.style;

    svgHelper.clearGroup(annotation.annotationUID);
    const group = svgHelper.getOrCreateGroup(annotation.annotationUID);

    svgHelper.drawEllipse(group, { x: centerX, y: centerY }, rx, ry, style);
    svgHelper.drawHandles(
      group,
      [{ x: cx0, y: cy0 }, { x: cx1, y: cy1 }],
      annotation.data.handles.activeHandleIndex,
      style,
    );

    if (annotation.data.label) {
      svgHelper.drawText(group, { x: centerX + rx + 5, y: centerY }, annotation.data.label, style);
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

    const centerX = (cx0 + cx1) / 2;
    const centerY = (cy0 + cy1) / 2;
    const rx = Math.abs(cx1 - cx0) / 2;
    const ry = Math.abs(cy1 - cy0) / 2;

    if (rx === 0 || ry === 0) return false;

    // Normalized distance from center
    const dx = (canvasPoint.x - centerX) / rx;
    const dy = (canvasPoint.y - centerY) / ry;
    const normalizedDist = Math.sqrt(dx * dx + dy * dy);

    // Near the ellipse boundary
    return Math.abs(normalizedDist - 1) * Math.min(rx, ry) <= proximity;
  }

  override cancel(): void {
    if (this.editData?.isNewAnnotation) {
      annotationManager.removeAnnotation(this.editData.annotation.annotationUID);
    }
    this.editData = null;
  }
}
