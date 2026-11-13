import { describe, expect, it, vi } from 'vitest';
import { HttpAccountService } from './httpAccountService';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const call = (fetchImpl: ReturnType<typeof vi.fn>, i = 0) =>
  fetchImpl.mock.calls[i] as unknown as [string, RequestInit];

describe('HttpAccountService', () => {
  it('reads who is signed in', async () => {
    const fetchImpl = vi.fn(async () =>
      json(200, { signedIn: true, available: true, account: { id: 3, displayName: 'Bintang' } }),
    );
    const r = await new HttpAccountService({ fetchImpl }).status();
    expect(r).toEqual({
      ok: true,
      value: { available: true, account: { id: 3, displayName: 'Bintang' } },
    });
    expect(call(fetchImpl)[0]).toBe('/api/me');
    expect(call(fetchImpl)[1].credentials).toBe('same-origin');
  });

  it('reports signed out and unconfigured sign-in', async () => {
    const fetchImpl = vi.fn(async () => json(200, { signedIn: false, available: false }));
    expect(await new HttpAccountService({ fetchImpl }).status()).toEqual({
      ok: true,
      value: { available: false, account: null },
    });
  });

  it('builds the sign-in address with the return path encoded', () => {
    expect(new HttpAccountService().signInUrl('/#/edit/x?y')).toBe(
      '/api/auth/google/start?return=%2F%23%2Fedit%2Fx%3Fy',
    );
  });

  it('sends the client header with every change', async () => {
    const fetchImpl = vi.fn(async () => json(200, { account: { id: 1, displayName: 'B' } }));
    const s = new HttpAccountService({ fetchImpl });
    await s.rename('B');
    await s.signOut();
    await s.deleteAccount();
    await s.claim([{ id: 'abcdEFG1', token: 't' }]);
    const methods = fetchImpl.mock.calls.map((c) => {
      const [url, init] = c as unknown as [string, RequestInit];
      expect((init.headers as Record<string, string>)['X-Minovsky-Client']).toBe('web');
      return `${init.method} ${url}`;
    });
    expect(methods).toEqual([
      'PATCH /api/me',
      'POST /api/auth/signout',
      'DELETE /api/me',
      'POST /api/me/claim',
    ]);
  });

  it('unwraps lists and claims', async () => {
    const list = vi.fn(async () =>
      json(200, { scenarios: [{ id: 'abcdEFG1', name: 'Mesa', updatedAt: 'x' }] }),
    );
    expect(await new HttpAccountService({ fetchImpl: list }).listOwned()).toEqual({
      ok: true,
      value: [{ id: 'abcdEFG1', name: 'Mesa', updatedAt: 'x' }],
    });
    const claim = vi.fn(async () => json(200, { claimed: ['abcdEFG1'] }));
    expect(
      await new HttpAccountService({ fetchImpl: claim }).claim([{ id: 'abcdEFG1', token: 't' }]),
    ).toEqual({ ok: true, value: ['abcdEFG1'] });
    expect(JSON.parse(call(claim)[1].body as string)).toEqual({
      items: [{ id: 'abcdEFG1', token: 't' }],
    });
  });

  it('maps a signed-out answer', async () => {
    const fetchImpl = vi.fn(async () => json(401, { code: 'signed-out', errors: ['Sign in'] }));
    expect(await new HttpAccountService({ fetchImpl }).listOwned()).toMatchObject({
      ok: false,
      failure: 'signed-out',
    });
  });
});
