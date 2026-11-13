/**
 * Publishing use cases: publish once (as the signed-in account), share a short link, update in
 * place, delete. The API is reached through the ScenarioPublisher port. Scenarios published
 * before accounts are "legacy": they are updated with an edit token from the PublicationStore
 * until the account claims them (see accounts.ts).
 */
import type { Scenario } from '../domain/scenario';
import { loadScenario } from '../domain/serialization';
import type { EditorSession } from './editorSession';
import type {
  ApiFailure,
  CallOptions,
  PublicationStore,
  ReportReason,
  ScenarioPublisher,
} from './ports';
import { saveBlockers } from './useCases';

/** Path of a published scenario's page. */
export const PUBLISHED_PATH = '/s/';

export const shortLink = (appRoot: string, id: string): string =>
  `${appRoot.replace(/\/$/, '')}${PUBLISHED_PATH}${id}`;

export type PublishingResult<T> =
  | ({ ok: true } & T)
  | { ok: false; failure: ApiFailure | 'blocked' | 'no-token'; errors: string[] };

/** What was published or updated. */
export interface PublishedRef {
  readonly id: string;
  readonly name: string;
}

/**
 * Can the open document be updated? Owned scenarios can (the server checks the session);
 * legacy ones only while this browser holds their edit token.
 */
export const canUpdate = (session: EditorSession, store: PublicationStore): boolean => {
  const ref = session.getSnapshot().publication;
  return !!ref && (ref.owned === true || store.get(ref.id) !== null);
};

/** First publish of the open document, owned by the signed-in account. */
export const publishScenario = async (
  session: EditorSession,
  publisher: ScenarioPublisher,
  opts?: CallOptions,
): Promise<PublishingResult<{ publication: PublishedRef }>> => {
  const s = session.scenario;
  const blockers = saveBlockers(s);
  if (blockers.length > 0) return { ok: false, failure: 'blocked', errors: blockers };
  const r = await publisher.publish(s, opts);
  if (!r.ok) return r;
  session.setPublication({ id: r.value.id, owned: true });
  return { ok: true, publication: { id: r.value.id, name: s.meta.name } };
};

/** Store the open document as a new version of its published scenario. */
export const updatePublished = async (
  session: EditorSession,
  publisher: ScenarioPublisher,
  store: PublicationStore,
  opts?: CallOptions,
): Promise<PublishingResult<{ publication: PublishedRef }>> => {
  const s = session.scenario;
  const blockers = saveBlockers(s);
  if (blockers.length > 0) return { ok: false, failure: 'blocked', errors: blockers };
  const ref = session.getSnapshot().publication;
  const legacy = ref && !ref.owned ? store.get(ref.id) : null;
  if (!ref || (!ref.owned && !legacy)) {
    return {
      ok: false,
      failure: 'no-token',
      errors: ['This browser has no edit link for the published scenario.'],
    };
  }
  const r = await publisher.update(ref.id, legacy?.editToken ?? null, s, opts);
  if (!r.ok) return r;
  if (legacy) store.save({ ...legacy, name: s.meta.name });
  return { ok: true, publication: { id: ref.id, name: s.meta.name } };
};

/** Fetch a published scenario and validate it exactly like an opened file. */
export const openPublished = async (
  id: string,
  publisher: ScenarioPublisher,
  opts?: CallOptions,
): Promise<
  PublishingResult<{
    scenario: Scenario;
    updatedAt: string;
    ownerName: string | null;
    isOwner: boolean;
  }>
> => {
  const r = await publisher.fetch(id, opts);
  if (!r.ok) return r;
  const loaded = loadScenario(r.value.scenario);
  if (!loaded.ok) return { ok: false, failure: 'invalid', errors: loaded.errors };
  return {
    ok: true,
    scenario: loaded.scenario,
    updatedAt: r.value.updatedAt,
    ownerName: r.value.owner?.displayName ?? null,
    isOwner: r.value.isOwner,
  };
};

/** Open a published scenario in the editor as that published document (Update available). */
export const editPublished = (
  session: EditorSession,
  id: string,
  s: Scenario,
  owned: boolean,
): void => {
  session.reset(s, { publication: owned ? { id, owned: true } : { id } });
};

/** Take down a scenario the signed-in account owns; unlinks the editor if it was open there. */
export const deletePublished = async (
  session: EditorSession,
  publisher: ScenarioPublisher,
  id: string,
  opts?: CallOptions,
): Promise<PublishingResult<object>> => {
  const r = await publisher.remove(id, opts);
  if (!r.ok) return r;
  if (session.getSnapshot().publication?.id === id) session.setPublication(null);
  return { ok: true };
};

export const REPORT_DETAILS_MAX = 1000;

/** Report a published scenario to the site owner. */
export const reportScenario = async (
  publisher: ScenarioPublisher,
  input: { scenarioId: string; reason: ReportReason | null; details: string },
  opts?: CallOptions,
): Promise<PublishingResult<object>> => {
  if (!input.reason) {
    return { ok: false, failure: 'blocked', errors: ['Choose a reason for the report.'] };
  }
  const details = input.details.trim();
  if ([...details].length > REPORT_DETAILS_MAX) {
    return { ok: false, failure: 'blocked', errors: ['Details can be at most 1,000 characters.'] };
  }
  const r = await publisher.report(
    { scenarioId: input.scenarioId, reason: input.reason, details },
    opts,
  );
  return r.ok ? { ok: true } : r;
};

/** Remember a legacy edit token that arrived through a private edit link. */
export const rememberEditToken = (
  store: PublicationStore,
  id: string,
  token: string,
  name = '',
): void => {
  const existing = store.get(id);
  store.save({ id, editToken: token, name: name || existing?.name || '' });
};
