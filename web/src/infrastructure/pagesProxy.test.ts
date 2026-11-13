import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../functions/api/[[path]]';

afterEach(() => vi.unstubAllGlobals());

describe('Pages /api proxy', () => {
  it('forwards method, path, query, body and Authorization to API_ORIGIN', async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":1}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const req = new Request('https://app.pages.dev/api/scenarios/abcdEFG1?x=1', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer tok',
        'CF-Connecting-IP': '203.0.113.9',
        Cookie: 'secret=1',
        'Content-Type': 'application/json',
      },
      body: '{"scenario":{}}',
    });
    const res = await onRequest({ request: req, env: { API_ORIGIN: 'https://api.example.com' } });
    expect(res.status).toBe(201);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/scenarios/abcdEFG1?x=1');
    expect(init.method).toBe('PUT');
    const h = init.headers as Headers;
    expect(h.get('authorization')).toBe('Bearer tok');
    expect(h.get('x-forwarded-for')).toBe('203.0.113.9');
    expect(h.get('cookie')).toBeNull();
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"scenario":{}}');
  });

  it('answers 503 when not configured and 502 when the API is unreachable', async () => {
    const req = new Request('https://app.pages.dev/api/health');
    expect((await onRequest({ request: req, env: {} })).status).toBe(503);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('down'))),
    );
    const res = await onRequest({ request: req, env: { API_ORIGIN: 'https://api.example.com' } });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ errors: ['The publishing server could not be reached.'] });
  });
});
