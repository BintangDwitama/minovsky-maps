import { describe, expect, it } from 'vitest';
import { loadScenario, serializeScenario } from '../domain/serialization';
import { readFixture } from '../domain/testing/fixtures';
import { EditorSession } from './editorSession';
import type { DraftStore } from './ports';
import { discardDraft, editedAgo, findDraft, startDraftAutosave } from './useCases';

const sample = () => {
  const r = loadScenario(readFixture('sample-mesa.scenario.json'));
  if (!r.ok) throw new Error(r.errors.join());
  return r.scenario;
};

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

describe('draft save time', () => {
  it('records when the draft was autosaved', async () => {
    const drafts = memoryDrafts();
    const session = new EditorSession(sample());
    const at = new Date('2026-11-16T08:00:00Z');
    const stop = startDraftAutosave(session, drafts, 0, () => at);
    session.reset({ ...sample(), meta: { name: 'Edited' } }, { dirty: true });
    await new Promise((r) => setTimeout(r, 5));
    stop();
    expect(findDraft(drafts)).toMatchObject({ savedAt: at.toISOString() });
  });

  it('still loads older drafts without a save time', () => {
    const drafts = memoryDrafts();
    drafts.save(JSON.stringify({ draft: 2, scenario: sample(), publication: null }));
    expect(findDraft(drafts)).toMatchObject({ savedAt: null, publication: null });
    drafts.save(serializeScenario(sample())); // pre-publishing: the bare scenario
    expect(findDraft(drafts)?.savedAt).toBeNull();
  });

  it('ignores an unreadable save time', () => {
    const drafts = memoryDrafts();
    drafts.save(JSON.stringify({ draft: 2, scenario: sample(), publication: null, savedAt: 'x' }));
    expect(findDraft(drafts)?.savedAt).toBeNull();
  });

  it('discards the draft', () => {
    const drafts = memoryDrafts();
    drafts.save(serializeScenario(sample()));
    discardDraft(drafts);
    expect(findDraft(drafts)).toBeNull();
  });
});

describe('editedAgo', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  const ago = (s: number) => new Date(now.getTime() - s * 1000).toISOString();
  it.each([
    [null, 'edited earlier'],
    [ago(20), 'edited just now'],
    [ago(60), 'edited 1 minute ago'],
    [ago(5 * 60), 'edited 5 minutes ago'],
    [ago(2 * 3600), 'edited 2 hours ago'],
    [ago(86400), 'edited 1 day ago'],
    [ago(3 * 86400), 'edited 3 days ago'],
  ])('%s → %s', (savedAt, want) => {
    expect(editedAgo(savedAt, now)).toBe(want);
  });
});
