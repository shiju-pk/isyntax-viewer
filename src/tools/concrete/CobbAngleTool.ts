/**
 * CobbAngleTool — measures the angle between two line segments (Cobb angle).
 *
 * Used in spinal measurements: draw two lines along vertebral endplates,
 * and the tool computes the angle between the perpendiculars of those lines.
 *
 * 4 handles: [line1Start, line1End, line2Start, line2End]
 */

import { AnnotationTool } from '../base/AnnotationTool';
import type { Annotation, NormalizedPointerEvent, Point2 } from '../base/types';
import type { SVGDrawingHelper } from '../drawing/SVGDrawingHelper';
import { annotationManager, generateAnnotationUID } from '../stateManagement/AnnotationManager';
import { annotationHistory } from '../stateManagement/HistoryMemo';

export class CobbAngleTool extends AnnotationTool {
  static override toolName = 'CobbAngle';

  private _phase: 'idle' | 'firstLine' | 'secondLineStart' | 'secondLine' = 'idle';

  override get cursor(): string {
    return 'crosshair';
  }

  override addNewAnnotation(evt: NormalizedPointerEvent): Annotation {
    const annotation: Annotation = {
      annotationUID: generateAnnotationUID(),
      metadata: {
        toolName: CobbAngleTool.toolName,
        viewportId: this.viewportRef?.viewport.id ?? '',
        imageId: this.viewportRef?.imageId,
      },
      data: {
        handles: {
          points: [
            { ...evt.worldPoint }, // line 1 start
            { ...evt.worldPoint }, // line 1 end
            { ...evt.worldPoint }, // line 2 start
            { ...evt.worldPoint }, // line 2 end
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
    this._phase = 'firstLine';
    return annotation;
  }

  override mouseDownCallback(evt: NormalizedPointerEvent): void {
    // Continue drawing second line
    if (this._phase === 'secondLineStart' && this.editData) {
      this.editData.annotation.data.handles.points[2] = { ...evt.worldPoint };
      this.editData.annotation.data.handles.points[3] = { ...evt.worldPoint };
      this.editData.handleIndex = 3;
      this.editData.annotation.data.handles.activeHandleIndex = 3;
      this._phase = 'secondLine';
      return;
    }

    // Check for existing handle hit
    const annotations = annotationManager.getAnnotations(CobbAngleTool.toolName, this.viewportRef?.imageId);
    for (const ann of annotations) {
      const handleIdx = this.getHandleNearCanvasPoint(ann, evt.canvasPoint, 6);
      if (handleIdx !== -1) {
        this.editData = {
          annotation: ann,
          viewportId: ann.metadata.viewportId,
          handleIndex: handleIdx,
          isNewAnnotation: false,
        };
        this._phase = 'idle';
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
    this.triggerRender();
  }

  override mouseUpCallback(_evt: NormalizedPointerEvent): void {
    if (!this.editData) return;

    if (this._phase === 'firstLine') {
      // First line drawn, wait for second
      this._phase = 'secondLineStart';
      return;
    }

    if (this._phase === 'secondLine' || this._phase === 'idle') {
      // Finalize
      const { annotation, isNewAnnotation } = this.editData;
      annotation.data.handles.activeHandleIndex = -1;
      annotation.highlighted = false;
      annotation.invalidated = false;

      const [p0, p1, p2, p3] = annotation.data.handles.points;
      const angle = computeCobbAngle(p0, p1, p2, p3);
      annotation.data.cachedStats = { angle };
      annotation.data.label = `Cobb: ${angle.toFixed(1)}°`;

      if (isNewAnnotation) annotationHistory.recordAdd(annotation);
      annotationManager.triggerAnnotationCompleted(annotation);
      this.editData = null;
      this._phase = 'idle';
      this.triggerRender();
    }
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
    if (points.length < 4) return;

    const cp: Point2[] = points.map((p) => {
      const [cx, cy] = camera.worldToCanvas(p.x, p.y, cw, ch, iw, ih);
      return { x: cx, y: cy };
    });

    const style = annotation.highlighted
      ? { ...this.style, color: this.style.highlightColor }
      : this.style;

    svgHelper.clearGroup(annotation.annotationUID);
    const group = svgHelper.getOrCreateGroup(annotation.annotationUID);

    // Draw two line segments
    svgHelper.drawLine(group, cp[0], cp[1], style);
    svgHelper.drawLine(group, cp[2], cp[3], style);

    // Draw dashed perpendicular indicators
    const dashStyle = { ...style, lineDash: [4, 3] };
    const mid1 = midpoint(cp[0], cp[1]);
    const mid2 = midpoint(cp[2], cp[3]);
    svgHelper.drawLine(group, mid1, mid2, dashStyle);

    // Draw handles
    svgHelper.drawHandles(group, cp, annotation.data.handles.activeHandleIndex, style);

    // Label
    if (annotation.data.label) {
      const labelPos: Point2 = {
        x: (mid1.x + mid2.x) / 2 + 15,
        y: (mid1.y + mid2.y) / 2 - 15,
      };
      svgHelper.drawText(group, labelPos, annotation.data.label, style);
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
    if (points.length < 4) return false;

    const cp: Point2[] = points.map((p) => {
      const [cx, cy] = camera.worldToCanvas(p.x, p.y, cw, ch, iw, ih);
      return { x: cx, y: cy };
    });

    return (
      distToSeg(canvasPoint, cp[0], cp[1]) <= proximity ||
      distToSeg(canvasPoint, cp[2], cp[3]) <= proximity
    );
  }

  override cancel(): void {
    if (this.editData?.isNewAnnotation) {
      annotationManager.removeAnnotation(this.editData.annotation.annotationUID);
    }
    this.editData = null;
    this._phase = 'idle';
  }
}

/**
 * Compute the Cobb angle between two line segments.
 * The Cobb angle is the acute angle between the lines defined by the two segments.
 */
function computeCobbAngle(p0: Point2, p1: Point2, p2: Point2, p3: Point2): number {
  // Direction vectors of the two lines
  const d1 = { x: p1.x - p0.x, y: p1.y - p0.y };
  const d2 = { x: p3.x - p2.x, y: p3.y - p2.y };

  const dot = d1.x * d2.x + d1.y * d2.y;
  const mag1 = Math.sqrt(d1.x * d1.x + d1.y * d1.y);
  const mag2 = Math.sqrt(d2.x * d2.x + d2.y * d2.y);
  if (mag1 === 0 || mag2 === 0) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  let angle = (Math.acos(cosAngle) * 180) / Math.PI;

  // Cobb angle is always the acute angle
  if (angle > 90) angle = 180 - angle;

  return angle;
}

function midpoint(a: Point2, b: Point2): Point2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distToSeg(p: Point2, a: Point2, b: Point2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
