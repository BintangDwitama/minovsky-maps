import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiCookies, apiOrigin, onRequest } from '../../functions/api/[[path]]';

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

  it('forwards only the API cookies', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const req = new Request('https://app.pages.dev/api/me', {
      headers: { Cookie: 'cf_clearance=x; mm_session=abc; _ga=1; mm_login=st8' },
    });
    await onRequest({ request: req, env: { API_ORIGIN: 'https://api.example.com' } });
    const h = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Headers;
    expect(h.get('cookie')).toBe('mm_session=abc; mm_login=st8');
  });

  it.each([
    ['a=1; b=2', null],
    ['mm_session=abc', 'mm_session=abc'],
    ['  mm_session = abc ;x=1', 'mm_session = abc'],
    ['mm_sessionx=1; xmm_login=2', null],
    [null, null],
  ])('apiCookies(%j)', (raw, want) => {
    expect(apiCookies(raw)).toBe(want);
  });

  it('passes redirects and every Set-Cookie through', async () => {
    const upstream = new Headers({ Location: '/?signin=ok#/' });
    upstream.append('Set-Cookie', 'mm_login=; Path=/api; Max-Age=0; HttpOnly; Secure');
    upstream.append('Set-Cookie', 'mm_session=tok; Path=/api; Max-Age=2592000; HttpOnly; Secure');
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: upstream }));
    vi.stubGlobal('fetch', fetchMock);
    const req = new Request('https://app.pages.dev/api/auth/google/callback?code=c&state=s');
    const res = await onRequest({ request: req, env: { API_ORIGIN: 'https://api.example.com' } });
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].redirect).toBe(
      'manual',
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/?signin=ok#/');
    expect(res.headers.getSetCookie()).toHaveLength(2);
  });

  it.each([
    ['https://api.example.com', 'https://api.example.com'],
    ['https://api.example.com/', 'https://api.example.com'],
    ['  https://api.example.com/some/path ', 'https://api.example.com'],
    ['api.example.com', 'https://api.example.com'],
    ['"https://api.example.com"', 'https://api.example.com'],
    ['http://localhost:8080', 'http://localhost:8080'],
    ['', null],
    ['https://', null],
    ['not a url at all', null],
  ])('parses API_ORIGIN %j', (raw, origin) => {
    expect(apiOrigin(raw)).toBe(origin);
  });

  it('never throws on a bad API_ORIGIN (Cloudflare would show error 1101)', async () => {
    const req = new Request('https://app.pages.dev/api/health');
    const res = await onRequest({ request: req, env: { API_ORIGIN: 'not a url at all' } });
    expect(res.status).toBe(503);
    expect((await res.json()).errors[0]).toContain('API_ORIGIN is not a valid URL');
  });

  it('works when API_ORIGIN has no scheme or a trailing slash', async () => {
    const fetchMock = vi.fn(async () => new Response('{"status":"ok"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const req = new Request('https://app.pages.dev/api/health?x=1');
    await onRequest({ request: req, env: { API_ORIGIN: 'minovsky-maps-api.vercel.app/' } });
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      'https://minovsky-maps-api.vercel.app/api/health?x=1',
    );
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
