import type { MouseEvent, ReactNode } from 'react';
import { cn } from '../cn';
import { SiteHeader, type SiteSection } from '../organisms/SiteHeader';
import { navigate, PRIVACY_ROUTE } from '../router';

export interface SiteLayoutProps {
  /** Section to mark as current in the header. */
  current?: SiteSection;
  /** A bar under the header, e.g. a sheet's actions (not printed). */
  toolbar?: ReactNode;
  /** Classes for <main>; the default is a centred column with page padding. */
  mainClassName?: string;
  overlay?: ReactNode;
  children?: ReactNode;
}

/** Site header, page content and footer: the frame of every page except the editor. */
export function SiteLayout({
  current,
  toolbar,
  mainClassName,
  overlay,
  children,
}: SiteLayoutProps) {
  const privacy = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(`#${PRIVACY_ROUTE}`);
  };
  return (
    <div className="flex min-h-full flex-col bg-bg print:block print:bg-white">
      <SiteHeader current={current} />
      {toolbar ? (
        <div className="border-b border-frame-2 bg-frame-2 px-2.5 py-1 text-frame-ink print:hidden">
          {toolbar}
        </div>
      ) : null}
      <main
        className={cn(
          'mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6 print:max-w-none print:p-0',
          mainClassName,
        )}
      >
        {children}
      </main>
      <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted print:hidden">
        Minovsky Maps is an unofficial fan tool, not affiliated with the makers of Gundam Assemble.
        ·{' '}
        <a href={`/#${PRIVACY_ROUTE}`} onClick={privacy} className="underline">
          What we store
        </a>
      </footer>
      {overlay}
    </div>
  );
}
