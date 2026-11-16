import { describe, expect, it, vi } from 'vitest';
import { EMPTY_BROWSE_QUERY } from '../application/browse';
import { HttpScenarioBrowser } from './httpScenarioBrowser';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('HttpScenarioBrowser', () => {
  it('sends filters and the cursor as query parameters', async () => {
    const fetchImpl = vi.fn(async () => json(200, { items: [], next: null }));
    const b = new HttpScenarioBrowser({ fetchImpl });
    await b.browse({ ...EMPTY_BROWSE_QUERY, q: 'mesa', deployment: 'bases' }, 'CUR');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/browse?q=mesa&deployment=bases&cursor=CUR');
    expect(init.method).toBe('GET');
    await b.browse(EMPTY_BROWSE_QUERY, null);
    expect((fetchImpl.mock.calls[1] as unknown as [string])[0]).toBe('/api/browse');
  });

  it('returns items and the next cursor', async () => {
    const item = { id: 'abcdEFG1', name: 'Mesa', ownerName: 'B', width: 15, height: 15 };
    const b = new HttpScenarioBrowser({
      fetchImpl: vi.fn(async () => json(200, { items: [item], next: 'N' })),
    });
    expect(await b.browse(EMPTY_BROWSE_QUERY, null)).toEqual({
      ok: true,
      value: { items: [item], next: 'N' },
    });
  });

  it('reports invalid parameters', async () => {
    const b = new HttpScenarioBrowser({
      fetchImpl: vi.fn(async () => json(400, { errors: ['Invalid size'] })),
    });
    expect(await b.browse(EMPTY_BROWSE_QUERY, null)).toMatchObject({
      ok: false,
      failure: 'invalid',
    });
  });
});
