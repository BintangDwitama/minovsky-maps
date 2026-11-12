/**
 * Board colours as literals: board SVG must be self-contained so it rasterises identically in the
 * PNG export (an <img>-loaded SVG can't see page CSS variables). Mirrors styles/tokens.css.
 */
import type { Owner, TerrainTag } from '../domain/scenario';

export const BOARD = {
  hexSize: 28,
  ground: '#e9dcc3',
  stroke: '#b9a888',
  elevation: ['#e9dcc3', '#c9a77a', '#a97f50', '#8a6237', '#6b4826'] as const,
  elevationInk: '#ffffff',
  energy: '#f0c419',
  upgrade: '#c7ccd4',
  objective: '#fafafa',
  token: '#7e57c2',
  outline: '#1b1d21',
  select: '#ffd400',
  warning: '#ff3b3b',
  background: '#23262d',
  title: '#ffffff',
} as const;

export const OWNER_COLORS: Record<Owner, { fill: string; ink: string }> = {
  A: { fill: '#0072b2', ink: '#ffffff' },
  B: { fill: '#d55e00', ink: '#ffffff' },
  neutral: { fill: '#8a8f98', ink: '#1b1d21' },
};

export const TERRAIN_COLORS: Record<TerrainTag, string> = {
  water: '#56b4e9',
  debris: '#7d6b55',
  impassable: '#2b2b2e',
  minovsky: '#cc79a7',
};

export const TERRAIN_LABELS: Record<TerrainTag, string> = {
  water: 'Water',
  debris: 'Debris field',
  impassable: 'Impassable',
  minovsky: 'Minovsky particles',
};

export const elevationFill = (level: number): string =>
  BOARD.elevation[Math.min(level, BOARD.elevation.length - 1)]!;
