import type { ReactNode } from 'react';
import { Brand } from '../molecules/Brand';

export interface SheetLayoutProps {
  /** Buttons on the right of the navy frame (not printed). */
  actions?: ReactNode;
  /** Full-width block above the columns (title, description). */
  intro?: ReactNode;
  board?: ReactNode;
  details?: ReactNode;
  overlay?: ReactNode;
  children?: ReactNode;
}

/**
 * Read-only page: frame header, then board and details side by side (stacked below 900px).
 * Print: no header, single column, board first.
 */
export function SheetLayout({
  actions,
  intro,
  board,
  details,
  overlay,
  children,
}: SheetLayoutProps) {
  return (
    <div className="min-h-full bg-bg print:bg-white">
      <header className="flex flex-wrap items-center gap-1 border-b-2 border-vent bg-frame px-2.5 py-1.5 text-frame-ink print:hidden">
        <a
          href="#/"
          className="rounded-ui focus-visible:outline-vent coarse:flex coarse:min-h-11 coarse:items-center"
          title="Open the editor"
        >
          <Brand />
        </a>
        <span className="flex-1" />
        <nav aria-label="Scenario actions" className="flex flex-wrap items-center gap-1">
          {actions}
        </nav>
      </header>
      <main className="mx-auto max-w-[1400px] p-4 sm:p-6 print:max-w-none print:p-0">
        {intro ? <div className="mb-5 print:mb-3">{intro}</div> : null}
        {board || details ? (
          <div className="grid gap-6 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] print:block">
            <div className="min-w-0 print:mb-3 print:break-inside-avoid">{board}</div>
            <div className="min-w-0 print:columns-2 print:gap-8">{details}</div>
          </div>
        ) : null}
        {children}
      </main>
      {overlay}
    </div>
  );
}
