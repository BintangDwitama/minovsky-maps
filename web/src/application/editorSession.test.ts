import { describe, expect, it, vi } from 'vitest';
import { offsetToAxial } from '../domain/hex';
import { createScenario } from '../domain/scenario';
import { adjustElevationCmd, paintTagsCmd, placeComponentCmd, updateMetaCmd } from './commands';
import { EditorSession } from './editorSession';
import type { DraftStore, FileWriter } from './ports';
import {
  findDraft,
  newScenario,
  openScenarioText,
  restoreDraft,
  saveScenario,
  startDraftAutosave,
} from './useCases';
import { serializeScenario } from '../domain/serialization';

const at = (col: number, row: number) => offsetToAxial({ col, row });
const session = () => new EditorSession(createScenario());

describe('EditorSession history', () => {
  it('undo/redo a placement', () => {
    const s = session();
    s.execute(placeComponentCmd('garrison', { id: 'g', hex: at(1, 1), owner: 'A' }));
    expect(s.scenario.components).toHaveLength(1);
    s.undo();
    expect(s.scenario.components).toHaveLength(0);
    s.redo();
    expect(s.scenario.components).toHaveLength(1);
  });

  it('a new edit after undo clears redo', () => {
    const s = session();
    s.execute(paintTagsCmd([at(0, 0)], 'water', 'add'));
    s.undo();
    expect(s.getSnapshot().canRedo).toBe(true);
    s.execute(paintTagsCmd([at(1, 1)], 'debris', 'add'));
    expect(s.getSnapshot().canRedo).toBe(false);
  });

  it('no-op commands and failures do not create history', () => {
    const s = session();
    expect(s.execute(paintTagsCmd([at(0, 0)], 'water', 'remove'))).toEqual({
      ok: true,
      changed: false,
    });
    const r = s.execute(
      placeComponentCmd('carrier', { id: 'c', hex: at(0, 0), owner: 'A', facing: 0 }),
    );
    expect(r.ok).toBe(false);
    expect(s.getSnapshot().canUndo).toBe(false);
  });

  it('caps history at the limit', () => {
    const s = new EditorSession(createScenario(), 5);
    for (let i = 0; i < 8; i++) s.execute(adjustElevationCmd([at(0, 0)], i % 2 ? -1 : 1));
    let undos = 0;
    while (s.getSnapshot().canUndo) {
      s.undo();
      undos++;
    }
    expect(undos).toBe(5);
  });

  it('keeps at least 200 steps by default', () => {
    const s = session();
    for (let i = 0; i < 210; i++) s.execute(adjustElevationCmd([at(0, 0)], i % 2 ? -1 : 1));
    let undos = 0;
    while (s.getSnapshot().canUndo) {
      s.undo();
      undos++;
    }
    expect(undos).toBe(200);
  });

  it('notifies subscribers and gives stable snapshots', () => {
    const s = session();
    const fn = vi.fn();
    s.subscribe(fn);
    const snap = s.getSnapshot();
    expect(s.getSnapshot()).toBe(snap);
    s.execute(adjustElevationCmd([at(0, 0)], 1));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(s.getSnapshot()).not.toBe(snap);
  });
});

describe('transactions', () => {
  it('a drag stroke is one history step', () => {
    const s = session();
    s.begin('Paint water');
    for (let c = 0; c < 10; c++) s.execute(paintTagsCmd([at(c, 0)], 'water', 'add'));
    s.commit();
    expect(s.scenario.board.hexes.filter((h) => h.tags).length).toBe(10);
    s.undo();
    expect(s.scenario.board.hexes.filter((h) => h.tags).length).toBe(0);
    expect(s.getSnapshot().canUndo).toBe(false);
  });

  it('empty transactions add nothing; cancel reverts', () => {
    const s = session();
    s.begin('nothing');
    s.commit();
    expect(s.getSnapshot().canUndo).toBe(false);
    s.begin('typing');
    s.execute(updateMetaCmd({ name: 'Draft' }));
    s.cancel();
    expect(s.scenario.meta.name).toBe('Untitled scenario');
  });

  it('text editing in one focus session is one step', () => {
    const s = session();
    s.begin('Edit details');
    for (const name of ['D', 'De', 'Des', 'Desert']) s.execute(updateMetaCmd({ name }));
    s.commit();
    s.undo();
    expect(s.scenario.meta.name).toBe('Untitled scenario');
  });
});

describe('dirty tracking and lifecycle', () => {
  it('dirty after edit, clean after save, clean again when undone to saved state', () => {
    const s = session();
    expect(s.getSnapshot().dirty).toBe(false);
    s.execute(adjustElevationCmd([at(0, 0)], 1));
    expect(s.getSnapshot().dirty).toBe(true);
    s.undo();
    expect(s.getSnapshot().dirty).toBe(false);
  });

  it('loading clears history', () => {
    const s = session();
    s.execute(adjustElevationCmd([at(0, 0)], 1));
    const text = serializeScenario(createScenario({ width: 3, height: 3, name: 'Loaded' }));
    expect(openScenarioText(s, text)).toEqual({ ok: true });
    expect(s.getSnapshot()).toMatchObject({ canUndo: false, dirty: false });
    expect(s.scenario.meta.name).toBe('Loaded');
  });

  it('invalid load leaves the scenario unchanged', () => {
    const s = session();
    const before = s.scenario;
    const r = openScenarioText(s, '{"schemaVersion": 1}');
    expect(r.ok).toBe(false);
    expect(s.scenario).toBe(before);
  });

  it('new scenario validates size', () => {
    const s = session();
    expect(newScenario(s, { width: 41 }).ok).toBe(false);
    expect(newScenario(s, { width: 12, height: 18 })).toEqual({ ok: true });
    expect(s.scenario.board.hexes).toHaveLength(216);
  });
});

describe('save', () => {
  const writer = (): FileWriter & { files: { name: string; data: Blob }[] } => {
    const files: { name: string; data: Blob }[] = [];
    return { files, write: async (name, data) => void files.push({ name, data }) };
  };

  it('blank name blocks save; warnings do not', async () => {
    const s = session();
    s.execute(updateMetaCmd({ name: '  ' }));
    const w = writer();
    const r = await saveScenario(s, w);
    expect(r.ok).toBe(false);
    expect(w.files).toHaveLength(0);

    s.execute(updateMetaCmd({ name: 'Desert Mesa' })); // no bases -> warnings, still saves
    expect(await saveScenario(s, w)).toEqual({ ok: true });
    expect(w.files[0]?.name).toBe('desert-mesa.scenario.json');
    expect(s.getSnapshot().dirty).toBe(false);
  });
});

describe('drafts', () => {
  const memoryDrafts = (): DraftStore & { value: string | null } => {
    const d = {
      value: null as string | null,
      load: () => d.value,
      save: (j: string) => void (d.value = j),
      clear: () => void (d.value = null),
    };
    return d;
  };

  it('autosaves dirty work, clears when clean, and restores as dirty', async () => {
    vi.useFakeTimers();
    const drafts = memoryDrafts();
    const s = session();
    const stop = startDraftAutosave(s, drafts, 100);
    s.execute(updateMetaCmd({ name: 'Unsaved work' }));
    vi.advanceTimersByTime(150);
    expect(drafts.value).toContain('Unsaved work');

    const s2 = session();
    const draft = findDraft(drafts);
    expect(draft?.scenario.meta.name).toBe('Unsaved work');
    restoreDraft(s2, draft!);
    expect(s2.getSnapshot().dirty).toBe(true);

    s.undo();
    vi.advanceTimersByTime(150);
    expect(drafts.value).toBeNull();
    stop();
    vi.useRealTimers();
  });

  it('drops corrupt drafts', () => {
    const drafts = memoryDrafts();
    drafts.value = '{broken';
    expect(findDraft(drafts)).toBeNull();
    expect(drafts.value).toBeNull();
  });
});
