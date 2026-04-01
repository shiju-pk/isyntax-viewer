import type { IViewport } from '../rendering/viewports/types';

export enum ToolType {
  PAN = 'pan',
  ZOOM = 'zoom',
  WINDOW_LEVEL = 'windowLevel',
}

export interface PointerEventData {
  clientX: number;
  clientY: number;
  deltaX: number;
  deltaY: number;
  button: number;
}

export interface WheelEventData {
  deltaY: number;
  clientX: number;
  clientY: number;
}

export interface ITool {
  readonly name: string;
  readonly type: ToolType;
  activate(viewport: IViewport): void;
  deactivate(): void;
  onPointerDown(event: PointerEventData): void;
  onPointerMove(event: PointerEventData): void;
  onPointerUp(event: PointerEventData): void;
  onWheel(event: WheelEventData): void;
}
