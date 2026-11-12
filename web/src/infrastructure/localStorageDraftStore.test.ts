import { describe, expect, it } from 'vitest';
import { LocalStorageDraftStore } from './localStorageDraftStore';

const memoryStorage = (): Storage => {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
};

const throwingStorage = (): Storage =>
  new Proxy({} as Storage, {
    get: () => () => {
      throw new Error('SecurityError: storage blocked');
    },
  });

describe('LocalStorageDraftStore', () => {
  it('saves, loads and clears', () => {
    const storage = memoryStorage();
    const d = new LocalStorageDraftStore('k', () => storage);
    expect(d.load()).toBeNull();
    d.save('{"a":1}');
    expect(d.load()).toBe('{"a":1}');
    d.clear();
    expect(d.load()).toBeNull();
  });

  it('never throws when storage throws', () => {
    const d = new LocalStorageDraftStore('k', throwingStorage);
    expect(() => d.save('x')).not.toThrow();
    expect(d.load()).toBeNull();
    expect(() => d.clear()).not.toThrow();
  });

  it('works when storage is unavailable', () => {
    const d = new LocalStorageDraftStore('k', () => undefined);
    d.save('x');
    expect(d.load()).toBeNull();
  });

  it('never throws when accessing storage itself throws', () => {
    const d = new LocalStorageDraftStore('k', () => {
      throw new Error('denied');
    });
    expect(d.load()).toBeNull();
    expect(() => d.save('x')).not.toThrow();
  });
});
