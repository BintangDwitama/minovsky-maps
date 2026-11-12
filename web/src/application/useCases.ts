import { checkIntegrity } from '../domain/integrity';
import { createScenario, type CreateScenarioOptions, type Scenario } from '../domain/scenario';
import { validateSchema } from '../domain/schemaValidator';
import {
  imageFileName,
  loadScenario,
  scenarioFileName,
  serializeScenario,
} from '../domain/serialization';
import type { EditorSession } from './editorSession';
import type { DraftStore, FileWriter, ImageExporter, ScenarioFileReader } from './ports';

export type UseCaseResult = { ok: true } | { ok: false; errors: string[] } | { ok: 'cancelled' };

export const PNG_MIN_LONG_SIDE = 2000;

export const newScenario = (session: EditorSession, opts: CreateScenarioOptions): UseCaseResult => {
  try {
    session.reset(createScenario(opts));
    return { ok: true };
  } catch (e) {
    return { ok: false, errors: [(e as Error).message] };
  }
};

export const openScenarioText = (session: EditorSession, text: string): UseCaseResult => {
  const r = loadScenario(text);
  if (!r.ok) return { ok: false, errors: r.errors };
  session.reset(r.scenario);
  return { ok: true };
};

export const openFromPicker = async (
  session: EditorSession,
  reader: ScenarioFileReader,
): Promise<UseCaseResult> => {
  const text = await reader.pick();
  if (text === null) return { ok: 'cancelled' };
  return openScenarioText(session, text);
};

export const openFromBlob = async (
  session: EditorSession,
  reader: ScenarioFileReader,
  blob: Blob,
): Promise<UseCaseResult> => openScenarioText(session, await reader.read(blob));

/** Problems that block saving (the document would not load back). Warnings never block. */
export const saveBlockers = (s: Scenario): string[] => {
  const blockers: string[] = [];
  if (!s.meta.name.trim()) blockers.push('Give the scenario a name before saving.');
  s.goals.forEach((g, i) => {
    if (!g.text.trim()) blockers.push(`Goal ${i + 1} has no text.`);
  });
  if (blockers.length > 0) return blockers;
  const schema = validateSchema(s);
  if (!schema.ok) return schema.errors;
  return checkIntegrity(s).map((e) => e.message);
};

export const saveScenario = async (
  session: EditorSession,
  writer: FileWriter,
  drafts?: DraftStore,
): Promise<UseCaseResult> => {
  const s = session.scenario;
  const blockers = saveBlockers(s);
  if (blockers.length > 0) return { ok: false, errors: blockers };
  await writer.write(
    scenarioFileName(s),
    new Blob([serializeScenario(s)], { type: 'application/json' }),
  );
  session.markSaved();
  drafts?.clear();
  return { ok: true };
};

export const exportPng = async (
  session: EditorSession,
  exporter: ImageExporter,
  writer: FileWriter,
): Promise<UseCaseResult> => {
  try {
    const png = await exporter.renderPng(session.scenario, PNG_MIN_LONG_SIDE);
    await writer.write(imageFileName(session.scenario), png);
    return { ok: true };
  } catch (e) {
    return { ok: false, errors: [`Export failed: ${(e as Error).message}`] };
  }
};

/* ---------------- drafts ---------------- */

/**
 * Autosave unsaved changes to the draft store (debounced). Returns an unsubscribe function.
 * Drafts are cleared when the document becomes clean (saved/new/loaded).
 */
export const startDraftAutosave = (
  session: EditorSession,
  drafts: DraftStore,
  delayMs = 800,
): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = session.getSnapshot().scenario;
  const flush = () => {
    timer = null;
    const snap = session.getSnapshot();
    if (snap.dirty) drafts.save(serializeScenario(snap.scenario));
    else drafts.clear();
  };
  const unsubscribe = session.subscribe(() => {
    const snap = session.getSnapshot();
    if (snap.scenario === last && snap.dirty) return;
    last = snap.scenario;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  });
  return () => {
    if (timer) {
      clearTimeout(timer);
      flush();
    }
    unsubscribe();
  };
};

/** A restorable draft, if one exists and still loads. */
export const findDraft = (drafts: DraftStore): Scenario | null => {
  const text = drafts.load();
  if (!text) return null;
  const r = loadScenario(text);
  if (!r.ok) {
    drafts.clear();
    return null;
  }
  return r.scenario;
};

export const restoreDraft = (session: EditorSession, draft: Scenario): void => {
  // restored drafts are unsaved work: keep them marked dirty
  session.reset(draft, { dirty: true });
};
