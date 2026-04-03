/**
 * SVGDrawingHelper — creates and manages an SVG overlay on top of the viewport canvas
 * for rendering annotations.
 *
 * Primitives: line, circle, ellipse, rect, path, text, arrow, handles.
 * Each annotation gets its own <g> group for efficient updates.
 */

import type { Point2, AnnotationStyle } from '../base/types';
import { DEFAULT_ANNOTATION_STYLE } from '../base/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class SVGDrawingHelper {
  private _svg: SVGSVGElement;
  private _container: HTMLElement;
  private _groups = new Map<string, SVGGElement>();

  constructor(container: HTMLElement) {
    this._container = container;

    // Create SVG overlay
    this._svg = document.createElementNS(SVG_NS, 'svg');
    this._svg.setAttribute('xmlns', SVG_NS);
    this._svg.style.position = 'absolute';
    this._svg.style.top = '0';
    this._svg.style.left = '0';
    this._svg.style.width = '100%';
    this._svg.style.height = '100%';
    this._svg.style.pointerEvents = 'none';
    this._svg.style.overflow = 'visible';

    // Ensure container has relative positioning
    const pos = getComputedStyle(container).position;
    if (pos === 'static') {
      container.style.position = 'relative';
    }

    container.appendChild(this._svg);
  }

  // ------------------------------------------------------------------
  // Group management
  // ------------------------------------------------------------------

  /**
   * Get or create a <g> group for an annotation UID.
   * Call this at the start of renderAnnotation().
   */
  getOrCreateGroup(annotationUID: string): SVGGElement {
    let g = this._groups.get(annotationUID);
    if (!g) {
      g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('id', `ann-${annotationUID}`);
      this._svg.appendChild(g);
      this._groups.set(annotationUID, g);
    }
    return g;
  }

  /**
   * Clear all children from a group (call before re-drawing).
   */
  clearGroup(annotationUID: string): void {
    const g = this._groups.get(annotationUID);
    if (g) {
      while (g.firstChild) g.removeChild(g.firstChild);
    }
  }

  /**
   * Remove a group entirely.
   */
  removeGroup(annotationUID: string): void {
    const g = this._groups.get(annotationUID);
    if (g) {
      g.remove();
      this._groups.delete(annotationUID);
    }
  }

  /**
   * Clear ALL annotation SVG groups.
   */
  clearAll(): void {
    for (const [uid] of this._groups) {
      this.removeGroup(uid);
    }
  }

  // ------------------------------------------------------------------
  // Drawing primitives
  // ------------------------------------------------------------------

  drawLine(
    group: SVGGElement,
    start: Point2,
    end: Point2,
    style: Partial<AnnotationStyle> = {},
  ): SVGLineElement {
    const s = { ...DEFAULT_ANNOTATION_STYLE, ...style };
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(start.x));
    line.setAttribute('y1', String(start.y));
    line.setAttribute('x2', String(end.x));
    line.setAttribute('y2', String(end.y));
    line.setAttribute('stroke', s.color);
    line.setAttribute('stroke-width', String(s.lineWidth));
    if (s.lineDash.length > 0) {
      line.setAttribute('stroke-dasharray', s.lineDash.join(','));
    }
    group.appendChild(line);
    return line;
  }

  drawCircle(
    group: SVGGElement,
    center: Point2,
    radius: number,
    style: Partial<AnnotationStyle> = {},
  ): SVGCircleElement {
    const s = { ...DEFAULT_ANNOTATION_STYLE, ...style };
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', String(center.x));
    circle.setAttribute('cy', String(center.y));
    circle.setAttribute('r', String(radius));
    circle.setAttribute('stroke', s.color);
    circle.setAttribute('stroke-width', String(s.lineWidth));
    circle.setAttribute('fill', 'none');
    group.appendChild(circle);
    return circle;
  }

  drawEllipse(
    group: SVGGElement,
    center: Point2,
    rx: number,
    ry: number,
    style: Partial<AnnotationStyle> = {},
  ): SVGEllipseElement {
    const s = { ...DEFAULT_ANNOTATION_STYLE, ...style };
    const ellipse = document.createElementNS(SVG_NS, 'ellipse');
    ellipse.setAttribute('cx', String(center.x));
    ellipse.setAttribute('cy', String(center.y));
    ellipse.setAttribute('rx', String(rx));
    ellipse.setAttribute('ry', String(ry));
    ellipse.setAttribute('stroke', s.color);
    ellipse.setAttribute('stroke-width', String(s.lineWidth));
    ellipse.setAttribute('fill', 'none');
    group.appendChild(ellipse);
    return ellipse;
  }

  drawRect(
    group: SVGGElement,
    topLeft: Point2,
    width: number,
    height: number,
    style: Partial<AnnotationStyle> = {},
  ): SVGRectElement {
    const s = { ...DEFAULT_ANNOTATION_STYLE, ...style };
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(topLeft.x));
    rect.setAttribute('y', String(topLeft.y));
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(height));
    rect.setAttribute('stroke', s.color);
    rect.setAttribute('stroke-width', String(s.lineWidth));
    rect.setAttribute('fill', 'none');
    group.appendChild(rect);
    return rect;
  }

  drawPath(
    group: SVGGElement,
    points: Point2[],
    closed: boolean = false,
    style: Partial<AnnotationStyle> = {},
  ): SVGPathElement {
    if (points.length < 2) return document.createElementNS(SVG_NS, 'path');

    const s = { ...DEFAULT_ANNOTATION_STYLE, ...style };
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (closed ? ' Z' : '');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', s.color);
    path.setAttribute('stroke-width', String(s.lineWidth));
    path.setAttribute('fill', 'none');
    if (s.lineDash.length > 0) {
      path.setAttribute('stroke-dasharray', s.lineDash.join(','));
    }
    group.appendChild(path);
    return path;
  }

  drawText(
    group: SVGGElement,
    position: Point2,
    text: string,
    style: Partial<AnnotationStyle> = {},
  ): SVGTextElement {
    const s = { ...DEFAULT_ANNOTATION_STYLE, ...style };
    const textEl = document.createElementNS(SVG_NS, 'text');
    textEl.setAttribute('x', String(position.x));
    textEl.setAttribute('y', String(position.y));
    textEl.setAttribute('fill', s.textColor);
    textEl.setAttribute('font-size', String(s.textFontSize));
    textEl.setAttribute('font-family', s.textFont);
    textEl.textContent = text;
    group.appendChild(textEl);
    return textEl;
  }

  drawArrow(
    group: SVGGElement,
    start: Point2,
    end: Point2,
    headLength: number = 10,
    style: Partial<AnnotationStyle> = {},
  ): void {
    // Draw the line
    this.drawLine(group, start, end, style);

    // Draw arrowhead
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const s = { ...DEFAULT_ANNOTATION_STYLE, ...style };

    const a1: Point2 = {
      x: end.x - headLength * Math.cos(angle - Math.PI / 6),
      y: end.y - headLength * Math.sin(angle - Math.PI / 6),
    };
    const a2: Point2 = {
      x: end.x - headLength * Math.cos(angle + Math.PI / 6),
      y: end.y - headLength * Math.sin(angle + Math.PI / 6),
    };

    this.drawLine(group, end, a1, style);
    this.drawLine(group, end, a2, style);
  }

  /**
   * Draw handle circles at annotation control points.
   */
  drawHandles(
    group: SVGGElement,
    points: Point2[],
    activeIndex: number = -1,
    style: Partial<AnnotationStyle> = {},
  ): void {
    const s = { ...DEFAULT_ANNOTATION_STYLE, ...style };
    for (let i = 0; i < points.length; i++) {
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', String(points[i].x));
      circle.setAttribute('cy', String(points[i].y));
      circle.setAttribute('r', String(s.handleRadius));
      circle.setAttribute('fill', i === activeIndex ? s.highlightColor : s.handleFillColor);
      circle.setAttribute('stroke', s.color);
      circle.setAttribute('stroke-width', '1');
      group.appendChild(circle);
    }
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  dispose(): void {
    this.clearAll();
    this._svg.remove();
  }
}
