import { useEffect, useMemo, useRef, useState } from 'react';
import { rectangleSize } from '../../domain/scenario';
import { loadScenario } from '../../domain/serialization';
import { BOARD } from '../theme';
import { BoardView, boardBounds } from './BoardView';

/**
 * A small, read-only picture of a scenario's board (same rendering as the sheet). It draws only
 * once scrolled into view, so a page of cards stays light on phones.
 */
export function BoardThumbnail({ doc }: { doc: unknown }) {
  const loaded = useMemo(() => loadScenario(doc), [doc]);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  const size = BOARD.hexSize;
  const scenario = loaded.ok ? loaded.scenario : null;
  const rect = scenario ? rectangleSize(scenario) : null;
  const label = !scenario
    ? 'Board preview unavailable'
    : rect
      ? `Board, ${rect.width} by ${rect.height} hexes`
      : `Board, ${scenario.board.hexes.length} hexes`;

  return (
    <div ref={ref} className="aspect-[4/3] w-full deck p-2" data-testid="board-thumbnail">
      {scenario && visible ? (
        <svg
          className="block size-full"
          viewBox={(() => {
            const b = boardBounds(scenario, size);
            return `${b.minX} ${b.minY} ${b.width} ${b.height}`;
          })()}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={label}
        >
          <BoardView scenario={scenario} size={size} />
        </svg>
      ) : (
        <div role="img" aria-label={label} className="size-full" />
      )}
    </div>
  );
}
