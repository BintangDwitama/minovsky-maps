import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { PointerKind } from '../../application/uiState';
import { type Axial, pixelToAxial } from '../../domain/hex';
import { rectangleSize } from '../../domain/scenario';
import { buildIndex, isOnBoard } from '../../domain/scenarioIndex';
import { IconButton } from '../atoms/Button';
import { useEditor, useServices, useUi } from '../hooks/editorContext';
import { useBoardViewport } from '../hooks/useBoardViewport';
import { createTools, type ToolContext } from '../tools/tools';
import { BOARD } from '../theme';
import { AnalysisOverlay } from './AnalysisOverlay';
import { BoardView, boardBounds } from './BoardView';

const SIZE = BOARD.hexSize;
/** Touch: a finger commits to a tool stroke after moving this far (CSS px) or after HOLD_MS. */
const SLOP_PX = 6;
const HOLD_MS = 120;

type Stroke =
  /** touch, not yet committed: a second finger now means pan/zoom and the tool never runs */
  | { kind: 'pending'; pointerId: number; hex: Axial; x: number; y: number; timer: number | null }
  | { kind: 'tool'; pointerId: number }
  | { kind: 'pan'; pointerId: number }
  /** two or more fingers: pinch/pan until all are lifted */
  | { kind: 'gesture' };

const pointerKind = (e: PointerEvent): PointerKind =>
  e.pointerType === 'touch' ? 'touch' : 'mouse';

/**
 * Interactive board: resolves pointer -> hex and delegates to the active tool.
 * Mouse: wheel zooms at the cursor; middle-drag or Space+drag pans.
 * Touch: one finger runs the tool (after a short commit, see SLOP_PX/HOLD_MS); two fingers pan and
 * pinch; a second finger during a stroke cancels it without history.
 */
export function HexBoard({ requestLabel }: { requestLabel: ToolContext['requestLabel'] }) {
  const services = useServices();
  const { session, ui, ids } = services;
  const { scenario } = useEditor();
  const { tool: toolId, selectedId, highlight, hover, zoom, pan, analysis } = useUi();
  const tools = useMemo(createTools, []);
  const tool = tools[toolId];
  const pointerRef = useRef<PointerKind>('mouse');
  const ctx = useMemo<ToolContext>(
    () => ({
      session,
      ui,
      ids,
      requestLabel,
      get pointer() {
        return pointerRef.current;
      },
    }),
    [session, ui, ids, requestLabel],
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const stroke = useRef<Stroke | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  // bounds only depend on board shape, not on every edit
  const bounds = useMemo(() => boardBounds(scenario, SIZE), [scenario.board.hexes]); // eslint-disable-line react-hooks/exhaustive-deps

  const vp = useBoardViewport({
    svgRef,
    bounds,
    getView: () => ui.current,
    setView: (v) => ui.patch({ zoom: v.zoom, pan: v.pan }),
  });

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

  // a pending touch must not outlive the board
  useEffect(
    () => () => {
      const s = stroke.current;
      if (s?.kind === 'pending' && s.timer !== null) clearTimeout(s.timer);
    },
    [],
  );

  const hexAtClient = useCallback(
    (clientX: number, clientY: number): Axial | null => {
      const m = contentRef.current?.getScreenCTM();
      if (!m) return null;
      const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
      const h = pixelToAxial({ x: p.x, y: p.y }, SIZE);
      return isOnBoard(buildIndex(session.scenario), h) ? h : null;
    },
    [session],
  );

  /** Start the tool on `hex` (or pan, when the tool asks for it). */
  const beginTool = (pointerId: number, hex: Axial) => {
    if (tool.onDown(hex, ctx) === 'pan') {
      vp.startPan(pointerId);
      stroke.current = { kind: 'pan', pointerId };
    } else {
      stroke.current = { kind: 'tool', pointerId };
    }
  };

  /** Turn a pending touch into a stroke; `to` is where the finger is now. */
  const commitPending = (to?: Axial | null) => {
    const s = stroke.current;
    if (s?.kind !== 'pending') return;
    if (s.timer !== null) clearTimeout(s.timer);
    beginTool(s.pointerId, s.hex);
    if (to && stroke.current?.kind === 'tool') tool.onMove(to, ctx);
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    const kind = pointerKind(e);
    pointerRef.current = kind;
    ui.setPointer(kind);
    const count = vp.track(e);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (count >= 2) {
      // another finger: whatever the first one started becomes a pan/pinch
      const s = stroke.current;
      if (s?.kind === 'pending' && s.timer !== null) clearTimeout(s.timer);
      if (s?.kind === 'tool') tool.onCancel(ctx);
      stroke.current = { kind: 'gesture' };
      return;
    }
    if (stroke.current) return;

    if (kind === 'mouse') {
      if (e.button === 1 || (e.button === 0 && spaceHeld)) {
        e.preventDefault();
        vp.startPan(e.pointerId);
        stroke.current = { kind: 'pan', pointerId: e.pointerId };
        return;
      }
      if (e.button !== 0) return;
      const h = hexAtClient(e.clientX, e.clientY);
      if (!h) {
        if (toolId === 'select') ui.select(null);
        return;
      }
      beginTool(e.pointerId, h);
      return;
    }

    // touch: off the board a finger just pans
    const h = hexAtClient(e.clientX, e.clientY);
    if (!h) {
      vp.startPan(e.pointerId);
      stroke.current = { kind: 'pan', pointerId: e.pointerId };
      return;
    }
    ui.setHover(h);
    // tap tools wait for lift or movement; stroke tools also commit after holding still
    const timer = tool.onTap ? null : window.setTimeout(() => commitPending(), HOLD_MS);
    stroke.current = {
      kind: 'pending',
      pointerId: e.pointerId,
      hex: h,
      x: e.clientX,
      y: e.clientY,
      timer,
    };
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (vp.move(e)) return; // pinch or pan
    const s = stroke.current;
    if (s?.kind === 'gesture' || s?.kind === 'pan') return;
    const touch = e.pointerType === 'touch';
    if (s?.kind === 'pending') {
      if (s.pointerId !== e.pointerId) return;
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < SLOP_PX) return;
      const h = hexAtClient(e.clientX, e.clientY);
      commitPending(h);
      if (h && stroke.current?.kind === 'tool') ui.setHover(h);
      return;
    }
    if (touch && !s) return;
    const h = hexAtClient(e.clientX, e.clientY);
    // during a probe drag the analyse tool clears hover itself
    if (!(toolId === 'analyse' && touch)) ui.setHover(h);
    if (s?.kind === 'tool' && s.pointerId === e.pointerId && h) tool.onMove(h, ctx);
  };

  const endStroke = (e: PointerEvent<SVGSVGElement>, cancelled: boolean) => {
    vp.release(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    const s = stroke.current;
    if (!s) return;
    if (s.kind === 'gesture') {
      if (vp.count() === 0) stroke.current = null;
      return;
    }
    if (s.pointerId !== e.pointerId) return;
    stroke.current = null;
    if (s.kind === 'pending') {
      if (s.timer !== null) clearTimeout(s.timer);
      if (cancelled) return;
      // a tap: tap tools get onTap, stroke tools a one-hex stroke
      if (tool.onTap) tool.onTap(s.hex, ctx);
      else if (tool.onDown(s.hex, ctx) !== 'pan') tool.onUp(ctx);
      return;
    }
    if (s.kind === 'tool') {
      if (cancelled) tool.onCancel(ctx);
      else tool.onUp(ctx);
    }
  };

  // transform keeps the zoom origin at the viewBox origin; pan is in viewBox units
  const transform = `translate(${pan.x} ${pan.y}) scale(${zoom})`;
  const deckSize = useMemo(() => rectangleSize(scenario), [scenario]);
  const panning = stroke.current?.kind === 'pan' || spaceHeld;

  return (
    <>
      <svg
        ref={svgRef}
        className="block size-full touch-none select-none"
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor: panning ? 'grab' : tool.cursor }}
        role="application"
        aria-label="Scenario board"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endStroke(e, false)}
        onPointerCancel={(e) => endStroke(e, true)}
        onPointerLeave={(e) => e.pointerType !== 'touch' && ui.setHover(null)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <g transform={transform}>
          <g ref={contentRef}>
            <BoardView
              scenario={scenario}
              size={SIZE}
              selectedId={selectedId}
              highlight={highlight}
              hover={hover}
            />
            {toolId === 'analyse' ? (
              <AnalysisOverlay scenario={scenario} analysis={analysis} hover={hover} size={SIZE} />
            ) : null}
          </g>
        </g>
      </svg>
      {/* deck stencil: states the board size; the settings panel says the same for screen readers */}
      <div
        className="pointer-events-none absolute bottom-3 left-4 text-[28px] leading-none font-extrabold tracking-[0.04em] text-deck-stencil font-stretch-condensed select-none max-[900px]:text-lg"
        aria-hidden
      >
        {deckSize
          ? `Deck ${deckSize.width} × ${deckSize.height}`
          : `Deck: ${scenario.board.hexes.length} hexes`}
      </div>
      <div className="absolute right-2.5 bottom-2.5 flex gap-1">
        <IconButton
          className="bg-panel"
          icon="zoomIn"
          label="Zoom in"
          onClick={() => vp.zoomAt(1.25)}
        />
        <IconButton
          className="bg-panel"
          icon="zoomOut"
          label="Zoom out"
          onClick={() => vp.zoomAt(1 / 1.25)}
        />
        <IconButton className="bg-panel" icon="fit" label="Fit board" onClick={vp.fit} />
      </div>
    </>
  );
}
