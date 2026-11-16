import type { ReactNode } from 'react';
import { SiteLayout } from './SiteLayout';

export interface SheetLayoutProps {
  /** Scenario actions, in a bar under the site header (not printed). */
  actions?: ReactNode;
  /** Full-width block above the columns (title, description). */
  intro?: ReactNode;
  board?: ReactNode;
  details?: ReactNode;
  overlay?: ReactNode;
  children?: ReactNode;
}

/**
 * Read-only scenario page: site header and actions bar, then board and details side by side
 * (stacked below 900px). Print: no header or bars, single column, board first.
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
    <SiteLayout
      overlay={overlay}
      toolbar={
        actions ? (
          <nav aria-label="Scenario actions" className="flex flex-wrap items-center gap-1">
            {actions}
          </nav>
        ) : null
      }
    >
      {intro ? <div className="mb-5 print:mb-3">{intro}</div> : null}
      {board || details ? (
        <div className="grid gap-6 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] print:block">
          <div className="min-w-0 print:mb-3 print:break-inside-avoid">{board}</div>
          <div className="min-w-0 print:columns-2 print:gap-8">{details}</div>
        </div>
      ) : null}
      {children}
    </SiteLayout>
  );
}
