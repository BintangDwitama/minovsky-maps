import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { Scenario } from '../../domain/scenario';
import { IconButton } from '../atoms/Button';
import { useBoardViewport } from '../hooks/useBoardViewport';
import { BOARD } from '../theme';
import type { View } from '../viewport';
import { BoardView, boardBounds } from './BoardView';

export interface BoardZoomViewProps {
  scenario: Scenario;
  label: string;
  onClose(): void;
}

/**
 * The board alone, full screen, for reading small labels on a phone: drag to pan, pinch or wheel
 * to zoom, plus zoom buttons. Read-only. Sits over the page, so the page keeps its scroll position.
 */
export function BoardZoomView({ scenario, label, onClose }: BoardZoomViewProps) {
  const size = BOARD.hexSize;
  const bounds = useMemo(() => boardBounds(scenario, size), [scenario, size]);
  const svgRef = useRef<SVGSVGElement>(null);
  const closeRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ zoom: 1, pan: { x: 0, y: 0 } });
  const viewRef = useRef(view);
  viewRef.current = view;
  const vp = useBoardViewport({
    svgRef,
    bounds,
    getView: () => viewRef.current,
    setView: (v) => {
      viewRef.current = v;
      setView(v);
    },
  });

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.querySelector('button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  const down = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (vp.track(e) === 1) vp.startPan(e.pointerId);
  };
  const up = (e: PointerEvent<SVGSVGElement>) => vp.release(e.pointerId);

  return (
    <div
      className="fixed inset-0 z-40 deck print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-testid="board-zoom"
    >
      <svg
        ref={svgRef}
        className="block size-full cursor-grab touch-none select-none"
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={label}
        onPointerDown={down}
        onPointerMove={(e) => vp.move(e)}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <g transform={`translate(${view.pan.x} ${view.pan.y}) scale(${view.zoom})`}>
          <BoardView scenario={scenario} size={size} />
        </g>
      </svg>
      <div ref={closeRef} className="absolute top-2.5 right-2.5">
        <IconButton
          className="bg-panel"
          icon="close"
          label="Close enlarged board"
          onClick={onClose}
        />
      </div>
      <div className="absolute right-2.5 bottom-2.5 flex gap-1">
        <IconButton
          className="bg-panel"
          icon="zoomIn"
          label="Zoom in"
          onClick={() => vp.zoomAt(1.25)}
        />
        <IconButton
          className="bg-panel"
          icon="zoomOut"
          label="Zoom out"
          onClick={() => vp.zoomAt(1 / 1.25)}
        />
        <IconButton className="bg-panel" icon="fit" label="Fit board" onClick={vp.fit} />
      </div>
    </div>
  );
}
