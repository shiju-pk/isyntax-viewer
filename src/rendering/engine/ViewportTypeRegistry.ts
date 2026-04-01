import type { ViewportInput, IViewport } from '../viewports/types';
import { ViewportType } from '../viewports/types';
import { StackViewport } from '../viewports/StackViewport';
import { WSIViewport } from '../viewports/WSIViewport';

interface ViewportConstructor {
  new (input: ViewportInput): IViewport;
}

class ViewportTypeRegistryImpl {
  private registry = new Map<string, ViewportConstructor>();

  constructor() {
    // Register built-in viewport types
    this.register(ViewportType.STACK, StackViewport);
    this.register(ViewportType.WSI, WSIViewport);
  }

  register(type: string, ctor: ViewportConstructor): void {
    this.registry.set(type, ctor);
  }

  unregister(type: string): void {
    this.registry.delete(type);
  }

  get(type: string): ViewportConstructor | undefined {
    return this.registry.get(type);
  }

  has(type: string): boolean {
    return this.registry.has(type);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.registry.keys());
  }
}

export const viewportTypeRegistry = new ViewportTypeRegistryImpl();
