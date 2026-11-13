import { rectangleSize, type Scenario } from '../../domain/scenario';
import { BOARD } from '../theme';
import { BoardView, boardBounds } from './BoardView';

/** Read-only board for the sheet: the same rendering as the editor and the PNG export. */
export function SheetBoard({ scenario }: { scenario: Scenario }) {
  const size = BOARD.hexSize;
  const b = boardBounds(scenario, size);
  const rect = rectangleSize(scenario);
  const label = rect
    ? `Board, ${rect.width} by ${rect.height} hexes`
    : `Board, ${scenario.board.hexes.length} hexes`;
  return (
    <figure className="deck p-3 chamfer print:bg-white print:bg-none print:p-0 print:[clip-path:none]">
      <svg
        className="mx-auto block max-h-[78vh] w-full print:max-h-[100mm]"
        viewBox={`${b.minX} ${b.minY} ${b.width} ${b.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={label}
      >
        <BoardView scenario={scenario} size={size} />
      </svg>
    </figure>
  );
}
