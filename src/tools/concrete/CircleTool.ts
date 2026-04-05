/**
 * CircleTool — draws a circle defined by a center point and an edge point.
 * Displays area and radius in world-space pixels.
 *
 * Mirrors legacy `StentorROIMeasurement` / `circleannotation.js` behavior
 * using the new AnnotationTool framework.
 */

import { AnnotationTool } from '../base/AnnotationTool';
import type { Annotation, NormalizedPointerEvent, Point2 } from '../base/types';
import type { SVGDrawingHelper } from '../drawing/SVGDrawingHelper';
import { annotationManager, generateAnnotationUID } from '../stateManagement/AnnotationManager';
import { annotationHistory } from '../stateManagement/HistoryMemo';

export class CircleTool extends AnnotationTool {
  static override toolName = 'Circle';

  override get cursor(): string {
    return 'crosshair';
  }

  override addNewAnnotation(evt: NormalizedPointerEvent): Annotation {
    const annotation: Annotation = {
      annotationUID: generateAnnotationUID(),
      metadata: {
        toolName: CircleTool.toolName,
        viewportId: this.viewportRef?.viewport.id ?? '',
        imageId: this.viewportRef?.imageId,
      },
      data: {
        handles: {
          points: [
            { ...evt.worldPoint }, // center
            { ...evt.worldPoint }, // edge point (defines radius)
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
    const annotations = annotationManager.getAnnotations(CircleTool.toolName, this.viewportRef?.imageId);
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

    const [center, edge] = annotation.data.handles.points;
    const dx = edge.x - center.x;
    const dy = edge.y - center.y;
    const radius = Math.sqrt(dx * dx + dy * dy);
    const area = Math.PI * radius * radius;

    annotation.data.cachedStats = { radius, area };
    annotation.data.label = `A: ${area.toFixed(1)} px²  r: ${radius.toFixed(1)} px`;

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

    const dx = cx1 - cx0;
    const dy = cy1 - cy0;
    const canvasRadius = Math.sqrt(dx * dx + dy * dy);

    const style = annotation.highlighted ? { ...this.style, color: this.style.highlightColor } : this.style;

    svgHelper.clearGroup(annotation.annotationUID);
    const group = svgHelper.getOrCreateGroup(annotation.annotationUID);

    // Draw the circle (as an ellipse with equal radii)
    svgHelper.drawEllipse(group, { x: cx0, y: cy0 }, canvasRadius, canvasRadius, style);

    // Draw handles: center + edge
    svgHelper.drawHandles(
      group,
      [{ x: cx0, y: cy0 }, { x: cx1, y: cy1 }],
      annotation.data.handles.activeHandleIndex,
      style,
    );

    // Draw a dashed radius line from center to edge
    svgHelper.drawLine(group, { x: cx0, y: cy0 }, { x: cx1, y: cy1 }, {
      ...style,
      lineWidth: 1,
      lineDash: [4, 3],
    });

    // Label
    if (annotation.data.label) {
      svgHelper.drawText(
        group,
        { x: cx0 + canvasRadius + 5, y: cy0 },
        annotation.data.label,
        style,
      );
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

    const dx = cx1 - cx0;
    const dy = cy1 - cy0;
    const radius = Math.sqrt(dx * dx + dy * dy);

    if (radius === 0) return false;

    const distFromCenter = Math.sqrt(
      (canvasPoint.x - cx0) ** 2 + (canvasPoint.y - cy0) ** 2,
    );

    // Near the circle boundary
    return Math.abs(distFromCenter - radius) <= proximity;
  }

  override cancel(): void {
    if (this.editData?.isNewAnnotation) {
      annotationManager.removeAnnotation(this.editData.annotation.annotationUID);
    }
    this.editData = null;
  }
}
