/**
 * Share links: the whole scenario travels in the URL fragment as `<codec>.<payload>`,
 * payload = base64url(deflate(JSON(compact scenario))).
 */
import { fromBase64Url, toBase64Url } from '../domain/base64url';
import { fromCompact, LINK_CODEC_VERSION, toCompact } from '../domain/linkCodec';
import type { Scenario } from '../domain/scenario';
import { loadScenario } from '../domain/serialization';
import type { EditorSession } from './editorSession';
import type { Compressor } from './ports';
import { saveBlockers } from './useCases';

/** Route prefix of the sheet page, after `#`. */
export const VIEW_ROUTE = '/view/';
/** Route prefix that opens a shared scenario in the editor as a copy. */
export const EDIT_ROUTE = '/edit/';
/** Links longer than this may not fit in one chat message (Discord: 2,000 characters). */
export const LONG_LINK_LENGTH = 1900;
/** Upper bound for decompressed link data (guards against decompression bombs). */
export const MAX_LINK_BYTES = 1_000_000;

/** `<codec>.<payload>`: the part of a link after the route prefix. */
export const encodeScenarioLink = (s: Scenario, compressor: Compressor): string => {
  const json = JSON.stringify(toCompact(s));
  const packed = compressor.deflate(new TextEncoder().encode(json));
  return `${LINK_CODEC_VERSION}.${toBase64Url(packed)}`;
};

export type CreateShareLinkResult =
  { ok: true; link: string; long: boolean } | { ok: false; errors: string[] };

/** Build a full share link; refused for the same reasons Save is refused. */
export const createShareLink = (
  s: Scenario,
  appAddress: string,
  compressor: Compressor,
): CreateShareLinkResult => {
  const blockers = saveBlockers(s);
  if (blockers.length > 0) return { ok: false, errors: blockers };
  const link = `${appAddress}#${VIEW_ROUTE}${encodeScenarioLink(s, compressor)}`;
  return { ok: true, link, long: link.length > LONG_LINK_LENGTH };
};

export type OpenLinkFailure = 'newer' | 'damaged' | 'invalid';
export type OpenLinkResult =
  { ok: true; scenario: Scenario } | { ok: false; reason: OpenLinkFailure; errors: string[] };

/** Decode and fully validate `<codec>.<payload>`. Never throws. */
export const openScenarioLink = (part: string, compressor: Compressor): OpenLinkResult => {
  const dot = part.indexOf('.');
  const version = dot > 0 ? Number(part.slice(0, dot)) : NaN;
  if (!Number.isInteger(version) || version < 1) {
    return {
      ok: false,
      reason: 'damaged',
      errors: ['The link has no recognisable format version.'],
    };
  }
  if (version > LINK_CODEC_VERSION) {
    return {
      ok: false,
      reason: 'newer',
      errors: [`Link format ${version} is newer than this app.`],
    };
  }

  let value: unknown;
  try {
    const bytes = fromBase64Url(decodeURIComponent(part.slice(dot + 1)));
    if (!bytes || bytes.length === 0) throw new Error('not base64url');
    const json = new TextDecoder('utf-8', { fatal: true }).decode(
      compressor.inflate(bytes, MAX_LINK_BYTES),
    );
    value = JSON.parse(json);
  } catch (e) {
    return { ok: false, reason: 'damaged', errors: [(e as Error).message] };
  }

  const expanded = fromCompact(value);
  if (!expanded.ok) return { ok: false, reason: 'damaged', errors: [expanded.error] };
  const loaded = loadScenario(expanded.doc);
  if (!loaded.ok) return { ok: false, reason: 'invalid', errors: loaded.errors };
  return { ok: true, scenario: loaded.scenario };
};

/** Open a shared scenario in the editor as a new, unsaved document with no history. */
export const editSharedCopy = (session: EditorSession, s: Scenario): void => {
  session.reset(s, { dirty: true });
};
