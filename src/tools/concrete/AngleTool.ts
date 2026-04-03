/**
 * AngleTool — three-point angle measurement.
 * Point 0 = first arm endpoint, Point 1 = vertex, Point 2 = second arm endpoint.
 */

import { AnnotationTool } from '../base/AnnotationTool';
import type { Annotation, NormalizedPointerEvent, Point2 } from '../base/types';
import type { SVGDrawingHelper } from '../drawing/SVGDrawingHelper';
import { annotationManager, generateAnnotationUID } from '../stateManagement/AnnotationManager';
import { annotationHistory } from '../stateManagement/HistoryMemo';

export class AngleTool extends AnnotationTool {
  static override toolName = 'Angle';

  private _phase: 'first' | 'second' | 'idle' = 'idle';

  override get cursor(): string {
    return 'crosshair';
  }

  override addNewAnnotation(evt: NormalizedPointerEvent): Annotation {
    const annotation: Annotation = {
      annotationUID: generateAnnotationUID(),
      metadata: {
        toolName: AngleTool.toolName,
        viewportId: this.viewportRef?.viewport.id ?? '',
      },
      data: {
        handles: {
          points: [
            { ...evt.worldPoint }, // arm 1 endpoint
            { ...evt.worldPoint }, // vertex (will move during first drag)
            { ...evt.worldPoint }, // arm 2 endpoint (will move during second drag)
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
    this._phase = 'first';
    return annotation;
  }

  override mouseDownCallback(evt: NormalizedPointerEvent): void {
    // If we're in second phase after first arm was drawn
    if (this._phase === 'second' && this.editData) {
      this.editData.handleIndex = 2;
      this.editData.annotation.data.handles.activeHandleIndex = 2;
      return;
    }

    // Check for existing handle hit
    const annotations = annotationManager.getAnnotations(AngleTool.toolName);
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

    if (this._phase === 'first') {
      // First arm drawn, now wait for second arm
      this._phase = 'second';
      this.editData.annotation.data.handles.points[2] = { ...this.editData.annotation.data.handles.points[1] };
      return;
    }

    // Finalize
    const { annotation, isNewAnnotation } = this.editData;
    annotation.data.handles.activeHandleIndex = -1;
    annotation.highlighted = false;
    annotation.invalidated = false;

    // Calculate angle
    const [p0, p1, p2] = annotation.data.handles.points;
    const angle = computeAngle(p0, p1, p2);
    annotation.data.cachedStats = { angle };
    annotation.data.label = `${angle.toFixed(1)}°`;

    if (isNewAnnotation) annotationHistory.recordAdd(annotation);
    annotationManager.triggerAnnotationCompleted(annotation);
    this.editData = null;
    this._phase = 'idle';
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
    if (points.length < 3) return;

    const canvasPoints: Point2[] = points.map(p => {
      const [cx, cy] = camera.worldToCanvas(p.x, p.y, cw, ch, iw, ih);
      return { x: cx, y: cy };
    });

    const style = annotation.highlighted ? { ...this.style, color: this.style.highlightColor } : this.style;

    svgHelper.clearGroup(annotation.annotationUID);
    const group = svgHelper.getOrCreateGroup(annotation.annotationUID);

    // Two arms: p0→p1 and p1→p2
    svgHelper.drawLine(group, canvasPoints[0], canvasPoints[1], style);
    svgHelper.drawLine(group, canvasPoints[1], canvasPoints[2], style);
    svgHelper.drawHandles(group, canvasPoints, annotation.data.handles.activeHandleIndex, style);

    // Draw arc at vertex
    const arcRadius = 20;
    const angle1 = Math.atan2(canvasPoints[0].y - canvasPoints[1].y, canvasPoints[0].x - canvasPoints[1].x);
    const angle2 = Math.atan2(canvasPoints[2].y - canvasPoints[1].y, canvasPoints[2].x - canvasPoints[1].x);
    const arcPath = describeArc(canvasPoints[1], arcRadius, angle1, angle2);
    if (arcPath) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', arcPath);
      path.setAttribute('stroke', style.color);
      path.setAttribute('stroke-width', String(style.lineWidth));
      path.setAttribute('fill', 'none');
      group.appendChild(path);
    }

    if (annotation.data.label) {
      const labelPos: Point2 = {
        x: canvasPoints[1].x + 15,
        y: canvasPoints[1].y - 15,
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
    if (points.length < 3) return false;

    const canvasPoints: Point2[] = points.map(p => {
      const [cx, cy] = camera.worldToCanvas(p.x, p.y, cw, ch, iw, ih);
      return { x: cx, y: cy };
    });

    // Near either arm segment
    return (
      distToSeg(canvasPoint, canvasPoints[0], canvasPoints[1]) <= proximity ||
      distToSeg(canvasPoint, canvasPoints[1], canvasPoints[2]) <= proximity
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

function computeAngle(a: Point2, vertex: Point2, b: Point2): number {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y };
  const v2 = { x: b.x - vertex.x, y: b.y - vertex.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

function describeArc(center: Point2, radius: number, startAngle: number, endAngle: number): string {
  const start: Point2 = {
    x: center.x + radius * Math.cos(startAngle),
    y: center.y + radius * Math.sin(startAngle),
  };
  const end: Point2 = {
    x: center.x + radius * Math.cos(endAngle),
    y: center.y + radius * Math.sin(endAngle),
  };

  let sweep = endAngle - startAngle;
  if (sweep < 0) sweep += 2 * Math.PI;
  const largeArc = sweep > Math.PI ? 1 : 0;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
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
