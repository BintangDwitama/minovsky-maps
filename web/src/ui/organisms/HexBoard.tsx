import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { type Axial, pixelToAxial } from '../../domain/hex';
import { buildIndex, isOnBoard } from '../../domain/scenarioIndex';
import { IconButton } from '../atoms/Button';
import { useEditor, useServices, useUi } from '../hooks/editorContext';
import { createTools, type ToolContext } from '../tools/tools';
import { BOARD } from '../theme';
import { BoardView, boardBounds } from './BoardView';

const SIZE = BOARD.hexSize;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 5;

/**
 * Interactive board: one pointer handler resolves pixel -> hex and delegates to the active tool.
 * Wheel zooms at the cursor; middle-drag or Space+drag pans.
 */
export function HexBoard({ requestLabel }: { requestLabel: ToolContext['requestLabel'] }) {
  const services = useServices();
  const { session, ui, ids } = services;
  const { scenario } = useEditor();
  const { tool: toolId, selectedId, highlight, hover, zoom, pan } = useUi();
  const tools = useMemo(createTools, []);
  const tool = tools[toolId];
  const ctx = useMemo<ToolContext>(() => ({ session, ui, ids, requestLabel }), [session, ui, ids, requestLabel]);

  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const stroke = useRef<{ kind: 'tool' | 'pan'; pointerId: number; last?: { x: number; y: number } } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  // bounds only depend on board shape, not on every edit
  const bounds = useMemo(() => boardBounds(scenario, SIZE), [scenario.board.hexes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const isTyping = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e)) {
        setSpaceHeld(true);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpaceHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  /** Client point -> board pixel space (accounts for viewBox, zoom and pan). */
  const toBoard = useCallback((clientX: number, clientY: number) => {
    const g = contentRef.current;
    const m = g?.getScreenCTM();
    if (!g || !m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }, []);

  /** Client point -> outer svg (viewBox) space. */
  const toView = useCallback((clientX: number, clientY: number) => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const hexAt = useCallback(
    (e: PointerEvent): Axial | null => {
      const p = toBoard(e.clientX, e.clientY);
      if (!p) return null;
      const h = pixelToAxial(p, SIZE);
      return isOnBoard(buildIndex(session.scenario), h) ? h : null;
    },
    [toBoard, session],
  );

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (stroke.current) return;
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      e.preventDefault();
      stroke.current = { kind: 'pan', pointerId: e.pointerId, last: toView(e.clientX, e.clientY) ?? undefined };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const h = hexAt(e);
    if (!h) {
      if (toolId === 'select') ui.select(null);
      return;
    }
    stroke.current = { kind: 'tool', pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    tool.onDown(h, ctx);
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const s = stroke.current;
    if (s?.kind === 'pan') {
      const p = toView(e.clientX, e.clientY);
      if (p && s.last) {
        const cur = ui.current.pan;
        ui.patch({ pan: { x: cur.x + (p.x - s.last.x), y: cur.y + (p.y - s.last.y) } });
        s.last = p;
      }
      return;
    }
    const h = hexAt(e);
    ui.setHover(h);
    if (s?.kind === 'tool' && h) tool.onMove(h, ctx);
  };

  const endStroke = (e: PointerEvent<SVGSVGElement>) => {
    const s = stroke.current;
    if (!s || s.pointerId !== e.pointerId) return;
    stroke.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (s.kind === 'tool') tool.onUp(ctx);
  };

  const zoomAt = useCallback(
    (factor: number, focus?: { x: number; y: number }) => {
      const { zoom: z, pan: p } = ui.current;
      const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor));
      if (nz === z) return;
      const f = focus ?? { x: bounds.minX + bounds.width / 2, y: bounds.minY + bounds.height / 2 };
      // keep the focus point fixed on screen
      const k = nz / z;
      ui.patch({ zoom: nz, pan: { x: f.x - (f.x - p.x) * k, y: f.y - (f.y - p.y) * k } });
    },
    [ui, bounds],
  );

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    const f = toView(e.clientX, e.clientY);
    if (!f) return;
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, f);
  };

  // React's onWheel is passive; block page scroll with a native non-passive listener
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const block = (e: globalThis.WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', block, { passive: false });
    return () => el.removeEventListener('wheel', block);
  }, []);

  const fit = () => ui.patch({ zoom: 1, pan: { x: 0, y: 0 } });

  // transform keeps the zoom origin at the viewBox origin; pan is in viewBox units
  const transform = `translate(${pan.x} ${pan.y}) scale(${zoom})`;
  const panning = stroke.current?.kind === 'pan' || spaceHeld;

  return (
    <>
      <svg
        ref={svgRef}
        className="board"
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor: panning ? 'grab' : tool.cursor }}
        role="application"
        aria-label="Scenario board"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={() => ui.setHover(null)}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <g transform={transform}>
          <g ref={contentRef}>
            <BoardView scenario={scenario} size={SIZE} selectedId={selectedId} highlight={highlight} hover={hover} />
          </g>
        </g>
      </svg>
      <div className="board__controls">
        <IconButton icon="zoomIn" label="Zoom in" onClick={() => zoomAt(1.25)} />
        <IconButton icon="zoomOut" label="Zoom out" onClick={() => zoomAt(1 / 1.25)} />
        <IconButton icon="fit" label="Fit board" onClick={fit} />
      </div>
    </>
  );
}
