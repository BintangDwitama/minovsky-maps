import { describe, expect, it } from 'vitest';
import {
  claimedMessage,
  claimLegacyScenarios,
  parseSignInResult,
  withoutSignInParam,
} from './accounts';
import type { AccountService, ApiResult, Publication, PublicationStore } from './ports';

class MemoryStore implements PublicationStore {
  items = new Map<string, Publication>();
  get = (id: string) => this.items.get(id) ?? null;
  save = (p: Publication) => void this.items.set(p.id, p);
  list = () => [...this.items.values()];
  remove = (id: string) => void this.items.delete(id);
}

/** Claims scenarios whose token is "good-…"; records what it was sent. */
const fakeAccounts = (fail = false) => {
  const sent: { id: string; token: string }[][] = [];
  const svc: Pick<AccountService, 'claim'> = {
    async claim(items): Promise<ApiResult<string[]>> {
      sent.push([...items]);
      if (fail) return { ok: false, failure: 'unavailable', errors: ['down'] };
      return { ok: true, value: items.filter((i) => i.token.startsWith('good')).map((i) => i.id) };
    },
  };
  return { svc: svc as AccountService, sent };
};

describe('claiming legacy scenarios', () => {
  it('claims what the server accepts and forgets only those tokens', async () => {
    const store = new MemoryStore();
    store.save({ id: 'aaaaaaa1', editToken: 'good-1', name: 'A' });
    store.save({ id: 'aaaaaaa2', editToken: 'good-2', name: 'B' });
    store.save({ id: 'aaaaaaa3', editToken: 'stale', name: 'C' });
    const { svc, sent } = fakeAccounts();
    expect(await claimLegacyScenarios(svc, store)).toEqual({ claimed: 2 });
    expect(sent[0]).toHaveLength(3);
    expect(store.list().map((p) => p.id)).toEqual(['aaaaaaa3']);
  });

  it('does nothing without tokens, and keeps tokens when the server is down', async () => {
    const empty = fakeAccounts();
    expect(await claimLegacyScenarios(empty.svc, new MemoryStore())).toEqual({ claimed: 0 });
    expect(empty.sent).toHaveLength(0);

    const store = new MemoryStore();
    store.save({ id: 'aaaaaaa1', editToken: 'good-1', name: 'A' });
    expect(await claimLegacyScenarios(fakeAccounts(true).svc, store)).toEqual({ claimed: 0 });
    expect(store.list()).toHaveLength(1);
  });

  it('words the result', () => {
    expect(claimedMessage(1)).toBe('1 scenario added to your account.');
    expect(claimedMessage(3)).toBe('3 scenarios added to your account.');
  });
});

describe('sign-in result in the address', () => {
  it.each([
    ['?signin=ok', 'ok'],
    ['?a=1&signin=failed', 'failed'],
    ['?signin=unverified', 'unverified'],
    ['?signin=unavailable', 'unavailable'],
    ['?signin=hacked', null],
    ['', null],
  ])('parses %j', (search, want) => {
    expect(parseSignInResult(search)).toBe(want);
  });

  it('removes only the signin parameter', () => {
    expect(withoutSignInParam('/', '?signin=ok', '#/')).toBe('/#/');
    expect(withoutSignInParam('/s/abcdEFG1', '?a=1&signin=ok', '')).toBe('/s/abcdEFG1?a=1');
  });
});
