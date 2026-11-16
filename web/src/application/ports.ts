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
  | 'forbidden' // 401/403: missing or wrong legacy edit token
  | 'signed-out' // 401: the action needs a signed-in account
  | 'not-owner' // 403: signed in, but not as the scenario's owner
  | 'rate-limited' // 429
  | 'bot' // the human check failed or couldn't run
  | 'unavailable'; // network error, timeout, 5xx

export type ApiResult<T> =
  { ok: true; value: T } | { ok: false; failure: ApiFailure; errors: string[] };

export interface CallOptions {
  /** Called once if the server has not answered after a few seconds (it may be waking up). */
  onSlow?: () => void;
}

/** Who can see a published scenario: only the owner, anyone with the link, or everyone (Browse). */
export type Visibility = 'private' | 'link' | 'public';

/** A published scenario as read by anyone; `owner` is the verified author of owned scenarios. */
export interface PublishedRead {
  readonly scenario: unknown;
  readonly updatedAt: string;
  readonly owner: { readonly displayName: string } | null;
  /** The signed-in account owns it. */
  readonly isOwner: boolean;
  /** Only told to the owner. */
  readonly visibility: Visibility | null;
}

export interface ScenarioPublisher {
  /** Save online as the signed-in account (the session cookie travels with the request). */
  publish(
    s: Scenario,
    visibility: Visibility,
    opts?: CallOptions,
  ): Promise<ApiResult<{ id: string; updatedAt: string }>>;
  /** Change who can see a scenario the signed-in account owns (same link). */
  setVisibility(id: string, visibility: Visibility): Promise<ApiResult<object>>;
  /** Update as the owner (editToken null) or with a legacy edit token. */
  update(
    id: string,
    editToken: string | null,
    s: Scenario,
    opts?: CallOptions,
  ): Promise<ApiResult<{ updatedAt: string }>>;
  /** The latest version, as an unvalidated document (callers run `loadScenario`). */
  fetch(id: string, opts?: CallOptions): Promise<ApiResult<PublishedRead>>;
  /** Take down a scenario the signed-in account owns. */
  remove(id: string, opts?: CallOptions): Promise<ApiResult<object>>;
  /** Report a published scenario to the site owner. */
  report(input: ReportInput, opts?: CallOptions): Promise<ApiResult<{ received: boolean }>>;
  /** Fire-and-forget request that starts a sleeping server early. Never throws. */
  wake(): void;
}

/* ---------------- accounts (API) ---------------- */

export interface Account {
  readonly id: number;
  readonly displayName: string;
}

export interface AccountStatus {
  /** Sign-in is configured on this server. */
  readonly available: boolean;
  readonly account: Account | null;
}

export interface OwnedScenario {
  readonly id: string;
  readonly name: string;
  readonly visibility: Visibility;
  readonly updatedAt: string;
}

/* ---------------- browse (API) ---------------- */

export type BrowseSize = 'standard' | 'smaller' | 'larger';
export type BrowseSort = 'new' | 'updated';

/** A Browse search; empty fields mean "any". */
export interface BrowseQuery {
  readonly q: string;
  readonly size: BrowseSize | null;
  readonly deployment: 'bases' | 'carriers' | null;
  readonly squad: number | null;
  readonly elevation: boolean;
  readonly sort: BrowseSort;
}

export interface BrowseItem {
  readonly id: string;
  readonly name: string;
  readonly ownerName: string;
  /** 0 when the board is not a full rectangle. */
  readonly width: number;
  readonly height: number;
  readonly hexCount: number;
  readonly deployment: string;
  readonly squadSize: number;
  readonly hasElevation: boolean;
  readonly listedAt: string;
  readonly updatedAt: string;
  /** Unvalidated document, for the thumbnail. */
  readonly scenario: unknown;
}

export interface BrowsePage {
  readonly items: readonly BrowseItem[];
  /** Cursor for the next page, or null when this is the last. */
  readonly next: string | null;
}

export interface ScenarioBrowser {
  browse(q: BrowseQuery, cursor: string | null, opts?: CallOptions): Promise<ApiResult<BrowsePage>>;
}

/** Sign-in with Google and the signed-in account's data. */
export interface AccountService {
  status(opts?: CallOptions): Promise<ApiResult<AccountStatus>>;
  /** Where to send the browser to sign in; it comes back to `returnPath` (an app path). */
  signInUrl(returnPath: string): string;
  signOut(): Promise<ApiResult<object>>;
  rename(displayName: string): Promise<ApiResult<Account>>;
  deleteAccount(): Promise<ApiResult<object>>;
  listOwned(opts?: CallOptions): Promise<ApiResult<OwnedScenario[]>>;
  /** Claim legacy scenarios by their edit tokens; resolves the ids claimed. */
  claim(items: readonly { id: string; token: string }[]): Promise<ApiResult<string[]>>;
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

/** A legacy (pre-accounts) scenario this browser holds an edit token for. */
export interface Publication {
  readonly id: string;
  readonly editToken: string;
  readonly name: string;
}

/** Legacy edit tokens remembered by this browser, until claimed. Implementations must never throw. */
export interface PublicationStore {
  get(id: string): Publication | null;
  save(p: Publication): void;
  list(): Publication[];
  /** Forget the edit token for a scenario (the scenario itself stays published). */
  remove(id: string): void;
}
