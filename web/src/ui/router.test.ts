import { describe, expect, it } from 'vitest';
import { parseRoute } from './router';

describe('parseRoute', () => {
  it.each([
    ['', { page: 'editor', importLink: null }],
    ['#', { page: 'editor', importLink: null }],
    ['#/', { page: 'editor', importLink: null }],
    ['#/nonsense', { page: 'editor', importLink: null }],
    ['#/view/', { page: 'editor', importLink: null }],
    ['#/view/1.abc', { page: 'sheet', link: '1.abc' }],
    ['#/edit/1.abc', { page: 'editor', importLink: '1.abc' }],
  ])('%s', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });
});
