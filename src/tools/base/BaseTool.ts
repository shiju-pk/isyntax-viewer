/**
 * BaseTool — foundation class for all tools.
 *
 * Provides:
 *   - Tool mode lifecycle (Active → Passive → Enabled → Disabled)
 *   - Configuration with strategy pattern
 *   - Mouse/wheel callback stubs (override in subclasses)
 *   - Cursor management
 */

import {
  ToolMode,
  type ToolConfiguration,
  type NormalizedPointerEvent,
  type NormalizedWheelEvent,
  type ToolViewportRef,
} from './types';

export abstract class BaseTool {
  static toolName: string = 'BaseTool';

  readonly toolName: string;
  mode: ToolMode = ToolMode.Disabled;
  configuration: ToolConfiguration;

  protected viewportRef: ToolViewportRef | null = null;

  constructor(config: ToolConfiguration = {}) {
    this.toolName = (this.constructor as typeof BaseTool).toolName;
    this.configuration = { ...config };
  }

  /**
   * The cursor to show when this tool is active.
   * Override in subclasses.
   */
  get cursor(): string {
    return 'default';
  }

  // --- Lifecycle hooks (override as needed) ---

  onSetToolActive(): void {
    // override
  }

  onSetToolPassive(): void {
    // override
  }

  onSetToolEnabled(): void {
    // override
  }

  onSetToolDisabled(): void {
    // override
  }

  // --- Event callbacks (override in subclasses) ---

  mouseDownCallback(evt: NormalizedPointerEvent): void {
    // override
  }

  mouseDragCallback(evt: NormalizedPointerEvent): void {
    // override
  }

  mouseMoveCallback(evt: NormalizedPointerEvent): void {
    // override
  }

  mouseUpCallback(evt: NormalizedPointerEvent): void {
    // override
  }

  mouseWheelCallback(evt: NormalizedWheelEvent): void {
    // override
  }

  /**
   * Set configuration values, deep-merging with existing config.
   */
  setConfiguration(newConfig: Partial<ToolConfiguration>): void {
    Object.assign(this.configuration, newConfig);
  }

  /**
   * Bind this tool to a viewport reference.
   * Called by ToolGroup when the tool becomes active.
   */
  setViewportRef(ref: ToolViewportRef | null): void {
    this.viewportRef = ref;
  }
}
