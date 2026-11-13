/**
 * Compact form of a scenario for share links (codec version 1).
 *
 * Shape (plain JSON, before compression):
 *   v  schemaVersion
 *   m  meta, unchanged
 *   b  [width, height] for a full odd-q rectangle (hexes in `rectangleHexes` order),
 *      or { x: [[q, r], ...] } for any other board shape (hexes in list order)
 *   t  { tag: [hexIndex, ...] }       terrain, only hexes that have it
 *   e  { level: [hexIndex, ...] }     elevation, only hexes above ground
 *   c  [[kind, hexIndex, ...kindDef.compactFields], ...]
 *   r  rules, unchanged
 *   g  [[text, vp, scoring], ...]
 *
 * Hexes are referenced by index into the board's hex order. Component and goal ids are not
 * stored; decoding assigns c1, c2, ... and g1, g2, ... Board hexes, terrain tags and elevation
 * come back in canonical order (the board is a set), so a round trip is equal up to ids and
 * ordering — see `canonicalize`.
 *
 * Links are permanent: never change how version 1 is read. A new layout needs a new codec
 * version alongside this one.
 */
import { hexKey, rectangleHexes, type Axial } from './hex';
import { COMPONENT_KINDS, kindDef } from './components/registry';
import {
  rectangleSize,
  TERRAIN_TAGS,
  type Component,
  type ComponentKind,
  type Goal,
  type Scenario,
  type TerrainTag,
} from './scenario';

export const LINK_CODEC_VERSION = 1;

export interface CompactScenarioV1 {
  v: number;
  m: Scenario['meta'];
  b: [number, number] | { x: [number, number][] };
  t?: Partial<Record<TerrainTag, number[]>>;
  e?: Record<string, number[]>;
  c?: unknown[][];
  r: Scenario['rules'];
  g?: [string, number, Goal['scoring']][];
}

/* ---------------- encode ---------------- */

const boardOrder = (s: Scenario): { hexes: Axial[]; b: CompactScenarioV1['b'] } => {
  const size = rectangleSize(s);
  if (size) return { hexes: rectangleHexes(size.width, size.height), b: [size.width, size.height] };
  return { hexes: s.board.hexes, b: { x: s.board.hexes.map((h) => [h.q, h.r]) } };
};

const trimTrailingEmpty = (row: unknown[]): unknown[] => {
  let end = row.length;
  while (end > 0 && (row[end - 1] === undefined || row[end - 1] === null)) end--;
  return row.slice(0, end).map((v) => (v === undefined ? null : v));
};

export const toCompact = (s: Scenario): CompactScenarioV1 => {
  const { hexes, b } = boardOrder(s);
  const index = new Map(hexes.map((h, i) => [hexKey(h), i]));
  const at = (h: Axial): number => {
    const i = index.get(hexKey(h));
    if (i === undefined) throw new RangeError(`Hex ${h.q},${h.r} is not on the board`);
    return i;
  };

  const t: Partial<Record<TerrainTag, number[]>> = {};
  for (const h of s.board.hexes) for (const tag of h.tags ?? []) (t[tag] ??= []).push(at(h));
  for (const list of Object.values(t)) list?.sort((x, y) => x - y);

  const e: Record<string, number[]> = {};
  for (const el of s.elevation) (e[String(el.level)] ??= []).push(at(el));
  for (const list of Object.values(e)) list.sort((x, y) => x - y);

  const c = s.components.map((comp) => {
    const fields = kindDef(comp.kind).compactFields.map(
      (f) => (comp as unknown as Record<string, unknown>)[f],
    );
    return trimTrailingEmpty([comp.kind, at(comp.hex), ...fields]);
  });

  const out: CompactScenarioV1 = { v: s.schemaVersion, m: s.meta, b, r: s.rules };
  if (Object.keys(t).length) out.t = t;
  if (Object.keys(e).length) out.e = e;
  if (c.length) out.c = c;
  if (s.goals.length) out.g = s.goals.map((g) => [g.text, g.vp, g.scoring]);
  return out;
};

/* ---------------- decode ---------------- */

export type ExpandResult = { ok: true; doc: unknown } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const MAX_HEXES = 40 * 40;

class Bad extends Error {}
const need = (cond: unknown, what: string): void => {
  if (!cond) throw new Bad(what);
};

/**
 * Expand a compact value into a full scenario document. Only the compact *structure* is checked
 * here; the result must still go through `loadScenario()` for schema and integrity validation.
 * Never throws.
 */
export const fromCompact = (value: unknown): ExpandResult => {
  try {
    need(isObj(value), 'not an object');
    const v = value as Record<string, unknown>;

    let hexes: Axial[];
    if (Array.isArray(v.b)) {
      const [w, h] = v.b as unknown[];
      need(isInt(w) && isInt(h) && (w as number) > 0 && (h as number) > 0, 'board size');
      need((w as number) * (h as number) <= MAX_HEXES, 'board too large');
      hexes = rectangleHexes(w as number, h as number);
    } else {
      need(isObj(v.b) && Array.isArray((v.b as Record<string, unknown>).x), 'board');
      const list = (v.b as { x: unknown[] }).x;
      need(list.length > 0 && list.length <= MAX_HEXES, 'board size');
      hexes = list.map((p) => {
        need(Array.isArray(p) && isInt(p[0]) && isInt(p[1]), 'board hex');
        return { q: (p as number[])[0]!, r: (p as number[])[1]! };
      });
    }
    const hexAt = (i: unknown): Axial => {
      need(isInt(i) && (i as number) >= 0 && (i as number) < hexes.length, 'hex index');
      return hexes[i as number]!;
    };

    const tagsByIndex = new Map<number, TerrainTag[]>();
    if (v.t !== undefined) {
      need(isObj(v.t), 'terrain');
      for (const tag of TERRAIN_TAGS) {
        const list = (v.t as Record<string, unknown>)[tag];
        if (list === undefined) continue;
        need(Array.isArray(list), 'terrain list');
        for (const i of list as unknown[]) {
          hexAt(i);
          const tags = tagsByIndex.get(i as number) ?? [];
          tags.push(tag);
          tagsByIndex.set(i as number, tags);
        }
      }
      for (const k of Object.keys(v.t as object)) {
        need((TERRAIN_TAGS as readonly string[]).includes(k), `terrain tag "${k}"`);
      }
    }

    const elevation: { index: number; level: number }[] = [];
    if (v.e !== undefined) {
      need(isObj(v.e), 'elevation');
      for (const [level, list] of Object.entries(v.e as Record<string, unknown>)) {
        need(Array.isArray(list), 'elevation list');
        for (const i of list as unknown[]) {
          hexAt(i);
          elevation.push({ index: i as number, level: Number(level) });
        }
      }
    }
    elevation.sort((a, b) => a.index - b.index);

    const components: Component[] = [];
    if (v.c !== undefined) {
      need(Array.isArray(v.c), 'components');
      (v.c as unknown[]).forEach((row, n) => {
        need(Array.isArray(row) && row.length >= 2, 'component');
        const [kind, index, ...values] = row as unknown[];
        need(
          (COMPONENT_KINDS as readonly unknown[]).includes(kind),
          `component kind "${String(kind)}"`,
        );
        const def = kindDef(kind as ComponentKind);
        const comp: Record<string, unknown> = { id: `c${n + 1}`, kind, hex: { ...hexAt(index) } };
        if (def.allowedOwners.length === 1) comp.owner = def.allowedOwners[0];
        def.compactFields.forEach((f, i) => {
          const val = values[i];
          if (val !== undefined && val !== null) comp[f] = val;
        });
        components.push(comp as unknown as Component);
      });
    }

    const goals: Goal[] = [];
    if (v.g !== undefined) {
      need(Array.isArray(v.g), 'goals');
      (v.g as unknown[]).forEach((row, n) => {
        need(Array.isArray(row) && row.length === 3, 'goal');
        const [text, vp, scoring] = row as [string, number, Goal['scoring']];
        goals.push({ id: `g${n + 1}`, text, vp, scoring });
      });
    }

    const doc = {
      schemaVersion: v.v,
      meta: v.m,
      board: {
        kind: 'inline',
        orientation: 'flat',
        hexes: hexes.map((h, i) => {
          const tags = tagsByIndex.get(i);
          return tags ? { q: h.q, r: h.r, tags } : { q: h.q, r: h.r };
        }),
      },
      elevation: elevation.map(({ index, level }) => ({ ...hexes[index]!, level })),
      components,
      rules: v.r,
      goals,
    };
    return { ok: true, doc };
  } catch (e) {
    return { ok: false, error: e instanceof Bad ? `Invalid link data (${e.message}).` : String(e) };
  }
};

/* ---------------- comparison ---------------- */

/**
 * Canonical form for comparing scenarios across a link round trip: ids replaced by position,
 * board hexes, tags and elevation in a fixed order.
 */
export const canonicalize = (s: Scenario): unknown => {
  const tagOrder = (tags: readonly TerrainTag[] | undefined) =>
    tags ? TERRAIN_TAGS.filter((t) => tags.includes(t)) : undefined;
  const byHex = (a: Axial, b: Axial) => a.q - b.q || a.r - b.r;
  return {
    ...s,
    board: {
      ...s.board,
      hexes: [...s.board.hexes]
        .sort(byHex)
        .map((h) =>
          h.tags?.length ? { q: h.q, r: h.r, tags: tagOrder(h.tags) } : { q: h.q, r: h.r },
        ),
    },
    elevation: [...s.elevation].sort(byHex),
    components: s.components.map((c, i) => ({ ...c, id: `c${i + 1}` })),
    goals: s.goals.map((g, i) => ({ ...g, id: `g${i + 1}` })),
  };
};
