import { describe, expect, it } from 'vitest';
import { parseRoute } from './router';

const editor = { page: 'editor', importLink: null, publishedId: null };

describe('parseRoute', () => {
  it.each([
    ['/', '', editor],
    ['/', '#', editor],
    ['/', '#/', editor],
    ['/', '#/nonsense', editor],
    ['/', '#/view/', editor],
    ['/', '#/view/1.abc', { page: 'sheet', link: '1.abc' }],
    ['/', '#/edit/1.abc', { page: 'editor', importLink: '1.abc', publishedId: null }],
    [
      '/',
      '#/edit-published/abcdEFG1',
      { page: 'editor', importLink: null, publishedId: 'abcdEFG1' },
    ],
    ['/s/abcdEFG1', '', { page: 'published', id: 'abcdEFG1', editToken: null }],
    ['/s/abcdEFG1/', '', { page: 'published', id: 'abcdEFG1', editToken: null }],
    ['/s/abcdEFG1', '#edit=tok_en-1', { page: 'published', id: 'abcdEFG1', editToken: 'tok_en-1' }],
    ['/s/abcdEFG1', '#edit=bad token', { page: 'published', id: 'abcdEFG1', editToken: null }],
    ['/s/short', '', editor],
    ['/s/abcdEFG1x', '', editor],
  ])('%s %s', (path, hash, route) => {
    expect(parseRoute(path, hash)).toEqual(route);
  });
});
