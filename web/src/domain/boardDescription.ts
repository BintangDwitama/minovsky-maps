/**
 * The board in words: for screen readers, and for anyone reading a map without seeing it.
 * Derived from the scenario, never stored. Hexes are written "col, row" like the hex readout.
 */
import { kindDef } from './components/registry';
import { type Axial, axialToOffset, DIRECTION_NAMES, parseHexKey, toDirection } from './hex';
import {
  type Component,
  type Owner,
  rectangleSize,
  type Scenario,
  TERRAIN_LABELS,
  TERRAIN_TAGS,
  type TerrainTag,
} from './scenario';
import { buildIndex, componentsAt, elevationAt, type ScenarioIndex, tagsAt } from './scenarioIndex';

export const SIDE_NAMES: Record<Owner, string> = { A: 'Side A', B: 'Side B', neutral: 'Neutral' };

export const hexText = (h: Axial): string => {
  const { col, row } = axialToOffset(h);
  return `${col}, ${row}`;
};

const byColRow = (a: Axial, b: Axial): number => {
  const oa = axialToOffset(a);
  const ob = axialToOffset(b);
  return oa.col - ob.col || oa.row - ob.row;
};

/** What a component is, without where: "Garrison", "Upgrade (speed)", "Objective “Data core”". */
export function componentText(c: Component): string {
  const def = kindDef(c.kind);
  switch (c.kind) {
    case 'carrier':
      return `${def.label} facing ${DIRECTION_NAMES[toDirection(c.facing)]}`;
    case 'upgrade':
      return `${def.label} (${c.upgradeType})`;
    case 'objective':
      return c.label ? `${def.label} “${c.label}”` : def.label;
    case 'token':
    case 'structure':
      return `${def.label} “${c.label}”`;
    default:
      return def.label;
  }
}

/** One hex, e.g. "7, 8. Level 2. Water. Garrison, Side A." */
export function describeHex(idx: ScenarioIndex, h: Axial): string {
  const parts = [hexText(h)];
  const level = elevationAt(idx, h);
  if (level > 0) parts.push(`Level ${level}`);
  const tags = tagsAt(idx, h);
  if (tags.length) parts.push(tags.map((t) => TERRAIN_LABELS[t]).join(' and '));
  for (const c of componentsAt(idx, h)) parts.push(`${componentText(c)}, ${SIDE_NAMES[c.owner]}`);
  return `${parts.join('. ')}.`;
}

export interface BoardDescription {
  /** "15 × 15 hexes" or "120 hexes". */
  readonly size: string;
  readonly levels: readonly { level: number; hexes: readonly string[] }[];
  readonly terrain: readonly { tag: TerrainTag; label: string; hexes: readonly string[] }[];
  readonly sides: readonly { side: Owner; label: string; items: readonly string[] }[];
  /** No elevation anywhere. */
  readonly flat: boolean;
}

export function describeBoard(s: Scenario): BoardDescription {
  const idx = buildIndex(s);
  const all = [...idx.hexes].map(parseHexKey).sort(byColRow);
  const rect = rectangleSize(s);

  const byLevel = new Map<number, Axial[]>();
  for (const h of all) {
    const l = elevationAt(idx, h);
    if (l > 0) byLevel.set(l, [...(byLevel.get(l) ?? []), h]);
  }
  const levels = [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, hexes]) => ({ level, hexes: hexes.map(hexText) }));

  const terrain = TERRAIN_TAGS.map((tag) => ({
    tag,
    label: TERRAIN_LABELS[tag],
    hexes: all.filter((h) => tagsAt(idx, h).includes(tag)).map(hexText),
  })).filter((t) => t.hexes.length > 0);

  const sides = (['A', 'B', 'neutral'] as const)
    .map((side) => ({
      side,
      label: SIDE_NAMES[side],
      items: s.components
        .filter((c) => c.owner === side)
        .sort((a, b) => byColRow(a.hex, b.hex))
        .map((c) => {
          const level = elevationAt(idx, c.hex);
          const where =
            c.kind === 'carrier' ? `, middle on ${hexText(c.hex)}` : ` on ${hexText(c.hex)}`;
          return `${componentText(c)}${where}${level > 0 ? `, level ${level}` : ''}`;
        }),
    }))
    .filter((g) => g.items.length > 0);

  return {
    size: rect ? `${rect.width} × ${rect.height} hexes` : `${s.board.hexes.length} hexes`,
    levels,
    terrain,
    sides,
    flat: levels.length === 0,
  };
}
