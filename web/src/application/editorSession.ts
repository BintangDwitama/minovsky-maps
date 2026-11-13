import type { OpResult } from '../domain/operations';
import type { Scenario } from '../domain/scenario';
import { type Listener, type ReadableStore, Store } from './store';

/** A change to the scenario. Returning the same object means "no change". */
export interface Command {
  readonly label: string;
  apply(s: Scenario): Scenario | OpResult;
}

export type ExecuteResult = { ok: true; changed: boolean } | { ok: false; reason: string };

export interface EditorSnapshot {
  readonly scenario: Scenario;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** True when the scenario differs from the last saved/created/loaded state. */
  readonly dirty: boolean;
  readonly undoLabel: string | null;
  readonly redoLabel: string | null;
  /** True while a transaction (drag stroke / text editing) is open. */
  readonly inTransaction: boolean;
  /** The published scenario this document is (set after Publish or "Edit" of a published one). */
  readonly publication: PublicationRef | null;
}

/** Link between the open document and a published scenario. Never written into scenario files. */
export interface PublicationRef {
  readonly id: string;
  /** Owned by the signed-in account (else a legacy scenario updated with an edit token). */
  readonly owned?: boolean;
}

interface HistoryEntry {
  readonly scenario: Scenario;
  readonly label: string;
}

export const HISTORY_LIMIT = 200;

const unwrap = (r: Scenario | OpResult): ExecuteResult & { scenario?: Scenario } => {
  if ('ok' in r) return r.ok ? { ok: true, changed: true, scenario: r.scenario } : r;
  return { ok: true, changed: true, scenario: r };
};

/**
 * Owns the scenario document and its history. Snapshot-based undo: the domain model is immutable,
 * so history stores previous Scenario references (structural sharing keeps this cheap).
 */
export class EditorSession implements ReadableStore<EditorSnapshot> {
  private current: Scenario;
  private saved: Scenario;
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private tx: { base: Scenario; label: string } | null = null;
  private publication: PublicationRef | null = null;
  private readonly store: Store<EditorSnapshot>;

  constructor(
    initial: Scenario,
    private readonly limit = HISTORY_LIMIT,
  ) {
    this.current = initial;
    this.saved = initial;
    this.store = new Store(this.snapshot());
  }

  /* ---- store ---- */
  getSnapshot = (): EditorSnapshot => this.store.getSnapshot();
  subscribe = (l: Listener): (() => void) => this.store.subscribe(l);
  get scenario(): Scenario {
    return this.current;
  }

  private snapshot(): EditorSnapshot {
    return {
      scenario: this.current,
      canUndo: this.past.length > 0 && !this.tx,
      canRedo: this.future.length > 0 && !this.tx,
      dirty: this.current !== this.saved,
      undoLabel: this.past.at(-1)?.label ?? null,
      redoLabel: this.future.at(-1)?.label ?? null,
      inTransaction: this.tx !== null,
      publication: this.publication,
    };
  }

  private emit(): void {
    this.store.set(this.snapshot());
  }

  private push(entry: HistoryEntry): void {
    this.past.push(entry);
    if (this.past.length > this.limit) this.past.splice(0, this.past.length - this.limit);
    this.future = [];
  }

  /* ---- commands ---- */

  /** Apply a command as one history step (or as part of the open transaction). */
  execute(cmd: Command): ExecuteResult {
    const r = unwrap(cmd.apply(this.current));
    if (!r.ok) return r;
    const next = r.scenario!;
    if (next === this.current) return { ok: true, changed: false };
    if (!this.tx) this.push({ scenario: this.current, label: cmd.label });
    this.current = next;
    this.emit();
    return { ok: true, changed: true };
  }

  /* ---- transactions: one history step for many updates ---- */

  begin(label: string): void {
    if (this.tx) this.commit();
    this.tx = { base: this.current, label };
    this.emit();
  }

  commit(): void {
    if (!this.tx) return;
    const { base, label } = this.tx;
    this.tx = null;
    if (base !== this.current) this.push({ scenario: base, label });
    this.emit();
  }

  cancel(): void {
    if (!this.tx) return;
    this.current = this.tx.base;
    this.tx = null;
    this.emit();
  }

  /* ---- history ---- */

  undo(): void {
    if (this.tx) this.commit();
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push({ scenario: this.current, label: prev.label });
    this.current = prev.scenario;
    this.emit();
  }

  redo(): void {
    if (this.tx) this.commit();
    const next = this.future.pop();
    if (!next) return;
    this.past.push({ scenario: this.current, label: next.label });
    this.current = next.scenario;
    this.emit();
  }

  /* ---- lifecycle ---- */

  /**
   * Replace the document (new / load). Clears history; the new document counts as saved.
   * The link to a published scenario is cleared unless `publication` is given.
   */
  reset(s: Scenario, opts: { dirty?: boolean; publication?: PublicationRef | null } = {}): void {
    this.tx = null;
    this.past = [];
    this.future = [];
    this.current = s;
    this.saved = opts.dirty ? ({} as Scenario) : s;
    this.publication = opts.publication ?? null;
    this.emit();
  }

  /** Link the open document to a published scenario (after a successful publish). */
  setPublication(p: PublicationRef | null): void {
    this.publication = p;
    this.emit();
  }

  markSaved(): void {
    this.saved = this.current;
    this.emit();
  }
}
