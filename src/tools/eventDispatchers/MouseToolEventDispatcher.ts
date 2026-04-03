/**
 * MouseToolEventDispatcher — attaches DOM event listeners to a viewport element,
 * normalizes events to {canvasPoint, worldPoint, deltaCanvas, deltaWorld},
 * and dispatches to the correct tool via ToolGroup bindings.
 *
 * Event types: mouseDown, mouseDrag, mouseMove, mouseUp, mouseWheel, click, doubleClick
 *
 * Pattern inspired by cornerstone3D's MouseToolEventDispatcher:
 *   - State machine: isInteractingWithTool prevents tool switching mid-drag
 *   - Coordinate normalization using camera.canvasToWorld()
 */

import type { ToolGroup } from '../ToolGroup';
import type { AnnotationTool } from '../base/AnnotationTool';
import type { IViewport } from '../../rendering/viewports/types';
import {
  MouseButton,
  type NormalizedPointerEvent,
  type NormalizedWheelEvent,
  type Point2,
} from '../base/types';
import type { BaseTool } from '../base/BaseTool';

export class MouseToolEventDispatcher {
  private _toolGroup: ToolGroup;
  private _viewport: IViewport | null = null;
  private _element: HTMLElement | null = null;

  private _isDragging = false;
  private _activeDragTool: BaseTool | null = null;
  private _lastCanvasPos: Point2 = { x: 0, y: 0 };
  private _lastWorldPos: Point2 = { x: 0, y: 0 };
  private _dragButton: MouseButton = MouseButton.Primary;

  // Bound handlers (for cleanup)
  private _onPointerDown = this._handlePointerDown.bind(this);
  private _onPointerMove = this._handlePointerMove.bind(this);
  private _onPointerUp = this._handlePointerUp.bind(this);
  private _onWheel = this._handleWheel.bind(this);
  private _onContextMenu = (e: Event) => e.preventDefault();

  constructor(toolGroup: ToolGroup) {
    this._toolGroup = toolGroup;
  }

  // ------------------------------------------------------------------
  // Attach / Detach
  // ------------------------------------------------------------------

  attach(viewport: IViewport): void {
    this.detach();
    this._viewport = viewport;
    this._element = viewport.element;

    this._element.addEventListener('pointerdown', this._onPointerDown);
    this._element.addEventListener('pointermove', this._onPointerMove);
    this._element.addEventListener('pointerup', this._onPointerUp);
    this._element.addEventListener('pointerleave', this._onPointerUp);
    this._element.addEventListener('wheel', this._onWheel, { passive: false });
    this._element.addEventListener('contextmenu', this._onContextMenu);
  }

  detach(): void {
    if (this._element) {
      this._element.removeEventListener('pointerdown', this._onPointerDown);
      this._element.removeEventListener('pointermove', this._onPointerMove);
      this._element.removeEventListener('pointerup', this._onPointerUp);
      this._element.removeEventListener('pointerleave', this._onPointerUp);
      this._element.removeEventListener('wheel', this._onWheel);
      this._element.removeEventListener('contextmenu', this._onContextMenu);
    }
    this._viewport = null;
    this._element = null;
    this._isDragging = false;
    this._activeDragTool = null;
  }

  // ------------------------------------------------------------------
  // Cursor management
  // ------------------------------------------------------------------

  updateCursor(): void {
    if (!this._element) return;
    // Find primary-button active tool for cursor
    const tool = this._toolGroup.getActiveTool(MouseButton.Primary, { ctrl: false, alt: false, shift: false });
    this._element.style.cursor = tool?.cursor ?? 'default';
  }

  // ------------------------------------------------------------------
  // Private event handlers
  // ------------------------------------------------------------------

  private _handlePointerDown(e: PointerEvent): void {
    if (!this._viewport || !this._element) return;

    const canvasPoint = this._getCanvasPoint(e);
    const worldPoint = this._canvasToWorld(canvasPoint);

    this._lastCanvasPos = canvasPoint;
    this._lastWorldPos = worldPoint;
    this._dragButton = e.button as MouseButton;

    const modifiers = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey };
    const tool = this._toolGroup.getActiveTool(e.button as MouseButton, modifiers);

    if (tool) {
      this._isDragging = true;
      this._activeDragTool = tool;

      // Capture pointer for reliable drag tracking outside element
      this._element.setPointerCapture(e.pointerId);

      const evt = this._buildPointerEvent(e, canvasPoint, worldPoint, { x: 0, y: 0 }, { x: 0, y: 0 });
      tool.mouseDownCallback(evt);

      // Update cursor for drag state
      if (tool.cursor === 'grab' && this._element) {
        this._element.style.cursor = 'grabbing';
      }
    }
  }

  private _handlePointerMove(e: PointerEvent): void {
    if (!this._viewport || !this._element) return;

    const canvasPoint = this._getCanvasPoint(e);
    const worldPoint = this._canvasToWorld(canvasPoint);

    const deltaCanvas: Point2 = {
      x: canvasPoint.x - this._lastCanvasPos.x,
      y: canvasPoint.y - this._lastCanvasPos.y,
    };
    const deltaWorld: Point2 = {
      x: worldPoint.x - this._lastWorldPos.x,
      y: worldPoint.y - this._lastWorldPos.y,
    };

    this._lastCanvasPos = canvasPoint;
    this._lastWorldPos = worldPoint;

    if (this._isDragging && this._activeDragTool) {
      // Drag event → active tool
      const evt = this._buildPointerEvent(e, canvasPoint, worldPoint, deltaCanvas, deltaWorld);
      this._activeDragTool.mouseDragCallback(evt);
    } else {
      // Move event → all Passive/Enabled annotation tools (for hover highlight)
      const evt = this._buildPointerEvent(e, canvasPoint, worldPoint, deltaCanvas, deltaWorld);
      for (const tool of this._toolGroup.getToolsInMode('Passive' as any)) {
        tool.mouseMoveCallback(evt);
      }
      for (const tool of this._toolGroup.getToolsInMode('Active' as any)) {
        tool.mouseMoveCallback(evt);
      }
    }
  }

  private _handlePointerUp(e: PointerEvent): void {
    if (!this._isDragging) return;

    if (this._element) {
      try { this._element.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }

    const canvasPoint = this._getCanvasPoint(e);
    const worldPoint = this._canvasToWorld(canvasPoint);

    if (this._activeDragTool) {
      const evt = this._buildPointerEvent(e, canvasPoint, worldPoint, { x: 0, y: 0 }, { x: 0, y: 0 });
      this._activeDragTool.mouseUpCallback(evt);
    }

    this._isDragging = false;
    this._activeDragTool = null;

    // Restore cursor
    this.updateCursor();
  }

  private _handleWheel(e: WheelEvent): void {
    e.preventDefault();
    if (!this._viewport || !this._element) return;

    const canvasPoint = this._getCanvasPoint(e);
    const worldPoint = this._canvasToWorld(canvasPoint);

    // Wheel events go to primary-button tool
    const modifiers = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey };
    const tool = this._toolGroup.getActiveTool(MouseButton.Primary, modifiers);

    if (tool) {
      const evt: NormalizedWheelEvent = {
        element: this._element,
        canvasPoint,
        worldPoint,
        deltaY: e.deltaY,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        nativeEvent: e,
      };
      tool.mouseWheelCallback(evt);
    }
  }

  // ------------------------------------------------------------------
  // Coordinate helpers
  // ------------------------------------------------------------------

  private _getCanvasPoint(e: MouseEvent): Point2 {
    if (!this._element) return { x: 0, y: 0 };
    const rect = this._element.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private _canvasToWorld(canvasPoint: Point2): Point2 {
    if (!this._viewport) return canvasPoint;

    const camera = this._viewport.getCamera();
    const imageData = this._viewport.getImageData();
    if (!imageData) return canvasPoint;

    const canvas = this._viewport.canvas;
    const [wx, wy] = camera.canvasToWorld(
      canvasPoint.x, canvasPoint.y,
      canvas.clientWidth, canvas.clientHeight,
      imageData.width, imageData.height,
    );
    return { x: wx, y: wy };
  }

  private _buildPointerEvent(
    e: PointerEvent,
    canvasPoint: Point2,
    worldPoint: Point2,
    deltaCanvas: Point2,
    deltaWorld: Point2,
  ): NormalizedPointerEvent {
    return {
      element: this._element!,
      canvasPoint,
      worldPoint,
      deltaCanvas,
      deltaWorld,
      button: e.button as MouseButton,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      nativeEvent: e,
    };
  }
}
