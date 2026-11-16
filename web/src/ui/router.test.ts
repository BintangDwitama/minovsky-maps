import { describe, expect, it } from 'vitest';
import { parseRoute } from './router';

const editor = { page: 'editor', importLink: null, publishedId: null };
const landing = { page: 'landing' };

describe('parseRoute', () => {
  it.each([
    ['/', '', landing],
    ['/', '#', landing],
    ['/', '#/', landing],
    ['/', '#/nonsense', landing],
    ['/', '#/view/', landing],
    ['/editor', '', editor],
    ['/editor/', '', editor],
    ['/my', '', { page: 'my' }],
    ['/nowhere', '', landing],
    ['/', '#/view/1.abc', { page: 'sheet', link: '1.abc' }],
    ['/', '#/edit/1.abc', { page: 'editor', importLink: '1.abc', publishedId: null }],
    [
      '/',
      '#/edit-published/abcdEFG1',
      { page: 'editor', importLink: null, publishedId: 'abcdEFG1' },
    ],
    ['/', '#/privacy', { page: 'privacy' }],
    ['/browse', '', { page: 'browse' }],
    ['/browse/', '', { page: 'browse' }],
    ['/s/abcdEFG1', '', { page: 'published', id: 'abcdEFG1', editToken: null }],
    ['/s/abcdEFG1/', '', { page: 'published', id: 'abcdEFG1', editToken: null }],
    ['/s/abcdEFG1', '#edit=tok_en-1', { page: 'published', id: 'abcdEFG1', editToken: 'tok_en-1' }],
    ['/s/abcdEFG1', '#edit=bad token', { page: 'published', id: 'abcdEFG1', editToken: null }],
    ['/s/short', '', landing],
    ['/s/abcdEFG1x', '', landing],
  ])('%s %s', (path, hash, route) => {
    expect(parseRoute(path, hash)).toEqual(route);
  });
});
