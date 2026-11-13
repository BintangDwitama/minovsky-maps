/**
 * Board viewport math (pure). The board is drawn with `translate(pan) scale(zoom)` inside the
 * svg viewBox, so a board point b appears at view point `pan + zoom * b`. All points here are in
 * viewBox units.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface View {
  readonly zoom: number;
  readonly pan: Point;
}

export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 5;

export const clampZoom = (z: number): number => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

/** Zoom by `factor`, keeping `focus` fixed on screen. */
export function zoomAround(view: View, factor: number, focus: Point): View {
  const zoom = clampZoom(view.zoom * factor);
  if (zoom === view.zoom) return view;
  const k = zoom / view.zoom;
  return {
    zoom,
    pan: { x: focus.x - (focus.x - view.pan.x) * k, y: focus.y - (focus.y - view.pan.y) * k },
  };
}

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Two-finger gesture step: the distance ratio scales the zoom, and the board point that was under
 * the old midpoint ends up under the new midpoint (so moving both fingers together pans).
 */
export function pinch(
  view: View,
  before: readonly [Point, Point],
  after: readonly [Point, Point],
): View {
  const d0 = dist(before[0], before[1]);
  const d1 = dist(after[0], after[1]);
  const zoom = d0 > 0 && d1 > 0 ? clampZoom(view.zoom * (d1 / d0)) : view.zoom;
  const m0 = mid(before[0], before[1]);
  const m1 = mid(after[0], after[1]);
  const board = { x: (m0.x - view.pan.x) / view.zoom, y: (m0.y - view.pan.y) / view.zoom };
  return { zoom, pan: { x: m1.x - board.x * zoom, y: m1.y - board.y * zoom } };
}

/** Pan by a view-space delta. */
export const panBy = (view: View, dx: number, dy: number): View => ({
  zoom: view.zoom,
  pan: { x: view.pan.x + dx, y: view.pan.y + dy },
});
