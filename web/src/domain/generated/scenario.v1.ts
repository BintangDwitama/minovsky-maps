/* eslint-disable */
/**
 * GENERATED from schema/scenario.v1.schema.json by `npm run gen:types`.
 * Do not edit by hand.
 */

/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "TerrainTag".
 */
export type TerrainTag = 'water' | 'debris' | 'impassable' | 'minovsky';
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "Component".
 */
export type Component =
  | BaseComponent
  | CarrierComponent
  | GarrisonComponent
  | UpgradeComponent
  | EnergyComponent
  | ObjectiveComponent
  | TokenComponent
  | StructureComponent;
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "ComponentId".
 */
export type ComponentId = string;
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "Side".
 */
export type Side = 'A' | 'B';
/**
 * Flat-top hex direction: 0 = north, then clockwise (NE, SE, S, SW, NW).
 *
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "Facing".
 */
export type Facing = number;
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "Label".
 */
export type Label = string;
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "Owner".
 */
export type Owner = 'A' | 'B' | 'neutral';
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "Note".
 */
export type Note = string;

/**
 * A Gundam Assemble fan scenario: board, elevation, components, rules and goals. Coordinates are axial {q, r} on a flat-top hex grid.
 */
export interface ScenarioV1 {
  schemaVersion: 1;
  meta: Meta;
  board: Board;
  elevation: ElevationEntry[];
  components: Component[];
  rules: Rules;
  goals: Goal[];
}
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "Meta".
 */
export interface Meta {
  name: string;
  author?: string;
  description?: string;
}
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "Board".
 */
export interface Board {
  kind: 'inline';
  orientation: 'flat';
  /**
   * @minItems 1
   */
  hexes: [BoardHex, ...BoardHex[]];
}
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "BoardHex".
 */
export interface BoardHex {
  q: number;
  r: number;
  tags?: TerrainTag[];
}
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "ElevationEntry".
 */
export interface ElevationEntry {
  q: number;
  r: number;
  level: number;
}
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "BaseComponent".
 */
export interface BaseComponent {
  id: ComponentId;
  kind: 'base';
  owner: Side;
  hex: Hex;
}
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "Hex".
 */
export interface Hex {
  q: number;
  r: number;
}
/**
 * Occupies three hexes in a line: hex is the middle; front = neighbour in facing direction; back = opposite neighbour.
 *
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "CarrierComponent".
 */
export interface CarrierComponent {
  id: ComponentId;
  kind: 'carrier';
  owner: Side;
  hex: Hex;
  facing: Facing;
}
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "GarrisonComponent".
 */
export interface GarrisonComponent {
  id: ComponentId;
  kind: 'garrison';
  owner: Side;
  hex: Hex;
}
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "UpgradeComponent".
 */
export interface UpgradeComponent {
  id: ComponentId;
  kind: 'upgrade';
  owner: 'neutral';
  hex: Hex;
  upgradeType: 'shield' | 'speed' | 'strength';
}
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "EnergyComponent".
 */
export interface EnergyComponent {
  id: ComponentId;
  kind: 'energy';
  owner: 'neutral';
  hex: Hex;
}
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "ObjectiveComponent".
 */
export interface ObjectiveComponent {
  id: ComponentId;
  kind: 'objective';
  owner: 'neutral';
  hex: Hex;
  objectiveType: 'controllable' | 'carryable';
  label?: Label;
}
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "TokenComponent".
 */
export interface TokenComponent {
  id: ComponentId;
  kind: 'token';
  owner: Owner;
  hex: Hex;
  label: Label;
  note?: Note;
}
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "StructureComponent".
 */
export interface StructureComponent {
  id: ComponentId;
  kind: 'structure';
  owner: Owner;
  hex: Hex;
  label: Label;
  note?: Note;
}
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "Rules".
 */
export interface Rules {
  deployment: 'bases' | 'carriers';
  squadSize: number;
  massProducedLimit?: number;
  terrainSetup: 'fixed' | 'free';
}
/**
 * This interface was referenced by `ScenarioV1`'s JSON-Schema
 * via the `definition` "Goal".
 */
export interface Goal {
  id: string;
  text: string;
  vp: number;
  scoring: 'phase1' | 'phase2' | 'each-phase';
}
