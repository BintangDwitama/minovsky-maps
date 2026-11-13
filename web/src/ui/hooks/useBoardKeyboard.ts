import {
  type FocusEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { PointerKind, ToolId } from '../../application/uiState';
import { type CursorDirection, startCursor, stepCursor } from '../../domain/boardCursor';
import { componentText, describeHex, hexText } from '../../domain/boardDescription';
import { type Axial, axialToPixel } from '../../domain/hex';
import { buildIndex, componentsAt } from '../../domain/scenarioIndex';
import { analysisText } from '../analysisText';
import { buildAnalysisResult } from './useAnalysis';
import type { Tool, ToolContext } from '../tools/tools';
import type { Point } from '../viewport';

const ARROWS: Record<string, CursorDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/** Tools whose Shift+arrow stroke paints every hex the cursor passes. */
const STROKE_TOOLS = new Set<ToolId>(['terrain', 'erase', 'raise', 'lower', 'setLevel']);

export interface BoardKeyboardOptions {
  tool: Tool;
  toolId: ToolId;
  ctx: ToolContext;
  pointerRef: MutableRefObject<PointerKind>;
  announce(text: string): void;
  svgRef: RefObject<SVGSVGElement | null>;
  hexSize: number;
  toView(clientX: number, clientY: number): Point | null;
}

/**
 * Keyboard control of the board, through the same Tool interface the mouse uses:
 * arrows move a cursor (which acts as hover), Enter = click, Shift+arrows = drag stroke,
 * Select: Enter picks up / drops a component. Escape or losing focus cancels an open stroke.
 */
export function useBoardKeyboard({
  tool,
  toolId,
  ctx,
  pointerRef,
  announce,
  svgRef,
  hexSize,
  toView,
}: BoardKeyboardOptions) {
  const { ui, session } = ctx;
  const mode = useRef<'idle' | 'stroke' | 'carry'>('idle');
  /** Scenario when the current Shift stroke began (to tell whether it changed anything). */
  const strokeBase = useRef<unknown>(null);
  const [focused, setFocused] = useState(false);

  // switching tool (e.g. a letter shortcut) mid-stroke cancels it with the tool that started it
  useEffect(
    () => () => {
      if (mode.current !== 'idle') {
        tool.onCancel(ctx);
        mode.current = 'idle';
      }
    },
    [tool, ctx],
  );

  const describe = (h: Axial): string => {
    const s = session.scenario;
    const text = describeHex(buildIndex(s), h);
    const u = ui.current;
    if (u.tool !== 'analyse' || !u.analysis.probe) return text;
    const a = analysisText(buildAnalysisResult(s, u.analysis), u.analysis, h);
    return a ? `${text} ${a}.` : text;
  };

  const setCursor = (h: Axial) => {
    ui.patch({ cursor: h, hover: h });
    keepInView(h);
  };

  /** Pan so the cursor hex stays visible (with a one-hex margin) when zoomed in. */
  const keepInView = (h: Axial) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const tl = toView(r.left, r.top);
    const br = toView(r.right, r.bottom);
    if (!tl || !br) return;
    const { zoom, pan } = ui.current;
    const b = axialToPixel(h, hexSize);
    const p = { x: pan.x + zoom * b.x, y: pan.y + zoom * b.y };
    const m = hexSize * zoom * 1.5;
    let dx = 0;
    let dy = 0;
    if (p.x < tl.x + m) dx = tl.x + m - p.x;
    else if (p.x > br.x - m) dx = br.x - m - p.x;
    if (p.y < tl.y + m) dy = tl.y + m - p.y;
    else if (p.y > br.y - m) dy = br.y - m - p.y;
    if (dx || dy) ui.patch({ pan: { x: pan.x + dx, y: pan.y + dy } });
  };

  const ensureCursor = (): Axial => {
    const idx = buildIndex(session.scenario);
    const cur = ui.current.cursor;
    if (cur && idx.hexes.size && startCursor(idx, cur) === cur) return cur;
    const sel = ui.current.selectedId ? idx.componentById.get(ui.current.selectedId)?.hex : null;
    const h = startCursor(idx, sel);
    setCursor(h);
    return h;
  };

  const markKeyboard = () => {
    pointerRef.current = 'keyboard';
    ui.setPointer('keyboard');
    setFocused(true);
  };

  const onFocus = (e: FocusEvent<SVGSVGElement>) => {
    // keyboard focus only: a mouse click on the board shouldn't show the cursor
    if (!e.currentTarget.matches(':focus-visible')) return;
    markKeyboard();
    announce(describe(ensureCursor()));
  };

  const onBlur = () => {
    setFocused(false);
    if (mode.current !== 'idle') {
      tool.onCancel(ctx);
      mode.current = 'idle';
    }
  };

  const changedLabel = (before: unknown) =>
    session.scenario !== before ? session.getSnapshot().undoLabel : null;

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const dir = ARROWS[e.key];
    if (dir) {
      e.preventDefault();
      markKeyboard();
      const from = ensureCursor();
      if (e.shiftKey && mode.current === 'idle' && STROKE_TOOLS.has(toolId)) {
        strokeBase.current = session.scenario;
        tool.onDown(from, ctx);
        mode.current = 'stroke';
      }
      const step = stepCursor(buildIndex(session.scenario), from, dir);
      if (step.edge) {
        announce('Edge of the board.');
        return;
      }
      if (mode.current !== 'idle') tool.onMove(step.hex, ctx);
      setCursor(step.hex);
      announce(describe(step.hex));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      markKeyboard();
      const h = ensureCursor();
      if (mode.current === 'carry') {
        const id = ui.current.selectedId;
        tool.onUp(ctx);
        mode.current = 'idle';
        const c = id ? session.scenario.components.find((x) => x.id === id) : undefined;
        // the move happens while carrying, so compare with the scenario at pick-up
        announce(
          c && session.scenario !== strokeBase.current
            ? `Moved ${componentText(c)} to ${hexText(c.hex)}.`
            : 'Dropped.',
        );
        return;
      }
      if (mode.current === 'stroke') return;
      if (toolId === 'select') {
        const here = componentsAt(buildIndex(session.scenario), h);
        strokeBase.current = session.scenario;
        tool.onDown(h, ctx);
        if (here.length) {
          mode.current = 'carry';
          const id = ui.current.selectedId;
          const c = here.find((x) => x.id === id) ?? here.at(-1)!;
          announce(
            `Picked up ${componentText(c)}. Arrows move it, Enter drops it, Escape puts it back.`,
          );
        } else {
          tool.onUp(ctx);
          announce('Nothing to pick up here.');
        }
        return;
      }
      const before = session.scenario;
      const probeBefore = ui.current.analysis.probe;
      tool.onDown(h, ctx);
      tool.onUp(ctx);
      if (toolId === 'analyse') {
        announce(probeBefore ? `Probe moved to ${hexText(h)}.` : `Probe placed on ${hexText(h)}.`);
        return;
      }
      const label = changedLabel(before);
      // a refusal is announced from the status message; otherwise say what happened
      if (label) announce(`${label}. ${describe(h)}`);
      else if (!ui.current.message) announce(`No change. ${describe(h)}`);
      return;
    }

    if (e.key === 'Escape' && mode.current !== 'idle') {
      e.preventDefault();
      e.stopPropagation(); // don't also reset the tool (the page-level Escape)
      const carrying = mode.current === 'carry';
      tool.onCancel(ctx);
      mode.current = 'idle';
      announce(carrying ? 'Put back.' : 'Cancelled.');
    }
  };

  const onKeyUp = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'Shift' || mode.current !== 'stroke') return;
    tool.onUp(ctx);
    mode.current = 'idle';
    const cur = ui.current.cursor;
    if (session.scenario !== strokeBase.current) {
      announce(
        `${session.getSnapshot().undoLabel ?? 'Edit'} done.${cur ? ` ${describe(cur)}` : ''}`,
      );
    } else {
      announce('No change.');
    }
  };
  return { focused, onFocus, onBlur, onKeyDown, onKeyUp };
}
