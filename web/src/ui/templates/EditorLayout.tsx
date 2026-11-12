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

/** Toolbar on top, tools left, board centre, panels right, status bar bottom. */
export function EditorLayout({ toolbar, left, board, right, status, overlay, onFileDrop }: EditorLayoutProps) {
  const [dragging, setDragging] = useState(false);
  const hasFile = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

  return (
    <div
      className={`layout${dragging ? ' layout--dragging' : ''}`}
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
      <div className="layout__toolbar">{toolbar}</div>
      <aside className="layout__left" aria-label="Tools">
        {left}
      </aside>
      <main className="layout__board">{board}</main>
      <aside className="layout__right" aria-label="Scenario panels">
        {right}
      </aside>
      <div className="layout__status">{status}</div>
      {overlay}
    </div>
  );
}
