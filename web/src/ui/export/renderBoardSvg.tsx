import { renderToStaticMarkup } from 'react-dom/server';
import type { Scenario } from '../../domain/scenario';
import type { RenderedSvg } from '../../infrastructure/svgPngExporter';
import { BoardView, boardBounds } from '../organisms/BoardView';
import { BOARD } from '../theme';

/**
 * Self-contained SVG of the board for export: same atoms as the editor, no selection/hover/warning
 * overlays, plus the scenario name as a title strip.
 */
export const renderBoardSvg = (s: Scenario): RenderedSvg => {
  const size = BOARD.hexSize;
  const b = boardBounds(s, size);
  const titleH = size * 1.6;
  const width = b.width;
  const height = b.height + titleH;
  const markup = renderToStaticMarkup(
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`${b.minX} ${b.minY - titleH} ${width} ${height}`}
    >
      <rect x={b.minX} y={b.minY - titleH} width={width} height={height} fill={BOARD.background} />
      <text
        x={b.minX + size * 0.8}
        y={b.minY - titleH / 2}
        dy="0.35em"
        fontSize={size * 0.8}
        fontWeight="700"
        fill={BOARD.title}
        fontFamily="system-ui, sans-serif"
      >
        {s.meta.name}
        {s.meta.author ? ` — ${s.meta.author}` : ''}
      </text>
      <BoardView scenario={s} size={size} />
    </svg>,
  );
  return { markup, width, height };
};
