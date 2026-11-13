import { describe, expect, it } from 'vitest';
import { fromBase64Url, toBase64Url } from './base64url';

const bytes = (...n: number[]) => new Uint8Array(n);

describe('base64url', () => {
  it('uses the URL-safe alphabet without padding', () => {
    expect(toBase64Url(bytes(0xfb, 0xff))).toBe('-_8');
    expect(toBase64Url(bytes(1))).toBe('AQ');
  });

  it('round-trips arbitrary bytes, including large inputs', () => {
    const big = new Uint8Array(100_000).map((_, i) => (i * 31) & 0xff);
    for (const b of [bytes(), bytes(0), bytes(1, 2, 3), bytes(255, 254, 253, 252), big]) {
      expect(fromBase64Url(toBase64Url(b))).toEqual(b);
    }
  });

  it('rejects invalid input', () => {
    expect(fromBase64Url('abc+')).toBeNull(); // standard alphabet char
    expect(fromBase64Url('ab=')).toBeNull(); // padding
    expect(fromBase64Url('a')).toBeNull(); // impossible length
    expect(fromBase64Url('a b')).toBeNull();
  });
});
