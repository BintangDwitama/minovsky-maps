/**
 * Pure scenario operations. Each returns a new Scenario (structural sharing; inputs never mutated).
 */
import { footprint, kindDef, type PlacementParams } from './components/registry';
import { type Axial, type HexKey, axialToOffset, hexKey, rectangleHexes, toDirection } from './hex';
import {
  type Component,
  type ComponentKind,
  type Goal,
  type Meta,
  type Rules,
  type Scenario,
  type TerrainTag,
  isValidBoardSize,
  MAX_ELEVATION,
} from './scenario';

export type OpResult = { ok: true; scenario: Scenario } | { ok: false; reason: string };

const ok = (scenario: Scenario): OpResult => ({ ok: true, scenario });
const fail = (reason: string): OpResult => ({ ok: false, reason });

const keySet = (hexes: readonly Axial[]): Set<HexKey> => new Set(hexes.map(hexKey));
const boardKeys = (s: Scenario): Set<HexKey> => keySet(s.board.hexes);

const fmtHex = (h: Axial): string => {
  const { col, row } = axialToOffset(h);
  return `(${col}, ${row})`;
};

/* ---------------- terrain tags ---------------- */

export type TagMode = 'add' | 'remove';

export const hasTag = (s: Scenario, h: Axial, tag: TerrainTag): boolean => {
  const k = hexKey(h);
  return s.board.hexes.some((b) => hexKey(b) === k && (b.tags ?? []).includes(tag));
};

const mapBoardHexes = (
  s: Scenario,
  targets: readonly Axial[],
  fn: (tags: readonly TerrainTag[]) => TerrainTag[],
): Scenario => {
  const keys = keySet(targets);
  let changed = false;
  const hexes = s.board.hexes.map((b) => {
    if (!keys.has(hexKey(b))) return b;
    const before = b.tags ?? [];
    const after = fn(before);
    if (after.length === before.length && after.every((t, i) => t === before[i])) return b;
    changed = true;
    const { tags: _drop, ...rest } = b;
    return after.length > 0 ? { ...rest, tags: after } : rest;
  });
  return changed ? { ...s, board: { ...s.board, hexes: hexes as Scenario['board']['hexes'] } } : s;
};

export const paintTags = (
  s: Scenario,
  targets: readonly Axial[],
  tag: TerrainTag,
  mode: TagMode,
): Scenario =>
  mapBoardHexes(s, targets, (tags) =>
    mode === 'add'
      ? tags.includes(tag)
        ? [...tags]
        : [...tags, tag]
      : tags.filter((t) => t !== tag),
  );

export const clearTags = (s: Scenario, targets: readonly Axial[]): Scenario =>
  mapBoardHexes(s, targets, () => []);

/* ---------------- elevation ---------------- */

const clampLevel = (n: number): number => Math.max(0, Math.min(MAX_ELEVATION, Math.round(n)));

const mapElevation = (
  s: Scenario,
  targets: readonly Axial[],
  fn: (current: number) => number,
): Scenario => {
  const board = boardKeys(s);
  const levels = new Map<HexKey, number>(s.elevation.map((e) => [hexKey(e), e.level]));
  let changed = false;
  for (const h of targets) {
    const k = hexKey(h);
    if (!board.has(k)) continue;
    const before = levels.get(k) ?? 0;
    const after = clampLevel(fn(before));
    if (after === before) continue;
    changed = true;
    if (after === 0) levels.delete(k);
    else levels.set(k, after);
  }
  if (!changed) return s;
  // keep board order for stable, diff-friendly output
  const elevation = s.board.hexes
    .filter((b) => levels.has(hexKey(b)))
    .map((b) => ({ q: b.q, r: b.r, level: levels.get(hexKey(b))! }));
  return { ...s, elevation };
};

export const setElevation = (s: Scenario, targets: readonly Axial[], level: number): Scenario =>
  mapElevation(s, targets, () => level);

export const adjustElevation = (s: Scenario, targets: readonly Axial[], delta: number): Scenario =>
  mapElevation(s, targets, (cur) => cur + delta);

/* ---------------- components ---------------- */

const offBoard = (s: Scenario, c: Component): Axial[] => {
  const board = boardKeys(s);
  return footprint(c).filter((h) => !board.has(hexKey(h)));
};

const offBoardReason = (c: Component, off: Axial[]): string =>
  `${kindDef(c.kind).label} would extend off the board at ${off.map(fmtHex).join(', ')}.`;

export const placeComponent = (
  s: Scenario,
  kind: ComponentKind,
  params: PlacementParams,
): OpResult => {
  const def = kindDef(kind);
  if (def.requiresLabel && !params.label?.trim()) return fail(`${def.label} needs a label.`);
  const c = def.create(params);
  const off = offBoard(s, c);
  if (off.length > 0) return fail(offBoardReason(c, off));
  return ok({ ...s, components: [...s.components, c] });
};

const replaceComponent = (s: Scenario, id: string, next: Component): OpResult => {
  const off = offBoard(s, next);
  if (off.length > 0) return fail(offBoardReason(next, off));
  return ok({ ...s, components: s.components.map((c) => (c.id === id ? next : c)) });
};

const findComponent = (s: Scenario, id: string): Component | undefined =>
  s.components.find((c) => c.id === id);

export const moveComponent = (s: Scenario, id: string, to: Axial): OpResult => {
  const c = findComponent(s, id);
  if (!c) return fail(`No component with id "${id}".`);
  if (c.hex.q === to.q && c.hex.r === to.r) return ok(s);
  return replaceComponent(s, id, { ...c, hex: { q: to.q, r: to.r } });
};

export const rotateCarrier = (s: Scenario, id: string, steps: number): OpResult => {
  const c = findComponent(s, id);
  if (!c) return fail(`No component with id "${id}".`);
  if (c.kind !== 'carrier') return fail('Only carriers can be rotated.');
  return replaceComponent(s, id, { ...c, facing: toDirection(c.facing + steps) });
};

/** Patch kind-specific fields. `kind`, `id` cannot change. Owner must be allowed for the kind. */
export type ComponentPatch = Partial<Omit<PlacementParams, 'id'>>;

export const updateComponent = (s: Scenario, id: string, patch: ComponentPatch): OpResult => {
  const c = findComponent(s, id);
  if (!c) return fail(`No component with id "${id}".`);
  const def = kindDef(c.kind);
  if (patch.owner !== undefined && !def.allowedOwners.includes(patch.owner)) {
    return fail(`${def.label} cannot be owned by "${patch.owner}".`);
  }
  const current: PlacementParams = {
    id: c.id,
    hex: c.hex,
    owner: c.owner,
    ...('facing' in c ? { facing: c.facing } : {}),
    ...('upgradeType' in c ? { upgradeType: c.upgradeType } : {}),
    ...('objectiveType' in c ? { objectiveType: c.objectiveType } : {}),
    ...('label' in c && c.label !== undefined ? { label: c.label } : {}),
    ...('note' in c && c.note !== undefined ? { note: c.note } : {}),
  };
  // An empty required label is allowed transiently while editing; integrity checks block saving it.
  const merged: PlacementParams = { ...current, ...patch, id: c.id };
  return replaceComponent(s, id, def.create(merged));
};

export const removeComponent = (s: Scenario, id: string): Scenario =>
  s.components.some((c) => c.id === id)
    ? { ...s, components: s.components.filter((c) => c.id !== id) }
    : s;

/* ---------------- board resize ---------------- */

export interface ResizePlan {
  readonly scenario: Scenario;
  /** Components that the resize removes (they would be off the new board). */
  readonly removedComponents: readonly Component[];
}

export const planResize = (s: Scenario, width: number, height: number): ResizePlan => {
  if (!isValidBoardSize(width) || !isValidBoardSize(height)) {
    throw new RangeError(`Board size must be between 1 and 40 (got ${width}x${height})`);
  }
  const existing = new Map(s.board.hexes.map((b) => [hexKey(b), b]));
  const hexes = rectangleHexes(width, height).map((h) => existing.get(hexKey(h)) ?? { q: h.q, r: h.r });
  const keys = keySet(hexes);
  const elevation = s.elevation.filter((e) => keys.has(hexKey(e)));
  const kept: Component[] = [];
  const removed: Component[] = [];
  for (const c of s.components) {
    (footprint(c).every((h) => keys.has(hexKey(h))) ? kept : removed).push(c);
  }
  return {
    scenario: {
      ...s,
      board: { ...s.board, hexes: hexes as Scenario['board']['hexes'] },
      elevation,
      components: kept,
    },
    removedComponents: removed,
  };
};

/* ---------------- meta, rules, goals ---------------- */

export const updateMeta = (s: Scenario, patch: Partial<Meta>): Scenario => {
  const meta: Meta = { ...s.meta, ...patch };
  // drop empty optional fields to keep files tidy
  if (!meta.author) delete meta.author;
  if (!meta.description) delete meta.description;
  return { ...s, meta };
};

export const updateRules = (s: Scenario, patch: Partial<Rules>): Scenario => {
  const rules: Rules = { ...s.rules, ...patch };
  if (patch.massProducedLimit === undefined && 'massProducedLimit' in patch) delete rules.massProducedLimit;
  return { ...s, rules };
};

export const addGoal = (s: Scenario, goal: Goal): Scenario => ({ ...s, goals: [...s.goals, goal] });

export const updateGoal = (s: Scenario, id: string, patch: Partial<Omit<Goal, 'id'>>): Scenario => ({
  ...s,
  goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
});

export const removeGoal = (s: Scenario, id: string): Scenario => ({
  ...s,
  goals: s.goals.filter((g) => g.id !== id),
});

export const moveGoal = (s: Scenario, id: string, toIndex: number): Scenario => {
  const from = s.goals.findIndex((g) => g.id === id);
  if (from < 0) return s;
  const to = Math.max(0, Math.min(s.goals.length - 1, toIndex));
  if (from === to) return s;
  const goals = [...s.goals];
  const [g] = goals.splice(from, 1);
  goals.splice(to, 0, g!);
  return { ...s, goals };
};
