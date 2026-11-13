import { describe, expect, it } from 'vitest';
import {
  clampZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  pinch,
  type Point,
  type View,
  zoomAround,
} from './viewport';

const at = (v: View, b: Point): Point => ({ x: v.pan.x + v.zoom * b.x, y: v.pan.y + v.zoom * b.y });
const boardAt = (v: View, p: Point): Point => ({
  x: (p.x - v.pan.x) / v.zoom,
  y: (p.y - v.pan.y) / v.zoom,
});
const start: View = { zoom: 1.5, pan: { x: 20, y: -10 } };

describe('viewport', () => {
  it('clamps zoom', () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM);
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(2)).toBe(2);
  });

  it('zoomAround keeps the focus point fixed', () => {
    const focus = { x: 300, y: 200 };
    const b = boardAt(start, focus);
    const v = zoomAround(start, 2, focus);
    expect(v.zoom).toBe(3);
    expect(at(v, b).x).toBeCloseTo(focus.x);
    expect(at(v, b).y).toBeCloseTo(focus.y);
  });

  it('zoomAround at the limit returns the same view', () => {
    const v = { zoom: MAX_ZOOM, pan: { x: 0, y: 0 } };
    expect(zoomAround(v, 2, { x: 1, y: 1 })).toBe(v);
  });

  it('pinch: distance ratio sets zoom and the midpoint stays under the fingers', () => {
    const before: [Point, Point] = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ];
    const after: [Point, Point] = [
      { x: 50, y: 100 },
      { x: 250, y: 100 },
    ];
    const b = boardAt(start, { x: 150, y: 100 });
    const v = pinch(start, before, after);
    expect(v.zoom).toBeCloseTo(3);
    expect(at(v, b).x).toBeCloseTo(150);
    expect(at(v, b).y).toBeCloseTo(100);
  });

  it('pinch: moving both fingers together pans', () => {
    const v = pinch(
      start,
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      [
        { x: 30, y: 40 },
        { x: 40, y: 40 },
      ],
    );
    expect(v.zoom).toBe(start.zoom);
    expect(v.pan.x).toBeCloseTo(start.pan.x + 30);
    expect(v.pan.y).toBeCloseTo(start.pan.y + 40);
  });

  it('pinch: zoom is clamped', () => {
    const v = pinch(
      { zoom: 4, pan: { x: 0, y: 0 } },
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    );
    expect(v.zoom).toBe(MAX_ZOOM);
  });

  it('panBy adds the delta', () => {
    expect(panBy(start, 5, 6).pan).toEqual({ x: 25, y: -4 });
  });
});
