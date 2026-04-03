import type { RenderingEventDetailMap } from './RenderingEvents';

type EventKey = keyof RenderingEventDetailMap;

class EventBus {
  private target = new EventTarget();
  private _wrappedListeners = new Map<Function, EventListener>();

  on<K extends EventKey>(
    type: K,
    listener: (detail: RenderingEventDetailMap[K]) => void
  ): void {
    const wrapped = ((e: CustomEvent) => {
      listener(e.detail);
    }) as EventListener;
    this._wrappedListeners.set(listener, wrapped);
    this.target.addEventListener(type, wrapped);
  }

  off<K extends EventKey>(
    type: K,
    listener: (detail: RenderingEventDetailMap[K]) => void
  ): void {
    const wrapped = this._wrappedListeners.get(listener);
    if (wrapped) {
      this.target.removeEventListener(type, wrapped);
      this._wrappedListeners.delete(listener);
    }
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
