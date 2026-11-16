import { useSyncExternalStore } from 'react';
import { EDIT_ROUTE, VIEW_ROUTE } from '../application/shareLink';

/** Route prefix (after `#`) that opens a published scenario in the editor for updating. */
export const EDIT_PUBLISHED_ROUTE = '/edit-published/';

/**
 * Pages (real paths, served by the SPA fallback):
 * - `/` landing page
 * - `/editor[?resume=draft]` editor (resume: restore the draft without asking)
 * - `/browse` public scenarios; `/my` My scenarios
 * - `/s/<id>[#edit=<token>]` published scenario sheet
 * Hash routes, kept so links shared before these paths existed still work:
 * - `#/view/<link>` share-link sheet; `#/edit/<link>` editor importing a share link
 * - `#/edit-published/<id>` editor opening a published scenario
 * - `#/privacy` what we store
 * Any other address shows the landing page.
 */
export type Route =
  | { page: 'landing' }
  | { page: 'editor'; importLink: string | null; publishedId: string | null }
  | { page: 'sheet'; link: string }
  | { page: 'published'; id: string; editToken: string | null }
  | { page: 'privacy' }
  | { page: 'browse' }
  | { page: 'my' };

export const EDITOR_PATH = '/editor';
export const BROWSE_PATH = '/browse';
export const MY_PATH = '/my';
const EDITOR_RE = /^\/editor\/?$/;
const BROWSE_RE = /^\/browse\/?$/;
const MY_RE = /^\/my\/?$/;

/** Route (after `#`) of the privacy note. */
export const PRIVACY_ROUTE = '/privacy';

const PUBLISHED_RE = /^\/s\/([A-Za-z0-9]{8})\/?$/;

export const parseRoute = (pathname: string, hash: string): Route => {
  if (BROWSE_RE.test(pathname)) return { page: 'browse' };
  if (MY_RE.test(pathname)) return { page: 'my' };
  const published = PUBLISHED_RE.exec(pathname);
  if (published) {
    const token = /^#edit=([A-Za-z0-9_-]+)$/.exec(hash)?.[1] ?? null;
    return { page: 'published', id: published[1]!, editToken: token };
  }
  // hash routes first, so links shared before the landing page existed keep working
  const path = hash.replace(/^#/, '');
  if (path === PRIVACY_ROUTE) return { page: 'privacy' };
  if (path.startsWith(VIEW_ROUTE) && path.length > VIEW_ROUTE.length) {
    return { page: 'sheet', link: path.slice(VIEW_ROUTE.length) };
  }
  if (path.startsWith(EDIT_ROUTE) && path.length > EDIT_ROUTE.length) {
    return { page: 'editor', importLink: path.slice(EDIT_ROUTE.length), publishedId: null };
  }
  if (path.startsWith(EDIT_PUBLISHED_ROUTE) && path.length > EDIT_PUBLISHED_ROUTE.length) {
    return {
      page: 'editor',
      importLink: null,
      publishedId: path.slice(EDIT_PUBLISHED_ROUTE.length),
    };
  }
  if (EDITOR_RE.test(pathname)) return { page: 'editor', importLink: null, publishedId: null };
  return { page: 'landing' };
};
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  window.addEventListener('popstate', cb);
  return () => {
    window.removeEventListener('hashchange', cb);
    window.removeEventListener('popstate', cb);
  };
};

const locationKey = () => `${location.pathname}${location.hash}`;

export const useRoute = (): Route => {
  const key = useSyncExternalStore(subscribe, locationKey);
  const hashAt = key.indexOf('#');
  return hashAt < 0 ? parseRoute(key, '') : parseRoute(key.slice(0, hashAt), key.slice(hashAt));
};

export const viewHash = (link: string) => `#${VIEW_ROUTE}${link}`;
export const editHash = (link: string) => `#${EDIT_ROUTE}${link}`;
export const editPublishedHash = (id: string) => `#${EDIT_PUBLISHED_ROUTE}${id}`;

const ROOT = import.meta.env.BASE_URL || '/';

/** Go to a hash route of the app root (also from a `/s/<id>` page) without reloading. */
export const navigate = (hash: string) => {
  if (location.pathname === ROOT) {
    location.hash = hash;
    return;
  }
  history.pushState(null, '', `${ROOT}${hash}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

/** Go to an app path such as `/s/<id>` without reloading. */
export const goToPath = (path: string) => {
  history.pushState(null, '', `${ROOT.replace(/\/$/, '')}${path}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

/** Open the editor (its draft-restore question included). */
export const openEditor = () => goToPath(EDITOR_PATH);

/** Open the editor with the browser's draft, without asking whether to restore it. */
export const resumeDraft = () => goToPath(`${EDITOR_PATH}?resume=draft`);

/** Make the address `/editor` without re-routing (after an import from a hash route). */
export const settleOnEditor = () => {
  history.replaceState(history.state, '', `${ROOT.replace(/\/$/, '')}${EDITOR_PATH}`);
};

/** Change the address without adding a history entry or re-routing. */
export const replaceHashSilently = (hash: string) => {
  history.replaceState(history.state, '', hash || location.pathname + location.search);
};

/** Root address of the running app, used as the base of share and short links. */
export const appAddress = (): string => `${location.origin}${ROOT}`;
