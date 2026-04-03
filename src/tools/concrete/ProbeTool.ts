/**
 * ProbeTool — single-click pixel inspection.
 * Displays pixel value at the clicked world coordinate.
 */

import { AnnotationTool } from '../base/AnnotationTool';
import type { Annotation, NormalizedPointerEvent, Point2 } from '../base/types';
import type { SVGDrawingHelper } from '../drawing/SVGDrawingHelper';
import { annotationManager, generateAnnotationUID } from '../stateManagement/AnnotationManager';
import { annotationHistory } from '../stateManagement/HistoryMemo';

export class ProbeTool extends AnnotationTool {
  static override toolName = 'Probe';

  override get cursor(): string {
    return 'crosshair';
  }

  override addNewAnnotation(evt: NormalizedPointerEvent): Annotation {
    const annotation: Annotation = {
      annotationUID: generateAnnotationUID(),
      metadata: {
        toolName: ProbeTool.toolName,
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

    // Read pixel value
    const value = this._readPixelValue(evt.worldPoint);
    annotation.data.cachedStats = { value };
    annotation.data.label = value !== null ? `${value}` : '—';

    annotationManager.addAnnotation(annotation);
    annotationHistory.recordAdd(annotation);
    annotationManager.triggerAnnotationCompleted(annotation);

    return annotation;
  }

  override mouseDownCallback(evt: NormalizedPointerEvent): void {
    this.addNewAnnotation(evt);
    this.triggerRender();
  }

  // Probe doesn't use drag
  override mouseDragCallback(_evt: NormalizedPointerEvent): void { }
  override mouseUpCallback(_evt: NormalizedPointerEvent): void { }

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
    if (points.length < 1) return;

    const [cx, cy] = camera.worldToCanvas(points[0].x, points[0].y, cw, ch, iw, ih);
    const center: Point2 = { x: cx, y: cy };

    const style = annotation.highlighted ? { ...this.style, color: this.style.highlightColor } : this.style;

    svgHelper.clearGroup(annotation.annotationUID);
    const group = svgHelper.getOrCreateGroup(annotation.annotationUID);

    // Small crosshair
    svgHelper.drawLine(group, { x: cx - 5, y: cy }, { x: cx + 5, y: cy }, style);
    svgHelper.drawLine(group, { x: cx, y: cy - 5 }, { x: cx, y: cy + 5 }, style);

    if (annotation.data.label) {
      svgHelper.drawText(group, { x: cx + 8, y: cy - 8 }, annotation.data.label, style);
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
    if (points.length < 1) return false;

    const [cx, cy] = camera.worldToCanvas(points[0].x, points[0].y, cw, ch, iw, ih);
    return Math.hypot(canvasPoint.x - cx, canvasPoint.y - cy) <= proximity;
  }

  override cancel(): void {
    this.editData = null;
  }

  private _readPixelValue(worldPoint: Point2): number | null {
    if (!this.viewportRef) return null;
    const imageData = this.viewportRef.viewport.getImageData();
    if (!imageData) return null;

    const x = Math.round(worldPoint.x);
    const y = Math.round(worldPoint.y);

    if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) return null;

    const idx = (y * imageData.width + x) * 4;
    // Return luminance value (average of RGB channels)
    const r = imageData.data[idx];
    const g = imageData.data[idx + 1];
    const b = imageData.data[idx + 2];
    return Math.round((r + g + b) / 3);
  }
}
