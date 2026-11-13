import { type Axial, type Direction, neighbor, opposite, toDirection } from '../hex';
import type { Component, ComponentKind, Owner } from '../scenario';

/**
 * Per-kind behaviour. Adding a component kind = add a schema def + one entry here
 * (plus a UI renderer entry). Nothing else switches on `kind`.
 */
export interface ComponentKindDef {
  readonly kind: ComponentKind;
  readonly label: string;
  /** Lower-case plural for counts, e.g. "2 bases". */
  readonly plural: string;
  /**
   * Kind-specific fields stored in share links, in this fixed order (after kind and hex).
   * Never reorder or remove entries: links already shared depend on it; append only.
   * Kinds with a single allowed owner omit owner (it is implied).
   */
  readonly compactFields: readonly string[];
  readonly allowedOwners: readonly Owner[];
  readonly requiresLabel: boolean;
  /** Hexes occupied by a component of this kind. */
  footprint(c: Component): Axial[];
  /** Build a new component from placement parameters (kind-specific fields defaulted). */
  create(p: PlacementParams): Component;
}

export interface PlacementParams {
  id: string;
  hex: Axial;
  owner?: Owner;
  facing?: number;
  upgradeType?: 'shield' | 'speed' | 'strength';
  objectiveType?: 'controllable' | 'carryable';
  label?: string;
  note?: string;
}

const SIDES: readonly Owner[] = ['A', 'B'];
const NEUTRAL: readonly Owner[] = ['neutral'];
const ANY: readonly Owner[] = ['A', 'B', 'neutral'];

const single = (c: Component): Axial[] => [c.hex];
const hexOf = (p: PlacementParams) => ({ q: p.hex.q, r: p.hex.r });
const side = (p: PlacementParams): 'A' | 'B' => (p.owner === 'B' ? 'B' : 'A');
const anyOwner = (p: PlacementParams): Owner => p.owner ?? 'neutral';
const withNote = (p: PlacementParams) => (p.note ? { note: p.note } : {});

export const carrierHexes = (
  middle: Axial,
  facing: number,
): { front: Axial; middle: Axial; back: Axial } => {
  const d: Direction = toDirection(facing);
  return { front: neighbor(middle, d), middle, back: neighbor(middle, opposite(d)) };
};

const defs: ComponentKindDef[] = [
  {
    kind: 'base',
    label: 'Base',
    plural: 'bases',
    compactFields: ['owner'],
    allowedOwners: SIDES,
    requiresLabel: false,
    footprint: single,
    create: (p) => ({ id: p.id, kind: 'base', owner: side(p), hex: hexOf(p) }),
  },
  {
    kind: 'carrier',
    label: 'Carrier',
    plural: 'carriers',
    compactFields: ['owner', 'facing'],
    allowedOwners: SIDES,
    requiresLabel: false,
    footprint: (c) => {
      const facing = c.kind === 'carrier' ? c.facing : 0;
      const { front, middle, back } = carrierHexes(c.hex, facing);
      return [front, middle, back];
    },
    create: (p) => ({
      id: p.id,
      kind: 'carrier',
      owner: side(p),
      hex: hexOf(p),
      facing: toDirection(p.facing ?? 0),
    }),
  },
  {
    kind: 'garrison',
    label: 'Garrison',
    plural: 'garrisons',
    compactFields: ['owner'],
    allowedOwners: SIDES,
    requiresLabel: false,
    footprint: single,
    create: (p) => ({ id: p.id, kind: 'garrison', owner: side(p), hex: hexOf(p) }),
  },
  {
    kind: 'upgrade',
    label: 'Upgrade',
    plural: 'upgrades',
    compactFields: ['upgradeType'],
    allowedOwners: NEUTRAL,
    requiresLabel: false,
    footprint: single,
    create: (p) => ({
      id: p.id,
      kind: 'upgrade',
      owner: 'neutral',
      hex: hexOf(p),
      upgradeType: p.upgradeType ?? 'shield',
    }),
  },
  {
    kind: 'energy',
    label: 'Energy',
    plural: 'energy',
    compactFields: [],
    allowedOwners: NEUTRAL,
    requiresLabel: false,
    footprint: single,
    create: (p) => ({ id: p.id, kind: 'energy', owner: 'neutral', hex: hexOf(p) }),
  },
  {
    kind: 'objective',
    label: 'Objective',
    plural: 'objectives',
    compactFields: ['objectiveType', 'label'],
    allowedOwners: NEUTRAL,
    requiresLabel: false,
    footprint: single,
    create: (p) => ({
      id: p.id,
      kind: 'objective',
      owner: 'neutral',
      hex: hexOf(p),
      objectiveType: p.objectiveType ?? 'controllable',
      ...(p.label ? { label: p.label } : {}),
    }),
  },
  {
    kind: 'token',
    label: 'Scenario token',
    plural: 'scenario tokens',
    compactFields: ['owner', 'label', 'note'],
    allowedOwners: ANY,
    requiresLabel: true,
    footprint: single,
    create: (p) => ({
      id: p.id,
      kind: 'token',
      owner: anyOwner(p),
      hex: hexOf(p),
      label: p.label ?? '',
      ...withNote(p),
    }),
  },
  {
    kind: 'structure',
    label: 'Structure',
    plural: 'structures',
    compactFields: ['owner', 'label', 'note'],
    allowedOwners: ANY,
    requiresLabel: true,
    footprint: single,
    create: (p) => ({
      id: p.id,
      kind: 'structure',
      owner: anyOwner(p),
      hex: hexOf(p),
      label: p.label ?? '',
      ...withNote(p),
    }),
  },
];

const byKind = new Map<ComponentKind, ComponentKindDef>(defs.map((d) => [d.kind, d]));

export const COMPONENT_KINDS: readonly ComponentKind[] = defs.map((d) => d.kind);

export const kindDef = (kind: ComponentKind): ComponentKindDef => {
  const d = byKind.get(kind);
  if (!d) throw new Error(`Unknown component kind: ${kind}`);
  return d;
};

export const footprint = (c: Component): Axial[] => kindDef(c.kind).footprint(c);
