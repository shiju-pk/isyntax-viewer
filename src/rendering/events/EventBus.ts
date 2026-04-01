import type { RenderingEventDetailMap } from './RenderingEvents';

type EventKey = keyof RenderingEventDetailMap;

class EventBus {
  private target = new EventTarget();

  on<K extends EventKey>(
    type: K,
    listener: (detail: RenderingEventDetailMap[K]) => void
  ): void {
    this.target.addEventListener(type, ((e: CustomEvent) => {
      listener(e.detail);
    }) as EventListener);
  }

  off<K extends EventKey>(
    type: K,
    listener: (detail: RenderingEventDetailMap[K]) => void
  ): void {
    this.target.removeEventListener(type, listener as unknown as EventListener);
  }

  emit<K extends EventKey>(
    type: K,
    detail: RenderingEventDetailMap[K]
  ): void {
    this.target.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

export const eventBus = new EventBus();
export { EventBus };
