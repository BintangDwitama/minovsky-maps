import { footprint, kindDef } from './components/registry';
import { type Axial, axialToOffset, hexKey } from './hex';
import type { Scenario } from './scenario';

/**
 * Hard integrity problems: cross-field rules JSON Schema can't express.
 * Unlike warnings, these make a document invalid (rejected on load).
 */
export interface IntegrityError {
  readonly code:
    | 'duplicate-hex'
    | 'elevation-off-board'
    | 'duplicate-elevation'
    | 'component-off-board'
    | 'duplicate-component-id'
    | 'owner-not-allowed'
    | 'label-required'
    | 'duplicate-goal-id';
  readonly message: string;
  readonly hexes?: readonly Axial[];
  readonly componentId?: string;
}

const fmt = (h: Axial): string => {
  const { col, row } = axialToOffset(h);
  return `(${col}, ${row})`;
};

export const checkIntegrity = (s: Scenario): IntegrityError[] => {
  const errors: IntegrityError[] = [];

  const board = new Set<string>();
  for (const h of s.board.hexes) {
    const k = hexKey(h);
    if (board.has(k)) {
      errors.push({ code: 'duplicate-hex', message: `Board lists hex ${fmt(h)} more than once.`, hexes: [h] });
    }
    board.add(k);
  }

  const elevSeen = new Set<string>();
  for (const e of s.elevation) {
    const k = hexKey(e);
    if (!board.has(k)) {
      errors.push({ code: 'elevation-off-board', message: `Elevation set on hex ${fmt(e)}, which is not on the board.`, hexes: [e] });
    }
    if (elevSeen.has(k)) {
      errors.push({ code: 'duplicate-elevation', message: `Elevation listed twice for hex ${fmt(e)}.`, hexes: [e] });
    }
    elevSeen.add(k);
  }

  const ids = new Set<string>();
  for (const c of s.components) {
    const def = kindDef(c.kind);
    if (ids.has(c.id)) {
      errors.push({ code: 'duplicate-component-id', message: `Component id "${c.id}" is used more than once.`, componentId: c.id });
    }
    ids.add(c.id);

    const off = footprint(c).filter((h) => !board.has(hexKey(h)));
    if (off.length > 0) {
      errors.push({
        code: 'component-off-board',
        message: `${def.label} "${c.id}" occupies ${off.map(fmt).join(', ')}, which ${off.length === 1 ? 'is' : 'are'} not on the board.`,
        hexes: off,
        componentId: c.id,
      });
    }

    if (!def.allowedOwners.includes(c.owner)) {
      errors.push({
        code: 'owner-not-allowed',
        message: `${def.label} "${c.id}" cannot be owned by "${c.owner}" (allowed: ${def.allowedOwners.join(', ')}).`,
        componentId: c.id,
      });
    }

    if (def.requiresLabel && !('label' in c && c.label && c.label.trim())) {
      errors.push({ code: 'label-required', message: `${def.label} "${c.id}" needs a label.`, componentId: c.id });
    }
  }

  const goalIds = new Set<string>();
  for (const g of s.goals) {
    if (goalIds.has(g.id)) {
      errors.push({ code: 'duplicate-goal-id', message: `Goal id "${g.id}" is used more than once.` });
    }
    goalIds.add(g.id);
  }

  return errors;
};
