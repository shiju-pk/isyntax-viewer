import type { RenderingEngine } from './RenderingEngine';

class RenderingEngineCacheImpl {
  private cache = new Map<string, RenderingEngine>();

  get(id: string): RenderingEngine | undefined {
    return this.cache.get(id);
  }

  set(engine: RenderingEngine): void {
    this.cache.set(engine.id, engine);
  }

  delete(id: string): void {
    this.cache.delete(id);
  }

  getAll(): RenderingEngine[] {
    return Array.from(this.cache.values());
  }

  clear(): void {
    this.cache.clear();
  }
}

export const renderingEngineCache = new RenderingEngineCacheImpl();
