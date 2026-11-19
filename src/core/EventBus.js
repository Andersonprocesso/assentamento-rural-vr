export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, fn) {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const set = this._listeners.get(event);
    if (set) set.delete(fn);
  }

  emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[EventBus] erro em "${event}":`, err);
      }
    }
  }
}
