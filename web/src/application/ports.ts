/** Ports: what the application needs from the outside world. Infrastructure implements them. */
import type { Scenario } from '../domain/scenario';

export interface ScenarioFileReader {
  /** Ask the user for a file. Resolves null if cancelled. */
  pick(): Promise<string | null>;
  /** Read a file the user dropped. */
  read(source: Blob): Promise<string>;
}

export interface FileWriter {
  /** Hand a file to the user (download). */
  write(fileName: string, data: Blob): Promise<void>;
}

/** Best-effort autosave. Implementations must never throw. */
export interface DraftStore {
  load(): string | null;
  save(json: string): void;
  clear(): void;
}

export interface ImageExporter {
  /** Render the board (no UI overlays) to a PNG at least `minLongSide` px on its longest side. */
  renderPng(s: Scenario, minLongSide: number): Promise<Blob>;
}

export interface IdGenerator {
  next(): string;
}

/** Raw DEFLATE (no zlib/gzip header). */
export interface Compressor {
  deflate(data: Uint8Array): Uint8Array;
  /** Throws on corrupt input or when the output would exceed `maxBytes`. */
  inflate(data: Uint8Array, maxBytes: number): Uint8Array;
}

export interface Clipboard {
  /** Resolves false (never rejects) when the clipboard can't be written. */
  writeText(text: string): Promise<boolean>;
}

/* ---------------- publishing (API) ---------------- */

/** Why an API call failed; the UI words each kind differently. */
export type ApiFailure =
  | 'invalid' // 400/413/422: the scenario or request was rejected
  | 'not-found' // 404: unknown or taken-down scenario
  | 'forbidden' // 401/403: missing or wrong edit token
  | 'rate-limited' // 429
  | 'bot' // the human check failed or couldn't run
  | 'unavailable'; // network error, timeout, 5xx

export type ApiResult<T> =
  { ok: true; value: T } | { ok: false; failure: ApiFailure; errors: string[] };

export interface CallOptions {
  /** Called once if the server has not answered after a few seconds (it may be waking up). */
  onSlow?: () => void;
}

export interface ScenarioPublisher {
  publish(
    s: Scenario,
    opts?: CallOptions,
  ): Promise<ApiResult<{ id: string; editToken: string; updatedAt: string }>>;
  update(
    id: string,
    editToken: string,
    s: Scenario,
    opts?: CallOptions,
  ): Promise<ApiResult<{ updatedAt: string }>>;
  /** The latest version, as an unvalidated document (callers run `loadScenario`). */
  fetch(
    id: string,
    opts?: CallOptions,
  ): Promise<ApiResult<{ scenario: unknown; updatedAt: string }>>;
  /** Report a published scenario to the site owner. */
  report(input: ReportInput, opts?: CallOptions): Promise<ApiResult<{ received: boolean }>>;
  /** Fire-and-forget request that starts a sleeping server early. Never throws. */
  wake(): void;
}

export type ReportReason = 'official-copy' | 'offensive' | 'spam' | 'broken' | 'other';

export interface ReportInput {
  readonly scenarioId: string;
  readonly reason: ReportReason;
  readonly details: string;
}

/**
 * Proves a person is acting (Cloudflare Turnstile). Resolves a fresh single-use token, or null
 * when no check is configured; rejects when the check can't run (blocked script, failure).
 */
export interface HumanCheck {
  token(): Promise<string | null>;
}

/** A scenario this browser can edit. */
export interface Publication {
  readonly id: string;
  readonly editToken: string;
  readonly name: string;
}

/** Edit tokens remembered by this browser. Implementations must never throw. */
export interface PublicationStore {
  get(id: string): Publication | null;
  save(p: Publication): void;
  list(): Publication[];
  /** Forget the edit token for a scenario (the scenario itself stays published). */
  remove(id: string): void;
}
