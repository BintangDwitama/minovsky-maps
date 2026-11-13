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
  ScenarioPublisher,
} from './ports';
import {
  editPublished,
  editablePublication,
  openPublished,
  privateEditLink,
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

/** In-memory fake of the API with the same token rule as the server. */
class FakeApi implements ScenarioPublisher {
  docs = new Map<string, { token: string; versions: Scenario[] }>();
  next = 1;
  down = false;
  async publish(
    s: Scenario,
  ): Promise<ApiResult<{ id: string; editToken: string; updatedAt: string }>> {
    if (this.down) return { ok: false, failure: 'unavailable', errors: ['down'] };
    const id = `id${String(this.next++).padStart(6, '0')}`;
    this.docs.set(id, { token: `tok-${id}`, versions: [s] });
    return { ok: true, value: { id, editToken: `tok-${id}`, updatedAt: 't' } };
  }
  async update(id: string, token: string, s: Scenario): Promise<ApiResult<{ updatedAt: string }>> {
    const d = this.docs.get(id);
    if (!d) return { ok: false, failure: 'not-found', errors: ['nf'] };
    if (d.token !== token) return { ok: false, failure: 'forbidden', errors: ['no'] };
    d.versions.push(s);
    return { ok: true, value: { updatedAt: 't2' } };
  }
  async fetch(id: string): Promise<ApiResult<{ scenario: unknown; updatedAt: string }>> {
    const d = this.docs.get(id);
    if (!d) return { ok: false, failure: 'not-found', errors: ['nf'] };
    return {
      ok: true,
      value: { scenario: JSON.parse(JSON.stringify(d.versions.at(-1))), updatedAt: 't' },
    };
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
  it('publishes, remembers the token and links the session', async () => {
    const api = new FakeApi();
    const store = new MemoryStore();
    const session = new EditorSession(sample());
    const r = await publishScenario(session, api, store);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(store.get(r.publication.id)?.editToken).toBe(r.publication.editToken);
    expect(session.getSnapshot().publication).toEqual({ id: r.publication.id });
    expect(editablePublication(session, store)?.id).toBe(r.publication.id);
  });

  it('refuses to publish while save blockers exist, without calling the API', async () => {
    const api = new FakeApi();
    const r = await publishScenario(
      new EditorSession(createScenario({ name: '' })),
      api,
      new MemoryStore(),
    );
    expect(r).toMatchObject({ ok: false, failure: 'blocked' });
    expect(api.docs.size).toBe(0);
  });

  it('updates in place, and the short link then shows the new version', async () => {
    const api = new FakeApi();
    const store = new MemoryStore();
    const session = new EditorSession(sample());
    const first = await publishScenario(session, api, store);
    if (!first.ok) throw new Error();
    session.reset(
      { ...session.scenario, meta: { ...session.scenario.meta, name: 'Mesa v2' } },
      {
        publication: { id: first.publication.id },
      },
    );
    const up = await updatePublished(session, api, store);
    expect(up.ok).toBe(true);
    const opened = await openPublished(first.publication.id, api);
    expect(opened.ok && opened.scenario.meta.name).toBe('Mesa v2');
    expect(store.get(first.publication.id)?.name).toBe('Mesa v2');
  });

  it('cannot update without a remembered token', async () => {
    const session = new EditorSession(sample());
    session.setPublication({ id: 'id000042' });
    const r = await updatePublished(session, new FakeApi(), new MemoryStore());
    expect(r).toMatchObject({ ok: false, failure: 'no-token' });
  });

  it('passes API failures through', async () => {
    const api = new FakeApi();
    api.down = true;
    const r = await publishScenario(new EditorSession(sample()), api, new MemoryStore());
    expect(r).toMatchObject({ ok: false, failure: 'unavailable' });
    expect(await openPublished('nope0000', api)).toMatchObject({ ok: false, failure: 'not-found' });
  });

  it('validates fetched documents like files', async () => {
    const api = new FakeApi();
    api.docs.set('bad00000', { token: 't', versions: [{ broken: true } as unknown as Scenario] });
    expect(await openPublished('bad00000', api)).toMatchObject({ ok: false, failure: 'invalid' });
  });

  it('edit published opens clean and linked; New unlinks', () => {
    const session = new EditorSession(createScenario());
    editPublished(session, 'id000001', sample());
    expect(session.getSnapshot()).toMatchObject({ dirty: false, publication: { id: 'id000001' } });
    newScenario(session, {});
    expect(session.getSnapshot().publication).toBeNull();
  });

  it('remembers tokens from private edit links without losing a known name', () => {
    const store = new MemoryStore();
    rememberEditToken(store, 'id000001', 'tok', 'Mesa');
    rememberEditToken(store, 'id000001', 'tok2');
    expect(store.get('id000001')).toEqual({ id: 'id000001', editToken: 'tok2', name: 'Mesa' });
  });

  it('builds links with the token only in the fragment', () => {
    expect(shortLink('https://m.pages.dev/', 'abcdEFG1')).toBe('https://m.pages.dev/s/abcdEFG1');
    expect(privateEditLink('https://m.pages.dev', 'abcdEFG1', 'tok')).toBe(
      'https://m.pages.dev/s/abcdEFG1#edit=tok',
    );
  });
});

describe('reportScenario', () => {
  it('sends a report with trimmed details', async () => {
    const api = new FakeApi();
    const pub = await publishScenario(new EditorSession(sample()), api, new MemoryStore());
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
      { dirty: true, publication: { id: 'id000009' } },
    );
    await new Promise((r) => setTimeout(r, 5));
    stop();
    const draft = findDraft(drafts);
    expect(draft?.scenario.meta.name).toBe('Edited');
    expect(draft?.publication).toEqual({ id: 'id000009' });
    const restored = new EditorSession(createScenario());
    restoreDraft(restored, draft!);
    expect(restored.getSnapshot()).toMatchObject({ dirty: true, publication: { id: 'id000009' } });
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
