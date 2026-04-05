/**
 * TextAnnotationTool — places a text label at a clicked position.
 *
 * The user clicks to place the text anchor, then a prompt (or inline
 * editing) provides the text content. Mirrors legacy `textannotation.js`.
 */

import { AnnotationTool } from '../base/AnnotationTool';
import type { Annotation, NormalizedPointerEvent, Point2 } from '../base/types';
import type { SVGDrawingHelper } from '../drawing/SVGDrawingHelper';
import { annotationManager, generateAnnotationUID } from '../stateManagement/AnnotationManager';
import { annotationHistory } from '../stateManagement/HistoryMemo';

export class TextAnnotationTool extends AnnotationTool {
  static override toolName = 'TextAnnotation';

  override get cursor(): string {
    return 'text';
  }

  override addNewAnnotation(evt: NormalizedPointerEvent): Annotation {
    // Prompt for text (simple window.prompt for now; can be replaced with inline UI)
    const text = window.prompt('Enter annotation text:', '');
    if (!text) {
      // Return a dummy that will be immediately removed
      const dummy: Annotation = {
        annotationUID: generateAnnotationUID(),
        metadata: {
          toolName: TextAnnotationTool.toolName,
          viewportId: this.viewportRef?.viewport.id ?? '',
          imageId: this.viewportRef?.imageId,
        },
        data: {
          handles: { points: [{ ...evt.worldPoint }], activeHandleIndex: -1 },
          cachedStats: {},
          label: '',
        },
        highlighted: false,
        isLocked: false,
        isVisible: false,
        invalidated: false,
      };
      return dummy;
    }

    const annotation: Annotation = {
      annotationUID: generateAnnotationUID(),
      metadata: {
        toolName: TextAnnotationTool.toolName,
        viewportId: this.viewportRef?.viewport.id ?? '',
        imageId: this.viewportRef?.imageId,
      },
      data: {
        handles: {
          points: [{ ...evt.worldPoint }],
          activeHandleIndex: -1,
        },
        cachedStats: {},
        label: text,
      },
      highlighted: false,
      isLocked: false,
      isVisible: true,
      invalidated: false,
    };

    annotationManager.addAnnotation(annotation);
    annotationHistory.recordAdd(annotation);
    annotationManager.triggerAnnotationCompleted(annotation);
    this.triggerRender();
    return annotation;
  }

  override mouseDownCallback(evt: NormalizedPointerEvent): void {
    // Check if clicking near an existing text handle to drag it
    const annotations = annotationManager.getAnnotations(TextAnnotationTool.toolName, this.viewportRef?.imageId);
    for (const ann of annotations) {
      const handleIdx = this.getHandleNearCanvasPoint(ann, evt.canvasPoint, 10);
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
    if (!this.editData || this.editData.isNewAnnotation) return;
    const { annotation, handleIndex } = this.editData;
    annotation.data.handles.points[handleIndex] = { ...evt.worldPoint };
    annotation.invalidated = true;
    annotationManager.triggerAnnotationModified(annotation);
    this.triggerRender();
  }

  override mouseUpCallback(_evt: NormalizedPointerEvent): void {
    if (!this.editData) return;
    const { annotation } = this.editData;
    annotation.invalidated = false;
    annotationManager.triggerAnnotationCompleted(annotation);
    this.editData = null;
    this.triggerRender();
  }

  override renderAnnotation(svgHelper: SVGDrawingHelper, annotation: Annotation): void {
    if (!annotation.isVisible || !this.viewportRef) return;
    if (!annotation.data.label) return;

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

    const style = annotation.highlighted
      ? { ...this.style, color: this.style.highlightColor }
      : this.style;

    svgHelper.clearGroup(annotation.annotationUID);
    const group = svgHelper.getOrCreateGroup(annotation.annotationUID);

    // Draw text background box
    const text = annotation.data.label;
    const fontSize = style.textFontSize ?? 14;
    const padding = 4;
    const estimatedWidth = text.length * fontSize * 0.6;
    const boxHeight = fontSize + padding * 2;
    const boxWidth = estimatedWidth + padding * 2;

    svgHelper.drawRect(
      group,
      { x: cx - padding, y: cy - fontSize - padding },
      boxWidth,
      boxHeight,
      { ...style, color: 'rgba(0,0,0,0.6)' },
    );

    // Draw the text
    svgHelper.drawText(group, { x: cx, y: cy }, text, style);

    // Draw handle
    svgHelper.drawHandles(group, [{ x: cx, y: cy }], -1, style);
  }

  override isPointNearTool(annotation: Annotation, canvasPoint: Point2, proximity: number): boolean {
    if (!this.viewportRef || !annotation.data.label) return false;

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

    // Check if near the text label area
    const fontSize = this.style.textFontSize ?? 14;
    const textWidth = annotation.data.label.length * fontSize * 0.6;

    return (
      canvasPoint.x >= cx - proximity &&
      canvasPoint.x <= cx + textWidth + proximity &&
      canvasPoint.y >= cy - fontSize - proximity &&
      canvasPoint.y <= cy + proximity
    );
  }

  override cancel(): void {
    this.editData = null;
  }
}
