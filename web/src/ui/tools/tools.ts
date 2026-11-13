/**
 * Editor tools. HexBoard only knows the Tool interface; each tool decides what a pointer stroke
 * means and uses session transactions so a whole stroke is one undo step (open/closed: add a tool
 * by adding a registry entry).
 */
import {
  adjustElevationCmd,
  clearTagsCmd,
  moveComponentCmd,
  paintTagsCmd,
  placeComponentCmd,
  setElevationCmd,
} from '../../application/commands';
import type { EditorSession } from '../../application/editorSession';
import type { IdGenerator } from '../../application/ports';
import type { ToolId, UiStore } from '../../application/uiState';
import { kindDef } from '../../domain/components/registry';
import { type Axial, hexKey } from '../../domain/hex';
import { hasTag, type TagMode } from '../../domain/operations';
import { buildIndex, componentsAt } from '../../domain/scenarioIndex';

export interface ToolContext {
  readonly session: EditorSession;
  readonly ui: UiStore;
  readonly ids: IdGenerator;
  /** Ask the user for a label (tokens/structures). Null = cancelled. */
  requestLabel(kindLabel: string): string | null;
}

export interface Tool {
  readonly id: ToolId;
  readonly cursor: string;
  onDown(hex: Axial, ctx: ToolContext): void;
  onMove(hex: Axial, ctx: ToolContext): void;
  onUp(ctx: ToolContext): void;
}

/** A tool that applies a per-hex action once per hex per stroke. */
const strokeTool = (
  id: ToolId,
  label: string,
  start: (hex: Axial, ctx: ToolContext) => (hex: Axial, ctx: ToolContext) => void,
): Tool => {
  let apply: ((hex: Axial, ctx: ToolContext) => void) | null = null;
  let visited = new Set<string>();
  const visit = (hex: Axial, ctx: ToolContext) => {
    const k = hexKey(hex);
    if (!apply || visited.has(k)) return;
    visited.add(k);
    apply(hex, ctx);
  };
  return {
    id,
    cursor: 'crosshair',
    onDown(hex, ctx) {
      visited = new Set();
      ctx.session.begin(label);
      apply = start(hex, ctx);
      visit(hex, ctx);
    },
    onMove: visit,
    onUp(ctx) {
      apply = null;
      ctx.session.commit();
    },
  };
};

const terrainTool = (): Tool =>
  strokeTool('terrain', 'Paint terrain', (first, ctx) => {
    const tag = ctx.ui.current.terrainTag;
    // the first hex decides whether the whole stroke adds or removes
    const mode: TagMode = hasTag(ctx.session.scenario, first, tag) ? 'remove' : 'add';
    return (hex, c) => void c.session.execute(paintTagsCmd([hex], tag, mode));
  });

const eraseTool = (): Tool =>
  strokeTool(
    'erase',
    'Erase terrain',
    () => (hex, c) => void c.session.execute(clearTagsCmd([hex])),
  );

const raiseTool = (): Tool =>
  strokeTool(
    'raise',
    'Raise',
    () => (hex, c) => void c.session.execute(adjustElevationCmd([hex], 1)),
  );

const lowerTool = (): Tool =>
  strokeTool(
    'lower',
    'Lower',
    () => (hex, c) => void c.session.execute(adjustElevationCmd([hex], -1)),
  );

const setLevelTool = (): Tool =>
  strokeTool('setLevel', 'Set level', (_h, ctx) => {
    const level = ctx.ui.current.level;
    return (hex, c) => void c.session.execute(setElevationCmd([hex], level));
  });

const placeTool = (): Tool => ({
  id: 'place',
  cursor: 'copy',
  onDown(hex, ctx) {
    const p = ctx.ui.current.palette;
    const def = kindDef(p.kind);
    let label = p.label.trim();
    if (def.requiresLabel && !label) {
      const asked = ctx.requestLabel(def.label);
      if (asked === null || !asked.trim()) return;
      label = asked.trim();
      ctx.ui.setPalette({ label });
    }
    const id = ctx.ids.next();
    const r = ctx.session.execute(
      placeComponentCmd(p.kind, {
        id,
        hex,
        owner: def.allowedOwners.includes(p.owner) ? p.owner : def.allowedOwners[0],
        facing: p.facing,
        upgradeType: p.upgradeType,
        objectiveType: p.objectiveType,
        ...(label ? { label } : {}),
      }),
    );
    if (r.ok) {
      ctx.ui.select(id);
      ctx.ui.flash(null);
    } else {
      ctx.ui.flash(r.reason);
    }
  },
  onMove() {},
  onUp() {},
});

const selectTool = (): Tool => {
  let dragging: { id: string; last: string } | null = null;
  return {
    id: 'select',
    cursor: 'default',
    onDown(hex, ctx) {
      const here = componentsAt(buildIndex(ctx.session.scenario), hex);
      const current = ctx.ui.current.selectedId;
      // keep the current selection if it is under the pointer (so it can be dragged), else topmost
      const target = here.find((c) => c.id === current) ?? here.at(-1) ?? null;
      ctx.ui.select(target?.id ?? null);
      ctx.ui.patch({ highlight: [] });
      if (target) {
        ctx.session.begin('Move component');
        dragging = { id: target.id, last: hexKey(hex) };
      }
    },
    onMove(hex, ctx) {
      if (!dragging) return;
      const k = hexKey(hex);
      if (k === dragging.last) return;
      const c = ctx.session.scenario.components.find((x) => x.id === dragging!.id);
      if (!c) return;
      // move by the pointer delta so dragging a carrier by its bow keeps the grab offset
      const [lq, lr] = dragging.last.split(',').map(Number) as [number, number];
      const to = { q: c.hex.q + (hex.q - lq), r: c.hex.r + (hex.r - lr) };
      const r = ctx.session.execute(moveComponentCmd(c.id, to));
      if (r.ok) dragging.last = k;
    },
    onUp(ctx) {
      dragging = null;
      ctx.session.commit();
    },
  };
};

/** Places the analysis probe. Touches UI state only: never the scenario or its history. */
const analyseTool = (): Tool => ({
  id: 'analyse',
  cursor: 'crosshair',
  onDown(hex, ctx) {
    ctx.ui.setAnalysis({ probe: hex });
  },
  onMove() {},
  onUp() {},
});

export const createTools = (): Record<ToolId, Tool> => ({
  analyse: analyseTool(),
  select: selectTool(),
  terrain: terrainTool(),
  erase: eraseTool(),
  raise: raiseTool(),
  lower: lowerTool(),
  setLevel: setLevelTool(),
  place: placeTool(),
});
