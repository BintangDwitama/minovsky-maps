import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { rectangleSize, type Scenario } from '../../domain/scenario';
import { Button } from '../atoms/Button';
import { BOARD } from '../theme';
import { BoardView, boardBounds } from './BoardView';
import { BoardZoomView } from './BoardZoomView';

/** Read-only board for the sheet: the same rendering as the editor and the PNG export. */
export function SheetBoard({ scenario }: { scenario: Scenario }) {
  const [enlarged, setEnlarged] = useState(false);
  const close = useCallback(() => setEnlarged(false), []);
  const size = BOARD.hexSize;
  const b = boardBounds(scenario, size);
  const rect = rectangleSize(scenario);
  const label = rect
    ? `Board, ${rect.width} by ${rect.height} hexes`
    : `Board, ${scenario.board.hexes.length} hexes`;
  return (
    <figure className="relative deck p-3 chamfer print:bg-white print:bg-none print:p-0 print:[clip-path:none]">
      <svg
        className="mx-auto block max-h-[78vh] w-full print:max-h-[100mm]"
        viewBox={`${b.minX} ${b.minY} ${b.width} ${b.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={label}
      >
        <BoardView scenario={scenario} size={size} />
      </svg>
      <Button
        icon="enlarge"
        className="absolute right-2.5 bottom-2.5 bg-panel print:hidden"
        onClick={() => setEnlarged(true)}
        title="Show the board full screen and zoom in"
      >
        Enlarge board
      </Button>
      {/* portal: the figure's chamfer clip-path would clip a fixed overlay */}
      {enlarged
        ? createPortal(
            <BoardZoomView scenario={scenario} label={label} onClose={close} />,
            document.body,
          )
        : null}
    </figure>
  );
}
