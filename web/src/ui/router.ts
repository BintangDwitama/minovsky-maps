import { useSyncExternalStore } from 'react';
import { EDIT_ROUTE, VIEW_ROUTE } from '../application/shareLink';

/** Two pages, routed by the URL fragment so static hosting needs no rewrites. */
export type Route = { page: 'editor'; importLink: string | null } | { page: 'sheet'; link: string };

export const parseRoute = (hash: string): Route => {
  const path = hash.replace(/^#/, '');
  if (path.startsWith(VIEW_ROUTE) && path.length > VIEW_ROUTE.length) {
    return { page: 'sheet', link: path.slice(VIEW_ROUTE.length) };
  }
  if (path.startsWith(EDIT_ROUTE) && path.length > EDIT_ROUTE.length) {
    return { page: 'editor', importLink: path.slice(EDIT_ROUTE.length) };
  }
  return { page: 'editor', importLink: null };
};

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export const useRoute = (): Route =>
  parseRoute(useSyncExternalStore(subscribe, () => location.hash));

export const viewHash = (link: string) => `#${VIEW_ROUTE}${link}`;
export const editHash = (link: string) => `#${EDIT_ROUTE}${link}`;

export const navigate = (hash: string) => {
  location.hash = hash;
};

/** Change the address without adding a history entry or re-routing. */
export const replaceHashSilently = (hash: string) => {
  history.replaceState(history.state, '', hash || location.pathname + location.search);
};

/** Origin + path of the running app, used as the base of share links. */
export const appAddress = (): string => `${location.origin}${location.pathname}`;
