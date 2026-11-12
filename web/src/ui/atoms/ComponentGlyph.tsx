import type { ReactNode } from 'react';
import type { Point } from '../../domain/hex';
import type { Component, ComponentKind, Owner } from '../../domain/scenario';
import { BOARD, OWNER_COLORS } from '../theme';

/**
 * Original, simple glyphs per component kind (no official artwork). Shapes differ per kind and
 * owned glyphs carry a letter, so kind and side are readable without colour.
 * This is the UI half of the component kind registry: one entry per kind.
 */
export interface GlyphProps {
  center: Point;
  size: number;
  owner: Owner;
  /** Kind-specific detail (upgrade type, objective type). */
  variant?: string;
}

const FONT = 'system-ui, sans-serif';

const Letter = ({ center, size, text, fill }: { center: Point; size: number; text: string; fill: string }) => (
  <text
    x={center.x}
    y={center.y}
    dy="0.36em"
    textAnchor="middle"
    fontSize={size}
    fontWeight="800"
    fill={fill}
    fontFamily={FONT}
  >
    {text}
  </text>
);

const ownerLetter = (o: Owner): string => (o === 'neutral' ? '' : o);

type GlyphRenderer = (p: GlyphProps) => ReactNode;

const base: GlyphRenderer = ({ center, size, owner }) => {
  const c = OWNER_COLORS[owner];
  const r = size * 0.62;
  return (
    <g>
      <circle cx={center.x} cy={center.y} r={r} fill={c.fill} stroke={BOARD.outline} strokeWidth="1.5" />
      <circle cx={center.x} cy={center.y} r={r * 0.72} fill="none" stroke={c.ink} strokeWidth="1.5" />
      <Letter center={center} size={size * 0.5} text={ownerLetter(owner)} fill={c.ink} />
    </g>
  );
};

const garrison: GlyphRenderer = ({ center, size, owner }) => {
  const c = OWNER_COLORS[owner];
  const s = size * 0.78;
  return (
    <g>
      <rect
        x={center.x - s / 2}
        y={center.y - s / 2}
        width={s}
        height={s}
        rx={s * 0.2}
        fill={c.fill}
        stroke={BOARD.outline}
        strokeWidth="1.5"
      />
      <Letter center={center} size={size * 0.42} text={ownerLetter(owner)} fill={c.ink} />
    </g>
  );
};

const UPGRADE_TEXT: Record<string, string> = { shield: 'SH', speed: 'SP', strength: 'ST' };

const upgrade: GlyphRenderer = ({ center, size, variant }) => {
  const s = size * 0.8;
  return (
    <g>
      <rect
        x={center.x - s / 2}
        y={center.y - s / 2}
        width={s}
        height={s}
        rx={2}
        fill={BOARD.upgrade}
        stroke={BOARD.outline}
        strokeWidth="1.5"
      />
      <path
        d={`M${center.x - s / 2} ${center.y - s / 2} L${center.x + s / 2} ${center.y + s / 2} M${center.x + s / 2} ${center.y - s / 2} L${center.x - s / 2} ${center.y + s / 2}`}
        stroke={BOARD.outline}
        strokeOpacity="0.18"
      />
      <Letter center={center} size={size * 0.36} text={UPGRADE_TEXT[variant ?? ''] ?? 'UP'} fill={BOARD.outline} />
    </g>
  );
};

const energy: GlyphRenderer = ({ center, size }) => {
  const r = size * 0.55;
  const pts = [0, 1, 2]
    .map((i) => {
      const a = (-90 + i * 120) * (Math.PI / 180);
      return `${center.x + r * Math.cos(a)},${center.y + r * Math.sin(a)}`;
    })
    .join(' ');
  return (
    <g>
      <polygon points={pts} fill={BOARD.energy} stroke={BOARD.outline} strokeWidth="1.5" strokeLinejoin="round" />
      <Letter center={{ x: center.x, y: center.y + size * 0.08 }} size={size * 0.32} text="E" fill={BOARD.outline} />
    </g>
  );
};

const objective: GlyphRenderer = ({ center, size, variant }) => {
  const r = size * 0.6;
  const d = `M${center.x} ${center.y - r} L${center.x + r} ${center.y} L${center.x} ${center.y + r} L${center.x - r} ${center.y} Z`;
  return (
    <g>
      <path d={d} fill={BOARD.objective} stroke={BOARD.outline} strokeWidth="1.5" />
      {variant === 'carryable' ? (
        <circle cx={center.x} cy={center.y} r={r * 0.3} fill="none" stroke={BOARD.outline} strokeWidth="2" />
      ) : (
        <circle cx={center.x} cy={center.y} r={r * 0.28} fill={BOARD.outline} />
      )}
    </g>
  );
};

const token: GlyphRenderer = ({ center, size, owner }) => {
  const r = size * 0.48;
  const ring = owner === 'neutral' ? BOARD.outline : OWNER_COLORS[owner].fill;
  return (
    <g>
      <circle cx={center.x} cy={center.y} r={r} fill={BOARD.token} stroke={ring} strokeWidth="3" />
      <Letter center={center} size={size * 0.36} text="T" fill="#ffffff" />
    </g>
  );
};

const structure: GlyphRenderer = ({ center, size, owner }) => {
  const c = OWNER_COLORS[owner];
  const w = size * 0.7;
  const h = size * 0.62;
  const top = center.y - h / 2;
  const d = `M${center.x - w / 2} ${center.y + h / 2} L${center.x - w / 2} ${top + h * 0.3} L${center.x} ${top - h * 0.2} L${center.x + w / 2} ${top + h * 0.3} L${center.x + w / 2} ${center.y + h / 2} Z`;
  return (
    <g>
      <path d={d} fill={c.fill} stroke={BOARD.outline} strokeWidth="1.5" strokeLinejoin="round" />
      <Letter center={{ x: center.x, y: center.y + h * 0.12 }} size={size * 0.3} text={ownerLetter(owner) || 'S'} fill={c.ink} />
    </g>
  );
};

/** Carriers span three hexes; their glyph is drawn by CarrierGlyph instead. This is the palette icon. */
const carrierIcon: GlyphRenderer = ({ center, size, owner }) => {
  const c = OWNER_COLORS[owner];
  const w = size * 1.2;
  const h = size * 0.5;
  return (
    <g>
      <path
        d={`M${center.x - w / 2} ${center.y - h / 2} H${center.x + w / 4} L${center.x + w / 2} ${center.y} L${center.x + w / 4} ${center.y + h / 2} H${center.x - w / 2} Z`}
        fill={c.fill}
        stroke={BOARD.outline}
        strokeWidth="1.5"
      />
    </g>
  );
};

export const GLYPHS: Record<ComponentKind, GlyphRenderer> = {
  base,
  carrier: carrierIcon,
  garrison,
  upgrade,
  energy,
  objective,
  token,
  structure,
};

export const glyphVariant = (c: Component): string | undefined =>
  c.kind === 'upgrade' ? c.upgradeType : c.kind === 'objective' ? c.objectiveType : undefined;

export function ComponentGlyph({ kind, ...props }: GlyphProps & { kind: ComponentKind }) {
  return <>{GLYPHS[kind](props)}</>;
}

export interface CarrierGlyphProps {
  front: Point;
  middle: Point;
  back: Point;
  size: number;
  owner: Owner;
}

/** A hull spanning back -> front with a pointed bow, so facing is visible without colour. */
export function CarrierGlyph({ front, middle, back, size, owner }: CarrierGlyphProps) {
  const c = OWNER_COLORS[owner];
  const dx = front.x - back.x;
  const dy = front.y - back.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const half = size * 0.42;
  const bowLen = size * 0.75;
  const sternX = back.x - ux * size * 0.55;
  const sternY = back.y - uy * size * 0.55;
  const shoulderX = front.x - ux * size * 0.1;
  const shoulderY = front.y - uy * size * 0.1;
  const tipX = shoulderX + ux * bowLen;
  const tipY = shoulderY + uy * bowLen;
  const d = [
    `M${sternX + nx * half} ${sternY + ny * half}`,
    `L${shoulderX + nx * half} ${shoulderY + ny * half}`,
    `L${tipX} ${tipY}`,
    `L${shoulderX - nx * half} ${shoulderY - ny * half}`,
    `L${sternX - nx * half} ${sternY - ny * half}`,
    'Z',
  ].join(' ');
  return (
    <g>
      <path d={d} fill={c.fill} stroke={BOARD.outline} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={front.x} cy={front.y} r={size * 0.14} fill={c.ink} />
      <Letter center={middle} size={size * 0.5} text={owner} fill={c.ink} />
    </g>
  );
}
