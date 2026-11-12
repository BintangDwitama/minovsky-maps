import { describe, expect, it } from 'vitest';
import {
  axialToOffset,
  axialToPixel,
  distance,
  hexKey,
  neighbor,
  neighbors,
  offsetToAxial,
  opposite,
  parseHexKey,
  pixelToAxial,
  rectangleHexes,
  toDirection,
} from './hex';

describe('keys and directions', () => {
  it('round-trips hex keys', () => {
    expect(parseHexKey(hexKey({ q: -3, r: 7 }))).toEqual({ q: -3, r: 7 });
  });

  it('direction 0 is north and directions go clockwise', () => {
    const o = { q: 0, r: 0 };
    expect(neighbor(o, 0)).toEqual({ q: 0, r: -1 });
    expect(neighbor(o, 1)).toEqual({ q: 1, r: -1 });
    expect(neighbor(o, 3)).toEqual({ q: 0, r: 1 });
  });

  it('opposite directions cancel out', () => {
    for (let d = 0; d < 6; d++) {
      const dir = toDirection(d);
      const there = neighbor({ q: 2, r: 2 }, dir);
      expect(neighbor(there, opposite(dir))).toEqual({ q: 2, r: 2 });
    }
  });

  it('toDirection wraps negatives and overflow', () => {
    expect(toDirection(-1)).toBe(5);
    expect(toDirection(7)).toBe(1);
  });

  it('every neighbour is at distance 1', () => {
    for (const n of neighbors({ q: 4, r: -2 })) expect(distance({ q: 4, r: -2 }, n)).toBe(1);
  });
});

describe('odd-q offset', () => {
  it('round-trips offset <-> axial', () => {
    for (let col = 0; col < 15; col++) {
      for (let row = 0; row < 15; row++) {
        expect(axialToOffset(offsetToAxial({ col, row }))).toEqual({ col, row });
      }
    }
  });

  it('15x15 template has 225 unique hexes', () => {
    const hexes = rectangleHexes(15, 15);
    expect(hexes).toHaveLength(225);
    expect(new Set(hexes.map(hexKey)).size).toBe(225);
  });

  it('column 0 sits higher than column 1 (odd-q)', () => {
    const size = 10;
    const c0 = axialToPixel(offsetToAxial({ col: 0, row: 0 }), size);
    const c1 = axialToPixel(offsetToAxial({ col: 1, row: 0 }), size);
    expect(c0.y).toBeLessThan(c1.y);
  });

  it('12x18 has 216 hexes', () => {
    expect(rectangleHexes(12, 18)).toHaveLength(216);
  });
});

describe('pixel conversion', () => {
  it('origin hex is at (0,0)', () => {
    expect(axialToPixel({ q: 0, r: 0 }, 20)).toEqual({ x: 0, y: 0 });
  });

  it('round-trips hex centres through pixel space', () => {
    for (const h of rectangleHexes(8, 8)) {
      expect(pixelToAxial(axialToPixel(h, 24), 24)).toEqual(h);
    }
  });

  it('points slightly off-centre still resolve to the same hex', () => {
    const h = { q: 3, r: 1 };
    const c = axialToPixel(h, 30);
    expect(pixelToAxial({ x: c.x + 10, y: c.y - 8 }, 30)).toEqual(h);
  });
});
