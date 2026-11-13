import type { ReactNode } from 'react';
import { cn } from '../cn';

export function Badge({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'warning';
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-block min-w-4.5 rounded-full px-1.5 py-px text-center text-tiny',
        tone === 'warning' ? 'bg-warning-bg text-warning-text' : 'bg-panel-2 text-muted',
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-block rounded border border-b-2 border-border px-1 font-mono text-tiny text-muted">
      {children}
    </kbd>
  );
}

export function Swatch({ color, pattern }: { color: string; pattern?: string }) {
  return (
    <svg
      className="inline-block size-3.5 flex-none rounded-[3px] border border-black/25"
      viewBox="0 0 14 14"
      aria-hidden
    >
      <rect width="14" height="14" fill={pattern ? `url(#${pattern})` : color} />
    </svg>
  );
}
