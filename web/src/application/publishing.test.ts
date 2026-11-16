import { describe, expect, it } from 'vitest';
import { createScenario, type Scenario } from '../domain/scenario';
import { loadScenario, serializeScenario } from '../domain/serialization';
import { readFixture } from '../domain/testing/fixtures';
import { EditorSession } from './editorSession';
import type {
  ApiResult,
  DraftStore,
  Publication,
  PublicationStore,
  PublishedRead,
  ScenarioPublisher,
  Visibility,
} from './ports';
import {
  canUpdate,
  changeVisibility,
  deletePublished,
  editPublished,
  openPublished,
  publishScenario,
  rememberEditToken,
  reportScenario,
  shortLink,
  updatePublished,
} from './publishing';
import { findDraft, newScenario, restoreDraft, startDraftAutosave } from './useCases';

const sample = (): Scenario => {
  const r = loadScenario(readFixture('sample-mesa.scenario.json'));
  if (!r.ok) throw new Error(r.errors.join());
  return r.scenario;
};

/**
 * In-memory fake of the API with the server's rules: publishing needs a signed-in account, owned
 * scenarios are changed by their owner, legacy ones with their edit token.
 */
class FakeApi implements ScenarioPublisher {
  docs = new Map<
    string,
    { owner: number | null; token: string | null; versions: Scenario[]; visibility?: Visibility }
  >();
  next = 1;
  down = false;
  /** The signed-in account (0 = signed out). */
  me = 7;
  async publish(
    s: Scenario,
    visibility: Visibility,
  ): Promise<ApiResult<{ id: string; updatedAt: string }>> {
    if (this.down) return { ok: false, failure: 'unavailable', errors: ['down'] };
    if (!this.me) return { ok: false, failure: 'signed-out', errors: ['sign in'] };
    const id = `id${String(this.next++).padStart(6, '0')}`;
    this.docs.set(id, { owner: this.me, token: null, versions: [s], visibility });
    return { ok: true, value: { id, updatedAt: 't' } };
  }
  async setVisibility(id: string, visibility: Visibility): Promise<ApiResult<object>> {
    const d = this.docs.get(id);
    if (!d) return { ok: false, failure: 'not-found', errors: ['nf'] };
    if (d.owner !== this.me) return { ok: false, failure: 'not-owner', errors: ['no'] };
    d.visibility = visibility;
    return { ok: true, value: {} };
  }
  async update(
    id: string,
    token: string | null,
    s: Scenario,
  ): Promise<ApiResult<{ updatedAt: string }>> {
    const d = this.docs.get(id);
    if (!d) return { ok: false, failure: 'not-found', errors: ['nf'] };
    if (d.owner !== null) {
      if (!this.me) return { ok: false, failure: 'signed-out', errors: ['sign in'] };
      if (d.owner !== this.me) return { ok: false, failure: 'not-owner', errors: ['no'] };
    } else if (d.token !== token) {
      return { ok: false, failure: 'forbidden', errors: ['no'] };
    }
    d.versions.push(s);
    return { ok: true, value: { updatedAt: 't2' } };
  }
  async fetch(id: string): Promise<ApiResult<PublishedRead>> {
    const d = this.docs.get(id);
    const isOwner = !!d && d.owner !== null && d.owner === this.me;
    if (!d || (d.visibility === 'private' && !isOwner))
      return { ok: false, failure: 'not-found', errors: ['nf'] };
    return {
      ok: true,
      value: {
        scenario: JSON.parse(JSON.stringify(d.versions.at(-1))),
        updatedAt: 't',
        owner: d.owner !== null ? { displayName: `Owner ${d.owner}` } : null,
        isOwner,
        visibility: isOwner ? (d.visibility ?? 'link') : null,
      },
    };
  }
  async remove(id: string): Promise<ApiResult<object>> {
    const d = this.docs.get(id);
    if (!d) return { ok: false, failure: 'not-found', errors: ['nf'] };
    if (d.owner !== this.me) return { ok: false, failure: 'not-owner', errors: ['no'] };
    this.docs.delete(id);
    return { ok: true, value: {} };
  }
  reports: { scenarioId: string; reason: string; details: string }[] = [];
  async report(input: {
    scenarioId: string;
    reason: string;
    details: string;
  }): Promise<ApiResult<{ received: boolean }>> {
    if (!this.docs.has(input.scenarioId))
      return { ok: false, failure: 'not-found', errors: ['nf'] };
    this.reports.push(input);
    return { ok: true, value: { received: true } };
  }
  wake() {}
}

class MemoryStore implements PublicationStore {
  items = new Map<string, Publication>();
  get = (id: string) => this.items.get(id) ?? null;
  save = (p: Publication) => void this.items.set(p.id, p);
  list = () => [...this.items.values()];
  remove = (id: string) => void this.items.delete(id);
}

describe('publishing use cases', () => {
  it('publishes as the account and links the session as owned (no edit token)', async () => {
    const api = new FakeApi();
    const store = new MemoryStore();
    const session = new EditorSession(sample());
    const r = await publishScenario(session, api);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(session.getSnapshot().publication).toEqual({ id: r.publication.id, owned: true });
    expect(store.list()).toHaveLength(0);
    expect(canUpdate(session, store)).toBe(true);
  });

  it('saves online as private by default; the owner can share it later on the same link', async () => {
    const api = new FakeApi();
    const r = await publishScenario(new EditorSession(sample()), api);
    if (!r.ok) throw new Error();
    const id = r.publication.id;
    expect(api.docs.get(id)?.visibility).toBe('private');
    expect(await openPublished(id, api)).toMatchObject({ ok: true, visibility: 'private' });
    api.me = 0;
    expect(await openPublished(id, api)).toMatchObject({ ok: false, failure: 'not-found' });
    api.me = 7;
    expect((await changeVisibility(api, id, 'link')).ok).toBe(true);
    api.me = 0;
    expect(await openPublished(id, api)).toMatchObject({ ok: true, visibility: null });
  });

  it('saves with the chosen visibility', async () => {
    const api = new FakeApi();
    const r = await publishScenario(new EditorSession(sample()), api, 'public');
    expect(r.ok && api.docs.get(r.publication.id)?.visibility).toBe('public');
  });

  it('reports signed-out instead of publishing', async () => {
    const api = new FakeApi();
    api.me = 0;
    const r = await publishScenario(new EditorSession(sample()), api);
    expect(r).toMatchObject({ ok: false, failure: 'signed-out' });
    expect(api.docs.size).toBe(0);
  });

  it('refuses to publish while save blockers exist, without calling the API', async () => {
    const api = new FakeApi();
    const r = await publishScenario(new EditorSession(createScenario({ name: '' })), api);
    expect(r).toMatchObject({ ok: false, failure: 'blocked' });
    expect(api.docs.size).toBe(0);
  });

  it('updates an owned scenario in place', async () => {
    const api = new FakeApi();
    const store = new MemoryStore();
    const session = new EditorSession(sample());
    const first = await publishScenario(session, api);
    if (!first.ok) throw new Error();
    session.reset(
      { ...session.scenario, meta: { ...session.scenario.meta, name: 'Mesa v2' } },
      { publication: { id: first.publication.id, owned: true } },
    );
    expect((await updatePublished(session, api, store)).ok).toBe(true);
    const opened = await openPublished(first.publication.id, api);
    expect(opened.ok && opened.scenario.meta.name).toBe('Mesa v2');
    expect(opened.ok && opened.isOwner).toBe(true);

    api.me = 8; // someone else
    expect(await updatePublished(session, api, store)).toMatchObject({
      ok: false,
      failure: 'not-owner',
    });
  });

  it('updates a legacy scenario with its edit token', async () => {
    const api = new FakeApi();
    api.docs.set('legacy01', { owner: null, token: 'tok', versions: [sample()] });
    const store = new MemoryStore();
    rememberEditToken(store, 'legacy01', 'tok', 'Mesa');
    const session = new EditorSession(sample());
    session.setPublication({ id: 'legacy01' });
    expect(canUpdate(session, store)).toBe(true);
    const r = await updatePublished(session, api, store);
    expect(r.ok).toBe(true);
    expect(store.get('legacy01')?.name).toBe('Sample: Desert Mesa');
  });

  it('cannot update a legacy scenario without a remembered token', async () => {
    const session = new EditorSession(sample());
    session.setPublication({ id: 'id000042' });
    expect(canUpdate(session, new MemoryStore())).toBe(false);
    const r = await updatePublished(session, new FakeApi(), new MemoryStore());
    expect(r).toMatchObject({ ok: false, failure: 'no-token' });
  });

  it('deletes an owned scenario and unlinks the editor', async () => {
    const api = new FakeApi();
    const session = new EditorSession(sample());
    const pub = await publishScenario(session, api);
    if (!pub.ok) throw new Error();
    expect((await deletePublished(session, api, pub.publication.id)).ok).toBe(true);
    expect(session.getSnapshot().publication).toBeNull();
    expect(await openPublished(pub.publication.id, api)).toMatchObject({ failure: 'not-found' });
  });

  it('passes API failures through', async () => {
    const api = new FakeApi();
    api.down = true;
    const r = await publishScenario(new EditorSession(sample()), api);
    expect(r).toMatchObject({ ok: false, failure: 'unavailable' });
    expect(await openPublished('nope0000', api)).toMatchObject({ ok: false, failure: 'not-found' });
  });

  it('validates fetched documents like files', async () => {
    const api = new FakeApi();
    api.docs.set('bad00000', {
      owner: null,
      token: 't',
      versions: [{ broken: true } as unknown as Scenario],
    });
    expect(await openPublished('bad00000', api)).toMatchObject({ ok: false, failure: 'invalid' });
  });

  it('gives the verified owner name of owned scenarios', async () => {
    const api = new FakeApi();
    const pub = await publishScenario(new EditorSession(sample()), api, 'link');
    if (!pub.ok) throw new Error();
    api.me = 0;
    const r = await openPublished(pub.publication.id, api);
    expect(r).toMatchObject({ ok: true, ownerName: 'Owner 7', isOwner: false });
  });

  it('edit published opens clean and linked; New unlinks', () => {
    const session = new EditorSession(createScenario());
    editPublished(session, 'id000001', sample(), true);
    expect(session.getSnapshot()).toMatchObject({
      dirty: false,
      publication: { id: 'id000001', owned: true },
    });
    newScenario(session, {});
    expect(session.getSnapshot().publication).toBeNull();
    editPublished(session, 'id000002', sample(), false);
    expect(session.getSnapshot().publication).toEqual({ id: 'id000002' });
  });

  it('remembers tokens from private edit links without losing a known name', () => {
    const store = new MemoryStore();
    rememberEditToken(store, 'id000001', 'tok', 'Mesa');
    rememberEditToken(store, 'id000001', 'tok2');
    expect(store.get('id000001')).toEqual({ id: 'id000001', editToken: 'tok2', name: 'Mesa' });
  });

  it('builds short links', () => {
    expect(shortLink('https://m.pages.dev/', 'abcdEFG1')).toBe('https://m.pages.dev/s/abcdEFG1');
  });
});
describe('reportScenario', () => {
  it('sends a report with trimmed details', async () => {
    const api = new FakeApi();
    const pub = await publishScenario(new EditorSession(sample()), api);
    if (!pub.ok) throw new Error();
    const r = await reportScenario(api, {
      scenarioId: pub.publication.id,
      reason: 'official-copy',
      details: '  starter map  ',
    });
    expect(r.ok).toBe(true);
    expect(api.reports).toEqual([
      { scenarioId: pub.publication.id, reason: 'official-copy', details: 'starter map' },
    ]);
  });

  it('requires a reason and at most 1,000 characters, without calling the API', async () => {
    const api = new FakeApi();
    expect(await reportScenario(api, { scenarioId: 'x', reason: null, details: '' })).toMatchObject(
      {
        ok: false,
        failure: 'blocked',
      },
    );
    expect(
      await reportScenario(api, { scenarioId: 'x', reason: 'spam', details: 'é'.repeat(1001) }),
    ).toMatchObject({ ok: false, failure: 'blocked' });
    expect(api.reports).toHaveLength(0);
  });

  it('passes API failures through', async () => {
    expect(
      await reportScenario(new FakeApi(), { scenarioId: 'nope0000', reason: 'spam', details: '' }),
    ).toMatchObject({ ok: false, failure: 'not-found' });
  });
});

describe('drafts keep the publication', () => {
  const memoryDrafts = (): DraftStore & { value: string | null } => ({
    value: null,
    load() {
      return this.value;
    },
    save(json) {
      this.value = json;
    },
    clear() {
      this.value = null;
    },
  });

  it('round-trips scenario and publication', async () => {
    const drafts = memoryDrafts();
    const session = new EditorSession(sample());
    const stop = startDraftAutosave(session, drafts, 0);
    session.reset(
      { ...sample(), meta: { name: 'Edited' } },
      { dirty: true, publication: { id: 'id000009', owned: true } },
    );
    await new Promise((r) => setTimeout(r, 5));
    stop();
    const draft = findDraft(drafts);
    expect(draft?.scenario.meta.name).toBe('Edited');
    expect(draft?.publication).toEqual({ id: 'id000009', owned: true });
    const restored = new EditorSession(createScenario());
    restoreDraft(restored, draft!);
    expect(restored.getSnapshot()).toMatchObject({
      dirty: true,
      publication: { id: 'id000009', owned: true },
    });
  });

  it('still loads drafts saved before publishing existed (bare scenario)', () => {
    const drafts = memoryDrafts();
    drafts.save(serializeScenario(sample()));
    const draft = findDraft(drafts);
    expect(draft?.scenario.meta.name).toBe('Sample: Desert Mesa');
    expect(draft?.publication).toBeNull();
  });

  it('drops unreadable drafts', () => {
    const drafts = memoryDrafts();
    drafts.save('{oops');
    expect(findDraft(drafts)).toBeNull();
    expect(drafts.value).toBeNull();
  });
});
