/**
 * Core tool types for the new tool framework.
 * Replaces the old ITool interface with a richer hierarchy
 * inspired by cornerstone3D's BaseTool → AnnotationTool.
 */

import type { IViewport } from '../../rendering/viewports/types';

// ------------------------------------------------------------------
// Enums
// ------------------------------------------------------------------

export enum ToolMode {
  Active = 'Active',
  Passive = 'Passive',
  Enabled = 'Enabled',
  Disabled = 'Disabled',
}

export enum MouseButton {
  Primary = 0,
  Auxiliary = 1,
  Secondary = 2,
}

// ------------------------------------------------------------------
// Geometry
// ------------------------------------------------------------------

export interface Point2 {
  x: number;
  y: number;
}

// ------------------------------------------------------------------
// Bindings
// ------------------------------------------------------------------

export interface ToolBinding {
  mouseButton: MouseButton;
  modifierKey?: 'Ctrl' | 'Alt' | 'Shift';
}

// ------------------------------------------------------------------
// Normalized events
// ------------------------------------------------------------------

export interface NormalizedPointerEvent {
  /** Viewport element the event occurred on */
  element: HTMLElement;
  /** Canvas-space coordinates */
  canvasPoint: Point2;
  /** World/image-space coordinates */
  worldPoint: Point2;
  /** Delta since last event (canvas pixels) */
  deltaCanvas: Point2;
  /** Delta since last event (world units) */
  deltaWorld: Point2;
  /** Which mouse button triggered this */
  button: MouseButton;
  /** Modifier keys held */
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  /** The original DOM event */
  nativeEvent: PointerEvent;
}

export interface NormalizedWheelEvent {
  element: HTMLElement;
  canvasPoint: Point2;
  worldPoint: Point2;
  deltaY: number;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  nativeEvent: WheelEvent;
}

// ------------------------------------------------------------------
// Annotation data
// ------------------------------------------------------------------

export interface AnnotationHandle {
  /** World-space position */
  point: Point2;
}

export interface AnnotationTextBox {
  worldPosition: Point2;
  text: string;
}

export interface Annotation {
  annotationUID: string;
  metadata: {
    toolName: string;
    viewportId: string;
    imageId?: string;
  };
  data: {
    handles: {
      points: Point2[];
      activeHandleIndex: number;
      textBox?: AnnotationTextBox;
    };
    cachedStats?: Record<string, unknown>;
    label?: string;
  };
  highlighted: boolean;
  isLocked: boolean;
  isVisible: boolean;
  invalidated: boolean;
}

// ------------------------------------------------------------------
// Annotation style
// ------------------------------------------------------------------

export interface AnnotationStyle {
  color: string;
  lineWidth: number;
  lineDash: number[];
  handleRadius: number;
  handleFillColor: string;
  textColor: string;
  textFontSize: number;
  textFont: string;
  highlightColor: string;
}

export const DEFAULT_ANNOTATION_STYLE: Readonly<AnnotationStyle> = {
  color: '#00ff00',
  lineWidth: 1.5,
  lineDash: [],
  handleRadius: 4,
  handleFillColor: '#00ff00',
  textColor: '#ffff00',
  textFontSize: 14,
  textFont: 'sans-serif',
  highlightColor: '#00ccff',
};

// ------------------------------------------------------------------
// Tool configuration
// ------------------------------------------------------------------

export interface ToolConfiguration {
  [key: string]: unknown;
}

// ------------------------------------------------------------------
// Viewport reference for tools
// ------------------------------------------------------------------

export interface ToolViewportRef {
  viewport: IViewport;
  element: HTMLElement;
  canvas: HTMLCanvasElement;
}
