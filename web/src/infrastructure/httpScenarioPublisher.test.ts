import { describe, expect, it, vi } from 'vitest';
import { createScenario } from '../domain/scenario';
import { HttpScenarioPublisher } from './httpScenarioPublisher';
import { LocalStoragePublicationStore } from './localStoragePublicationStore';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('HttpScenarioPublisher', () => {
  it('publishes to /api/scenarios with the scenario wrapped', async () => {
    const fetchImpl = vi.fn(async () =>
      json(201, { id: 'abcdEFG1', editToken: 't', updatedAt: 'x' }),
    );
    const p = new HttpScenarioPublisher({ fetchImpl });
    const r = await p.publish(createScenario({ name: 'Mesa' }));
    expect(r).toEqual({ ok: true, value: { id: 'abcdEFG1', editToken: 't', updatedAt: 'x' } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/scenarios');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string).scenario.meta.name).toBe('Mesa');
  });

  it('sends the edit token only in the Authorization header', async () => {
    const fetchImpl = vi.fn(async () => json(200, { id: 'abcdEFG1', updatedAt: 'x' }));
    await new HttpScenarioPublisher({ fetchImpl }).update('abcdEFG1', 'secret', createScenario());
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/scenarios/abcdEFG1');
    expect(url).not.toContain('secret');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret');
  });

  it.each([
    [404, 'not-found'],
    [403, 'forbidden'],
    [401, 'forbidden'],
    [429, 'rate-limited'],
    [422, 'invalid'],
    [413, 'invalid'],
    [502, 'unavailable'],
  ])('maps HTTP %i to %s and keeps server messages', async (status, failure) => {
    const fetchImpl = vi.fn(async () => json(status, { errors: ['why'] }));
    const r = await new HttpScenarioPublisher({ fetchImpl }).fetch('abcdEFG1');
    expect(r).toEqual({ ok: false, failure, errors: ['why'] });
  });

  it('reports network errors and timeouts as unavailable, and calls onSlow', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(
        (_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener('abort', () =>
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
            ),
          ),
      );
      const onSlow = vi.fn();
      const p = new HttpScenarioPublisher({ fetchImpl, slowAfterMs: 3000, timeoutMs: 90_000 });
      const pending = p.fetch('abcdEFG1', { onSlow });
      await vi.advanceTimersByTimeAsync(3000);
      expect(onSlow).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(87_000);
      expect(await pending).toMatchObject({ ok: false, failure: 'unavailable' });
    } finally {
      vi.useRealTimers();
    }

    const offline = new HttpScenarioPublisher({
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    expect(await offline.fetch('abcdEFG1')).toMatchObject({ ok: false, failure: 'unavailable' });
  });

  it('wake never throws', () => {
    const p = new HttpScenarioPublisher({ fetchImpl: () => Promise.reject(new Error('down')) });
    expect(() => p.wake()).not.toThrow();
  });
});

describe('LocalStoragePublicationStore', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    } as unknown as Storage;
  };

  it('saves, replaces and lists newest first', () => {
    const storage = memory();
    const s = new LocalStoragePublicationStore('k', () => storage);
    s.save({ id: 'a', editToken: '1', name: 'A' });
    s.save({ id: 'b', editToken: '2', name: 'B' });
    s.save({ id: 'a', editToken: '1', name: 'A2' });
    expect(s.list().map((p) => p.id)).toEqual(['a', 'b']);
    expect(s.get('a')?.name).toBe('A2');
    expect(s.get('zzz')).toBeNull();
  });

  it('never throws when storage is broken or corrupt', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    } as unknown as Storage;
    const s = new LocalStoragePublicationStore('k', () => broken);
    expect(s.list()).toEqual([]);
    expect(() => s.save({ id: 'a', editToken: '1', name: 'A' })).not.toThrow();

    const corrupt = memory();
    corrupt.setItem('k', '{not json');
    expect(new LocalStoragePublicationStore('k', () => corrupt).list()).toEqual([]);
    corrupt.setItem('k', JSON.stringify([{ id: 1 }, { id: 'ok', editToken: 't', name: '' }]));
    expect(new LocalStoragePublicationStore('k', () => corrupt).list()).toHaveLength(1);
  });
});
