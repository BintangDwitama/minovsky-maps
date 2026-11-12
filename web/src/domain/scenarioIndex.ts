import { footprint } from './components/registry';
import { type Axial, type HexKey, hexKey } from './hex';
import type { Component, Scenario, TerrainTag } from './scenario';

/** Read-only lookup tables derived from a scenario. Cheap to rebuild; never stored. */
export interface ScenarioIndex {
  readonly hexes: ReadonlySet<HexKey>;
  readonly tagsByHex: ReadonlyMap<HexKey, readonly TerrainTag[]>;
  readonly elevationByHex: ReadonlyMap<HexKey, number>;
  readonly componentsByHex: ReadonlyMap<HexKey, readonly Component[]>;
  readonly componentById: ReadonlyMap<string, Component>;
}

const cache = new WeakMap<Scenario, ScenarioIndex>();

export const buildIndex = (s: Scenario): ScenarioIndex => {
  const cached = cache.get(s);
  if (cached) return cached;

  const hexes = new Set<HexKey>();
  const tagsByHex = new Map<HexKey, readonly TerrainTag[]>();
  for (const h of s.board.hexes) {
    const k = hexKey(h);
    hexes.add(k);
    if (h.tags && h.tags.length > 0) tagsByHex.set(k, h.tags);
  }

  const elevationByHex = new Map<HexKey, number>();
  for (const e of s.elevation) elevationByHex.set(hexKey(e), e.level);

  const componentsByHex = new Map<HexKey, Component[]>();
  const componentById = new Map<string, Component>();
  for (const c of s.components) {
    componentById.set(c.id, c);
    for (const h of footprint(c)) {
      const k = hexKey(h);
      const list = componentsByHex.get(k);
      if (list) list.push(c);
      else componentsByHex.set(k, [c]);
    }
  }

  const index: ScenarioIndex = { hexes, tagsByHex, elevationByHex, componentsByHex, componentById };
  cache.set(s, index);
  return index;
};

export const isOnBoard = (idx: ScenarioIndex, h: Axial): boolean => idx.hexes.has(hexKey(h));

export const elevationAt = (idx: ScenarioIndex, h: Axial): number =>
  idx.elevationByHex.get(hexKey(h)) ?? 0;

export const tagsAt = (idx: ScenarioIndex, h: Axial): readonly TerrainTag[] =>
  idx.tagsByHex.get(hexKey(h)) ?? [];

export const componentsAt = (idx: ScenarioIndex, h: Axial): readonly Component[] =>
  idx.componentsByHex.get(hexKey(h)) ?? [];
