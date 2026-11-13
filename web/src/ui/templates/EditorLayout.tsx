import { useState, type DragEvent, type ReactNode } from 'react';

export interface EditorLayoutProps {
  toolbar: ReactNode;
  left: ReactNode;
  board: ReactNode;
  right: ReactNode;
  status: ReactNode;
  overlay?: ReactNode;
  onFileDrop?(file: File): void;
}

/**
 * Toolbar on top, tools left, board centre, panels right, status bar bottom.
 * Side panels only scroll vertically; their content must fit their fixed widths.
 * Below 900px everything stacks in one column.
 */
export function EditorLayout({
  toolbar,
  left,
  board,
  right,
  status,
  overlay,
  onFileDrop,
}: EditorLayoutProps) {
  const [dragging, setDragging] = useState(false);
  const hasFile = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

  return (
    <div
      className="grid h-full min-h-0 grid-cols-[220px_minmax(0,1fr)_320px] grid-rows-[auto_minmax(0,1fr)_auto] [grid-template-areas:'toolbar_toolbar_toolbar'_'left_board_right'_'status_status_status'] max-[900px]:h-auto max-[900px]:grid-cols-[minmax(0,1fr)] max-[900px]:grid-rows-[auto_60vh_auto_auto_auto] max-[900px]:[grid-template-areas:'toolbar'_'board'_'left'_'right'_'status']"
      onDragOver={(e) => {
        if (!onFileDrop || !hasFile(e)) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setDragging(false);
      }}
      onDrop={(e) => {
        if (!onFileDrop || !hasFile(e)) return;
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) onFileDrop(f);
      }}
    >
      <div className="[grid-area:toolbar]">{toolbar}</div>
      <aside
        className="min-w-0 overflow-x-hidden overflow-y-auto border-r border-border bg-panel p-2.5 [grid-area:left]"
        aria-label="Tools"
      >
        {left}
      </aside>
      <main className="relative min-h-0 min-w-0 deck [grid-area:board]">
        {board}
        {dragging ? (
          <div className="pointer-events-none absolute inset-3 grid place-items-center rounded-xl border-2 border-dashed border-accent bg-black/45 text-lg text-white">
            Drop a .scenario.json file to open it
          </div>
        ) : null}
      </main>
      <aside
        className="min-w-0 overflow-x-hidden overflow-y-auto border-l border-border bg-panel [grid-area:right]"
        aria-label="Scenario panels"
      >
        {right}
      </aside>
      <div className="[grid-area:status]">{status}</div>
      {overlay}
    </div>
  );
}
