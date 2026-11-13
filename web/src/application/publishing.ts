/**
 * Publishing use cases: publish once, share a short link, update in place.
 * The API is reached through the ScenarioPublisher port; edit tokens live in the PublicationStore.
 */
import type { Scenario } from '../domain/scenario';
import { loadScenario } from '../domain/serialization';
import type { EditorSession } from './editorSession';
import type {
  ApiFailure,
  CallOptions,
  Publication,
  PublicationStore,
  ScenarioPublisher,
} from './ports';
import { saveBlockers } from './useCases';

/** Path of a published scenario's page. */
export const PUBLISHED_PATH = '/s/';

export const shortLink = (appRoot: string, id: string): string =>
  `${appRoot.replace(/\/$/, '')}${PUBLISHED_PATH}${id}`;

/** The private edit link: the token travels only in the fragment, never to a server. */
export const privateEditLink = (appRoot: string, id: string, token: string): string =>
  `${shortLink(appRoot, id)}#edit=${token}`;

export type PublishingResult<T> =
  | ({ ok: true } & T)
  | { ok: false; failure: ApiFailure | 'blocked' | 'no-token'; errors: string[] };

/** Can the open document be updated (published, and this browser holds its token)? */
export const editablePublication = (
  session: EditorSession,
  store: PublicationStore,
): Publication | null => {
  const ref = session.getSnapshot().publication;
  return ref ? store.get(ref.id) : null;
};

/** First publish of the open document. */
export const publishScenario = async (
  session: EditorSession,
  publisher: ScenarioPublisher,
  store: PublicationStore,
  opts?: CallOptions,
): Promise<PublishingResult<{ publication: Publication }>> => {
  const s = session.scenario;
  const blockers = saveBlockers(s);
  if (blockers.length > 0) return { ok: false, failure: 'blocked', errors: blockers };
  const r = await publisher.publish(s, opts);
  if (!r.ok) return r;
  const publication = { id: r.value.id, editToken: r.value.editToken, name: s.meta.name };
  store.save(publication);
  session.setPublication({ id: publication.id });
  return { ok: true, publication };
};

/** Store the open document as a new version of its published scenario. */
export const updatePublished = async (
  session: EditorSession,
  publisher: ScenarioPublisher,
  store: PublicationStore,
  opts?: CallOptions,
): Promise<PublishingResult<{ publication: Publication }>> => {
  const s = session.scenario;
  const blockers = saveBlockers(s);
  if (blockers.length > 0) return { ok: false, failure: 'blocked', errors: blockers };
  const pub = editablePublication(session, store);
  if (!pub) {
    return {
      ok: false,
      failure: 'no-token',
      errors: ['This browser has no edit link for the published scenario.'],
    };
  }
  const r = await publisher.update(pub.id, pub.editToken, s, opts);
  if (!r.ok) return r;
  const publication = { ...pub, name: s.meta.name };
  store.save(publication);
  return { ok: true, publication };
};

/** Fetch a published scenario and validate it exactly like an opened file. */
export const openPublished = async (
  id: string,
  publisher: ScenarioPublisher,
  opts?: CallOptions,
): Promise<PublishingResult<{ scenario: Scenario; updatedAt: string }>> => {
  const r = await publisher.fetch(id, opts);
  if (!r.ok) return r;
  const loaded = loadScenario(r.value.scenario);
  if (!loaded.ok) return { ok: false, failure: 'invalid', errors: loaded.errors };
  return { ok: true, scenario: loaded.scenario, updatedAt: r.value.updatedAt };
};

/** Open a published scenario in the editor as that published document (Update available). */
export const editPublished = (session: EditorSession, id: string, s: Scenario): void => {
  session.reset(s, { publication: { id } });
};

/** Remember an edit token that arrived through a private edit link. */
export const rememberEditToken = (
  store: PublicationStore,
  id: string,
  token: string,
  name = '',
): void => {
  const existing = store.get(id);
  store.save({ id, editToken: token, name: name || existing?.name || '' });
};
