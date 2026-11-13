import { Fragment, memo, useMemo } from 'react';
import { carrierHexes, footprint } from '../../domain/components/registry';
import { type Axial, axialToPixel, hexKey, type Point } from '../../domain/hex';
import type { Component, Scenario } from '../../domain/scenario';
import { buildIndex } from '../../domain/scenarioIndex';
import { CarrierGlyph, ComponentGlyph, glyphVariant } from '../atoms/ComponentGlyph';
import { HexPolygon } from '../atoms/HexPolygon';
import { TerrainPatternDefs } from '../atoms/TerrainPattern';
import { HexCell } from '../molecules/HexCell';
import { BOARD } from '../theme';

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

export const boardBounds = (s: Scenario, size: number, pad = size * 1.2): Bounds => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const h of s.board.hexes) {
    const p = axialToPixel(h, size);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    minX: minX - size - pad,
    minY: minY - size - pad,
    width: maxX - minX + 2 * (size + pad),
    height: maxY - minY + 2 * (size + pad),
  };
};

export interface BoardViewProps {
  scenario: Scenario;
  size: number;
  selectedId?: string | null;
  highlight?: readonly Axial[];
  hover?: Axial | null;
  /** Keyboard cursor (drawn only while the board has keyboard focus). */
  cursor?: Axial | null;
}

const LABEL_KINDS = new Set(['token', 'structure', 'objective']);

/**
 * Pure, props-only rendering of a scenario as SVG content (no <svg> wrapper).
 * Used by the interactive HexBoard and the PNG export (overlay props omitted there).
 */
export const BoardView = memo(function BoardView({ scenario, size, selectedId, highlight, hover, cursor }: BoardViewProps) {
  const idx = buildIndex(scenario);
  const center = (h: Axial): Point => axialToPixel(h, size);

  // single-hex components: offset when several share a hex so all stay visible
  const placed = useMemo(() => {
    const perHex = new Map<string, Component[]>();
    for (const c of scenario.components) {
      if (c.kind === 'carrier') continue;
      const k = hexKey(c.hex);
      const list = perHex.get(k);
      if (list) list.push(c);
      else perHex.set(k, [c]);
    }
    const out: { c: Component; at: Point; scale: number }[] = [];
    for (const list of perHex.values()) {
      const n = list.length;
      list.forEach((c, i) => {
        const base = axialToPixel(c.hex, size);
        const shift = n > 1 ? (i - (n - 1) / 2) * size * 0.42 : 0;
        out.push({ c, at: { x: base.x + shift, y: base.y - shift * 0.35 }, scale: n > 1 ? 0.75 : 1 });
      });
    }
    return out;
  }, [scenario.components, size]);

  const carriers = scenario.components.filter((c) => c.kind === 'carrier');
  const selected = selectedId ? idx.componentById.get(selectedId) : undefined;

  return (
    <g>
      <TerrainPatternDefs />
      <g>
        {scenario.board.hexes.map((h) => {
          const k = hexKey(h);
          return (
            <HexCell
              key={k}
              center={center(h)}
              size={size}
              tags={h.tags ?? []}
              level={idx.elevationByHex.get(k) ?? 0}
            />
          );
        })}
      </g>

      <g>
        {carriers.map((c) => {
          if (c.kind !== 'carrier') return null;
          const { front, middle, back } = carrierHexes(c.hex, c.facing);
          return (
            <CarrierGlyph
              key={c.id}
              front={center(front)}
              middle={center(middle)}
              back={center(back)}
              size={size}
              owner={c.owner}
            />
          );
        })}
        {placed.map(({ c, at, scale }) => (
          <Fragment key={c.id}>
            <ComponentGlyph kind={c.kind} center={at} size={size * scale} owner={c.owner} variant={glyphVariant(c)} />
            {LABEL_KINDS.has(c.kind) && 'label' in c && c.label ? (
              <text
                x={at.x}
                y={at.y + size * 0.62 * scale + size * 0.32}
                textAnchor="middle"
                fontSize={size * 0.32}
                fontWeight="600"
                fill="#1b1d21"
                stroke="#ffffff"
                strokeWidth={3}
                paintOrder="stroke"
                fontFamily="system-ui, sans-serif"
              >
                {c.label.length > 16 ? `${c.label.slice(0, 15)}…` : c.label}
              </text>
            ) : null}
          </Fragment>
        ))}
      </g>

      {/* overlays: hover, warnings, selection (omitted in exports) */}
      <g pointerEvents="none">
        {hover && idx.hexes.has(hexKey(hover)) ? (
          <HexPolygon center={center(hover)} size={size - 2} fill="rgba(255,255,255,0.22)" stroke="#ffffff" strokeWidth={2} />
        ) : null}
        {(highlight ?? []).map((h) => (
          <HexPolygon key={`w-${hexKey(h)}`} center={center(h)} size={size - 2} fill="none" stroke={BOARD.warning} strokeWidth={3} />
        ))}
        {selected
          ? footprint(selected).map((h) => (
              <HexPolygon key={`s-${hexKey(h)}`} center={center(h)} size={size - 1.5} fill="none" stroke={BOARD.select} strokeWidth={3} />
            ))
          : null}
        {cursor && idx.hexes.has(hexKey(cursor)) ? (
          // two-tone ring: visible on light ground and dark elevation alike, no colour needed
          <g data-testid="board-cursor">
            <HexPolygon center={center(cursor)} size={size - 1} fill="none" stroke="#161d2b" strokeWidth={6} />
            <HexPolygon center={center(cursor)} size={size - 1} fill="none" stroke={BOARD.select} strokeWidth={2.5} />
          </g>
        ) : null}
      </g>
    </g>
  );
});