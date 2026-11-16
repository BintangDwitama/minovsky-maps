import { checkIntegrity } from '../domain/integrity';
import { createScenario, type CreateScenarioOptions, type Scenario } from '../domain/scenario';
import { validateSchema } from '../domain/schemaValidator';
import {
  imageFileName,
  loadScenario,
  scenarioFileName,
  serializeScenario,
} from '../domain/serialization';
import type { EditorSession, PublicationRef } from './editorSession';
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

/** Render any scenario to PNG and hand it to the user. */
export const exportScenarioPng = async (
  s: Scenario,
  exporter: ImageExporter,
  writer: FileWriter,
): Promise<UseCaseResult> => {
  try {
    const png = await exporter.renderPng(s, PNG_MIN_LONG_SIDE);
    await writer.write(imageFileName(s), png);
    return { ok: true };
  } catch (e) {
    return { ok: false, errors: [`Export failed: ${(e as Error).message}`] };
  }
};

export const exportPng = (
  session: EditorSession,
  exporter: ImageExporter,
  writer: FileWriter,
): Promise<UseCaseResult> => exportScenarioPng(session.scenario, exporter, writer);

/** Download a scenario file without touching any editor session (e.g. from the sheet). */
export const downloadScenarioFile = async (s: Scenario, writer: FileWriter): Promise<void> => {
  await writer.write(
    scenarioFileName(s),
    new Blob([serializeScenario(s)], { type: 'application/json' }),
  );
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
  now: () => Date = () => new Date(),
): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = session.getSnapshot().scenario;
  let lastPublication = session.getSnapshot().publication;
  const flush = () => {
    timer = null;
    const snap = session.getSnapshot();
    if (snap.dirty) drafts.save(serializeDraft(snap.scenario, snap.publication, now()));
    else drafts.clear();
  };
  const unsubscribe = session.subscribe(() => {
    const snap = session.getSnapshot();
    if (snap.scenario === last && snap.publication === lastPublication && snap.dirty) return;
    last = snap.scenario;
    lastPublication = snap.publication;
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

export interface Draft {
  readonly scenario: Scenario;
  readonly publication: PublicationRef | null;
  /** When it was autosaved (ISO time); null for drafts saved before this was recorded. */
  readonly savedAt: string | null;
}

/** Drafts wrap the scenario so editor-only state (publication) survives a reload. */
const serializeDraft = (
  scenario: Scenario,
  publication: PublicationRef | null,
  savedAt: Date,
): string => JSON.stringify({ draft: 2, scenario, publication, savedAt: savedAt.toISOString() });

/** A restorable draft, if one exists and still loads. Accepts drafts saved as a bare scenario too. */
export const findDraft = (drafts: DraftStore): Draft | null => {
  const text = drafts.load();
  if (!text) return null;
  let doc: unknown = null;
  let publication: PublicationRef | null = null;
  let savedAt: string | null = null;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (parsed && parsed.draft === 2 && 'scenario' in parsed) {
      doc = parsed.scenario;
      const p = parsed.publication as { id?: unknown; owned?: unknown } | null;
      publication =
        p && typeof p.id === 'string'
          ? { id: p.id, ...(p.owned === true ? { owned: true } : {}) }
          : null;
      if (typeof parsed.savedAt === 'string' && !Number.isNaN(Date.parse(parsed.savedAt))) {
        savedAt = parsed.savedAt;
      }
    } else {
      doc = parsed; // pre-publishing drafts: the scenario itself
    }
  } catch {
    doc = null;
  }
  const r = loadScenario(doc);
  if (!r.ok) {
    drafts.clear();
    return null;
  }
  return { scenario: r.scenario, publication, savedAt };
};

/** Throw the browser's draft away (My scenarios → Discard). */
export const discardDraft = (drafts: DraftStore): void => drafts.clear();

/**
 * "edited 5 minutes ago" style wording for a draft's save time; "edited earlier" when unknown.
 * `now` is passed in so the wording is testable.
 */
export const editedAgo = (savedAt: string | null, now: Date): string => {
  if (!savedAt) return 'edited earlier';
  const s = Math.max(0, (now.getTime() - Date.parse(savedAt)) / 1000);
  const unit = (n: number, word: string) => `edited ${n} ${word}${n === 1 ? '' : 's'} ago`;
  if (s < 60) return 'edited just now';
  if (s < 3600) return unit(Math.floor(s / 60), 'minute');
  if (s < 86400) return unit(Math.floor(s / 3600), 'hour');
  return unit(Math.floor(s / 86400), 'day');
};

export const restoreDraft = (session: EditorSession, draft: Draft): void => {
  // restored drafts are unsaved work: keep them marked dirty
  session.reset(draft.scenario, { dirty: true, publication: draft.publication });
};
