import { describe, expect, it } from 'vitest';
import { FflateCompressor } from './fflateCompressor';

const c = new FflateCompressor();
const text = (s: string) => new TextEncoder().encode(s);

describe('FflateCompressor', () => {
  it('round-trips data', () => {
    const data = text('hello hex world '.repeat(200));
    const packed = c.deflate(data);
    expect(packed.length).toBeLessThan(data.length);
    expect(c.inflate(packed, 1_000_000)).toEqual(data);
  });

  it('refuses output above the cap (decompression bomb)', () => {
    const bomb = c.deflate(new Uint8Array(5_000_000));
    expect(bomb.length).toBeLessThan(10_000);
    expect(() => c.inflate(bomb, 1_000_000)).toThrow(/exceeds/);
  });

  it('throws on truncated input', () => {
    const packed = c.deflate(text('a scenario that will be cut off '.repeat(50)));
    expect(() => c.inflate(packed.subarray(0, Math.floor(packed.length / 2)), 1_000_000)).toThrow();
  });
});
