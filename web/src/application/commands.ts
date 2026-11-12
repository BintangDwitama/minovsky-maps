/** Commands: labelled wrappers around pure domain operations, executed by EditorSession. */
import type { PlacementParams } from '../domain/components/registry';
import type { Axial } from '../domain/hex';
import {
  addGoal,
  adjustElevation,
  clearTags,
  type ComponentPatch,
  moveComponent,
  moveGoal,
  paintTags,
  placeComponent,
  planResize,
  removeComponent,
  removeGoal,
  rotateCarrier,
  setElevation,
  type TagMode,
  updateComponent,
  updateGoal,
  updateMeta,
  updateRules,
} from '../domain/operations';
import type { ComponentKind, Goal, Meta, Rules, TerrainTag } from '../domain/scenario';
import type { Command } from './editorSession';

export const paintTagsCmd = (hexes: readonly Axial[], tag: TerrainTag, mode: TagMode): Command => ({
  label: `${mode === 'add' ? 'Paint' : 'Remove'} ${tag}`,
  apply: (s) => paintTags(s, hexes, tag, mode),
});

export const clearTagsCmd = (hexes: readonly Axial[]): Command => ({
  label: 'Erase terrain',
  apply: (s) => clearTags(s, hexes),
});

export const adjustElevationCmd = (hexes: readonly Axial[], delta: number): Command => ({
  label: delta > 0 ? 'Raise' : 'Lower',
  apply: (s) => adjustElevation(s, hexes, delta),
});

export const setElevationCmd = (hexes: readonly Axial[], level: number): Command => ({
  label: `Set level ${level}`,
  apply: (s) => setElevation(s, hexes, level),
});

export const resizeBoardCmd = (width: number, height: number): Command => ({
  label: `Resize to ${width}×${height}`,
  apply: (s) => planResize(s, width, height).scenario,
});

export const placeComponentCmd = (kind: ComponentKind, params: PlacementParams): Command => ({
  label: `Place ${kind}`,
  apply: (s) => placeComponent(s, kind, params),
});

export const moveComponentCmd = (id: string, to: Axial): Command => ({
  label: 'Move component',
  apply: (s) => moveComponent(s, id, to),
});

export const rotateCarrierCmd = (id: string, steps: number): Command => ({
  label: 'Rotate carrier',
  apply: (s) => rotateCarrier(s, id, steps),
});

export const updateComponentCmd = (id: string, patch: ComponentPatch): Command => ({
  label: 'Edit component',
  apply: (s) => updateComponent(s, id, patch),
});

export const removeComponentCmd = (id: string): Command => ({
  label: 'Remove component',
  apply: (s) => removeComponent(s, id),
});

export const updateMetaCmd = (patch: Partial<Meta>): Command => ({
  label: 'Edit details',
  apply: (s) => updateMeta(s, patch),
});

export const updateRulesCmd = (patch: Partial<Rules>): Command => ({
  label: 'Edit rules',
  apply: (s) => updateRules(s, patch),
});

export const addGoalCmd = (goal: Goal): Command => ({
  label: 'Add goal',
  apply: (s) => addGoal(s, goal),
});

export const updateGoalCmd = (id: string, patch: Partial<Omit<Goal, 'id'>>): Command => ({
  label: 'Edit goal',
  apply: (s) => updateGoal(s, id, patch),
});

export const removeGoalCmd = (id: string): Command => ({
  label: 'Remove goal',
  apply: (s) => removeGoal(s, id),
});

export const moveGoalCmd = (id: string, toIndex: number): Command => ({
  label: 'Reorder goals',
  apply: (s) => moveGoal(s, id, toIndex),
});
