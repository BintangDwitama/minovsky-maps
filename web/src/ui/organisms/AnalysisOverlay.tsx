import type { AnalysisSettings } from '../../application/uiState';
import { traceSightLine } from '../../domain/analysis/lineOfSight';
import { type Axial, axialToPixel, hexEquals, parseHexKey } from '../../domain/hex';
import type { Scenario } from '../../domain/scenario';
import { HexPolygon } from '../atoms/HexPolygon';
import { useAnalysis } from '../hooks/useAnalysis';
import { BOARD, OWNER_COLORS } from '../theme';

const HIDDEN_PATTERN = 'mm-analysis-hidden';
const REACH = '#f2b705';

export interface AnalysisOverlayProps {
  scenario: Scenario;
  analysis: AnalysisSettings;
  hover: Axial | null;
  size: number;
}

/**
 * Line-of-sight and reach overlays for the Analyse tool. Drawn only by the interactive board
 * (never in exports). Hidden hexes are hatched and reachable hexes carry their cost, so neither
 * relies on colour alone.
 */
export function AnalysisOverlay({ scenario, analysis, hover, size }: AnalysisOverlayProps) {
  const result = useAnalysis(scenario, analysis);
  if (!result || !analysis.probe) return null;
  const probe = analysis.probe;
  const c = (h: Axial) => axialToPixel(h, size);
  const pc = c(probe);

  const hidden = result.visible
    ? [...result.visible].filter(([, v]) => !v).map(([k]) => parseHexKey(k))
    : [];
  const reachable = result.reach
    ? [...result.reach.costs].map(([k, cost]) => ({ h: parseHexKey(k), cost }))
    : [];

  const sight =
    hover && !hexEquals(hover, probe) && result.index.onBoard(hover)
      ? traceSightLine(result.index, probe, analysis.side, hover)
      : null;
  const hc = hover ? c(hover) : null;
  const owner = OWNER_COLORS[analysis.side];

  return (
    <g pointerEvents="none" aria-hidden data-testid="analysis-overlay">
      <defs>
        <pattern
          id={HIDDEN_PATTERN}
          width={7}
          height={7}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={7} height={7} fill="rgba(12, 15, 22, 0.42)" />
          <line x1={0} y1={0} x2={0} y2={7} stroke="rgba(12, 15, 22, 0.75)" strokeWidth={3} />
        </pattern>
      </defs>

      {hidden.map((h) => (
        <HexPolygon
          key={`h${h.q},${h.r}`}
          center={c(h)}
          size={size - 1}
          fill={`url(#${HIDDEN_PATTERN})`}
          className="analysis-hidden"
        />
      ))}

      {reachable.map(({ h, cost }) => {
        const p = c(h);
        return (
          <g key={`r${h.q},${h.r}`} className="analysis-reach">
            <HexPolygon
              center={p}
              size={size - 3}
              fill="rgba(242, 183, 5, 0.28)"
              stroke={REACH}
              strokeWidth={2}
            />
            <text
              x={p.x}
              y={p.y + size * 0.62}
              textAnchor="middle"
              fontSize={size * 0.36}
              fontWeight="700"
              fill="#1b1d21"
              stroke="#ffffff"
              strokeWidth={3}
              paintOrder="stroke"
              fontFamily="system-ui, sans-serif"
            >
              {cost}
            </text>
          </g>
        );
      })}

      {sight && hc ? (
        <>
          {sight.blocker ? (
            <HexPolygon
              center={c(sight.blocker.hex)}
              size={size - 2}
              fill="none"
              stroke={BOARD.warning}
              strokeWidth={3.5}
            />
          ) : null}
          <line
            x1={pc.x}
            y1={pc.y}
            x2={hc.x}
            y2={hc.y}
            stroke={sight.visible ? '#ffffff' : BOARD.warning}
            strokeWidth={3}
            strokeDasharray={sight.visible ? undefined : '8 6'}
            strokeLinecap="round"
          />
        </>
      ) : null}

      <g data-testid="analysis-probe">
        <circle cx={pc.x} cy={pc.y} r={size * 0.58} fill="none" stroke="#ffffff" strokeWidth={5} />
        <circle
          cx={pc.x}
          cy={pc.y}
          r={size * 0.58}
          fill="none"
          stroke={owner.fill}
          strokeWidth={3}
        />
        <circle
          cx={pc.x}
          cy={pc.y}
          r={size * 0.28}
          fill={owner.fill}
          stroke="#ffffff"
          strokeWidth={1.5}
        />
        <text
          x={pc.x}
          y={pc.y}
          dy="0.35em"
          textAnchor="middle"
          fontSize={size * 0.34}
          fontWeight="800"
          fill={owner.ink}
          fontFamily="system-ui, sans-serif"
        >
          {analysis.side}
        </text>
      </g>
    </g>
  );
}
