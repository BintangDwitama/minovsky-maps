/**
 * Flat-top hex grid math in axial coordinates.
 * Reference: Red Blob Games, "Hexagonal Grids" (flat-top, axial, odd-q offset).
 */

export interface Axial {
  readonly q: number;
  readonly r: number;
}

export interface Offset {
  readonly col: number;
  readonly row: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Hex direction index for flat-top hexes: 0 = N, then clockwise. */
export type Direction = 0 | 1 | 2 | 3 | 4 | 5;

export const DIRECTIONS: readonly Axial[] = [
  { q: 0, r: -1 }, // 0 N
  { q: 1, r: -1 }, // 1 NE
  { q: 1, r: 0 }, // 2 SE
  { q: 0, r: 1 }, // 3 S
  { q: -1, r: 1 }, // 4 SW
  { q: -1, r: 0 }, // 5 NW
];

export const DIRECTION_NAMES = ['N', 'NE', 'SE', 'S', 'SW', 'NW'] as const;

export type HexKey = string;

export const hexKey = (h: Axial): HexKey => `${h.q},${h.r}`;

export const parseHexKey = (k: HexKey): Axial => {
  const [q, r] = k.split(',').map(Number);
  return { q: q ?? 0, r: r ?? 0 };
};

export const hexEquals = (a: Axial, b: Axial): boolean => a.q === b.q && a.r === b.r;

export const hexAdd = (a: Axial, b: Axial): Axial => ({ q: a.q + b.q, r: a.r + b.r });

export const toDirection = (n: number): Direction => ((((n % 6) + 6) % 6) as Direction);

export const opposite = (d: Direction): Direction => toDirection(d + 3);

export const neighbor = (h: Axial, d: Direction): Axial => hexAdd(h, DIRECTIONS[d]!);

export const neighbors = (h: Axial): Axial[] => DIRECTIONS.map((d) => hexAdd(h, d));

export const distance = (a: Axial, b: Axial): number => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

/* ---------- odd-q offset (flat-top, odd columns shifted down; column 0 sits higher) ---------- */

export const offsetToAxial = ({ col, row }: Offset): Axial => ({
  q: col,
  r: row - (col - (col & 1)) / 2,
});

export const axialToOffset = ({ q, r }: Axial): Offset => ({
  col: q,
  row: r + (q - (q & 1)) / 2,
});

/** All hexes of a rectangular W x H board in odd-q layout, column-major order. */
export const rectangleHexes = (width: number, height: number): Axial[] => {
  const out: Axial[] = [];
  for (let col = 0; col < width; col++) {
    for (let row = 0; row < height; row++) {
      out.push(offsetToAxial({ col, row }));
    }
  }
  return out;
};

/* ---------- pixel conversion (flat-top) ---------- */

const SQRT3 = Math.sqrt(3);

/** Centre of a hex in pixels, for hexes with circumradius `size`. */
export const axialToPixel = ({ q, r }: Axial, size: number): Point => ({
  x: size * 1.5 * q,
  y: size * SQRT3 * (r + q / 2),
});

export const pixelToFractional = ({ x, y }: Point, size: number): { q: number; r: number } => ({
  q: ((2 / 3) * x) / size,
  r: ((-1 / 3) * x + (SQRT3 / 3) * y) / size,
});

export const hexRound = (frac: { q: number; r: number }): Axial => {
  const s = -frac.q - frac.r;
  let q = Math.round(frac.q);
  let r = Math.round(frac.r);
  const rs = Math.round(s);
  const dq = Math.abs(q - frac.q);
  const dr = Math.abs(r - frac.r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) q = -r - rs;
  else if (dr > ds) r = -q - rs;
  // normalise -0
  return { q: q + 0, r: r + 0 };
};

export const pixelToAxial = (p: Point, size: number): Axial =>
  hexRound(pixelToFractional(p, size));

/** The six corners of a flat-top hex centred at `c`, starting at the east corner. */
export const hexCorners = (c: Point, size: number): Point[] =>
  Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i);
    return { x: c.x + size * Math.cos(angle), y: c.y + size * Math.sin(angle) };
  });
