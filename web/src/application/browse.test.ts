import { describe, expect, it } from 'vitest';
import {
  boardSizeText,
  browseSearch,
  deploymentText,
  EMPTY_BROWSE_QUERY,
  isFiltered,
  parseBrowseQuery,
} from './browse';

describe('browse query in the address', () => {
  it('round-trips every filter', () => {
    const q = {
      q: 'mesa',
      size: 'standard' as const,
      deployment: 'carriers' as const,
      squad: 4,
      elevation: true,
      sort: 'updated' as const,
    };
    const s = browseSearch(q);
    expect(s).toBe('?q=mesa&size=standard&deployment=carriers&squad=4&elevation=1&sort=updated');
    expect(parseBrowseQuery(s)).toEqual(q);
  });

  it('leaves defaults out', () => {
    expect(browseSearch(EMPTY_BROWSE_QUERY)).toBe('');
    expect(isFiltered(EMPTY_BROWSE_QUERY)).toBe(false);
    expect(isFiltered({ ...EMPTY_BROWSE_QUERY, q: '  ' })).toBe(false);
    expect(isFiltered({ ...EMPTY_BROWSE_QUERY, elevation: true })).toBe(true);
  });

  it('drops invalid values instead of sending them', () => {
    expect(
      parseBrowseQuery('?size=huge&deployment=boats&squad=11&sort=random&elevation=yes'),
    ).toEqual(EMPTY_BROWSE_QUERY);
    expect(parseBrowseQuery(`?q=${'x'.repeat(80)}`).q).toHaveLength(60);
  });
});

describe('card words', () => {
  it('describes board size and deployment', () => {
    expect(boardSizeText({ width: 15, height: 15, hexCount: 225 })).toBe('15 × 15');
    expect(boardSizeText({ width: 0, height: 0, hexCount: 120 })).toBe('120 hexes');
    expect(deploymentText('bases')).toBe('Bases');
    expect(deploymentText('carriers')).toBe('Carriers');
  });
});
