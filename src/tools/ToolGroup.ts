/**
 * ToolGroup — organizes tools and maps mouse button + modifier bindings.
 *
 * Pattern inspired by cornerstone3D's ToolGroup:
 *   - addTool(name, config) → instantiates and stores
 *   - setToolActive(name, bindings) → binds to mouse buttons
 *   - setToolPassive/Enabled/Disabled
 *   - getActiveTool(button, modifiers) → returns the tool for an event
 */

import { BaseTool } from './base/BaseTool';
import {
  ToolMode,
  MouseButton,
  type ToolBinding,
  type ToolConfiguration,
  type ToolViewportRef,
} from './base/types';

interface ToolEntry {
  instance: BaseTool;
  mode: ToolMode;
  bindings: ToolBinding[];
}

/** Global registry of tool constructors by name */
const toolClassRegistry = new Map<string, new (config?: ToolConfiguration) => BaseTool>();

export function registerToolClass(toolClass: typeof BaseTool): void {
  toolClassRegistry.set(toolClass.toolName, toolClass as any);
}

export class ToolGroup {
  readonly id: string;
  private _tools = new Map<string, ToolEntry>();
  private _viewportRef: ToolViewportRef | null = null;

  constructor(id: string) {
    this.id = id;
  }

  // ------------------------------------------------------------------
  // Tool registration
  // ------------------------------------------------------------------

  /**
   * Add a tool to this group. Uses the global tool class registry.
   */
  addTool(toolName: string, config?: ToolConfiguration): void {
    if (this._tools.has(toolName)) {
      console.warn(`Tool "${toolName}" already added to ToolGroup "${this.id}"`);
      return;
    }
    const ToolClass = toolClassRegistry.get(toolName);
    if (!ToolClass) {
      throw new Error(
        `Tool class "${toolName}" not registered. Call registerToolClass() first.`
      );
    }
    const instance = new ToolClass(config);
    this._tools.set(toolName, {
      instance,
      mode: ToolMode.Disabled,
      bindings: [],
    });
  }

  /**
   * Add a tool from an already-instantiated BaseTool instance.
   */
  addToolInstance(tool: BaseTool): void {
    if (this._tools.has(tool.toolName)) {
      console.warn(`Tool "${tool.toolName}" already in ToolGroup "${this.id}"`);
      return;
    }
    this._tools.set(tool.toolName, {
      instance: tool,
      mode: ToolMode.Disabled,
      bindings: [],
    });
  }

  // ------------------------------------------------------------------
  // Mode management
  // ------------------------------------------------------------------

  setToolActive(toolName: string, bindings: ToolBinding[] = [{ mouseButton: MouseButton.Primary }]): void {
    const entry = this._getEntry(toolName);

    // If another tool already has the same binding, demote it to Passive
    for (const binding of bindings) {
      for (const [name, other] of this._tools) {
        if (name === toolName) continue;
        const conflicting = other.bindings.findIndex(
          b => b.mouseButton === binding.mouseButton && b.modifierKey === binding.modifierKey
        );
        if (conflicting !== -1) {
          other.bindings.splice(conflicting, 1);
          if (other.bindings.length === 0 && other.mode === ToolMode.Active) {
            other.mode = ToolMode.Passive;
            other.instance.mode = ToolMode.Passive;
            other.instance.onSetToolPassive();
          }
        }
      }
    }

    entry.mode = ToolMode.Active;
    entry.bindings = bindings;
    entry.instance.mode = ToolMode.Active;
    entry.instance.setViewportRef(this._viewportRef);
    entry.instance.onSetToolActive();
  }

  setToolPassive(toolName: string): void {
    const entry = this._getEntry(toolName);
    entry.mode = ToolMode.Passive;
    entry.bindings = [];
    entry.instance.mode = ToolMode.Passive;
    entry.instance.onSetToolPassive();
  }

  setToolEnabled(toolName: string): void {
    const entry = this._getEntry(toolName);
    entry.mode = ToolMode.Enabled;
    entry.bindings = [];
    entry.instance.mode = ToolMode.Enabled;
    entry.instance.onSetToolEnabled();
  }

  setToolDisabled(toolName: string): void {
    const entry = this._getEntry(toolName);
    entry.mode = ToolMode.Disabled;
    entry.bindings = [];
    entry.instance.mode = ToolMode.Disabled;
    entry.instance.onSetToolDisabled();
  }

  // ------------------------------------------------------------------
  // Queries
  // ------------------------------------------------------------------

  getToolInstance<T extends BaseTool = BaseTool>(toolName: string): T | undefined {
    return this._tools.get(toolName)?.instance as T | undefined;
  }

  getToolMode(toolName: string): ToolMode | undefined {
    return this._tools.get(toolName)?.mode;
  }

  /**
   * Find the active tool that matches a mouse button + modifier combination.
   */
  getActiveTool(button: MouseButton, modifiers: { ctrl: boolean; alt: boolean; shift: boolean }): BaseTool | undefined {
    const modKey = modifiers.ctrl ? 'Ctrl' : modifiers.alt ? 'Alt' : modifiers.shift ? 'Shift' : undefined;

    for (const [, entry] of this._tools) {
      if (entry.mode !== ToolMode.Active) continue;

      for (const binding of entry.bindings) {
        if (binding.mouseButton === button && binding.modifierKey === modKey) {
          return entry.instance;
        }
        // Match binding without modifier if no modifier key on binding
        if (binding.mouseButton === button && !binding.modifierKey && !modKey) {
          return entry.instance;
        }
      }
    }
    return undefined;
  }

  /**
   * Get all tools in a given mode.
   */
  getToolsInMode(mode: ToolMode): BaseTool[] {
    const result: BaseTool[] = [];
    for (const [, entry] of this._tools) {
      if (entry.mode === mode) result.push(entry.instance);
    }
    return result;
  }

  /**
   * Get all tool names.
   */
  getToolNames(): string[] {
    return Array.from(this._tools.keys());
  }

  // ------------------------------------------------------------------
  // Viewport binding
  // ------------------------------------------------------------------

  setViewportRef(ref: ToolViewportRef | null): void {
    this._viewportRef = ref;
    // Propagate to all active tools
    for (const [, entry] of this._tools) {
      if (entry.mode === ToolMode.Active) {
        entry.instance.setViewportRef(ref);
      }
    }
  }

  // ------------------------------------------------------------------
  // Disposal
  // ------------------------------------------------------------------

  destroy(): void {
    for (const [, entry] of this._tools) {
      entry.instance.mode = ToolMode.Disabled;
      entry.instance.setViewportRef(null);
    }
    this._tools.clear();
    this._viewportRef = null;
  }

  // ------------------------------------------------------------------
  // Private
  // ------------------------------------------------------------------

  private _getEntry(toolName: string): ToolEntry {
    const entry = this._tools.get(toolName);
    if (!entry) {
      throw new Error(`Tool "${toolName}" not found in ToolGroup "${this.id}"`);
    }
    return entry;
  }
}
