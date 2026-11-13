import { type RefObject, useCallback, useEffect, useRef } from 'react';
import { panBy, pinch, type Point, type View, zoomAround } from '../viewport';

export interface BoardViewportOptions {
  svgRef: RefObject<SVGSVGElement | null>;
  getView(): View;
  setView(v: View): void;
  /** The svg viewBox; zoom buttons zoom around its centre. */
  bounds: { minX: number; minY: number; width: number; height: number };
}

interface PointerLike {
  pointerId: number;
  clientX: number;
  clientY: number;
}

export interface BoardViewport {
  /** Client point -> svg viewBox point. */
  toView(clientX: number, clientY: number): Point | null;
  zoomAt(factor: number, focus?: Point): void;
  fit(): void;
  /** Start tracking a pressed pointer; returns how many pointers are now down. */
  track(e: PointerLike): number;
  /** Let a tracked pointer pan the board (one-finger, middle or Space drag). */
  startPan(pointerId: number): void;
  /** Feed a pointer move; true when the viewport used it (pan or pinch). */
  move(e: PointerLike): boolean;
  release(pointerId: number): void;
  /** Pointers currently down. */
  count(): number;
}

/**
 * Zoom, pan and pinch for an svg board. Two tracked pointers always pinch (and pan by their
 * midpoint); a single pointer pans only after `startPan`. The wheel zooms at the cursor.
 */
export function useBoardViewport(opts: BoardViewportOptions): BoardViewport {
  const latest = useRef(opts);
  latest.current = opts;
  const pointers = useRef(new Map<number, Point>());
  const panners = useRef(new Set<number>());

  const toView = useCallback((clientX: number, clientY: number): Point | null => {
    const m = latest.current.svgRef.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const zoomAt = useCallback((factor: number, focus?: Point) => {
    const { getView, setView, bounds } = latest.current;
    const f = focus ?? { x: bounds.minX + bounds.width / 2, y: bounds.minY + bounds.height / 2 };
    const v = getView();
    const next = zoomAround(v, factor, f);
    if (next !== v) setView(next);
  }, []);

  const fit = useCallback(() => latest.current.setView({ zoom: 1, pan: { x: 0, y: 0 } }), []);

  const track = useCallback(
    (e: PointerLike) => {
      const p = toView(e.clientX, e.clientY);
      if (p) pointers.current.set(e.pointerId, p);
      return pointers.current.size;
    },
    [toView],
  );

  const startPan = useCallback((id: number) => void panners.current.add(id), []);

  const move = useCallback(
    (e: PointerLike) => {
      const map = pointers.current;
      const prev = map.get(e.pointerId);
      if (!prev) return false;
      const next = toView(e.clientX, e.clientY);
      if (!next) return false;
      const { getView, setView } = latest.current;
      if (map.size >= 2) {
        const [a, b] = [...map.keys()] as [number, number];
        if (e.pointerId === a || e.pointerId === b) {
          const pa = map.get(a)!;
          const pb = map.get(b)!;
          const after: [Point, Point] = e.pointerId === a ? [next, pb] : [pa, next];
          setView(pinch(getView(), [pa, pb], after));
        }
        map.set(e.pointerId, next);
        return true;
      }
      map.set(e.pointerId, next);
      if (panners.current.has(e.pointerId)) {
        setView(panBy(getView(), next.x - prev.x, next.y - prev.y));
        return true;
      }
      return false;
    },
    [toView],
  );

  const release = useCallback((id: number) => {
    pointers.current.delete(id);
    panners.current.delete(id);
  }, []);

  const count = useCallback(() => pointers.current.size, []);

  // React's onWheel is passive; zoom with a native non-passive listener so the page doesn't scroll
  useEffect(() => {
    const el = opts.svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = toView(e.clientX, e.clientY);
      if (f) zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, f);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [opts.svgRef, toView, zoomAt]);

  return { toView, zoomAt, fit, track, startPan, move, release, count };
}
