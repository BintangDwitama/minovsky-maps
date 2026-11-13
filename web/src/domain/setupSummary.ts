/** What a player needs to set a scenario up on the table. Derived, never stored. */
import { COMPONENT_KINDS, kindDef } from './components/registry';
import type { ComponentKind, Owner, Scenario } from './scenario';
import { pillarCount, type PillarCount } from './warnings';

export interface KindCount {
  readonly kind: ComponentKind;
  readonly count: number;
  /** e.g. "2 bases", "1 base" */
  readonly text: string;
}

export interface SideSetup {
  readonly owner: Owner;
  readonly kinds: readonly KindCount[];
}

export interface LabelledComponent {
  readonly kind: ComponentKind;
  readonly kindLabel: string;
  readonly owner: Owner;
  readonly label: string;
}

export interface SetupSummary {
  readonly pillars: PillarCount;
  /** Sides in A, B, neutral order; sides without components are left out. */
  readonly sides: readonly SideSetup[];
  readonly labelled: readonly LabelledComponent[];
}

const OWNERS: readonly Owner[] = ['A', 'B', 'neutral'];

export const countText = (kind: ComponentKind, count: number): string => {
  const def = kindDef(kind);
  return `${count} ${count === 1 ? def.label.toLowerCase() : def.plural}`;
};

export const setupSummary = (s: Scenario): SetupSummary => {
  const sides = OWNERS.map((owner) => {
    const kinds = COMPONENT_KINDS.map((kind) => {
      const count = s.components.filter((c) => c.owner === owner && c.kind === kind).length;
      return { kind, count, text: countText(kind, count) };
    }).filter((k) => k.count > 0);
    return { owner, kinds };
  }).filter((side) => side.kinds.length > 0);

  const labelled = s.components.flatMap((c) =>
    'label' in c && c.label?.trim()
      ? [{ kind: c.kind, kindLabel: kindDef(c.kind).label, owner: c.owner, label: c.label }]
      : [],
  );

  return { pillars: pillarCount(s), sides, labelled };
};
