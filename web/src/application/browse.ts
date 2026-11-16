/**
 * Browse queries live in the page address (`/browse?q=…&size=…`), so a filtered view can be
 * shared and survives a reload. These functions convert between the two; unknown or invalid
 * values are dropped rather than sent to the server.
 */
import type { BrowseItem, BrowseQuery, BrowseSize } from './ports';

export const EMPTY_BROWSE_QUERY: BrowseQuery = {
  q: '',
  size: null,
  deployment: null,
  squad: null,
  elevation: false,
  sort: 'new',
};

const SIZES: readonly BrowseSize[] = ['standard', 'smaller', 'larger'];
export const MAX_SEARCH = 60;

export const parseBrowseQuery = (search: string): BrowseQuery => {
  const p = new URLSearchParams(search);
  const size = p.get('size');
  const deployment = p.get('deployment');
  const squad = Number(p.get('squad'));
  return {
    q: (p.get('q') ?? '').slice(0, MAX_SEARCH),
    size: SIZES.includes(size as BrowseSize) ? (size as BrowseSize) : null,
    deployment: deployment === 'bases' || deployment === 'carriers' ? deployment : null,
    squad: Number.isInteger(squad) && squad >= 1 && squad <= 10 ? squad : null,
    elevation: p.get('elevation') === '1',
    sort: p.get('sort') === 'updated' ? 'updated' : 'new',
  };
};

/** Query string without defaults (empty for the plain Browse page). */
export const browseSearch = (q: BrowseQuery): string => {
  const p = new URLSearchParams();
  const text = q.q.trim();
  if (text) p.set('q', text);
  if (q.size) p.set('size', q.size);
  if (q.deployment) p.set('deployment', q.deployment);
  if (q.squad) p.set('squad', String(q.squad));
  if (q.elevation) p.set('elevation', '1');
  if (q.sort !== 'new') p.set('sort', q.sort);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const isFiltered = (q: BrowseQuery): boolean => browseSearch(q) !== '';

/** "15 × 15" for rectangles, otherwise "120 hexes". */
export const boardSizeText = (it: Pick<BrowseItem, 'width' | 'height' | 'hexCount'>): string =>
  it.width && it.height ? `${it.width} × ${it.height}` : `${it.hexCount} hexes`;

export const deploymentText = (d: string): string =>
  d === 'carriers' ? 'Carriers' : d === 'bases' ? 'Bases' : '';
