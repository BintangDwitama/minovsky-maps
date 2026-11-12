import type {
  Component,
  Goal,
  Rules,
  ScenarioV1,
  TerrainTag,
} from './generated/scenario.v1';
import { rectangleHexes } from './hex';

export type * from './generated/scenario.v1';

/** The current in-memory scenario shape. Bump together with the schema file. */
export type Scenario = ScenarioV1;
export const CURRENT_SCHEMA_VERSION = 1 as const;

export type ComponentKind = Component['kind'];
export type ComponentOfKind<K extends ComponentKind> = Extract<Component, { kind: K }>;
export type GoalScoring = Goal['scoring'];
export type Deployment = Rules['deployment'];

export const TERRAIN_TAGS: readonly TerrainTag[] = ['water', 'debris', 'impassable', 'minovsky'];

export const MIN_BOARD_SIZE = 1;
export const MAX_BOARD_SIZE = 40;
export const DEFAULT_BOARD_SIZE = 15;
export const MAX_ELEVATION = 9;

export const DEFAULT_RULES: Rules = { deployment: 'bases', squadSize: 3, terrainSetup: 'fixed' };

export const isValidBoardSize = (n: number): boolean =>
  Number.isInteger(n) && n >= MIN_BOARD_SIZE && n <= MAX_BOARD_SIZE;

export interface CreateScenarioOptions {
  width?: number;
  height?: number;
  name?: string;
}

export const createScenario = (opts: CreateScenarioOptions = {}): Scenario => {
  const width = opts.width ?? DEFAULT_BOARD_SIZE;
  const height = opts.height ?? DEFAULT_BOARD_SIZE;
  if (!isValidBoardSize(width) || !isValidBoardSize(height)) {
    throw new RangeError(
      `Board size must be between ${MIN_BOARD_SIZE} and ${MAX_BOARD_SIZE} (got ${width}x${height})`,
    );
  }
  const hexes = rectangleHexes(width, height).map(({ q, r }) => ({ q, r }));
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: { name: opts.name ?? 'Untitled scenario' },
    board: { kind: 'inline', orientation: 'flat', hexes: hexes as Scenario['board']['hexes'] },
    elevation: [],
    components: [],
    rules: { ...DEFAULT_RULES },
    goals: [],
  };
};

/** Width/height of a board if it is a full odd-q rectangle anchored at col 0,row 0; else null. */
export const rectangleSize = (s: Scenario): { width: number; height: number } | null => {
  let maxCol = -1;
  let maxRow = -1;
  for (const { q, r } of s.board.hexes) {
    const row = r + (q - (q & 1)) / 2;
    if (q < 0 || row < 0) return null;
    maxCol = Math.max(maxCol, q);
    maxRow = Math.max(maxRow, row);
  }
  const width = maxCol + 1;
  const height = maxRow + 1;
  return width * height === s.board.hexes.length ? { width, height } : null;
};
