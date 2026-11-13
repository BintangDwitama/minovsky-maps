import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface PanelSectionProps {
  /** Heading content; extra elements (badge, action button) are pushed to the right. */
  title: ReactNode;
  /** Muted body text, for empty states. */
  muted?: boolean;
  className?: string;
  children?: ReactNode;
}

/** One armour plate of the right-hand panel, separated from the next by an engraved line. */
export function PanelSection({ title, muted, className, children }: PanelSectionProps) {
  return (
    <section
      className={cn('min-w-0 p-3 panel-line', muted && 'text-ui text-muted', className)}
      data-empty={muted || undefined}
    >
      <h2 className="mb-2.5 flex min-h-6 items-center justify-between gap-2 text-head font-semibold text-text font-stretch-condensed">
        {title}
      </h2>
      {children}
    </section>
  );
}
