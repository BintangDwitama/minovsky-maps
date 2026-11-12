/**
 * Soft, non-blocking warnings. Each rule is an independent unit registered in WARNING_RULES;
 * adding a rule never requires changing existing ones (open/closed).
 */
import { carrierHexes, footprint, kindDef } from './components/registry';
import { type Axial, hexKey, parseHexKey } from './hex';
import type { Scenario, Side } from './scenario';
import { buildIndex, elevationAt, type ScenarioIndex } from './scenarioIndex';

export interface Warning {
  readonly code: string;
  readonly message: string;
  readonly hexes: readonly Axial[];
  readonly componentIds: readonly string[];
}

export interface WarningRule {
  readonly code: string;
  check(s: Scenario, idx: ScenarioIndex): Warning[];
}

const componentOnImpassable: WarningRule = {
  code: 'component-on-impassable',
  check: (s, idx) =>
    s.components.flatMap((c) => {
      const bad = footprint(c).filter((h) => idx.tagsByHex.get(hexKey(h))?.includes('impassable'));
      return bad.length === 0
        ? []
        : [
            {
              code: 'component-on-impassable',
              message: `${kindDef(c.kind).label}${'label' in c && c.label ? ` "${c.label}"` : ''} sits on impassable terrain; no unit can end a move there.`,
              hexes: bad,
              componentIds: [c.id],
            },
          ];
    }),
};

const stackedComponents: WarningRule = {
  code: 'stacked-components',
  check: (_s, idx) => {
    const out: Warning[] = [];
    for (const [k, list] of idx.componentsByHex) {
      if (list.length < 2) continue;
      out.push({
        code: 'stacked-components',
        message: `${list.length} components share one hex (${list.map((c) => kindDef(c.kind).label.toLowerCase()).join(', ')}).`,
        hexes: [parseHexKey(k)],
        componentIds: list.map((c) => c.id),
      });
    }
    return out;
  },
};

const carrierUnevenElevation: WarningRule = {
  code: 'carrier-uneven-elevation',
  check: (s, idx) =>
    s.components.flatMap((c) => {
      if (c.kind !== 'carrier') return [];
      const { front, middle, back } = carrierHexes(c.hex, c.facing);
      const levels = [front, middle, back].map((h) => elevationAt(idx, h));
      if (levels.every((l) => l === levels[0])) return [];
      return [
        {
          code: 'carrier-uneven-elevation',
          message: `Side ${c.owner} carrier spans elevations ${levels.join('/')} (front/middle/back); carriers must end moves level.`,
          hexes: [front, middle, back],
          componentIds: [c.id],
        },
      ];
    }),
};

const deploymentMismatch: WarningRule = {
  code: 'deployment-mismatch',
  check: (s) => {
    const wrongKind = s.rules.deployment === 'bases' ? 'carrier' : 'base';
    const wrong = s.components.filter((c) => c.kind === wrongKind);
    if (wrong.length === 0) return [];
    return [
      {
        code: 'deployment-mismatch',
        message: `Deployment is set to ${s.rules.deployment}, but ${wrong.length} ${wrongKind}${wrong.length > 1 ? 's are' : ' is'} placed.`,
        hexes: wrong.map((c) => c.hex),
        componentIds: wrong.map((c) => c.id),
      },
    ];
  },
};

const missingDeploymentPoint: WarningRule = {
  code: 'missing-deployment-point',
  check: (s) => {
    const needed = s.rules.deployment === 'bases' ? 'base' : 'carrier';
    const sides: Side[] = ['A', 'B'];
    return sides
      .filter((side) => !s.components.some((c) => c.kind === needed && c.owner === side))
      .map((side) => ({
        code: 'missing-deployment-point',
        message: `Side ${side} has no ${needed} to deploy from.`,
        hexes: [],
        componentIds: [],
      }));
  },
};

export const WARNING_RULES: readonly WarningRule[] = [
  componentOnImpassable,
  stackedComponents,
  carrierUnevenElevation,
  deploymentMismatch,
  missingDeploymentPoint,
];

export const computeWarnings = (
  s: Scenario,
  rules: readonly WarningRule[] = WARNING_RULES,
): Warning[] => {
  const idx = buildIndex(s);
  return rules.flatMap((r) => r.check(s, idx));
};

/* ---------------- derived figures ---------------- */

export interface PillarCount {
  readonly total: number;
  /** level -> number of hexes at that level (levels >= 1 only), ascending. */
  readonly byLevel: ReadonlyArray<{ level: number; hexes: number }>;
}

export const pillarCount = (s: Scenario): PillarCount => {
  const counts = new Map<number, number>();
  let total = 0;
  for (const e of s.elevation) {
    total += e.level;
    counts.set(e.level, (counts.get(e.level) ?? 0) + 1);
  }
  const byLevel = [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, hexes]) => ({ level, hexes }));
  return { total, byLevel };
};
