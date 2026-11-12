/** Minimal observable store compatible with React's useSyncExternalStore. */
export type Listener = () => void;

export interface ReadableStore<T> {
  getSnapshot(): T;
  subscribe(listener: Listener): () => void;
}

export class Store<T> implements ReadableStore<T> {
  private listeners = new Set<Listener>();

  constructor(private state: T) {}

  getSnapshot = (): T => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(next: T): void {
    if (Object.is(next, this.state)) return;
    this.state = next;
    for (const l of [...this.listeners]) l();
  }

  patch(partial: Partial<T>): void {
    this.set({ ...this.state, ...partial });
  }
}
