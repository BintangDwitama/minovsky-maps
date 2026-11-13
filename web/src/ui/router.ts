import { useSyncExternalStore } from 'react';
import { EDIT_ROUTE, VIEW_ROUTE } from '../application/shareLink';

/** Route prefix (after `#`) that opens a published scenario in the editor for updating. */
export const EDIT_PUBLISHED_ROUTE = '/edit-published/';

/**
 * Pages:
 * - `/s/<id>[#edit=<token>]` published scenario sheet (a real path: short and stable)
 * - `#/view/<link>` share-link sheet; `#/edit/<link>` editor importing a share link
 * - `#/edit-published/<id>` editor opening a published scenario
 * - anything else: the editor
 */
export type Route =
  | { page: 'editor'; importLink: string | null; publishedId: string | null }
  | { page: 'sheet'; link: string }
  | { page: 'published'; id: string; editToken: string | null };

const PUBLISHED_RE = /^\/s\/([A-Za-z0-9]{8})\/?$/;

export const parseRoute = (pathname: string, hash: string): Route => {
  const published = PUBLISHED_RE.exec(pathname);
  if (published) {
    const token = /^#edit=([A-Za-z0-9_-]+)$/.exec(hash)?.[1] ?? null;
    return { page: 'published', id: published[1]!, editToken: token };
  }
  const path = hash.replace(/^#/, '');
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
  return { page: 'editor', importLink: null, publishedId: null };
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

/** Change the address without adding a history entry or re-routing. */
export const replaceHashSilently = (hash: string) => {
  history.replaceState(history.state, '', hash || location.pathname + location.search);
};

/** Root address of the running app, used as the base of share and short links. */
export const appAddress = (): string => `${location.origin}${ROOT}`;
