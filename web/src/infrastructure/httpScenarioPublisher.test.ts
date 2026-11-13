import { describe, expect, it, vi } from 'vitest';
import { createScenario } from '../domain/scenario';
import { HttpScenarioPublisher } from './httpScenarioPublisher';
import { LocalStoragePublicationStore } from './localStoragePublicationStore';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('HttpScenarioPublisher', () => {
  it('publishes to /api/scenarios with the scenario wrapped', async () => {
    const fetchImpl = vi.fn(async () => json(201, { id: 'abcdEFG1', updatedAt: 'x' }));
    const p = new HttpScenarioPublisher({ fetchImpl });
    const r = await p.publish(createScenario({ name: 'Mesa' }));
    expect(r).toEqual({ ok: true, value: { id: 'abcdEFG1', updatedAt: 'x' } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/scenarios');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect((init.headers as Record<string, string>)['X-Minovsky-Client']).toBe('web');
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

  it('sends a fresh bot-check token with every write', async () => {
    let n = 0;
    const humanCheck = { token: async () => `tok${++n}` };
    const fetchImpl = vi.fn(async () =>
      json(201, { id: 'abcdEFG1', editToken: 't', updatedAt: 'x' }),
    );
    const p = new HttpScenarioPublisher({ fetchImpl, humanCheck });
    await p.publish(createScenario());
    await p.update('abcdEFG1', 'secret', createScenario());
    await p.report({ scenarioId: 'abcdEFG1', reason: 'spam', details: '' });
    await p.fetch('abcdEFG1');
    const bodies = fetchImpl.mock.calls.map((c) => {
      const init = (c as unknown as [string, RequestInit])[1];
      return init.body ? JSON.parse(init.body as string) : null;
    });
    expect(bodies.slice(0, 3).map((b) => b.turnstileToken)).toEqual(['tok1', 'tok2', 'tok3']);
    expect(bodies[3]).toBeNull(); // reads are not checked
  });

  it('reports a bot-check failure from the server and a blocked check script', async () => {
    const rejected = new HttpScenarioPublisher({
      fetchImpl: vi.fn(async () => json(403, { code: 'bot-check', errors: ['Could not confirm'] })),
    });
    expect(await rejected.publish(createScenario())).toEqual({
      ok: false,
      failure: 'bot',
      errors: ['Could not confirm'],
    });
    const fetchImpl = vi.fn();
    const blocked = new HttpScenarioPublisher({
      fetchImpl,
      humanCheck: { token: () => Promise.reject(new Error('blocked')) },
    });
    const r = await blocked.publish(createScenario());
    expect(r).toMatchObject({ ok: false, failure: 'bot' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('a 403 without the bot code still means a wrong edit token', async () => {
    const p = new HttpScenarioPublisher({
      fetchImpl: vi.fn(async () => json(403, { errors: ['no'] })),
    });
    expect(await p.update('abcdEFG1', 'x', createScenario())).toMatchObject({
      failure: 'forbidden',
    });
  });

  it('owners update without a token; owned reads carry the verified owner', async () => {
    const fetchImpl = vi.fn(async () =>
      json(200, {
        id: 'abcdEFG1',
        scenario: {},
        updatedAt: 'x',
        owner: { displayName: 'Bintang' },
        isOwner: true,
      }),
    );
    const p = new HttpScenarioPublisher({ fetchImpl });
    await p.update('abcdEFG1', null, createScenario());
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(await p.fetch('abcdEFG1')).toEqual({
      ok: true,
      value: { scenario: {}, updatedAt: 'x', owner: { displayName: 'Bintang' }, isOwner: true },
    });
    const get = (fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1];
    expect((get.headers as Record<string, string>)['X-Minovsky-Client']).toBeUndefined();
  });

  it('legacy reads have no owner', async () => {
    const p = new HttpScenarioPublisher({
      fetchImpl: vi.fn(async () => json(200, { id: 'a', scenario: {}, updatedAt: 'x' })),
    });
    expect(await p.fetch('abcdEFG1')).toMatchObject({ value: { owner: null, isOwner: false } });
  });

  it.each([
    [401, 'signed-out', 'signed-out'],
    [403, 'not-owner', 'not-owner'],
    [403, 'client-header', 'forbidden'],
  ])('maps %i with code %s to %s', async (status, code, failure) => {
    const p = new HttpScenarioPublisher({
      fetchImpl: vi.fn(async () => json(status, { code, errors: ['x'] })),
    });
    expect(await p.publish(createScenario())).toMatchObject({ ok: false, failure });
  });

  it('deletes with DELETE and accepts an empty 204', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const r = await new HttpScenarioPublisher({ fetchImpl }).remove('abcdEFG1');
    expect(r).toEqual({ ok: true, value: {} });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect([url, init.method]).toEqual(['/api/scenarios/abcdEFG1', 'DELETE']);
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

  it('removes one scenario and never throws', () => {
    const storage = memory();
    const s = new LocalStoragePublicationStore('k', () => storage);
    s.save({ id: 'a', editToken: '1', name: 'A' });
    s.save({ id: 'b', editToken: '2', name: 'B' });
    s.remove('a');
    expect(s.list().map((p) => p.id)).toEqual(['b']);
    s.remove('missing');
    expect(s.list()).toHaveLength(1);
    const broken = {
      getItem: () => '[]',
      setItem: () => {
        throw new Error('quota');
      },
    } as unknown as Storage;
    expect(() => new LocalStoragePublicationStore('k', () => broken).remove('b')).not.toThrow();
  });
});
