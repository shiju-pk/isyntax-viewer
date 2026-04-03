/**
 * AnnotationTool — base for tools that create and render annotations.
 *
 * Extends BaseTool with:
 *   - Annotation creation lifecycle (mouseDown → drag → mouseUp)
 *   - SVG rendering callback
 *   - Hit testing for annotation selection/editing
 *   - Handle proximity detection
 */

import { BaseTool } from './BaseTool';
import type {
  Annotation,
  AnnotationStyle,
  NormalizedPointerEvent,
  Point2,
} from './types';
import { DEFAULT_ANNOTATION_STYLE } from './types';
import type { SVGDrawingHelper } from '../drawing/SVGDrawingHelper';

export interface EditData {
  annotation: Annotation;
  viewportId: string;
  handleIndex: number;
  isNewAnnotation: boolean;
}

export abstract class AnnotationTool extends BaseTool {
  style: AnnotationStyle;
  protected editData: EditData | null = null;

  constructor(config = {}) {
    super(config);
    this.style = { ...DEFAULT_ANNOTATION_STYLE, ...(config as any).style };
  }

  // ------------------------------------------------------------------
  // Abstract methods — every annotation tool must implement these
  // ------------------------------------------------------------------

  /**
   * Create a new annotation on mouse down. Return the annotation object.
   */
  abstract addNewAnnotation(evt: NormalizedPointerEvent): Annotation;

  /**
   * Render this tool's annotations to the SVG overlay.
   */
  abstract renderAnnotation(
    svgHelper: SVGDrawingHelper,
    annotation: Annotation,
  ): void;

  /**
   * Is the given canvas point close enough to this annotation to select it?
   */
  abstract isPointNearTool(
    annotation: Annotation,
    canvasPoint: Point2,
    proximity: number,
  ): boolean;

  /**
   * Cancel the in-progress annotation creation.
   */
  abstract cancel(): void;

  // ------------------------------------------------------------------
  // Provided: handle proximity detection
  // ------------------------------------------------------------------

  /**
   * Find the closest handle to a canvas point within proximity radius.
   * Returns the handle index, or -1 if none found.
   */
  getHandleNearCanvasPoint(
    annotation: Annotation,
    canvasPoint: Point2,
    proximity: number = 6,
  ): number {
    if (!this.viewportRef) return -1;

    const { viewport, canvas } = this.viewportRef;
    const camera = viewport.getCamera();
    const imageData = viewport.getImageData();
    if (!imageData) return -1;
    const { width: iw, height: ih } = imageData;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;

    for (let i = 0; i < annotation.data.handles.points.length; i++) {
      const hp = annotation.data.handles.points[i];
      const [cx, cy] = camera.worldToCanvas(hp.x, hp.y, cw, ch, iw, ih);
      const dx = cx - canvasPoint.x;
      const dy = cy - canvasPoint.y;
      if (Math.sqrt(dx * dx + dy * dy) <= proximity) {
        return i;
      }
    }
    return -1;
  }

  // ------------------------------------------------------------------
  // Provided: stats computation helper
  // ------------------------------------------------------------------

  /**
   * Compute distance between two world-space points.
   */
  protected worldDistance(a: Point2, b: Point2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
